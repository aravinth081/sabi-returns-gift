import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { User, Lock, Eye, EyeOff, Key, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { collection, getDocs, doc, updateDoc, addDoc, query, where } from "firebase/firestore";
import { db } from "@/firebase";

interface LoginProps {
  onLoginSuccess?: (userData?: { role: 'Admin' | 'Employee'; name: string; employeeId?: string }) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  // Flip state for 3D book page turning effect
  const [isFlipped, setIsFlipped] = useState(false);

  // Login form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Register form states
  const [regName, setRegName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Handle Login submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setLoginError("");

    const inputUser = username.trim().toLowerCase();
    const inputPass = password.trim();

    try {
      // 1. Admin Login (subash g / 561997)
      if (inputUser === "subash g" && inputPass === "561997") {
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("loggedInName", "Subash");
        localStorage.setItem("role", "Admin");
        localStorage.setItem("loginTimestamp", Date.now().toString());
        toast({
          title: "Welcome Back, Subash!",
          description: "Logged in as Admin",
        });

        if (onLoginSuccess) {
          onLoginSuccess({ role: 'Admin', name: 'Subash' });
        } else {
          navigate("/dashboard");
        }
        return;
      }

      // 2. Firebase Employee Check (Targeted query for maximum concurrency & low latency)
      try {
        let matchedDoc: any = null;
        
        // Fast targeted lookup for lowercase username
        const qLower = query(collection(db, "employees"), where("username", "==", inputUser));
        const snapLower = await getDocs(qLower);
        if (!snapLower.empty) {
          const docSnap = snapLower.docs.find(d => d.data().password === inputPass);
          if (docSnap) matchedDoc = { fireId: docSnap.id, ...docSnap.data() };
        }

        // Secondary lookup for exact typed casing if not matched
        if (!matchedDoc && inputUser !== username.trim()) {
          const qExact = query(collection(db, "employees"), where("username", "==", username.trim()));
          const snapExact = await getDocs(qExact);
          if (!snapExact.empty) {
            const docSnap = snapExact.docs.find(d => d.data().password === inputPass);
            if (docSnap) matchedDoc = { fireId: docSnap.id, ...docSnap.data() };
          }
        }

        // Fallback scan only if indexed queries didn't match (for legacy untrimmed records)
        if (!matchedDoc) {
          const q = query(collection(db, "employees"));
          const snap = await getDocs(q);
          matchedDoc = snap.docs
            .map((docSnap) => ({ fireId: docSnap.id, ...docSnap.data() } as any))
            .find(
              (emp) =>
                emp.username &&
                emp.username.toLowerCase() === inputUser &&
                emp.password === inputPass
            );
        }

        if (matchedDoc) {
          if (matchedDoc.status === "Approved") {
            updateDoc(doc(db, "employees", matchedDoc.fireId), {
              isLive: true,
              lastLoginAt: new Date().toISOString(),
            }).catch((err) => console.error("Error setting live status:", err));

            localStorage.setItem("isLoggedIn", "true");
            localStorage.setItem("loggedInName", matchedDoc.name || matchedDoc.username);
            localStorage.setItem("role", "Employee");
            localStorage.setItem("employeeId", matchedDoc.fireId);
            localStorage.setItem("loginTimestamp", Date.now().toString());

            toast({
              title: `Welcome, ${matchedDoc.name}!`,
              description: "Logged in successfully",
            });

            if (onLoginSuccess) {
              onLoginSuccess({
                role: 'Employee',
                name: matchedDoc.name || matchedDoc.username,
                employeeId: matchedDoc.fireId
              });
            } else {
              navigate("/dashboard");
            }
            return;
          } else {
            setLoginError("Your account is still pending approval or declined.");
            setIsLoading(false);
            return;
          }
        }
      } catch (fbErr) {
        console.warn("Firebase employee check failed:", fbErr);
      }

      // 3. Supabase Auth fallback
      try {
        await signIn(username, password);
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("loggedInName", username);
        localStorage.setItem("loginTimestamp", Date.now().toString());
        if (onLoginSuccess) {
          onLoginSuccess({ role: 'Admin', name: username });
        } else {
          navigate("/dashboard");
        }
        return;
      } catch (supErr: any) {
        console.warn("Supabase auth fallback error:", supErr);
      }

      setLoginError("Invalid Username or Password!");
    } catch (err: any) {
      setLoginError(err.message || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Register submission
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError("");

    if (!regName || !regUsername || !regPassword) {
      setRegisterError("Please fill all required fields");
      return;
    }

    setIsRegistering(true);
    try {
      await addDoc(collection(db, "employees"), {
        name: regName,
        username: regUsername,
        password: regPassword,
        status: "Pending",
        createdAt: new Date().toISOString(),
      });

      toast({
        title: "Registration Request Sent!",
        description: "Account created! Pending administrator approval.",
      });

      // Clear fields and smoothly flip back to Login page
      setRegName("");
      setRegUsername("");
      setRegPassword("");
      setTimeout(() => {
        setIsFlipped(false);
      }, 500);
    } catch (err: any) {
      setRegisterError("Failed to register. Please try again.");
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 w-full h-[100dvh] max-w-[100vw] flex items-center justify-center p-0 md:p-8 select-none overflow-x-hidden overflow-y-auto"
      style={{
        backgroundColor: "#060a14",
        backgroundImage: `
          radial-gradient(circle at 18% 40%, rgba(217, 169, 40, 0.14) 0%, transparent 45%),
          radial-gradient(circle at 82% 60%, rgba(30, 58, 110, 0.28) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 50%, #0c1427 0%, #060a14 100%)
        `
      }}
    >
      {/* ======================================================== */}
      {/* MOBILE VIEW (Screens < md) - Strictly Locked (No Horizontal Movement) */}
      {/* ======================================================== */}
      <div className="md:hidden w-full max-w-[100vw] h-[100dvh] max-h-[100dvh] flex flex-col justify-between py-4 px-5 relative z-10 overflow-x-hidden overflow-y-auto overscroll-none touch-manipulation">
        
        {/* 1. Corner Luxury Concentric Gold Arcs (Pinned strictly within viewport edges) */}
        {/* Top-Left Concentric Arcs */}
        <svg 
          className="absolute top-0 left-0 w-28 h-28 pointer-events-none opacity-40 select-none z-0" 
          viewBox="0 0 120 120"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="goldArcTL" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F5D88A" stopOpacity="0.75" />
              <stop offset="50%" stopColor="#D4AF37" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#8C6D1F" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <circle cx="0" cy="0" r="35" stroke="url(#goldArcTL)" strokeWidth="1.5" />
          <circle cx="0" cy="0" r="65" stroke="url(#goldArcTL)" strokeWidth="1.5" />
          <circle cx="0" cy="0" r="95" stroke="url(#goldArcTL)" strokeWidth="1.5" />
        </svg>

        {/* Top-Right Concentric Arcs */}
        <svg 
          className="absolute top-0 right-0 w-28 h-28 pointer-events-none opacity-40 select-none z-0" 
          viewBox="0 0 120 120"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="goldArcTR" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F5D88A" stopOpacity="0.75" />
              <stop offset="50%" stopColor="#D4AF37" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#8C6D1F" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <circle cx="120" cy="0" r="35" stroke="url(#goldArcTR)" strokeWidth="1.5" />
          <circle cx="120" cy="0" r="65" stroke="url(#goldArcTR)" strokeWidth="1.5" />
          <circle cx="120" cy="0" r="95" stroke="url(#goldArcTR)" strokeWidth="1.5" />
        </svg>

        {/* Bottom-Left Concentric Arcs */}
        <svg 
          className="absolute bottom-0 left-0 w-28 h-28 pointer-events-none opacity-40 select-none z-0" 
          viewBox="0 0 120 120"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="goldArcBL" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F5D88A" stopOpacity="0.75" />
              <stop offset="50%" stopColor="#D4AF37" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#8C6D1F" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <circle cx="0" cy="120" r="35" stroke="url(#goldArcBL)" strokeWidth="1.5" />
          <circle cx="0" cy="120" r="65" stroke="url(#goldArcBL)" strokeWidth="1.5" />
          <circle cx="0" cy="120" r="95" stroke="url(#goldArcBL)" strokeWidth="1.5" />
        </svg>

        {/* Bottom-Right Concentric Arcs */}
        <svg 
          className="absolute bottom-0 right-0 w-28 h-28 pointer-events-none opacity-40 select-none z-0" 
          viewBox="0 0 120 120"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="goldArcBR" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#F5D88A" stopOpacity="0.75" />
              <stop offset="50%" stopColor="#D4AF37" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#8C6D1F" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <circle cx="120" cy="120" r="35" stroke="url(#goldArcBR)" strokeWidth="1.5" />
          <circle cx="120" cy="120" r="65" stroke="url(#goldArcBR)" strokeWidth="1.5" />
          <circle cx="120" cy="120" r="95" stroke="url(#goldArcBR)" strokeWidth="1.5" />
        </svg>

        {/* 2. Top Centered Brand Section - Rock-Solid & Standard (Stationary) */}
        <div className="relative z-10 flex flex-col items-center pt-1">
          
          {/* Subtle Steady Golden Halo Aura Behind Logo */}
          <div 
            className="absolute top-1 w-32 h-32 rounded-full pointer-events-none animate-gold-halo" 
            style={{ background: "radial-gradient(circle, #D9A928 0%, rgba(245, 158, 11, 0.4) 35%, transparent 70%)" }}
          />

          {/* Sabi Return Gifts Luxury Logo Badge - Standard & Grounded */}
          <div className="relative z-10 flex flex-col items-center">
            {/* Elegant Royal Hallmark Pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#1b1509] border border-[#D9A928]/50 shadow-[0_0_12px_rgba(217,169,40,0.25)] mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F5D88A] animate-pulse" />
              <span className="text-[10px] font-black tracking-[0.22em] text-[#F5D88A] uppercase">
                OFFICIAL PORTAL
              </span>
            </div>

            {/* Outer Metallic Gold Gradient Rim */}
            <div className="w-[100px] h-[100px] sm:w-[110px] sm:h-[110px] p-[3px] rounded-[1.8rem] bg-gradient-to-tr from-[#8C6D1F] via-[#F5D88A] via-[#E8C15A] to-[#B38B28] shadow-[0_16px_40px_rgba(0,0,0,0.95),0_0_30px_rgba(217,169,40,0.4)] relative group overflow-hidden transition-all duration-300">
              
              {/* Inner Black Logo Container */}
              <div className="w-full h-full rounded-[1.6rem] bg-gradient-to-b from-[#18181b] via-[#09090b] to-[#000000] p-1.5 border border-[#F5D88A]/35 relative overflow-hidden flex items-center justify-center">
                
                {/* Diagonal Light Shimmer Reflection Sweep Across Logo Glass */}
                <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none animate-logo-shimmer z-20" />
                
                <img 
                  src="/logo.jpeg" 
                  alt="Sabi Return Gifts" 
                  className="w-full h-full object-cover rounded-[1.3rem] relative z-10"
                  loading="eager"
                  decoding="sync"
                  fetchPriority="high"
                  width="110"
                  height="110"
                />
              </div>
            </div>
          </div>

          {/* Brand Name: Metallic Gold & Ivory Shimmer Gradient */}
          <h1 className="text-2xl sm:text-[28px] font-serif font-black tracking-[0.24em] bg-gradient-to-r from-[#FFF9E6] via-[#F5D88A] to-[#D4AF37] bg-clip-text text-transparent uppercase mt-3 text-center drop-shadow-md">
            SABI RETURNS
          </h1>

          {/* Tagline */}
          <div className="flex items-center justify-center gap-2 mt-0.5">
            <span className="w-2 h-[1px] bg-[#D9A928]/70" />
            <p className="text-[10px] sm:text-[11px] font-black tracking-[0.3em] text-[#D9A928] uppercase drop-shadow-sm">
              PREMIUM GIFTING SOLUTIONS
            </p>
            <span className="w-2 h-[1px] bg-[#D9A928]/70" />
          </div>
        </div>

        {/* 3. Form Content Section (Login or Register) */}
        <div className="relative z-10 w-full max-w-[390px] mx-auto my-auto py-2">
          {!isFlipped ? (
            /* --- MOBILE LOGIN FORM --- */
            <div className="space-y-3.5">
              {/* Screen Title */}
              <div className="text-center">
                <h2 className="text-2xl font-serif font-bold text-[#F8F5ED] tracking-[0.18em] uppercase drop-shadow-sm">
                  SIGN IN
                </h2>

                {/* Luxury Jewelry Diamond Ornament Divider */}
                <div className="flex items-center justify-center gap-2.5 mt-2">
                  <div className="w-14 h-[1.5px] bg-gradient-to-r from-transparent via-[#D9A928]/70 to-[#F5D88A]" />
                  <span className="w-2.5 h-2.5 rotate-45 bg-[#D9A928] shadow-[0_0_8px_rgba(245,216,138,0.85)] border border-[#FFF9E6]" />
                  <div className="w-14 h-[1.5px] bg-gradient-to-l from-transparent via-[#D9A928]/70 to-[#F5D88A]" />
                </div>
              </div>

              {/* Error Message */}
              {loginError && (
                <div className="bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-medium px-3.5 py-2.5 rounded-xl text-center">
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                {/* Username Input Box - Unified Seamless Luxury Card */}
                <div>
                  <label 
                    htmlFor="mobile-username" 
                    className="flex items-center gap-1.5 text-[11px] font-black tracking-[0.16em] text-[#A0AFC7] uppercase mb-1.5 pl-1"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D9A928] shadow-[0_0_6px_rgba(217,169,40,0.8)]" />
                    USERNAME
                  </label>
                  <div className="relative group w-full">
                    <div className="w-full h-[54px] rounded-2xl bg-[#0c1427]/90 border border-[#223354] hover:border-[#D9A928]/50 focus-within:border-[#F5D88A] focus-within:ring-2 focus-within:ring-[#D9A928]/25 shadow-[0_4px_16px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] px-3.5 flex items-center transition-all duration-300">
                      <div className="w-8 h-8 rounded-lg bg-[#D9A928]/15 border border-[#D9A928]/35 flex items-center justify-center mr-3 shrink-0 group-focus-within:bg-[#D9A928]/25 group-focus-within:border-[#F5D88A] transition-all">
                        <User className="h-4.5 w-4.5 text-[#F5D88A]" />
                      </div>
                      <input 
                        id="mobile-username" 
                        type="text"
                        value={username} 
                        onChange={(e) => setUsername(e.target.value)} 
                        placeholder="Enter your username" 
                        required 
                        autoComplete="username"
                        className="w-full flex-1 bg-transparent border-none outline-none text-[#F8F5ED] placeholder-[#73829C] text-[16px] font-medium shadow-none focus:ring-0 focus:outline-none p-0"
                      />
                    </div>
                  </div>
                </div>

                {/* Password Input Box - Unified Seamless Luxury Card */}
                <div>
                  <label 
                    htmlFor="mobile-password" 
                    className="flex items-center gap-1.5 text-[11px] font-black tracking-[0.16em] text-[#A0AFC7] uppercase mb-1.5 pl-1"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D9A928] shadow-[0_0_6px_rgba(217,169,40,0.8)]" />
                    PASSWORD
                  </label>
                  <div className="relative group w-full">
                    <div className="w-full h-[54px] rounded-2xl bg-[#0c1427]/90 border border-[#223354] hover:border-[#D9A928]/50 focus-within:border-[#F5D88A] focus-within:ring-2 focus-within:ring-[#D9A928]/25 shadow-[0_4px_16px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] px-3.5 flex items-center transition-all duration-300">
                      <div className="w-8 h-8 rounded-lg bg-[#D9A928]/15 border border-[#D9A928]/35 flex items-center justify-center mr-3 shrink-0 group-focus-within:bg-[#D9A928]/25 group-focus-within:border-[#F5D88A] transition-all">
                        <Lock className="h-4.5 w-4.5 text-[#F5D88A]" />
                      </div>
                      <input 
                        id="mobile-password" 
                        type={showPassword ? "text" : "password"} 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        placeholder="Enter password" 
                        required 
                        autoComplete="current-password"
                        className="w-full flex-1 bg-transparent border-none outline-none text-[#F8F5ED] placeholder-[#73829C] text-[16px] font-medium shadow-none focus:ring-0 focus:outline-none p-0"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#D9A928] hover:text-[#F5D88A] hover:bg-[#D9A928]/15 transition-all cursor-pointer shrink-0 ml-1"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Remember Me & Register */}
                <div className="flex items-center justify-between px-1 pt-0.5">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="mobile-remember" 
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(!!checked)}
                      className="w-4.5 h-4.5 rounded border-[#223354] data-[state=checked]:bg-[#D9A928] data-[state=checked]:border-[#D9A928] data-[state=checked]:text-[#080F23] focus-visible:ring-1 focus-visible:ring-[#D9A928]" 
                    />
                    <label
                      htmlFor="mobile-remember"
                      className="text-xs sm:text-sm font-semibold text-[#E8EAF0] cursor-pointer select-none"
                    >
                      Remember Me?
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsFlipped(true)}
                    className="text-xs sm:text-sm font-bold text-[#D9A928] hover:text-[#F5D88A] transition-colors underline underline-offset-4 cursor-pointer"
                  >
                    Register
                  </button>
                </div>

                {/* Action Button: Luxury Gold Gradient with Dynamic Sheen */}
                <div className="pt-2">
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full h-14 min-h-[56px] bg-gradient-to-r from-[#C89B2B] via-[#F4CF68] to-[#C89B2B] hover:brightness-110 active:scale-[0.985] text-[#080F23] font-black text-sm uppercase tracking-[0.22em] rounded-2xl shadow-[0_12px_32px_rgba(217,169,40,0.5),0_2px_8px_rgba(0,0,0,0.4)] transition-all duration-300 flex items-center justify-center gap-2.5 border-none cursor-pointer relative overflow-hidden"
                  >
                    <Key className="w-5 h-5 text-[#080F23] stroke-[2.7]" />
                    <span>{isLoading ? "Signing In..." : "SIGN IN"}</span>
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            /* --- MOBILE REGISTER FORM --- */
            <div className="space-y-3.5">
              {/* Screen Title */}
              <div className="text-center">
                <h2 className="text-2xl font-serif font-bold text-[#F8F5ED] tracking-[0.18em] uppercase drop-shadow-sm">
                  REGISTER
                </h2>

                {/* Luxury Jewelry Diamond Ornament Divider */}
                <div className="flex items-center justify-center gap-2.5 mt-2">
                  <div className="w-14 h-[1.5px] bg-gradient-to-r from-transparent via-[#D9A928]/70 to-[#F5D88A]" />
                  <span className="w-2.5 h-2.5 rotate-45 bg-[#D9A928] shadow-[0_0_8px_rgba(245,216,138,0.85)] border border-[#FFF9E6]" />
                  <div className="w-14 h-[1.5px] bg-gradient-to-l from-transparent via-[#D9A928]/70 to-[#F5D88A]" />
                </div>
              </div>

              {/* Error Message */}
              {registerError && (
                <div className="bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-medium px-3.5 py-2.5 rounded-xl text-center">
                  {registerError}
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                {/* Full Name */}
                <div>
                  <label 
                    htmlFor="mobile-reg-name" 
                    className="flex items-center gap-1.5 text-[11px] font-black tracking-[0.16em] text-[#A0AFC7] uppercase mb-1.5 pl-1"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D9A928] shadow-[0_0_6px_rgba(217,169,40,0.8)]" />
                    FULL NAME
                  </label>
                  <div className="relative group w-full">
                    <div className="w-full h-[54px] rounded-2xl bg-[#0c1427]/90 border border-[#223354] hover:border-[#D9A928]/50 focus-within:border-[#F5D88A] focus-within:ring-2 focus-within:ring-[#D9A928]/25 shadow-[0_4px_16px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] px-3.5 flex items-center transition-all duration-300">
                      <div className="w-8 h-8 rounded-lg bg-[#D9A928]/15 border border-[#D9A928]/35 flex items-center justify-center mr-3 shrink-0 group-focus-within:bg-[#D9A928]/25 group-focus-within:border-[#F5D88A] transition-all">
                        <User className="h-4.5 w-4.5 text-[#F5D88A]" />
                      </div>
                      <input 
                        id="mobile-reg-name" 
                        type="text"
                        value={regName} 
                        onChange={(e) => setRegName(e.target.value)} 
                        placeholder="Enter your full name" 
                        required 
                        className="w-full flex-1 bg-transparent border-none outline-none text-[#F8F5ED] placeholder-[#73829C] text-[16px] font-medium shadow-none focus:ring-0 focus:outline-none p-0"
                      />
                    </div>
                  </div>
                </div>

                {/* Username */}
                <div>
                  <label 
                    htmlFor="mobile-reg-username" 
                    className="flex items-center gap-1.5 text-[11px] font-black tracking-[0.16em] text-[#A0AFC7] uppercase mb-1.5 pl-1"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D9A928] shadow-[0_0_6px_rgba(217,169,40,0.8)]" />
                    USERNAME
                  </label>
                  <div className="relative group w-full">
                    <div className="w-full h-[54px] rounded-2xl bg-[#0c1427]/90 border border-[#223354] hover:border-[#D9A928]/50 focus-within:border-[#F5D88A] focus-within:ring-2 focus-within:ring-[#D9A928]/25 shadow-[0_4px_16px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] px-3.5 flex items-center transition-all duration-300">
                      <div className="w-8 h-8 rounded-lg bg-[#D9A928]/15 border border-[#D9A928]/35 flex items-center justify-center mr-3 shrink-0 group-focus-within:bg-[#D9A928]/25 group-focus-within:border-[#F5D88A] transition-all">
                        <User className="h-4.5 w-4.5 text-[#F5D88A]" />
                      </div>
                      <input 
                        id="mobile-reg-username" 
                        type="text"
                        value={regUsername} 
                        onChange={(e) => setRegUsername(e.target.value)} 
                        placeholder="Choose a username" 
                        required 
                        autoComplete="username"
                        className="w-full flex-1 bg-transparent border-none outline-none text-[#F8F5ED] placeholder-[#73829C] text-[16px] font-medium shadow-none focus:ring-0 focus:outline-none p-0"
                      />
                    </div>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label 
                    htmlFor="mobile-reg-password" 
                    className="flex items-center gap-1.5 text-[11px] font-black tracking-[0.16em] text-[#A0AFC7] uppercase mb-1.5 pl-1"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D9A928] shadow-[0_0_6px_rgba(217,169,40,0.8)]" />
                    PASSWORD
                  </label>
                  <div className="relative group w-full">
                    <div className="w-full h-[54px] rounded-2xl bg-[#0c1427]/90 border border-[#223354] hover:border-[#D9A928]/50 focus-within:border-[#F5D88A] focus-within:ring-2 focus-within:ring-[#D9A928]/25 shadow-[0_4px_16px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] px-3.5 flex items-center transition-all duration-300">
                      <div className="w-8 h-8 rounded-lg bg-[#D9A928]/15 border border-[#D9A928]/35 flex items-center justify-center mr-3 shrink-0 group-focus-within:bg-[#D9A928]/25 group-focus-within:border-[#F5D88A] transition-all">
                        <Lock className="h-4.5 w-4.5 text-[#F5D88A]" />
                      </div>
                      <input 
                        id="mobile-reg-password" 
                        type={showRegPassword ? "text" : "password"} 
                        value={regPassword} 
                        onChange={(e) => setRegPassword(e.target.value)} 
                        placeholder="Create password" 
                        required 
                        className="w-full flex-1 bg-transparent border-none outline-none text-[#F8F5ED] placeholder-[#73829C] text-[16px] font-medium shadow-none focus:ring-0 focus:outline-none p-0"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#D9A928] hover:text-[#F5D88A] hover:bg-[#D9A928]/15 transition-all cursor-pointer shrink-0 ml-1"
                        aria-label={showRegPassword ? "Hide password" : "Show password"}
                      >
                        {showRegPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Flip Back to Login Row */}
                <div className="flex items-center justify-between px-1 pt-0.5">
                  <span className="text-xs sm:text-sm text-[#9DAAC2] font-medium">
                    Already have an account?
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsFlipped(false)}
                    className="text-xs sm:text-sm font-bold text-[#D9A928] hover:text-[#F5D88A] transition-colors underline underline-offset-4 cursor-pointer"
                  >
                    Login
                  </button>
                </div>

                {/* Action Button: Luxury Gold Gradient with Dynamic Sheen */}
                <div className="pt-2">
                  <Button 
                    type="submit" 
                    disabled={isRegistering}
                    className="w-full h-14 min-h-[56px] bg-gradient-to-r from-[#C89B2B] via-[#F4CF68] to-[#C89B2B] hover:brightness-110 active:scale-[0.985] text-[#080F23] font-black text-sm uppercase tracking-[0.22em] rounded-2xl shadow-[0_12px_32px_rgba(217,169,40,0.5),0_2px_8px_rgba(0,0,0,0.4)] transition-all duration-300 flex items-center justify-center gap-2.5 border-none cursor-pointer relative overflow-hidden"
                  >
                    <UserPlus className="w-5 h-5 text-[#080F23] stroke-[2.7]" />
                    <span>{isRegistering ? "Creating..." : "CREATE ACCOUNT"}</span>
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* 4. Bottom Security / Official Portal Micro-Badge */}
        <div className="relative z-10 text-center pb-1">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0c1427]/80 border border-[#223354] text-[10px] text-[#A0AFC7] font-semibold tracking-wider uppercase shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
            Sabi Return Gifts • Secure Portal
          </div>
        </div>

      </div>

      {/* ======================================================== */}
      {/* DESKTOP VIEW (Screens >= md) - Sabi Return Gifts Luxury Reference Layout */}
      {/* ======================================================== */}
      <div className="hidden md:flex w-full max-w-[1060px] min-h-[580px] lg:min-h-[620px] rounded-[2.5rem] shadow-[0_25px_80px_rgba(0,0,0,0.85),0_0_60px_rgba(217,169,40,0.18)] flex-row overflow-hidden border border-[#D9A928]/35 relative z-10 my-auto bg-[#0a1122] transition-all duration-300">
        
        {/* ================= LEFT SIDE (Brand Presentation & Signature Luxury Logo) ================= */}
        <div className="w-full md:w-1/2 relative bg-gradient-to-b from-[#0e172e] via-[#0c1427] to-[#080f20] flex flex-col items-center justify-center p-8 lg:p-12 text-center overflow-hidden border-r border-[#223354]/50">
          
          {/* Subtle Ambient Radial Golden Warmth */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_35%,rgba(217,169,40,0.16)_0%,transparent_65%)]" />

          {/* Concentric Gold Arcs: Top-Left */}
          <svg 
            className="absolute top-0 left-0 w-36 h-36 lg:w-44 lg:h-44 pointer-events-none opacity-40 select-none z-0" 
            viewBox="0 0 150 150"
            fill="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="deskGoldArcTL" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F5D88A" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#D4AF37" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#8C6D1F" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            <circle cx="0" cy="0" r="45" stroke="url(#deskGoldArcTL)" strokeWidth="1.8" />
            <circle cx="0" cy="0" r="85" stroke="url(#deskGoldArcTL)" strokeWidth="1.8" />
            <circle cx="0" cy="0" r="125" stroke="url(#deskGoldArcTL)" strokeWidth="1.8" />
          </svg>

          {/* Concentric Gold Arcs: Bottom-Left */}
          <svg 
            className="absolute bottom-0 left-0 w-36 h-36 lg:w-44 lg:h-44 pointer-events-none opacity-40 select-none z-0" 
            viewBox="0 0 150 150"
            fill="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="deskGoldArcBL" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#F5D88A" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#D4AF37" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#8C6D1F" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            <circle cx="0" cy="150" r="45" stroke="url(#deskGoldArcBL)" strokeWidth="1.8" />
            <circle cx="0" cy="150" r="85" stroke="url(#deskGoldArcBL)" strokeWidth="1.8" />
            <circle cx="0" cy="150" r="125" stroke="url(#deskGoldArcBL)" strokeWidth="1.8" />
          </svg>
          
          {/* Left Panel Content */}
          <div className="relative z-10 flex flex-col items-center max-w-[360px] w-full">
            
            {/* Header Micro-Pill Tag */}
            <div className="flex justify-center mb-3">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#121c33]/90 border border-[#D9A928]/40 text-[10px] text-[#F5D88A] font-bold tracking-[0.22em] uppercase shadow-md">
                <span className="text-[#D9A928] text-[9px]">✦</span>
                OFFICIAL BRAND
                <span className="text-[#D9A928] text-[9px]">✦</span>
              </span>
            </div>

            {/* Signature Luxury Logo Badge with Multilayer Glow & Shimmer */}
            <div className="relative group mb-5">
              {/* 1. Breathing Golden Halo Glow Aura */}
              <div className="absolute -inset-4 bg-gradient-to-r from-[#D9A928]/35 via-[#F5D88A]/45 to-[#D9A928]/35 rounded-full blur-2xl opacity-60 animate-gold-halo pointer-events-none" />

              {/* 2. Double Metallic Gold Squircle Bezel Container */}
              <div className="w-[140px] h-[140px] sm:w-[160px] sm:h-[160px] lg:w-[185px] lg:h-[185px] p-2.5 lg:p-3 rounded-[2rem] bg-[#070c18] border-2 border-[#D9A928]/70 shadow-[0_16px_40px_rgba(0,0,0,0.7),0_0_35px_rgba(217,169,40,0.25)] relative overflow-hidden transition-all duration-500 group-hover:scale-105 group-hover:border-[#F5D88A] group-hover:shadow-[0_20px_50px_rgba(217,169,40,0.4)]">
                
                {/* Metallic Inner Inset Bezel */}
                <div className="absolute inset-1 rounded-[1.65rem] border border-[#D9A928]/35 pointer-events-none z-10" />
                
                {/* Glass Diagonal Shimmer Sweep Highlight */}
                <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none z-20 animate-logo-shimmer" />

                {/* The Royal Sabi Logo Image */}
                <img 
                  src="/logo.jpeg" 
                  alt="Sabi Return Gifts" 
                  className="w-full h-full object-cover rounded-[1.4rem] relative z-0 transition-transform duration-500 group-hover:scale-105" 
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  width="185"
                  height="185"
                />
              </div>
            </div>
            
            {/* Brand Titles: Regal Ivory White #F8F5ED */}
            <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-serif font-bold text-[#F8F5ED] tracking-[0.1em] mb-1 drop-shadow-md">
              SABI RETURNS
            </h1>
            {/* Subtitle: Radiant Gold #D9A928 */}
            <p className="text-[11px] sm:text-xs font-bold tracking-[0.28em] text-[#D9A928] uppercase drop-shadow-sm mb-3">
              PREMIUM GIFTING SOLUTIONS
            </p>
            
            {/* Signature Gold Diamond Ornament Line */}
            <div className="flex items-center justify-center gap-3 my-2 w-full max-w-[200px]">
              <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#D9A928]/60 to-[#D9A928]" />
              <span className="text-[#F5D88A] text-xs">◆</span>
              <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-[#D9A928]/60 to-[#D9A928]" />
            </div>
            
            {/* Tagline: Muted Slate-White #A0AFC7 */}
            <p className="text-[#A0AFC7] text-xs lg:text-[13px] font-medium px-4 leading-relaxed max-w-[320px] text-center">
              Empowering your celebrations with elegant, secure, and seamless return gift solutions.
            </p>
          </div>
        </div>

        {/* ================= RIGHT SIDE (3D BOOK PAGE FLIP: Sign In / Register) ================= */}
        <div className="w-full md:w-1/2 relative bg-gradient-to-b from-[#0e172e] via-[#0c1427] to-[#080f20] book-perspective overflow-hidden">
          
          <div className={`book-card-inner ${isFlipped ? "is-flipped" : ""}`}>
            
            {/* ---------------- FRONT PAGE: SIGN IN ---------------- */}
            <div className="book-face p-6 sm:p-8 lg:p-12 relative overflow-hidden bg-gradient-to-b from-[#0e172e] via-[#0c1427] to-[#080f20]">
              
              {/* Concentric Gold Arcs: Top-Right */}
              <svg 
                className="absolute top-0 right-0 w-36 h-36 lg:w-44 lg:h-44 pointer-events-none opacity-40 select-none z-0" 
                viewBox="0 0 150 150"
                fill="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="deskGoldArcTR" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#F5D88A" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#D4AF37" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#8C6D1F" stopOpacity="0.1" />
                  </linearGradient>
                </defs>
                <circle cx="150" cy="0" r="45" stroke="url(#deskGoldArcTR)" strokeWidth="1.8" />
                <circle cx="150" cy="0" r="85" stroke="url(#deskGoldArcTR)" strokeWidth="1.8" />
                <circle cx="150" cy="0" r="125" stroke="url(#deskGoldArcTR)" strokeWidth="1.8" />
              </svg>

              {/* Concentric Gold Arcs: Bottom-Right */}
              <svg 
                className="absolute bottom-0 right-0 w-36 h-36 lg:w-44 lg:h-44 pointer-events-none opacity-40 select-none z-0" 
                viewBox="0 0 150 150"
                fill="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="deskGoldArcBR" x1="100%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#F5D88A" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#D4AF37" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#8C6D1F" stopOpacity="0.1" />
                  </linearGradient>
                </defs>
                <circle cx="150" cy="150" r="45" stroke="url(#deskGoldArcBR)" strokeWidth="1.8" />
                <circle cx="150" cy="150" r="85" stroke="url(#deskGoldArcBR)" strokeWidth="1.8" />
                <circle cx="150" cy="150" r="125" stroke="url(#deskGoldArcBR)" strokeWidth="1.8" />
              </svg>

              <div className="max-w-[380px] w-full mx-auto space-y-5 lg:space-y-6 relative z-10">
                
                {/* Header: Regal Serif SIGN IN */}
                <div className="text-center space-y-1">
                  <h2 className="text-2xl sm:text-3xl lg:text-[34px] font-serif font-bold text-[#F8F5ED] tracking-[0.14em] drop-shadow-md">
                    SIGN IN
                  </h2>
                  <div className="flex items-center justify-center gap-3 mt-2 w-full max-w-[160px] mx-auto">
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#D9A928]/60 to-[#D9A928]" />
                    <span className="text-[#F5D88A] text-xs">◆</span>
                    <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-[#D9A928]/60 to-[#D9A928]" />
                  </div>
                </div>

                {/* Error Message Display */}
                {loginError && (
                  <div className="bg-red-500/15 border border-red-500/40 text-red-300 text-xs sm:text-sm font-medium px-3.5 py-2 rounded-xl text-center shadow-inner">
                    {loginError}
                  </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleLoginSubmit} className="space-y-4 lg:space-y-5">
                  <div className="space-y-3.5">
                    
                    {/* USERNAME FIELD */}
                    <div className="space-y-1.5 text-left">
                      <label htmlFor="username" className="flex items-center gap-1.5 text-[11px] font-bold text-[#D9A928] uppercase tracking-[0.2em]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D9A928]" />
                        <span>USERNAME</span>
                      </label>
                      <div className="w-full h-[52px] rounded-xl bg-[#080e1d]/90 border border-[#223354] hover:border-[#D9A928]/50 focus-within:border-[#F5D88A] focus-within:ring-2 focus-within:ring-[#D9A928]/25 shadow-[0_4px_16px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] px-3.5 flex items-center transition-all duration-300">
                        <div className="w-8 h-8 rounded-lg bg-[#D9A928]/15 border border-[#D9A928]/35 flex items-center justify-center mr-3 shrink-0">
                          <User className="h-4.5 w-4.5 text-[#F5D88A]" />
                        </div>
                        <input 
                          id="username" 
                          type="text"
                          value={username} 
                          onChange={(e) => setUsername(e.target.value)} 
                          placeholder="Enter your username" 
                          required 
                          autoComplete="username"
                          className="w-full flex-1 bg-transparent border-none outline-none text-[#F8F5ED] placeholder-[#73829C] text-sm sm:text-base font-medium shadow-none focus:ring-0 focus:outline-none p-0"
                        />
                      </div>
                    </div>
                    
                    {/* PASSWORD FIELD */}
                    <div className="space-y-1.5 text-left">
                      <label htmlFor="password" className="flex items-center gap-1.5 text-[11px] font-bold text-[#D9A928] uppercase tracking-[0.2em]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D9A928]" />
                        <span>PASSWORD</span>
                      </label>
                      <div className="w-full h-[52px] rounded-xl bg-[#080e1d]/90 border border-[#223354] hover:border-[#D9A928]/50 focus-within:border-[#F5D88A] focus-within:ring-2 focus-within:ring-[#D9A928]/25 shadow-[0_4px_16px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] px-3.5 flex items-center transition-all duration-300">
                        <div className="w-8 h-8 rounded-lg bg-[#D9A928]/15 border border-[#D9A928]/35 flex items-center justify-center mr-3 shrink-0">
                          <Lock className="h-4.5 w-4.5 text-[#F5D88A]" />
                        </div>
                        <input 
                          id="password" 
                          type={showPassword ? "text" : "password"} 
                          value={password} 
                          onChange={(e) => setPassword(e.target.value)} 
                          placeholder="Enter password" 
                          required 
                          autoComplete="current-password"
                          className="w-full flex-1 bg-transparent border-none outline-none text-[#F8F5ED] placeholder-[#73829C] text-sm sm:text-base font-medium shadow-none focus:ring-0 focus:outline-none p-0"
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowPassword(!showPassword)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#D9A928] hover:text-[#F5D88A] hover:bg-[#D9A928]/15 transition-all cursor-pointer shrink-0 ml-1"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Options Row: Remember Me & Register */}
                  <div className="flex items-center justify-between px-0.5 pt-0.5">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="remember" 
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(!!checked)}
                        className="w-4.5 h-4.5 rounded border-[#223354] data-[state=checked]:bg-[#D9A928] data-[state=checked]:border-[#D9A928] data-[state=checked]:text-[#080F23] focus-visible:ring-1 focus-visible:ring-[#D9A928]" 
                      />
                      <label
                        htmlFor="remember"
                        className="text-xs sm:text-sm font-medium leading-none text-[#C8D1E0] cursor-pointer hover:text-white transition-colors select-none"
                      >
                        Remember Me?
                      </label>
                    </div>

                    {/* Book Flip to Register Page */}
                    <button
                      type="button"
                      onClick={() => setIsFlipped(true)}
                      className="text-xs sm:text-sm font-semibold text-[#D9A928] hover:text-[#F5D88A] transition-colors underline underline-offset-4 cursor-pointer"
                    >
                      Register
                    </button>
                  </div>

                  {/* Action Button: Luxury Golden Key Sign In */}
                  <div className="pt-2">
                    <Button 
                      type="submit" 
                      disabled={isLoading}
                      className="w-full h-13 min-h-[52px] bg-gradient-to-r from-[#C89B2B] via-[#F4CF68] to-[#C89B2B] hover:brightness-110 active:scale-[0.985] text-[#080F23] font-black text-sm uppercase tracking-[0.22em] rounded-2xl shadow-[0_12px_32px_rgba(217,169,40,0.5),0_2px_8px_rgba(0,0,0,0.4)] transition-all duration-300 flex items-center justify-center gap-2.5 border-none cursor-pointer relative overflow-hidden group touch-friendly-btn"
                    >
                      <Key className="w-5 h-5 text-[#080F23] stroke-[2.7] group-hover:rotate-12 transition-transform duration-300" />
                      <span>{isLoading ? "Signing In..." : "SIGN IN"}</span>
                    </Button>
                  </div>
                  
                </form>
              </div>
            </div>

            {/* ---------------- BACK PAGE: REGISTER (3D Book Turned View) ---------------- */}
            <div className="book-face-back p-6 sm:p-8 lg:p-12 relative overflow-hidden bg-gradient-to-b from-[#0e172e] via-[#0c1427] to-[#080f20]">
              
              {/* Concentric Gold Arcs: Top-Right */}
              <svg 
                className="absolute top-0 right-0 w-36 h-36 lg:w-44 lg:h-44 pointer-events-none opacity-40 select-none z-0" 
                viewBox="0 0 150 150"
                fill="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="deskRegGoldArcTR" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#F5D88A" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#D4AF37" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#8C6D1F" stopOpacity="0.1" />
                  </linearGradient>
                </defs>
                <circle cx="150" cy="0" r="45" stroke="url(#deskRegGoldArcTR)" strokeWidth="1.8" />
                <circle cx="150" cy="0" r="85" stroke="url(#deskRegGoldArcTR)" strokeWidth="1.8" />
                <circle cx="150" cy="0" r="125" stroke="url(#deskRegGoldArcTR)" strokeWidth="1.8" />
              </svg>

              {/* Concentric Gold Arcs: Bottom-Right */}
              <svg 
                className="absolute bottom-0 right-0 w-36 h-36 lg:w-44 lg:h-44 pointer-events-none opacity-40 select-none z-0" 
                viewBox="0 0 150 150"
                fill="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="deskRegGoldArcBR" x1="100%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#F5D88A" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#D4AF37" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#8C6D1F" stopOpacity="0.1" />
                  </linearGradient>
                </defs>
                <circle cx="150" cy="150" r="45" stroke="url(#deskRegGoldArcBR)" strokeWidth="1.8" />
                <circle cx="150" cy="150" r="85" stroke="url(#deskRegGoldArcBR)" strokeWidth="1.8" />
                <circle cx="150" cy="150" r="125" stroke="url(#deskRegGoldArcBR)" strokeWidth="1.8" />
              </svg>

              <div className="max-w-[380px] w-full mx-auto space-y-4 lg:space-y-5 relative z-10">
                
                {/* Header: Regal Serif REGISTER */}
                <div className="text-center space-y-1">
                  <h2 className="text-2xl sm:text-3xl lg:text-[34px] font-serif font-bold text-[#F8F5ED] tracking-[0.14em] drop-shadow-md">
                    REGISTER
                  </h2>
                  <div className="flex items-center justify-center gap-3 mt-2 w-full max-w-[160px] mx-auto">
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#D9A928]/60 to-[#D9A928]" />
                    <span className="text-[#F5D88A] text-xs">◆</span>
                    <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-[#D9A928]/60 to-[#D9A928]" />
                  </div>
                </div>

                {/* Error Message Display */}
                {registerError && (
                  <div className="bg-red-500/15 border border-red-500/40 text-red-300 text-xs sm:text-sm font-medium px-3.5 py-2 rounded-xl text-center shadow-inner">
                    {registerError}
                  </div>
                )}

                {/* Register Form */}
                <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                  <div className="space-y-3">
                    
                    {/* FULL NAME FIELD */}
                    <div className="space-y-1 text-left">
                      <label htmlFor="reg-name" className="flex items-center gap-1.5 text-[11px] font-bold text-[#D9A928] uppercase tracking-[0.2em]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D9A928]" />
                        <span>FULL NAME</span>
                      </label>
                      <div className="w-full h-[50px] rounded-xl bg-[#080e1d]/90 border border-[#223354] hover:border-[#D9A928]/50 focus-within:border-[#F5D88A] focus-within:ring-2 focus-within:ring-[#D9A928]/25 shadow-[0_4px_16px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] px-3.5 flex items-center transition-all duration-300">
                        <div className="w-8 h-8 rounded-lg bg-[#D9A928]/15 border border-[#D9A928]/35 flex items-center justify-center mr-3 shrink-0">
                          <User className="h-4.5 w-4.5 text-[#F5D88A]" />
                        </div>
                        <input 
                          id="reg-name" 
                          type="text"
                          value={regName} 
                          onChange={(e) => setRegName(e.target.value)} 
                          placeholder="Enter your full name" 
                          required 
                          className="w-full flex-1 bg-transparent border-none outline-none text-[#F8F5ED] placeholder-[#73829C] text-sm sm:text-base font-medium shadow-none focus:ring-0 focus:outline-none p-0"
                        />
                      </div>
                    </div>

                    {/* USERNAME FIELD */}
                    <div className="space-y-1 text-left">
                      <label htmlFor="reg-username" className="flex items-center gap-1.5 text-[11px] font-bold text-[#D9A928] uppercase tracking-[0.2em]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D9A928]" />
                        <span>USERNAME</span>
                      </label>
                      <div className="w-full h-[50px] rounded-xl bg-[#080e1d]/90 border border-[#223354] hover:border-[#D9A928]/50 focus-within:border-[#F5D88A] focus-within:ring-2 focus-within:ring-[#D9A928]/25 shadow-[0_4px_16px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] px-3.5 flex items-center transition-all duration-300">
                        <div className="w-8 h-8 rounded-lg bg-[#D9A928]/15 border border-[#D9A928]/35 flex items-center justify-center mr-3 shrink-0">
                          <User className="h-4.5 w-4.5 text-[#F5D88A]" />
                        </div>
                        <input 
                          id="reg-username" 
                          type="text"
                          value={regUsername} 
                          onChange={(e) => setRegUsername(e.target.value)} 
                          placeholder="Create username" 
                          required 
                          autoComplete="username"
                          className="w-full flex-1 bg-transparent border-none outline-none text-[#F8F5ED] placeholder-[#73829C] text-sm sm:text-base font-medium shadow-none focus:ring-0 focus:outline-none p-0"
                        />
                      </div>
                    </div>
                    
                    {/* PASSWORD FIELD */}
                    <div className="space-y-1 text-left">
                      <label htmlFor="reg-password" className="flex items-center gap-1.5 text-[11px] font-bold text-[#D9A928] uppercase tracking-[0.2em]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D9A928]" />
                        <span>PASSWORD</span>
                      </label>
                      <div className="w-full h-[50px] rounded-xl bg-[#080e1d]/90 border border-[#223354] hover:border-[#D9A928]/50 focus-within:border-[#F5D88A] focus-within:ring-2 focus-within:ring-[#D9A928]/25 shadow-[0_4px_16px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] px-3.5 flex items-center transition-all duration-300">
                        <div className="w-8 h-8 rounded-lg bg-[#D9A928]/15 border border-[#D9A928]/35 flex items-center justify-center mr-3 shrink-0">
                          <Lock className="h-4.5 w-4.5 text-[#F5D88A]" />
                        </div>
                        <input 
                          id="reg-password" 
                          type={showRegPassword ? "text" : "password"} 
                          value={regPassword} 
                          onChange={(e) => setRegPassword(e.target.value)} 
                          placeholder="Create password" 
                          required 
                          className="w-full flex-1 bg-transparent border-none outline-none text-[#F8F5ED] placeholder-[#73829C] text-sm sm:text-base font-medium shadow-none focus:ring-0 focus:outline-none p-0"
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowRegPassword(!showRegPassword)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#D9A928] hover:text-[#F5D88A] hover:bg-[#D9A928]/15 transition-all cursor-pointer shrink-0 ml-1"
                          aria-label={showRegPassword ? "Hide password" : "Show password"}
                        >
                          {showRegPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Flip Back to Login Row */}
                  <div className="flex items-center justify-between px-0.5 pt-0.5">
                    <span className="text-xs sm:text-sm text-[#A0AFC7] font-medium">
                      Already have an account?
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsFlipped(false)}
                      className="text-xs sm:text-sm font-semibold text-[#D9A928] hover:text-[#F5D88A] transition-colors underline underline-offset-4 cursor-pointer"
                    >
                      Sign In
                    </button>
                  </div>

                  {/* Action Button */}
                  <div className="pt-2">
                    <Button 
                      type="submit" 
                      disabled={isRegistering}
                      className="w-full h-13 min-h-[52px] bg-gradient-to-r from-[#C89B2B] via-[#F4CF68] to-[#C89B2B] hover:brightness-110 active:scale-[0.985] text-[#080F23] font-black text-sm uppercase tracking-[0.22em] rounded-2xl shadow-[0_12px_32px_rgba(217,169,40,0.5),0_2px_8px_rgba(0,0,0,0.4)] transition-all duration-300 flex items-center justify-center gap-2.5 border-none cursor-pointer relative overflow-hidden group touch-friendly-btn"
                    >
                      <UserPlus className="w-5 h-5 text-[#080F23] stroke-[2.7]" />
                      <span>{isRegistering ? "Creating..." : "CREATE ACCOUNT"}</span>
                    </Button>
                  </div>
                  
                </form>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};

export default Login;
