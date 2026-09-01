import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { User, Lock, Eye, EyeOff } from "lucide-react";
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
    <div className="min-h-screen bg-[#F4F6F9] flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-[1200px] min-h-[700px] bg-[#0B101E] rounded-3xl shadow-[0_25px_65px_rgba(0,_0,_0,_0.2)] flex overflow-hidden border border-white/5">
        
        {/* Left Side (Branding/Info) */}
        <div className="hidden md:flex w-1/2 relative bg-gradient-to-br from-[#E2B743] via-[#D19B27] to-[#B07D15] flex-col items-center justify-center p-12 text-center overflow-hidden">
          {/* Wave effect overlay */}
          <div className="absolute bottom-0 left-0 w-full h-1/2 opacity-20 pointer-events-none">
             <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                <path d="M0,50 Q25,30 50,50 T100,50 L100,100 L0,100 Z" fill="#ffffff" />
             </svg>
          </div>
          
          <div className="relative z-10 flex flex-col items-center">
            {/* Logo Image */}
            <div className="w-[320px] h-[320px] p-2 flex items-center justify-center mb-10 rounded-[2rem] overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.5)] bg-black border border-white/10 relative group">
              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none"></div>
              <img src="/logo.jpeg" alt="Sabi Returns" className="w-full h-full object-contain transform group-hover:scale-105 transition-transform duration-500" />
            </div>
            
            <h1 className="text-4xl font-serif font-bold text-white tracking-wider mb-2 drop-shadow-md">SABI RETURNS</h1>
            <p className="text-[11px] font-bold tracking-[0.35em] text-white/90 mb-8 uppercase drop-shadow-sm">Premium Gifting Solutions</p>
            
            <div className="w-12 h-[2px] bg-white/60 mb-8 rounded-full"></div>
            
            <p className="text-white/90 text-sm font-medium px-4 leading-relaxed max-w-[320px] drop-shadow-sm">
              Empowering your celebrations with elegant,<br/>secure, and seamless return gift solutions.
            </p>
          </div>
        </div>

        {/* Right Side (Login Form) */}
        <div className="w-full md:w-1/2 flex flex-col justify-center p-8 md:p-16 bg-gradient-to-b from-[#0F172A] to-[#020617] relative">
          <div className="max-w-md w-full mx-auto space-y-12">
            
            <div className="text-center space-y-3">
              <h2 className="text-[48px] font-serif font-bold text-white tracking-wide drop-shadow-md">Login</h2>
              <p className="text-gray-400 text-sm font-medium">Sign in to your Sabi Returns account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-6">
                
                {/* Username Input - Sleek Glassmorphism */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-5 pointer-events-none">
                    <User className="h-5 w-5 text-[#D19B27] opacity-80 group-focus-within:opacity-100 transition-opacity" />
                  </div>
                  <Input 
                    id="username" 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)} 
                    placeholder="Username" 
                    required 
                    className="pl-14 bg-[#151F32] border border-[#D19B27]/60 rounded-xl h-16 text-white font-medium placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-[#D19B27] focus-visible:border-[#D19B27] transition-all text-base shadow-inner"
                  />
                </div>
                
                {/* Password Input - Sleek Glassmorphism */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-5 pointer-events-none">
                    <Lock className="h-5 w-5 text-[#D19B27] opacity-80 group-focus-within:opacity-100 transition-opacity" />
                  </div>
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    placeholder="Password" 
                    required 
                    className="pl-14 pr-12 bg-[#151F32] border border-[#D19B27]/60 rounded-xl h-16 text-white font-medium placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-[#D19B27] focus-visible:border-[#D19B27] transition-all text-base shadow-inner"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-5 text-gray-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center space-x-3 justify-center pt-2">
                <Checkbox id="remember" className="border-gray-500 rounded-[4px] data-[state=checked]:bg-[#D19B27] data-[state=checked]:border-[#D19B27]" />
                <label
                  htmlFor="remember"
                  className="text-sm font-medium leading-none text-gray-300 cursor-pointer hover:text-white transition-colors"
                >
                  Remember Me?
                </label>
              </div>

              {/* Login Button */}
              <div className="pt-4 flex justify-center">
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-48 h-12 bg-gradient-to-r from-[#D9AA3B] to-[#C18C1D] hover:from-[#C99127] hover:to-[#A37415] text-white font-bold rounded-full shadow-[0_4px_20px_-4px_rgba(217,170,59,0.5)] transition-all duration-300 hover:shadow-[0_8px_25px_-4px_rgba(217,170,59,0.6)] hover:-translate-y-1 text-base border border-[#E2B743]/30"
                >
                  {isLoading ? "Logging In..." : "Log In"}
                </Button>
              </div>
              
            </form>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;
