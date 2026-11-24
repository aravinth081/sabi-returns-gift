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
      className="min-h-[100dvh] flex items-center justify-center p-0 md:p-8 select-none relative overflow-x-hidden overflow-y-auto"
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
      {/* MOBILE VIEW (Screens < md) - Ultra-Luxury Golden Leaf Layout with Sabi Return Gifts Palette */}
      {/* ======================================================== */}
      <div className="md:hidden w-full min-h-[100dvh] flex flex-col justify-between py-6 px-5 relative z-10 overflow-y-auto">
        
        {/* 1. Corner Luxury Concentric Gold Arcs (Top-Left, Top-Right, Bottom-Left, Bottom-Right) */}
        {/* Top-Left Concentric Arcs */}
        <svg 
          className="absolute -top-6 -left-6 w-36 h-36 pointer-events-none opacity-45 select-none z-0" 
          viewBox="0 0 150 150"
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
          <circle cx="15" cy="15" r="45" stroke="url(#goldArcTL)" strokeWidth="1.5" />
          <circle cx="15" cy="15" r="75" stroke="url(#goldArcTL)" strokeWidth="1.5" />
          <circle cx="15" cy="15" r="105" stroke="url(#goldArcTL)" strokeWidth="1.5" />
        </svg>

        {/* Top-Right Concentric Arcs */}
        <svg 
          className="absolute -top-6 -right-6 w-36 h-36 pointer-events-none opacity-45 select-none z-0" 
          viewBox="0 0 150 150"
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
          <circle cx="135" cy="15" r="45" stroke="url(#goldArcTR)" strokeWidth="1.5" />
          <circle cx="135" cy="15" r="75" stroke="url(#goldArcTR)" strokeWidth="1.5" />
          <circle cx="135" cy="15" r="105" stroke="url(#goldArcTR)" strokeWidth="1.5" />
        </svg>

        {/* Bottom-Left Concentric Arcs */}
        <svg 
          className="absolute -bottom-6 -left-6 w-36 h-36 pointer-events-none opacity-45 select-none z-0" 
          viewBox="0 0 150 150"
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
          <circle cx="15" cy="135" r="45" stroke="url(#goldArcBL)" strokeWidth="1.5" />
          <circle cx="15" cy="135" r="75" stroke="url(#goldArcBL)" strokeWidth="1.5" />
          <circle cx="15" cy="135" r="105" stroke="url(#goldArcBL)" strokeWidth="1.5" />
        </svg>

        {/* Bottom-Right Concentric Arcs */}
        <svg 
          className="absolute -bottom-6 -right-6 w-36 h-36 pointer-events-none opacity-45 select-none z-0" 
          viewBox="0 0 150 150"
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
          <circle cx="135" cy="135" r="45" stroke="url(#goldArcBR)" strokeWidth="1.5" />
          <circle cx="135" cy="135" r="75" stroke="url(#goldArcBR)" strokeWidth="1.5" />
          <circle cx="135" cy="135" r="105" stroke="url(#goldArcBR)" strokeWidth="1.5" />
        </svg>

        {/* 2. Top Centered Brand Section with Luxury Animated Effects */}
        <div className="relative z-10 flex flex-col items-center pt-2 sm:pt-4">
          
          {/* Subtle Breathing Radial Golden Halo Aura Behind Logo */}
          <div 
            className="absolute top-1 w-32 h-32 rounded-full pointer-events-none animate-gold-halo" 
            style={{ background: "radial-gradient(circle, #D9A928 0%, rgba(245, 158, 11, 0.45) 35%, transparent 70%)" }}
          />

          {/* Sabi Return Gifts Luxury Logo Badge with Float & Shimmer Effect */}
          <div className="relative z-10 animate-logo-float">
            {/* Outer Metallic Gold Gradient Rim */}
            <div className="w-[94px] h-[94px] sm:w-[106px] sm:h-[106px] p-[2.5px] rounded-3xl bg-gradient-to-tr from-[#9B7722] via-[#F5D88A] to-[#D4AF37] shadow-[0_14px_36px_rgba(0,0,0,0.85),0_0_28px_rgba(217,169,40,0.45)] relative group overflow-hidden transition-all duration-300">
              
              {/* Inner Black Logo Container */}
              <div className="w-full h-full rounded-[1.35rem] bg-[#000000] p-1.5 flex items-center justify-center relative overflow-hidden">
                
                {/* Diagonal Light Shimmer Reflection Sweep Across Logo Glass */}
                <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none animate-logo-shimmer z-20" />
                
                <img 
                  src="/logo.jpeg" 
                  alt="Sabi Return Gifts" 
                  className="w-full h-full object-cover rounded-[1.1rem] relative z-10"
                  loading="eager"
                  decoding="sync"
                  fetchPriority="high"
                  width="104"
                  height="104"
                />
              </div>
            </div>
          </div>

          {/* Brand Name: Metallic Gold & Ivory Shimmer Gradient */}
          <h1 className="text-2xl sm:text-[28px] font-serif font-black tracking-[0.24em] bg-gradient-to-r from-[#FFF9E6] via-[#F5D88A] to-[#D4AF37] bg-clip-text text-transparent uppercase mt-3.5 text-center drop-shadow-md">
            SABI RETURNS
          </h1>

          {/* Tagline */}
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="w-2 h-[1px] bg-[#D9A928]/70" />
            <p className="text-[10px] sm:text-[11px] font-black tracking-[0.3em] text-[#D9A928] uppercase drop-shadow-sm">
              PREMIUM GIFTING SOLUTIONS
            </p>
            <span className="w-2 h-[1px] bg-[#D9A928]/70" />
          </div>
        </div>

        {/* 3. Form Content Section (Login or Register) */}
        <div className="relative z-10 w-full max-w-[380px] mx-auto my-auto py-3">
          {!isFlipped ? (
            /* --- MOBILE LOGIN FORM --- */
            <div className="space-y-4">
              {/* Screen Title */}
              <div className="text-center">
                <h2 className="text-2xl font-serif font-bold text-[#F8F5ED] tracking-[0.18em] uppercase drop-shadow-sm">
                  SIGN IN
                </h2>

                {/* Luxury Jewelry Diamond Ornament Divider */}
                <div className="flex items-center justify-center gap-2.5 mt-2.5">
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

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {/* Username */}
                <div>
                  <label 
                    htmlFor="mobile-username" 
                    className="block text-[11px] font-black tracking-widest text-[#9DAAC2] uppercase mb-1.5 pl-1"
                  >
                    USERNAME
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4.5 pointer-events-none">
                      <User className="h-5 w-5 text-[#D9A928] group-focus-within:text-[#F5D88A] transition-colors" />
                    </div>
                    <input 
                      id="mobile-username" 
                      type="text"
                      value={username} 
                      onChange={(e) => setUsername(e.target.value)} 
                      placeholder="Enter your username" 
                      required 
                      autoComplete="username"
                      className="w-full pl-12 pr-4 h-[54px] bg-[#0c1427]/85 backdrop-blur-md border border-[#223354] hover:border-[#D9A928]/50 focus:border-[#F5D88A] focus:ring-2 focus:ring-[#D9A928]/25 rounded-2xl text-[#E8EAF0] placeholder-[#7D8B9E] text-sm font-medium outline-none transition-all duration-200 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)]"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label 
                    htmlFor="mobile-password" 
                    className="block text-[11px] font-black tracking-widest text-[#9DAAC2] uppercase mb-1.5 pl-1"
                  >
                    PASSWORD
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4.5 pointer-events-none">
                      <Lock className="h-5 w-5 text-[#D9A928] group-focus-within:text-[#F5D88A] transition-colors" />
                    </div>
                    <input 
                      id="mobile-password" 
                      type={showPassword ? "text" : "password"} 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      placeholder="Enter password" 
                      required 
                      autoComplete="current-password"
                      className="w-full pl-12 pr-12 h-[54px] bg-[#0c1427]/85 backdrop-blur-md border border-[#223354] hover:border-[#D9A928]/50 focus:border-[#F5D88A] focus:ring-2 focus:ring-[#D9A928]/25 rounded-2xl text-[#E8EAF0] placeholder-[#7D8B9E] text-sm font-medium outline-none transition-all duration-200 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)]"
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-4 text-[#D9A928] hover:text-[#F5D88A] transition-colors cursor-pointer"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
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
                    className="w-full h-13 min-h-[52px] bg-gradient-to-r from-[#C89B2B] via-[#F4CF68] to-[#C89B2B] hover:brightness-110 active:scale-[0.985] text-[#080F23] font-black text-sm uppercase tracking-[0.2em] rounded-2xl shadow-[0_10px_32px_rgba(217,169,40,0.5),0_2px_8px_rgba(0,0,0,0.4)] transition-all duration-300 flex items-center justify-center gap-2.5 border-none cursor-pointer relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-[-25deg] pointer-events-none -translate-x-[200%] group-hover:translate-x-[400%] transition-transform duration-1000" />
                    <Key className="w-5 h-5 text-[#080F23] stroke-[2.7] group-hover:rotate-12 transition-transform duration-300" />
                    <span>{isLoading ? "Signing In..." : "SIGN IN"}</span>
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            /* --- MOBILE REGISTER FORM --- */
            <div className="space-y-4">
              {/* Screen Title */}
              <div className="text-center">
                <h2 className="text-2xl font-serif font-bold text-[#F8F5ED] tracking-[0.18em] uppercase drop-shadow-sm">
                  REGISTER
                </h2>

                {/* Luxury Jewelry Diamond Ornament Divider */}
                <div className="flex items-center justify-center gap-2.5 mt-2.5">
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
                    className="block text-[11px] font-black tracking-widest text-[#9DAAC2] uppercase mb-1 pl-1"
                  >
                    FULL NAME
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4.5 pointer-events-none">
                      <User className="h-5 w-5 text-[#D9A928] group-focus-within:text-[#F5D88A] transition-colors" />
                    </div>
                    <input 
                      id="mobile-reg-name" 
                      type="text"
                      value={regName} 
                      onChange={(e) => setRegName(e.target.value)} 
                      placeholder="Enter your full name" 
                      required 
                      className="w-full pl-12 pr-4 h-[52px] bg-[#0c1427]/85 backdrop-blur-md border border-[#223354] hover:border-[#D9A928]/50 focus:border-[#F5D88A] focus:ring-2 focus:ring-[#D9A928]/25 rounded-2xl text-[#E8EAF0] placeholder-[#7D8B9E] text-sm font-medium outline-none transition-all duration-200 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)]"
                    />
                  </div>
                </div>

                {/* Username */}
                <div>
                  <label 
                    htmlFor="mobile-reg-username" 
                    className="block text-[11px] font-black tracking-widest text-[#9DAAC2] uppercase mb-1 pl-1"
                  >
                    USERNAME
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4.5 pointer-events-none">
                      <User className="h-5 w-5 text-[#D9A928] group-focus-within:text-[#F5D88A] transition-colors" />
                    </div>
                    <input 
                      id="mobile-reg-username" 
                      type="text"
                      value={regUsername} 
                      onChange={(e) => setRegUsername(e.target.value)} 
                      placeholder="Choose a username" 
                      required 
                      autoComplete="username"
                      className="w-full pl-12 pr-4 h-[52px] bg-[#0c1427]/85 backdrop-blur-md border border-[#223354] hover:border-[#D9A928]/50 focus:border-[#F5D88A] focus:ring-2 focus:ring-[#D9A928]/25 rounded-2xl text-[#E8EAF0] placeholder-[#7D8B9E] text-sm font-medium outline-none transition-all duration-200 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)]"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label 
                    htmlFor="mobile-reg-password" 
                    className="block text-[11px] font-black tracking-widest text-[#9DAAC2] uppercase mb-1 pl-1"
                  >
                    PASSWORD
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4.5 pointer-events-none">
                      <Lock className="h-5 w-5 text-[#D9A928] group-focus-within:text-[#F5D88A] transition-colors" />
                    </div>
                    <input 
                      id="mobile-reg-password" 
                      type={showRegPassword ? "text" : "password"} 
                      value={regPassword} 
                      onChange={(e) => setRegPassword(e.target.value)} 
                      placeholder="Create password" 
                      required 
                      className="w-full pl-12 pr-12 h-[52px] bg-[#0c1427]/85 backdrop-blur-md border border-[#223354] hover:border-[#D9A928]/50 focus:border-[#F5D88A] focus:ring-2 focus:ring-[#D9A928]/25 rounded-2xl text-[#E8EAF0] placeholder-[#7D8B9E] text-sm font-medium outline-none transition-all duration-200 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)]"
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-4 text-[#D9A928] hover:text-[#F5D88A] transition-colors cursor-pointer"
                      aria-label={showRegPassword ? "Hide password" : "Show password"}
                    >
                      {showRegPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
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
                    className="w-full h-13 min-h-[52px] bg-gradient-to-r from-[#C89B2B] via-[#F4CF68] to-[#C89B2B] hover:brightness-110 active:scale-[0.985] text-[#080F23] font-black text-sm uppercase tracking-[0.2em] rounded-2xl shadow-[0_10px_32px_rgba(217,169,40,0.5),0_2px_8px_rgba(0,0,0,0.4)] transition-all duration-300 flex items-center justify-center gap-2.5 border-none cursor-pointer relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-[-25deg] pointer-events-none -translate-x-[200%] group-hover:translate-x-[400%] transition-transform duration-1000" />
                    <UserPlus className="w-5 h-5 text-[#080F23] stroke-[2.7] group-hover:scale-110 transition-transform duration-300" />
                    <span>{isRegistering ? "Creating..." : "CREATE ACCOUNT"}</span>
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* 4. Bottom Security / Official Portal Micro-Badge */}
        <div className="relative z-10 text-center pb-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#101a33]/60 border border-[#223354]/60 text-[10px] text-[#9DAAC2]/80 font-semibold tracking-wider uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            Sabi Return Gifts • Secure Portal
          </div>
        </div>

      </div>

      {/* ======================================================== */}
      {/* DESKTOP VIEW (Screens >= md) - Split 3D Book Layout */}
      {/* ======================================================== */}
      <div className="hidden md:flex w-full max-w-[1040px] min-h-[540px] md:min-h-[610px] rounded-2xl sm:rounded-[2.25rem] shadow-[0_25px_80px_rgba(0,0,0,0.65),0_0_50px_rgba(0,0,0,0.4)] flex-row overflow-hidden border border-white/15 relative z-10 my-auto transition-all duration-300">
        
        {/* ================= LEFT SIDE (Rich Champagne Gold Branding: #D9A928) ================= */}
        <div className="w-full md:w-1/2 relative bg-[#D9A928] flex flex-col items-center justify-center p-6 sm:p-8 md:p-12 text-center overflow-hidden min-h-[220px] sm:min-h-[280px] md:min-h-auto">
          
          {/* Subtle Dynamic Bottom Waves: #E4BE5C */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Wave 1 */}
            <svg 
              viewBox="0 0 500 500" 
              preserveAspectRatio="none" 
              className="absolute bottom-0 left-0 w-full h-[52%] opacity-60"
            >
              <path 
                d="M0,280 C150,210 270,330 420,260 C460,240 480,245 500,255 L500,500 L0,500 Z" 
                fill="#E4BE5C" 
              />
            </svg>

            {/* Wave 2 */}
            <svg 
              viewBox="0 0 500 500" 
              preserveAspectRatio="none" 
              className="absolute bottom-0 left-0 w-full h-[40%] opacity-90"
            >
              <path 
                d="M0,340 C140,260 300,380 500,300 L500,500 L0,500 Z" 
                fill="#E4BE5C" 
              />
            </svg>

            {/* Wave 3 */}
            <svg 
              viewBox="0 0 500 500" 
              preserveAspectRatio="none" 
              className="absolute bottom-0 left-0 w-full h-[26%] opacity-100"
            >
              <path 
                d="M0,400 C160,330 340,420 500,360 L500,500 L0,500 Z" 
                fill="#E4BE5C" 
              />
            </svg>
          </div>
          
          {/* Left Panel Content */}
          <div className="relative z-10 flex flex-col items-center max-w-[360px]">
            {/* Logo Badge Container */}
            <div className="w-[110px] h-[110px] sm:w-[160px] sm:h-[160px] md:w-[220px] md:h-[220px] p-2 flex items-center justify-center mb-3 sm:mb-6 rounded-2xl sm:rounded-[1.75rem] overflow-hidden shadow-[0_16px_35px_rgba(0,0,0,0.32)] bg-black border border-[#F1D27A]/30 relative group transition-transform duration-500 hover:scale-[1.02]">
              <img 
                src="/logo.jpeg" 
                alt="Sabi Return Gifts" 
                className="w-full h-full object-cover rounded-xl sm:rounded-[1.4rem]" 
                loading="eager"
                decoding="async"
                fetchPriority="high"
                width="220"
                height="220"
              />
            </div>
            
            {/* Brand Titles: Ivory White #F8F5ED */}
            <h1 className="text-xl sm:text-2xl md:text-[34px] font-serif font-bold text-[#F8F5ED] tracking-wider mb-1 drop-shadow-md">
              SABI RETURNS
            </h1>
            {/* Subtitle: Soft White #E8EAF0 */}
            <p className="text-[10px] sm:text-xs font-bold tracking-[0.25em] sm:tracking-[0.3em] text-[#E8EAF0] mb-2 sm:mb-4 uppercase drop-shadow-sm opacity-95">
              PREMIUM GIFTING SOLUTIONS
            </p>
            
            {/* Decorative Line: Champagne #F1D27A */}
            <div className="w-10 sm:w-12 h-[2px] bg-[#F1D27A] mb-2 sm:mb-4 rounded-full shadow-sm"></div>
            
            {/* Tagline: Soft White #E8EAF0 */}
            <p className="text-[#E8EAF0] text-[11px] sm:text-[13px] font-medium px-2 sm:px-3 leading-relaxed drop-shadow-sm opacity-95 max-w-[320px]">
              Empowering your celebrations with elegant,<br className="hidden sm:inline" /> secure, and seamless return gift solutions.
            </p>
          </div>
        </div>

        {/* ================= RIGHT SIDE (3D BOOK PAGE FLIP: Deep Navy #080F23 to #101A33) ================= */}
        <div className="w-full md:w-1/2 relative bg-gradient-to-b from-[#101A33] via-[#0C142A] to-[#080F23] book-perspective overflow-hidden">
          
          <div className={`book-card-inner ${isFlipped ? "is-flipped" : ""}`}>
            
            {/* ---------------- FRONT PAGE: LOGIN ---------------- */}
            <div className="book-face p-5 sm:p-8 md:p-10 lg:p-12">
              <div className="max-w-[400px] w-full mx-auto space-y-5 sm:space-y-7">
                
                {/* Header: Ivory White #F8F5ED & Muted Blue-Gray #9DAAC2 */}
                <div className="text-center space-y-1">
                  <h2 className="text-2xl sm:text-3xl md:text-[38px] font-serif font-bold text-[#F8F5ED] tracking-wide drop-shadow-md">
                    Login
                  </h2>
                  <p className="text-[#9DAAC2] text-xs sm:text-sm font-medium">
                    Sign in to your Sabi Returns account
                  </p>
                </div>

                {/* Error Message Display */}
                {loginError && (
                  <div className="bg-red-500/15 border border-red-500/40 text-red-300 text-xs sm:text-sm font-medium px-3.5 py-2.5 rounded-xl text-center">
                    {loginError}
                  </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleLoginSubmit} className="space-y-6">
                  <div className="space-y-4">
                    
                    {/* Username Input */}
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                        <User className="h-5 w-5 text-[#D9A628] transition-colors group-focus-within:text-[#F0C64A]" />
                      </div>
                      <input 
                        id="username" 
                        type="text"
                        value={username} 
                        onChange={(e) => setUsername(e.target.value)} 
                        placeholder="Username" 
                        required 
                        autoComplete="username"
                        className="w-full pl-12 pr-4 h-[52px] bg-[#131d35] border border-[#223354] focus:border-[#D9A628] focus:ring-1 focus:ring-[#D9A628] rounded-xl text-[#E8EAF0] placeholder-[#8995AA] text-sm sm:text-base font-medium outline-none focus:outline-none transition-all duration-200 shadow-inner"
                      />
                    </div>
                    
                    {/* Password Input */}
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                        <Lock className="h-5 w-5 text-[#D9A628] transition-colors group-focus-within:text-[#F0C64A]" />
                      </div>
                      <input 
                        id="password" 
                        type={showPassword ? "text" : "password"} 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        placeholder="Password" 
                        required 
                        autoComplete="current-password"
                        className="w-full pl-12 pr-12 h-[52px] bg-[#131d35] border border-[#223354] focus:border-[#D9A628] focus:ring-1 focus:ring-[#D9A628] rounded-xl text-[#E8EAF0] placeholder-[#8995AA] text-sm sm:text-base font-medium outline-none focus:outline-none transition-all duration-200 shadow-inner"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-4 text-[#D9A628] hover:text-[#E8BD45] transition-colors cursor-pointer"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Options Row: Remember Me & Register button (perfectly aligned with box edges) */}
                  <div className="flex items-center justify-between px-0.5 pt-0.5">
                    <div className="flex items-center space-x-2.5">
                      <Checkbox 
                        id="remember" 
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(!!checked)}
                        className="w-4.5 h-4.5 rounded border-[#223354] data-[state=checked]:bg-[#D9A628] data-[state=checked]:border-[#D9A628] data-[state=checked]:text-white focus-visible:ring-1 focus-visible:ring-[#D9A628]" 
                      />
                      <label
                        htmlFor="remember"
                        className="text-sm font-medium leading-none text-[#E8EAF0] cursor-pointer hover:text-white transition-colors select-none"
                      >
                        Remember Me?
                      </label>
                    </div>

                    {/* Book Flip to Register Page */}
                    <button
                      type="button"
                      onClick={() => setIsFlipped(true)}
                      className="text-sm font-semibold text-[#D9A628] hover:text-[#E8BD45] transition-colors underline underline-offset-4 cursor-pointer"
                    >
                      Register
                    </button>
                  </div>

                  {/* Action Button: Luxury Gold #D9A628 */}
                  <div className="pt-2 flex justify-center">
                    <Button 
                      type="submit" 
                      disabled={isLoading}
                      className="w-full sm:w-52 h-12 min-h-[44px] bg-[#D9A628] hover:bg-[#E8BD45] text-white font-bold rounded-full shadow-[0_8px_25px_rgba(217,166,40,0.5)] hover:shadow-[0_12px_32px_rgba(232,189,69,0.65)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 text-sm sm:text-base tracking-wide border-none cursor-pointer flex items-center justify-center touch-friendly-btn"
                    >
                      {isLoading ? "Logging In..." : "Log In"}
                    </Button>
                  </div>
                  
                </form>
              </div>
            </div>

            {/* ---------------- BACK PAGE: REGISTER (3D Book Turned View) ---------------- */}
            <div className="book-face-back p-5 sm:p-8 md:p-10 lg:p-12">
              <div className="max-w-[400px] w-full mx-auto space-y-5 sm:space-y-6">
                
                {/* Header: Ivory White #F8F5ED */}
                <div className="text-center space-y-1">
                  <h2 className="text-2xl sm:text-3xl md:text-[38px] font-serif font-bold text-[#F8F5ED] tracking-wide drop-shadow-md">
                    Register
                  </h2>
                  <p className="text-[#9DAAC2] text-xs sm:text-sm font-medium">
                    Create your Sabi Returns account
                  </p>
                </div>

                {/* Error Message Display */}
                {registerError && (
                  <div className="bg-red-500/15 border border-red-500/40 text-red-300 text-xs sm:text-sm font-medium px-3.5 py-2.5 rounded-xl text-center">
                    {registerError}
                  </div>
                )}

                {/* Register Form */}
                <form onSubmit={handleRegisterSubmit} className="space-y-5">
                  <div className="space-y-3.5">
                    
                    {/* Full Name Input */}
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                        <User className="h-5 w-5 text-[#D9A628] transition-colors group-focus-within:text-[#F0C64A]" />
                      </div>
                      <input 
                        id="reg-name" 
                        type="text"
                        value={regName} 
                        onChange={(e) => setRegName(e.target.value)} 
                        placeholder="Full Name" 
                        required 
                        className="w-full pl-12 pr-4 h-[52px] bg-[#131d35] border border-[#223354] focus:border-[#D9A628] focus:ring-1 focus:ring-[#D9A628] rounded-xl text-[#E8EAF0] placeholder-[#8995AA] text-sm sm:text-base font-medium outline-none focus:outline-none transition-all duration-200 shadow-inner"
                      />
                    </div>

                    {/* Username Input */}
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                        <User className="h-5 w-5 text-[#D9A628] transition-colors group-focus-within:text-[#F0C64A]" />
                      </div>
                      <input 
                        id="reg-username" 
                        type="text"
                        value={regUsername} 
                        onChange={(e) => setRegUsername(e.target.value)} 
                        placeholder="Username" 
                        required 
                        autoComplete="username"
                        className="w-full pl-12 pr-4 h-[52px] bg-[#131d35] border border-[#223354] focus:border-[#D9A628] focus:ring-1 focus:ring-[#D9A628] rounded-xl text-[#E8EAF0] placeholder-[#8995AA] text-sm sm:text-base font-medium outline-none focus:outline-none transition-all duration-200 shadow-inner"
                      />
                    </div>
                    
                    {/* Password Input */}
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                        <Lock className="h-5 w-5 text-[#D9A628] transition-colors group-focus-within:text-[#F0C64A]" />
                      </div>
                      <input 
                        id="reg-password" 
                        type={showRegPassword ? "text" : "password"} 
                        value={regPassword} 
                        onChange={(e) => setRegPassword(e.target.value)} 
                        placeholder="Password" 
                        required 
                        className="w-full pl-12 pr-12 h-[52px] bg-[#131d35] border border-[#223354] focus:border-[#D9A628] focus:ring-1 focus:ring-[#D9A628] rounded-xl text-[#E8EAF0] placeholder-[#8995AA] text-sm sm:text-base font-medium outline-none focus:outline-none transition-all duration-200 shadow-inner"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-4 text-[#D9A628] hover:text-[#E8BD45] transition-colors cursor-pointer"
                        aria-label={showRegPassword ? "Hide password" : "Show password"}
                      >
                        {showRegPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Flip Back to Login Row (perfectly aligned with box edges) */}
                  <div className="flex items-center justify-between px-0.5 pt-0.5">
                    <span className="text-sm text-[#9DAAC2] font-medium">
                      Already have an account?
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsFlipped(false)}
                      className="text-sm font-semibold text-[#D9A628] hover:text-[#E8BD45] transition-colors underline underline-offset-4 cursor-pointer"
                    >
                      Login
                    </button>
                  </div>

                  {/* Action Button */}
                  <div className="pt-2 flex justify-center">
                    <Button 
                      type="submit" 
                      disabled={isRegistering}
                      className="w-full sm:w-52 h-12 min-h-[44px] bg-[#D9A628] hover:bg-[#E8BD45] text-white font-bold rounded-full shadow-[0_8px_25px_rgba(217,166,40,0.5)] hover:shadow-[0_12px_32px_rgba(232,189,69,0.65)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 text-sm sm:text-base tracking-wide border-none cursor-pointer flex items-center justify-center touch-friendly-btn"
                    >
                      {isRegistering ? "Creating..." : "Create Account"}
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
