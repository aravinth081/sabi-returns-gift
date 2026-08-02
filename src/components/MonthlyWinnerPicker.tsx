import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Gift, Calendar, Trophy, Phone, Sparkles, Volume2, VolumeX, Play, RotateCcw, X, ChevronDown, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/firebase';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';

interface Order {
  id: number;
  fireId?: string;
  name: string;
  phone: string;
  orderDate: string;
  deliveryDate?: string;
  functionDate?: string;
  chocolate?: string;
  count?: number;
  orderType?: string;
}

interface MonthlyWinnerPickerProps {
  orders: Order[];
  onClose?: () => void;
}

interface Customer {
  name: string;
  phone: string;
}

// Web Audio Synth Helpers
class AudioSynthManager {
  private audioCtx: AudioContext | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;
  private rollInterval: any = null;

  private initCtx() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  startDrumroll() {
    try {
      this.initCtx();
      if (!this.audioCtx) return;

      const bufferSize = this.audioCtx.sampleRate * 2; // 2s loop buffer
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      this.noiseNode = this.audioCtx.createBufferSource();
      this.noiseNode.buffer = buffer;
      this.noiseNode.loop = true;

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(160, this.audioCtx.currentTime);

      this.noiseGain = this.audioCtx.createGain();
      this.noiseGain.gain.setValueAtTime(0.02, this.audioCtx.currentTime);

      this.noiseNode.connect(filter);
      filter.connect(this.noiseGain);
      this.noiseGain.connect(this.audioCtx.destination);

      this.noiseNode.start();

      // Modulate gain to sound like a snare drum roll
      let toggle = false;
      this.rollInterval = setInterval(() => {
        if (!this.noiseGain || !this.audioCtx) return;
        const volume = toggle ? 0.08 : 0.03;
        this.noiseGain.gain.setValueAtTime(volume + Math.random() * 0.03, this.audioCtx.currentTime);
        toggle = !toggle;
      }, 50);

    } catch (e) {
      console.warn("Drumroll audio error:", e);
    }
  }

  stopDrumroll() {
    try {
      if (this.rollInterval) {
        clearInterval(this.rollInterval);
        this.rollInterval = null;
      }
      if (this.noiseNode) {
        this.noiseNode.stop();
        this.noiseNode.disconnect();
        this.noiseNode = null;
      }
      if (this.noiseGain) {
        this.noiseGain.disconnect();
        this.noiseGain = null;
      }
    } catch (e) {
      // Ignore
    }
  }

  playWinnerChime() {
    try {
      this.initCtx();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      // Play a beautiful arpeggio chord (C Major: C5 -> E5 -> G5 -> C6)
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = this.audioCtx!.createOscillator();
        const gainNode = this.audioCtx!.createGain();

        osc.type = 'triangle';
        osc.frequency.value = freq;

        const delay = idx * 0.15;
        gainNode.gain.setValueAtTime(0, now + delay);
        gainNode.gain.linearRampToValueAtTime(0.2, now + delay + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + delay + 1.2);

        osc.connect(gainNode);
        gainNode.connect(this.audioCtx!.destination);

        osc.start(now + delay);
        osc.stop(now + delay + 1.3);
      });

      // Booming gong base note
      const baseOsc = this.audioCtx.createOscillator();
      const baseGain = this.audioCtx.createGain();
      baseOsc.type = 'sine';
      baseOsc.frequency.setValueAtTime(130.81, now); // C3
      baseGain.gain.setValueAtTime(0.35, now);
      baseGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

      baseOsc.connect(baseGain);
      baseGain.connect(this.audioCtx.destination);
      baseOsc.start(now);
      baseOsc.stop(now + 2.1);

    } catch (e) {
      console.warn("Victory audio chime error:", e);
    }
  }
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  rotation?: number;
  rotationSpeed?: number;
  shape?: 'circle' | 'square';
}

