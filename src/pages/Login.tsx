import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { User, Lock, Eye, EyeOff, Sparkles, UserPlus } from "lucide-react";
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
      navigate("/chat");
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
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

      {/* Main Login Glass Card */}
      <div className="relative z-10 w-full max-w-md bg-[#0c1326]/90 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_25px_70px_rgba(0,0,0,0.9),0_0_50px_rgba(245,158,11,0.12)] p-7 sm:p-9 border border-amber-500/30 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

        {/* Sabi Return Gifts Logo Showcase (Full Unclipped 3D Gold Art) */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative group w-full flex items-center justify-center mb-2">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/30 via-yellow-400/40 to-amber-500/30 rounded-3xl blur-2xl opacity-60 group-hover:opacity-90 transition duration-700" />
            <div className="relative w-64 sm:w-72 h-32 flex items-center justify-center p-1 transition-transform duration-500 group-hover:scale-[1.02]">
              <img 
                src="/sabi-gold-logo.png" 
                alt="Sabi Return Gifts" 
                className="w-full h-full object-contain filter drop-shadow-[0_4px_25px_rgba(245,158,11,0.6)]"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-500/15 via-amber-400/20 to-amber-500/15 border border-amber-400/35 text-amber-300 text-[10px] sm:text-[11px] font-black tracking-widest uppercase shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Member Login
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-amber-200/90 uppercase tracking-wider pl-1">
              Username
            </label>
            <div className="relative flex items-center bg-[#070c18]/90 border border-slate-700/80 hover:border-amber-500/50 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 rounded-2xl transition-all shadow-inner overflow-hidden">
              <div className="w-12 h-13 bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center text-amber-400 border-r border-amber-500/20 shrink-0">
                <User size={20} />
              </div>
              <input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 h-13 bg-transparent text-white placeholder-slate-500 font-semibold outline-none text-sm"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-amber-200/90 uppercase tracking-wider pl-1">
              Password
            </label>
            <div className="relative flex items-center bg-[#070c18]/90 border border-slate-700/80 hover:border-amber-500/50 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 rounded-2xl transition-all shadow-inner overflow-hidden">
              <div className="w-12 h-13 bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center text-amber-400 border-r border-amber-500/20 shrink-0">
                <Lock size={18} />
              </div>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-4 pr-11 h-13 bg-transparent text-white placeholder-slate-500 font-semibold outline-none text-sm"
                required
              />
              <button
                type="button"
                className="absolute right-3.5 text-slate-400 hover:text-amber-300 p-1 transition-colors"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-13 mt-2 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:via-yellow-400 hover:to-amber-500 text-slate-950 font-black text-base rounded-2xl shadow-[0_10px_25px_rgba(245,158,11,0.35)] transition-all duration-300 tracking-wider uppercase flex items-center justify-center gap-2 active:scale-[0.98] border border-amber-300/40 cursor-pointer disabled:opacity-50"
          >
            <span>{isLoading ? "Signing in..." : "Sign In"}</span>
            <Sparkles className="w-4 h-4 text-slate-950" />
          </button>

          <div className="text-center pt-2">
            <p className="text-xs text-slate-400">
              Don't have an account?{" "}
              <Link to="/register" className="font-bold text-amber-400 hover:text-amber-300 underline underline-offset-4">
                Register
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
