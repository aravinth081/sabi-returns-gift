import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { User, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
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
    <div className="flex min-h-screen items-center justify-center bg-[#070b16] relative overflow-hidden p-4 select-none">
      {/* Subtle ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(245,158,11,0.08)_0%,_rgba(7,11,22,0.95)_70%)] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Login Glass Card */}
      <div className="relative z-10 w-full max-w-[420px] bg-[#0d1424]/85 backdrop-blur-2xl rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.85),0_0_1px_rgba(255,255,255,0.15)] p-8 sm:p-9 border border-slate-700/60 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />

        {/* Logo Header (Clean & Unboxed) */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-2 flex items-center justify-center">
            <div className="absolute -inset-2 bg-amber-500/15 rounded-full blur-xl pointer-events-none" />
            <img 
              src="/sabi-gold-logo.png" 
              alt="Sabi Return Gifts" 
              className="relative z-10 w-48 sm:w-56 h-auto max-h-28 object-contain drop-shadow-[0_4px_16px_rgba(245,158,11,0.3)]"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <p className="text-xs text-slate-400 font-medium tracking-wide">
            Welcome back to Sabi Return Gifts
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 tracking-wide block">
              Username
            </label>
            <div className="relative flex items-center group">
              <User className="absolute left-3.5 w-4 h-4 text-slate-400 group-focus-within:text-amber-400 transition-colors pointer-events-none" />
              <input
                id="username"
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 h-12 bg-slate-950/70 border border-slate-700/70 focus:border-amber-400/80 focus:bg-slate-950/90 focus:ring-2 focus:ring-amber-400/20 rounded-xl text-white placeholder-slate-500 font-medium text-sm transition-all duration-200 outline-none shadow-inner"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 tracking-wide block">
              Password
            </label>
            <div className="relative flex items-center group">
              <Lock className="absolute left-3.5 w-4 h-4 text-slate-400 group-focus-within:text-amber-400 transition-colors pointer-events-none" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 h-12 bg-slate-950/70 border border-slate-700/70 focus:border-amber-400/80 focus:bg-slate-950/90 focus:ring-2 focus:ring-amber-400/20 rounded-xl text-white placeholder-slate-500 font-medium text-sm transition-all duration-200 outline-none shadow-inner"
                required
              />
              <button
                type="button"
                className="absolute right-3 text-slate-400 hover:text-white p-1 transition-colors"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 mt-2 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:via-yellow-300 hover:to-amber-400 text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-amber-500/20 hover:shadow-amber-500/35 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all duration-200 uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer border border-amber-200/40 disabled:opacity-50"
          >
            <span>{isLoading ? "Signing in..." : "Sign In"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="text-center pt-2">
            <p className="text-xs text-slate-400">
              Don't have an account?{" "}
              <Link to="/register" className="font-bold text-amber-400 hover:text-amber-300 hover:underline">
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
