import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { User, Lock, Sparkles, Shield, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Register = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const validateAadhaar = (value: string) => /^\d{12}$/.test(value);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateAadhaar(aadhaar)) {
      toast({ title: "Invalid Aadhaar", description: "Aadhaar number must be exactly 12 digits.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Password mismatch", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Weak password", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const email = `${username.toLowerCase()}@chatapp.local`;
      await signUp(email, password, username, aadhaar);
      toast({ title: "Account created!", description: "You can now sign in." });
      navigate("/chat");
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05070e] relative overflow-hidden p-4 select-none">
      {/* Luxury ambient radial glows */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-600/15 via-[#0b1020] to-[#03050a] pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-yellow-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Register Glass Card */}
      <div className="relative z-10 w-full max-w-md bg-[#0c1326]/90 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_25px_70px_rgba(0,0,0,0.9),0_0_50px_rgba(245,158,11,0.12)] p-7 sm:p-9 border border-amber-500/30 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

        {/* Logo Header */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="relative group mb-3">
            <div className="absolute -inset-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 rounded-2xl blur-md opacity-40 group-hover:opacity-75 transition duration-500" />
            <div className="relative w-44 sm:w-52 h-24 rounded-2xl overflow-hidden border border-amber-400/40 bg-black/60 shadow-xl flex items-center justify-center p-2">
              <img 
                src="/sabi-gold-logo.png" 
                alt="Sabi Return Gifts" 
                className="w-full h-full object-contain filter drop-shadow-[0_2px_10px_rgba(245,158,11,0.4)]"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[11px] font-bold tracking-widest uppercase mb-1">
            <UserPlus className="w-3 h-3 text-amber-400" /> Create Account
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Join the Sabi Return Gifts Portal
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-amber-200/90 uppercase tracking-wider pl-1">
              Username
            </label>
            <div className="relative flex items-center bg-[#070c18]/90 border border-slate-700/80 hover:border-amber-500/50 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 rounded-xl transition-all shadow-inner overflow-hidden">
              <div className="w-10 h-12 bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center text-amber-400 border-r border-amber-500/20 shrink-0">
                <User size={18} />
              </div>
              <input
                id="username"
                type="text"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 h-12 bg-transparent text-white placeholder-slate-500 font-semibold outline-none text-sm"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-amber-200/90 uppercase tracking-wider pl-1">
              Aadhaar Number
            </label>
            <div className="relative flex items-center bg-[#070c18]/90 border border-slate-700/80 hover:border-amber-500/50 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 rounded-xl transition-all shadow-inner overflow-hidden">
              <div className="w-10 h-12 bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center text-amber-400 border-r border-amber-500/20 shrink-0">
                <Shield size={18} />
              </div>
              <input
                id="aadhaar"
                type="text"
                placeholder="12-digit Aadhaar number"
                value={aadhaar}
                onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, "").slice(0, 12))}
                maxLength={12}
                className="w-full px-3 h-12 bg-transparent text-white placeholder-slate-500 font-semibold outline-none text-sm"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-amber-200/90 uppercase tracking-wider pl-1">
              Password
            </label>
            <div className="relative flex items-center bg-[#070c18]/90 border border-slate-700/80 hover:border-amber-500/50 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 rounded-xl transition-all shadow-inner overflow-hidden">
              <div className="w-10 h-12 bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center text-amber-400 border-r border-amber-500/20 shrink-0">
                <Lock size={18} />
              </div>
              <input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 h-12 bg-transparent text-white placeholder-slate-500 font-semibold outline-none text-sm"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-amber-200/90 uppercase tracking-wider pl-1">
              Confirm Password
            </label>
            <div className="relative flex items-center bg-[#070c18]/90 border border-slate-700/80 hover:border-amber-500/50 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 rounded-xl transition-all shadow-inner overflow-hidden">
              <div className="w-10 h-12 bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center text-amber-400 border-r border-amber-500/20 shrink-0">
                <Lock size={18} />
              </div>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 h-12 bg-transparent text-white placeholder-slate-500 font-semibold outline-none text-sm"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 mt-2 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:via-yellow-400 hover:to-amber-500 text-slate-950 font-black text-base rounded-xl shadow-[0_10px_25px_rgba(245,158,11,0.35)] transition-all duration-300 tracking-wider uppercase flex items-center justify-center gap-2 active:scale-[0.98] border border-amber-300/40 cursor-pointer disabled:opacity-50"
          >
            <span>{isLoading ? "Creating..." : "Create Account"}</span>
            <Sparkles className="w-4 h-4 text-slate-950" />
          </button>

          <div className="text-center pt-2">
            <p className="text-xs text-slate-400">
              Already have an account?{" "}
              <Link to="/login" className="font-bold text-amber-400 hover:text-amber-300 underline underline-offset-4">
                Sign In
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
