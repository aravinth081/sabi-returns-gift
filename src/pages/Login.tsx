import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { User, Lock, Eye, EyeOff, Sparkles, Shield, Mail, LogIn, Home } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signIn(username, password);
      navigate("/dashboard");
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#071333] relative overflow-x-hidden p-4 select-none">
      {/* Deep Royal Blue Radial Ambient Glow Backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1d357a] via-[#09163d] to-[#04091c] pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-[100px] pointer-events-none" />

      {/* Top-Left Back to Home Pill Button */}
      <div className="absolute top-4 left-4 z-20">
        <Link 
          to="/"
          className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs flex items-center gap-1.5 backdrop-blur-md border border-white/15 shadow-sm transition-all"
        >
          <Home size={14} />
          <span>Back to Home</span>
        </Link>
      </div>

      <div className="relative z-10 w-full max-w-[440px] flex flex-col items-center my-auto py-6">
        {/* TOP CARD: Floating Brand Header Box */}
        <div className="w-full bg-[#182a5c]/85 backdrop-blur-xl border border-white/20 rounded-3xl p-4 sm:p-5 shadow-2xl mb-4 relative overflow-hidden">
          <div className="flex items-center gap-3.5 w-full">
            {/* Golden Logo in clean rounded box */}
            <div className="w-20 sm:w-24 h-16 sm:h-18 rounded-2xl bg-black/60 border border-amber-400/40 p-1 flex items-center justify-center shadow-lg overflow-hidden shrink-0">
              <img 
                src="/sabi-gold-logo.png" 
                alt="Sabi Return Gifts" 
                className="w-full h-full object-contain filter drop-shadow-[0_2px_10px_rgba(245,158,11,0.5)]" 
              />
            </div>

            {/* Brand Title & Info */}
            <div className="flex-1 text-left min-w-0">
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/25 text-amber-300 font-extrabold text-[10px] uppercase tracking-wider mb-0.5 border border-amber-400/30">
                <Sparkles className="w-2.5 h-2.5 text-amber-400" /> SABI
              </div>
              <h1 className="text-base sm:text-lg font-black text-white tracking-tight uppercase leading-tight truncate">
                Sabi Return Gifts
              </h1>
              <p className="text-[11px] sm:text-xs text-amber-300 font-bold mt-0.5 truncate">
                Special Return Gifts & Billing Portal
              </p>
            </div>
          </div>

          {/* Authorized Portal Badge */}
          <div className="w-full mt-3 pt-2.5 border-t border-white/15 flex items-center justify-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-amber-300 border border-white/15 text-[11px] font-bold">
              <Shield className="w-3.5 h-3.5 text-amber-400" /> Authorized Staff & Admin Portal
            </div>
          </div>
        </div>

        {/* BOTTOM CARD: Crisp White Login Card */}
        <div className="w-full bg-white text-slate-900 rounded-3xl shadow-2xl p-7 sm:p-8 border border-slate-100 relative">
          <div className="mb-5 text-left">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Welcome back
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Sign in to your account to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email / Username Input */}
            <div className="space-y-1 text-left">
              <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider pl-0.5">
                Email Address / Username
              </label>
              <div className="relative flex items-center bg-[#f0f4fa] border border-slate-200/80 focus-within:border-indigo-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-600/20 rounded-xl transition-all shadow-xs h-12 px-3.5">
                <Mail className="w-4 h-4 text-slate-400 mr-2.5 shrink-0" />
                <input
                  id="username"
                  type="text"
                  placeholder="Enter your username or email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-full bg-transparent text-slate-900 placeholder-slate-400 font-semibold outline-none text-sm"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1 text-left">
              <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider pl-0.5">
                Password
              </label>
              <div className="relative flex items-center bg-[#f0f4fa] border border-slate-200/80 focus-within:border-indigo-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-600/20 rounded-xl transition-all shadow-xs h-12 px-3.5">
                <Lock className="w-4 h-4 text-slate-400 mr-2.5 shrink-0" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-full bg-transparent text-slate-900 placeholder-slate-400 font-semibold outline-none text-sm pr-8"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 text-slate-400 hover:text-slate-700 p-1 transition-colors cursor-pointer"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full h-12 mt-4 bg-[#142354] hover:bg-[#1b2f70] active:bg-[#0f1a3d] text-white font-black text-base rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-50"
            >
              <LogIn className="w-4 h-4 text-white" />
              <span>{isLoading ? "Signing in..." : "Sign In"}</span>
            </button>

            {/* Footer link */}
            <div className="text-center pt-2">
              <p className="text-xs text-slate-600 font-medium">
                New staff?{" "}
                <Link to="/register" className="font-bold text-[#142354] hover:underline">
                  Request access
                </Link>
              </p>
            </div>
          </form>
        </div>

        {/* Bottom Footer Info */}
        <div className="mt-4 text-center text-xs text-blue-200/60 font-medium">
          Sabi Return Gifts • Special Return Gifts & Chocolates Portal
        </div>
      </div>
    </div>
  );
};

export default Login;