export default function MonthlyWinnerPicker({ orders, onClose }: MonthlyWinnerPickerProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [cashbackAmount, setCashbackAmount] = useState<string>('1,000');
  const [isPicking, setIsPicking] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(10);
  const [currentCandidate, setCurrentCandidate] = useState<Customer | null>(null);
  const [winner, setWinner] = useState<Customer | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [drawSource, setDrawSource] = useState<'orders' | 'manual'>('orders');
  const [manualInput, setManualInput] = useState<string>('');
  const [isMonthSelectOpen, setIsMonthSelectOpen] = useState<boolean>(false);
  
  const [pastWinners, setPastWinners] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const synthRef = useRef<AudioSynthManager>(new AudioSynthManager());
  const shuffleTimerRef = useRef<any>(null);
  const countdownTimerRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Subscribe to monthly winners database records
  useEffect(() => {
    const q = query(collection(db, "monthly_winners"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPastWinners(list);
    }, (err) => {
      console.error("Error listening to monthly_winners collection:", err);
    });
    return () => unsubscribe();
  }, []);

  // Save drawn winner record to Firestore database
  const saveWinnerToDb = async (winnerObj: Customer, monthName: string, source: 'orders' | 'manual') => {
    try {
      await addDoc(collection(db, "monthly_winners"), {
        name: winnerObj.name,
        phone: winnerObj.phone || '',
        month: source === 'orders' ? monthName : 'Manual List',
        drawSource: source,
        prize: `₹${cashbackAmount} Cashback`,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error("Error saving winner record to database:", e);
      toast.error("Failed to save winner to database history.");
    }
  };

  // Delete a winner record from database
  const deleteWinnerEntry = async (id: string) => {
    try {
      await deleteDoc(doc(db, "monthly_winners", id));
      toast.success("Winner record deleted.");
    } catch (e) {
      console.error("Error deleting winner record:", e);
      toast.error("Failed to delete winner record from database.");
    }
  };

  // Clear all winners history from database
  const clearAllWinners = async () => {
    if (!window.confirm("Are you sure you want to delete the entire winner draw history? This cannot be undone.")) return;
    try {
      const promises = pastWinners.map(item => deleteDoc(doc(db, "monthly_winners", item.id)));
      await Promise.all(promises);
      toast.success("All winner draw history cleared successfully.");
    } catch (e) {
      console.error("Error clearing winners history:", e);
      toast.error("Failed to clear winner history from database.");
    }
  };

  // Helper: extract month from order date string (e.g. "14 Jul 2026", "14 Jul", "2026-07-15")
  const getMonthFromDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const orderOfMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    // 1. Try to parse with JavaScript Date
    const parsedDate = new Date(dateStr);
    if (!isNaN(parsedDate.getTime())) {
      return orderOfMonths[parsedDate.getMonth()];
    }

    // 2. Fallback: Search for short month substring
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const fullMonths: Record<string, string> = {
      jan: 'January', feb: 'February', mar: 'March', apr: 'April', may: 'May', jun: 'June',
      jul: 'July', aug: 'August', sep: 'September', oct: 'October', nov: 'November', dec: 'December'
    };
    const normalized = dateStr.toLowerCase();
    for (const m of months) {
      if (normalized.includes(m)) {
        return fullMonths[m];
      }
    }
    return '';
  };

  // Filter unique customers for selected month from Dashboard 1 and 2
  const monthlyCustomers = useMemo(() => {
    if (!selectedMonth) return [];
    
    const dedupedMap = new Map<string, Customer>();
    orders.forEach(order => {
      const m = getMonthFromDate(order.orderDate || order.deliveryDate || order.functionDate || '');
      if (m === selectedMonth && order.name && order.phone) {
        const cleanPhone = order.phone.trim();
        const cleanName = order.name.trim();
        
        // Exclude obviously placeholder names or empty names, but match any real saved customer
        const isPlaceholder = cleanName.toLowerCase() === 'self' || cleanName.toLowerCase() === 'sabi' || cleanName.toLowerCase() === 'others';
        if (cleanName && cleanPhone && !isPlaceholder) {
          const key = `${cleanName.toLowerCase()}_${cleanPhone}`;
          if (!dedupedMap.has(key)) {
            dedupedMap.set(key, { name: cleanName, phone: cleanPhone });
          }
        }
      }
    });
    
    return Array.from(dedupedMap.values());
  }, [selectedMonth, orders]);

  // Filter unique manual candidates list
  const manualCustomers = useMemo(() => {
    if (!manualInput.trim()) return [];
    const lines = manualInput.split('\n');
    const parsed: Customer[] = [];
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      let name = '';
      let phone = '';
      
      const separators = [',', '-', '/', '\t'];
      let splitSuccess = false;
      for (const sep of separators) {
        if (trimmed.includes(sep)) {
          const parts = trimmed.split(sep);
          name = parts[0]?.trim() || '';
          phone = parts[1]?.trim() || '';
          splitSuccess = true;
          break;
        }
      }
      
      if (!splitSuccess) {
        const spaceIdx = trimmed.lastIndexOf(' ');
        if (spaceIdx !== -1) {
          name = trimmed.slice(0, spaceIdx).trim();
          phone = trimmed.slice(spaceIdx).trim();
          if (!/^\d+$/.test(phone.replace(/\D/g, ''))) {
            name = trimmed;
            phone = '';
          }
        } else {
          name = trimmed;
          phone = '';
        }
      }
      
      if (name) {
        parsed.push({ name, phone });
      }
    });
    return parsed;
  }, [manualInput]);

  const activePool = useMemo(() => {
    return drawSource === 'orders' ? monthlyCustomers : manualCustomers;
  }, [drawSource, monthlyCustomers, manualCustomers]);

  // Canvas animation logic (confetti & fireworks)
  useEffect(() => {
    if (!winner || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let animationId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);
    
    const handleResize = () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);
    
    const particles: Particle[] = [];
    const colors = [
      '#f59e0b', '#fbbf24', '#fef08a', // Gold
      '#ef4444', '#f87171',             // Red
      '#3b82f6', '#60a5fa',             // Blue
      '#10b981', '#34d399',             // Green
      '#a855f7', '#c084fc',             // Purple
    ];
    
    // Spawn firework
    const spawnFirework = () => {
      const originX = Math.random() * width;
      const originY = height;
      const targetX = Math.random() * width;
      const targetY = Math.random() * (height * 0.4) + height * 0.1;
      
      const fireworkColor = colors[Math.floor(Math.random() * colors.length)];
      const numParticles = 60 + Math.floor(Math.random() * 40);
      
      // Explosion particles
      for (let i = 0; i < numParticles; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 6 + 2;
        particles.push({
          x: targetX,
          y: targetY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed + (Math.random() * 1 - 0.5),
          color: fireworkColor,
          size: Math.random() * 3 + 2,
          alpha: 1,
          life: 0,
          maxLife: 60 + Math.floor(Math.random() * 40),
          shape: 'circle'
        });
      }
    };
    
    // Spawn falling confetti
    const spawnConfetti = () => {
      for (let i = 0; i < 3; i++) {
        particles.push({
          x: Math.random() * width,
          y: -10,
          vx: Math.random() * 3 - 1.5,
          vy: Math.random() * 2 + 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: Math.random() * 6 + 4,
          alpha: 1,
          life: 0,
          maxLife: 300,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: Math.random() * 0.1 - 0.05,
          shape: Math.random() > 0.5 ? 'square' : 'circle'
        });
      }
    };
    
    // Initial bursts
    for (let i = 0; i < 4; i++) {
      setTimeout(spawnFirework, i * 400);
    }
    
    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      
      if (Math.random() < 0.03) spawnFirework();
      if (Math.random() < 0.4) spawnConfetti();
      
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        
        // Apply physics
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06; // Gravity
        p.vx *= 0.98; // Air resistance
        
        if (p.rotation !== undefined && p.rotationSpeed !== undefined) {
          p.rotation += p.rotationSpeed;
        }
        
        // Fade out
        p.alpha = Math.max(0, 1 - p.life / p.maxLife);
        
        if (p.life >= p.maxLife || p.y > height) {
          particles.splice(i, 1);
          continue;
        }
        
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        
        if (p.shape === 'square' && p.rotation !== undefined) {
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      
      animationId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, [winner]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (shuffleTimerRef.current) clearTimeout(shuffleTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      synthRef.current.stopDrumroll();
    };
  }, []);

  const handleStartPicking = () => {
    if (activePool.length === 0) {
      toast.error('No candidates found to draw from.');
      return;
    }
    
    setIsPicking(true);
    setWinner(null);
    setTimeLeft(10);
    
    if (soundEnabled) {
      synthRef.current.startDrumroll();
    }
    
    // Start countdown
    let timerVal = 10;
    countdownTimerRef.current = setInterval(() => {
      timerVal -= 1;
      setTimeLeft(timerVal);
      if (timerVal <= 0) {
        clearInterval(countdownTimerRef.current);
      }
    }, 1000);

    // Shuffle speed deceleration logic: spinning physical slot machine wheel slowing down to a halt
    let spinCount = 0;
    const runShuffle = () => {
      if (timerVal <= 0) {
        // Draw the official winner!
        const finalWinner = activePool[Math.floor(Math.random() * activePool.length)];
        setWinner(finalWinner);
        setCurrentCandidate(finalWinner);
        setIsPicking(false);
        synthRef.current.stopDrumroll();
        if (soundEnabled) {
          synthRef.current.playWinnerChime();
        }
        toast.success(`🎉 Congratulations to ${finalWinner.name}!`);
        // Save the draw data directly to Firebase Firestore
        saveWinnerToDb(finalWinner, selectedMonth, drawSource);
        return;
      }

      // Pick a random customer from list
      const randIdx = Math.floor(Math.random() * activePool.length);
      setCurrentCandidate(activePool[randIdx]);
      spinCount++;

      // Adjust shuffle interval based on remaining countdown time
      let nextDelay = 60; // 30s to 5s remaining: rapid shuffle 60ms
      if (timerVal <= 1) {
        nextDelay = 550; // final 1s
      } else if (timerVal <= 3) {
        nextDelay = 300; // 3s to 1s remaining
      } else if (timerVal <= 5) {
        nextDelay = 150; // 5s to 3s remaining
      }

      shuffleTimerRef.current = setTimeout(runShuffle, nextDelay);
    };

    runShuffle();
  };

  const handleReset = () => {
    if (shuffleTimerRef.current) clearTimeout(shuffleTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    synthRef.current.stopDrumroll();
    
    setIsPicking(false);
    setWinner(null);
    setCurrentCandidate(null);
    setTimeLeft(10);
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-[75vh] w-full p-4 select-none relative">
      
      {/* 🎬 9:16 aspect ratio Reels Frame Container Wrapper */}
      <div className="relative w-full max-w-sm aspect-[9/16] shrink-0">
        
        {/* SaaS Premium Offset Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute -top-3 -right-3 z-[220] p-2.5 rounded-full bg-[#2e1d13] hover:bg-[#3e2723] text-amber-400 hover:text-amber-200 shadow-2xl border-2 border-amber-500/30 hover:scale-115 transition-all cursor-pointer flex items-center justify-center animate-in fade-in duration-300"
            title="Close Winner Picker"
          >
            <X size={14} className="stroke-[3]" />
          </button>
        )}

        {/* 🎬 9:16 aspect ratio Reels Frame Container */}
        <div 
          className="relative w-full h-full rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-amber-950/20 flex flex-col justify-between p-6 animate-in fade-in zoom-in-95 duration-500"
          style={{
            background: 'radial-gradient(circle at center, #2e1d13 0%, #150a05 100%)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), inset 0 2px 20px rgba(251, 191, 36, 0.1)',
          }}
        >
        
        {/* Glow lights backdrop */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.12)_0%,transparent_50%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(217,119,6,0.08)_0%,transparent_60%)] pointer-events-none" />
        
        {/* Canvas overlays for victory effects */}
        {winner && (
          <canvas ref={canvasRef} className="absolute inset-0 z-10 pointer-events-none rounded-[2.2rem]" />
        )}

        {/* 1. Header controls */}
        <div className="flex items-center justify-between z-20 w-full shrink-0">
          <div className="flex items-center gap-1 text-amber-500 font-black tracking-widest text-[10px] uppercase">
            <Gift size={12} className="animate-pulse" />
            <span>Sabi Return Gifts</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            {!isPicking && !winner && (
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="p-1.5 py-1 px-2.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 transition-all border border-amber-500/20 cursor-pointer flex items-center gap-1 text-[8px] font-black uppercase tracking-widest"
                title={showHistory ? "Back to Draw Room" : "View Winners History"}
              >
                <Trophy size={10} className={showHistory ? "text-amber-400 animate-bounce" : "text-amber-400"} />
                <span>{showHistory ? "Draw Room" : `Winners (${pastWinners.length})`}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-amber-400 hover:text-amber-300 transition-colors border border-white/10 cursor-pointer"
              title={soundEnabled ? "Mute sound effects" : "Unmute sound effects"}
            >
              {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            </button>
          </div>
        </div>

        {/* 2. Primary Body Content */}
        <div className="flex-1 flex flex-col items-center justify-center py-6 w-full z-20 overflow-hidden">
          
          {/* Main draw state controller switcher */}
          {showHistory ? (
            // History View
            <div className="w-full text-center space-y-4 animate-in fade-in duration-300 flex-1 flex flex-col justify-between overflow-hidden">
              <div className="flex flex-col items-center justify-start gap-2 shrink-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 p-0.5 shadow-lg shadow-amber-500/20 flex items-center justify-center">
                  <div className="w-full h-full rounded-full bg-[#1e1008] flex items-center justify-center text-amber-400">
                    <Trophy size={20} className="animate-pulse" />
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-black bg-gradient-to-r from-amber-100 via-amber-300 to-yellow-100 bg-clip-text text-transparent uppercase tracking-wider mt-1" style={{ textShadow: "0 2px 10px rgba(245,158,11,0.15)" }}>
                    Draw History
                  </h2>
                  <p className="text-[9px] text-amber-400/60 font-black uppercase tracking-widest">
                    database records
                  </p>
                </div>
              </div>

              {/* Scrollable list of winners */}
              <div className="flex-1 my-3 overflow-y-auto pr-1.5 custom-scrollbar space-y-2.5 max-h-[190px] text-left w-full max-w-[280px] mx-auto">
                {pastWinners.length === 0 ? (
                  <div className="text-center py-8 space-y-2">
                    <Trophy size={32} className="text-amber-500/20 mx-auto" />
                    <p className="text-xs font-bold text-amber-600/50 italic">No winners drawn yet.</p>
                  </div>
                ) : (
                  pastWinners.map(item => (
                    <div 
                      key={item.id} 
                      style={{ backgroundColor: '#28150a', border: '1px solid rgba(245, 158, 11, 0.35)', color: '#ffffff' }}
                      className="rounded-2xl p-3 flex justify-between items-center transition-all shadow-md"
                    >
                      <div className="space-y-1 truncate pr-2 flex-1">
                        <p className="text-xs font-black uppercase tracking-wide truncate" style={{ color: '#ffffff' }}>{item.name}</p>
                        <p className="text-[11px] font-black tracking-wider" style={{ color: '#fbbf24' }}>{item.phone || 'No Contact'}</p>
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider" style={{ backgroundColor: 'rgba(245, 158, 11, 0.25)', color: '#fef08a', border: '1px solid rgba(245, 158, 11, 0.4)' }}>{item.month}</span>
                          {item.drawSource === 'manual' ? (
                            <span className="text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider" style={{ backgroundColor: 'rgba(168, 85, 247, 0.25)', color: '#e9d5ff', border: '1px solid rgba(168, 85, 247, 0.4)' }}>Manual</span>
                          ) : (
                            <span className="text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider" style={{ backgroundColor: 'rgba(59, 130, 246, 0.25)', color: '#bfdbfe', border: '1px solid rgba(59, 130, 246, 0.4)' }}>Orders</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0 gap-2">
                        <span className="text-[8px] font-black uppercase tracking-wider" style={{ color: '#cbd5e1' }}>
                          {item.timestamp ? new Date(item.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''}
                        </span>
                        <button 
                          type="button"
                          onClick={() => deleteWinnerEntry(item.id)} 
                          style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)' }}
                          className="p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center hover:brightness-125"
                          title="Delete Record"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {pastWinners.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllWinners}
                  style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.4)', fontWeight: 900 }}
                  className="w-full max-w-[200px] mx-auto py-2.5 px-3 rounded-2xl text-[9px] uppercase tracking-widest cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1.5 hover:brightness-125"
                >
                  <Trash2 size={11} />
                  <span>Clear All History</span>
                </button>
              )}
            </div>
          ) : !isPicking && !winner ? (
            // Form Selection View
            <div className="w-full text-center space-y-4 animate-in fade-in duration-300 flex-1 flex flex-col justify-center">
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 p-0.5 shadow-lg shadow-amber-500/20 animate-bounce flex items-center justify-center">
                  <div className="w-full h-full rounded-full bg-[#1e1008] flex items-center justify-center text-amber-400">
                    <Gift size={28} className="animate-pulse" />
                  </div>
                </div>
                <div>
                  <div className="inline-flex items-center gap-1 px-3 py-1 bg-[#1c0d05] border-2 border-amber-400/60 rounded-full shadow-md">
                    <span className="text-amber-400 font-black text-xs">₹</span>
                    <input
                      type="text"
                      value={cashbackAmount}
                      onChange={(e) => setCashbackAmount(e.target.value)}
                      style={{ backgroundColor: 'transparent', color: '#fbbf24' }}
                      className="w-16 text-amber-300 font-black text-xs outline-none text-center border-b border-amber-400/40 focus:border-amber-300"
                      title="Click to edit reward amount"
                      placeholder="1,000"
                    />
                    <span className="text-amber-300 font-black text-[9px] uppercase tracking-wider">Cashback Reward</span>
                  </div>
                  <h2 className="text-2xl font-black bg-gradient-to-r from-amber-100 via-amber-300 to-yellow-100 bg-clip-text text-transparent uppercase tracking-wider mt-1.5" style={{ textShadow: "0 2px 10px rgba(245,158,11,0.15)" }}>
                    Cashback Draw
                  </h2>
                  <p className="text-[10px] text-amber-300 max-w-[210px] mx-auto font-bold mt-1 leading-normal">
                    Select a month or enter candidates manually to spin and pick a random winner.
                  </p>
                </div>
              </div>

              <div className="flex p-1.5 rounded-2xl border border-amber-500/40 max-w-[250px] mx-auto w-full shadow-inner" style={{ backgroundColor: '#120803' }}>
                <button
                  type="button"
                  onClick={() => setDrawSource('orders')}
                  style={
                    drawSource === 'orders'
                      ? { background: 'linear-gradient(to right, #fbbf24, #f59e0b, #d97706)', color: '#000000', fontWeight: 900 }
                      : { backgroundColor: '#1f1007', color: '#ffffff', fontWeight: 800 }
                  }
                  className="flex-1 py-2.5 rounded-xl text-[10px] uppercase tracking-wider transition-all duration-300 flex justify-center items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Calendar size={12} />
                  <span>From Orders</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDrawSource('manual')}
                  style={
                    drawSource === 'manual'
                      ? { background: 'linear-gradient(to right, #fbbf24, #f59e0b, #d97706)', color: '#000000', fontWeight: 900 }
                      : { backgroundColor: '#1f1007', color: '#ffffff', fontWeight: 800 }
                  }
                  className="flex-1 py-2.5 rounded-xl text-[10px] uppercase tracking-wider transition-all duration-300 flex justify-center items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Sparkles size={12} />
                  <span>Manual List</span>
                </button>
              </div>

              <div className="space-y-3.5 max-w-[240px] mx-auto w-full">
                {drawSource === 'orders' ? (
                  <div className="space-y-1.5 text-left animate-in fade-in duration-200">
                    <label className="block text-[9px] font-black text-amber-300 uppercase tracking-widest pl-1">Select Draw Month</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsMonthSelectOpen(!isMonthSelectOpen)}
                        style={{ backgroundColor: '#180b04', color: '#ffffff', border: '2px solid rgba(245, 158, 11, 0.4)' }}
                        className="w-full rounded-2xl p-3 pl-9 pr-8 text-xs text-left outline-none transition-colors cursor-pointer font-black shadow-inner flex items-center justify-between min-h-[42px] relative"
                      >
                        <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-400" />
                        <span className="truncate text-white font-extrabold">{selectedMonth || 'Choose Month...'}</span>
                        <ChevronDown size={14} className={`text-amber-400 transition-transform duration-200 ${isMonthSelectOpen ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {isMonthSelectOpen && (
                        <>
                          <div 
                            onClick={() => setIsMonthSelectOpen(false)}
                            className="fixed inset-0 z-[90]" 
                          />
                          <div className="absolute top-full left-0 mt-1 w-full border-2 border-amber-500/60 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.95)] py-1.5 z-[100] max-h-48 overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2 duration-150" style={{ backgroundColor: '#0d0603' }}>
                            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => {
                                  setSelectedMonth(m);
                                  setIsMonthSelectOpen(false);
                                }}
                                style={
                                  selectedMonth === m
                                    ? { backgroundColor: '#fbbf24', color: '#000000', fontWeight: 900 }
                                    : { backgroundColor: 'transparent', color: '#ffffff', fontWeight: 800 }
                                }
                                className="w-full text-left px-4 py-2.5 text-xs font-black transition-colors hover:bg-amber-500/30 hover:text-amber-300"
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 text-left animate-in fade-in duration-200">
                    <label className="block text-[9px] font-black text-amber-300 uppercase tracking-widest pl-1">Manual Candidates List</label>
                    <textarea
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      style={{ backgroundColor: '#140903', color: '#ffffff', border: '2px solid rgba(245, 158, 11, 0.5)' }}
                      className="w-full rounded-2xl p-3 text-xs font-black placeholder-amber-400/50 outline-none focus:border-amber-400 transition-all cursor-text shadow-inner h-28 resize-none custom-scrollbar"
                      placeholder="Name, Phone (One per line)&#10;Example:&#10;Subash, 9876543210&#10;Aravinth, 9988776655"
                    />
                  </div>
                )}

                {activePool.length > 0 ? (
                  <div className="space-y-1.5 text-left animate-in fade-in duration-200">
                    <div className="flex justify-between items-center px-1">
                      <label className="block text-[9px] font-black text-amber-300 uppercase tracking-widest">
                        Eligible Candidates
                      </label>
                      <span className="text-[10px] font-black text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/40 uppercase tracking-wide">
                        {activePool.length}
                      </span>
                    </div>
                    <div className="border border-amber-500/20 rounded-2xl p-2.5 max-h-[105px] overflow-y-auto custom-scrollbar space-y-1.5 w-full" style={{ backgroundColor: '#120803' }}>
                      {activePool.map((c, i) => (
                        <div key={i} className="flex justify-between items-center rounded-xl px-3 py-2 transition-colors shadow-sm" style={{ backgroundColor: '#28150a', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                          <span className="text-xs font-black uppercase truncate pr-2 flex-1 tracking-wide" style={{ color: '#ffffff' }}>{c.name}</span>
                          <span className="text-[11px] font-black tracking-wider shrink-0" style={{ color: '#fbbf24' }}>
                            {c.phone ? c.phone.replace(/(\d{4})$/, '****') : 'No Contact'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : selectedMonth && drawSource === 'orders' ? (
                  <div className="bg-gradient-to-br from-red-500/10 to-red-500/20 border border-red-400/40 rounded-2xl p-3.5 text-center animate-in fade-in duration-200">
                    <p className="text-[9px] font-black text-red-300 uppercase tracking-widest">No Candidates Found</p>
                    <p className="text-[10px] text-white font-bold mt-1">Please add orders for {selectedMonth} in Dashboard 1 or 2.</p>
                  </div>
                ) : null}

                <button
                  onClick={handleStartPicking}
                  disabled={activePool.length === 0}
                  style={
                    activePool.length > 0
                      ? { background: 'linear-gradient(to right, #fbbf24, #f59e0b, #d97706)', color: '#000000', fontWeight: 900 }
                      : { backgroundColor: '#281a10', color: 'rgba(255, 255, 255, 0.3)', border: '1px solid rgba(255, 255, 255, 0.1)' }
                  }
                  className="w-full py-3.5 px-4 rounded-2xl text-xs uppercase tracking-widest transition-all duration-300 flex justify-center items-center gap-2 shadow-lg cursor-pointer hover:brightness-110 active:scale-95"
                >
                  <Play size={13} className="fill-black text-black" />
                  <span>Start Draw</span>
                </button>
              </div>
            </div>
          ) : isPicking ? (
            // Shuffling wheel visualizer view
            <div className="w-full text-center space-y-6 animate-in fade-in duration-300 flex-1 flex flex-col justify-center items-center">
              
              {/* Spinning Circular Countdown Ring */}
              <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
                <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                  <circle
                    cx="72"
                    cy="72"
                    r="64"
                    className="stroke-amber-950/40"
                    strokeWidth="6"
                    fill="transparent"
                  />
                  <circle
                    cx="72"
                    cy="72"
                    r="64"
                    className="stroke-amber-500 transition-all duration-1000 ease-linear"
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 64}
                    strokeDashoffset={2 * Math.PI * 64 * (1 - timeLeft / 10)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="flex flex-col items-center justify-center z-20">
                  <span className="text-4xl font-black text-amber-100 leading-none tabular-nums animate-pulse">{timeLeft}</span>
                  <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mt-1">Seconds</span>
                </div>
              </div>

              {/* Shuffling Candidate Billboard */}
              <div 
                className="w-full max-w-[250px] p-4 rounded-2xl border border-white/10 relative overflow-hidden flex flex-col items-center justify-center shadow-2xl min-h-[96px]"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-amber-500/5 animate-pulse" />
                {currentCandidate ? (
                  <div className="space-y-1 z-20 animate-in fade-in duration-75">
                    <p className="text-sm font-black text-amber-100 uppercase tracking-wider truncate max-w-[210px]">{currentCandidate.name}</p>
                    <p className="text-xs text-amber-400 font-bold tracking-widest flex items-center justify-center gap-1">
                      <Phone size={10} />
                      {currentCandidate.phone ? currentCandidate.phone.replace(/(\d{4})$/, '****') : 'No Contact'}
                    </p>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-amber-500/60 uppercase tracking-widest animate-pulse">Initializing...</span>
                )}
              </div>
              
              <div className="flex items-center gap-1 text-[10px] text-amber-500/70 font-semibold uppercase tracking-wider animate-pulse">
                <Sparkles size={11} /> Shuffling Candidates...
              </div>

            </div>
          ) : (
            // Winner Reveal Card view
            <div className="w-full text-center space-y-4 animate-in zoom-in-95 duration-500 flex-1 flex flex-col justify-center items-center">
              
              <div className="relative">
                <div className="absolute -inset-6 bg-gradient-to-tr from-amber-500 to-yellow-500 blur-2xl rounded-full opacity-30 animate-pulse" />
                <Trophy size={48} className="text-amber-400 fill-amber-500/20 relative z-20 animate-bounce" />
              </div>
              
              <h3 className="text-xl font-black bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-100 bg-clip-text text-transparent uppercase tracking-widest leading-none mt-1 relative z-20">
                We Have a Winner!
              </h3>

              {/* Glowing metallic Winner Card */}
              <div 
                className="w-full max-w-[320px] p-5 rounded-[2rem] border-2 border-amber-400/40 relative overflow-hidden flex flex-col items-center justify-center shadow-[0_20px_50px_rgba(0,0,0,0.6)] space-y-3.5"
                style={{
                  background: 'linear-gradient(135deg, rgba(251,191,36,0.1) 0%, rgba(217,119,6,0.05) 100%)',
                  backdropFilter: 'blur(30px)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.5), inset 0 0 20px rgba(251,191,36,0.2)',
                }}
              >
                {/* 3D coin decorations */}
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-yellow-500 border border-amber-200/50 flex items-center justify-center text-[9px] font-black text-amber-950 shadow-md animate-[spin_6s_linear_infinite]">₹</div>
                <div className="absolute -bottom-3 -right-3 w-8 h-8 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-yellow-500 border border-amber-200/50 flex items-center justify-center text-[9px] font-black text-amber-950 shadow-md animate-[spin_5s_linear_infinite_reverse]">₹</div>

                <div className="space-y-1 text-center w-full">
                  <span className="inline-block text-[8px] font-black px-2.5 py-0.5 bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 rounded-full uppercase tracking-widest shadow-md">Winner Details</span>
                  <p className="text-lg font-black bg-gradient-to-r from-white to-amber-100 bg-clip-text text-transparent uppercase tracking-wide break-words max-w-[280px] mx-auto pt-1">{winner?.name}</p>
                  <p className="text-xs text-amber-300 font-bold tracking-widest flex items-center justify-center gap-1">
                    <Phone size={10} className="text-amber-400" />
                    {winner?.phone || 'No Contact'}
                  </p>
                </div>
                
                <div className="w-full border-t border-dashed border-amber-400/20 pt-3 text-center">
                  <p className="text-[9px] text-amber-400/70 font-black uppercase tracking-widest">Prize Cash Reward</p>
                  <p className="text-lg font-black text-amber-100 flex items-center justify-center gap-1">
                    <span className="bg-gradient-to-r from-amber-200 to-yellow-100 bg-clip-text text-transparent text-xl font-black">
                      ₹{cashbackAmount}
                    </span>
                    <span className="text-[9px] font-black bg-amber-500 text-amber-950 px-2 py-0.5 rounded-full uppercase shadow-sm">Cashback</span>
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5 max-w-[220px] w-full mt-2 shrink-0 z-20">
                <button
                  onClick={handleReset}
                  className="flex-1 py-2.5 px-3 rounded-2xl border border-amber-500/20 bg-white/10 hover:bg-white/20 text-amber-100 hover:text-white font-extrabold text-xs uppercase tracking-widest cursor-pointer flex justify-center items-center gap-1.5 transition-all hover:scale-105 active:scale-95 shadow-lg"
                >
                  <RotateCcw size={12} />
                  <span>Draw Again</span>
                </button>
              </div>

            </div>
          )}

        </div>

        <div className="w-full shrink-0 flex flex-col items-center justify-center border-t border-white/5 pt-4 text-center z-20">
          <p className="text-[9px] font-semibold text-white/40 tracking-wider">SABI RETURN GIFTS SYSTEM</p>
        </div>

      </div>
    </div>
  </div>
  );
}
