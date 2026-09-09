import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle } from "lucide-react";
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
    <div className="flex min-h-[100dvh] items-center justify-center bg-background p-3 sm:p-6 select-none overflow-y-auto">
      <Card className="w-full max-w-md my-auto shadow-2xl border-white/15">
        <CardHeader className="text-center p-5 sm:p-6">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <MessageCircle className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold">Create Account</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Join the conversation</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 p-5 sm:p-6 pt-0 sm:pt-0">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs font-bold uppercase tracking-wider">Username</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Choose a username" className="h-11 sm:h-12 text-sm sm:text-base touch-friendly-input" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aadhaar" className="text-xs font-bold uppercase tracking-wider">Aadhaar Number</Label>
              <Input
                id="aadhaar"
                value={aadhaar}
                onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, "").slice(0, 12))}
                placeholder="12-digit Aadhaar number"
                maxLength={12}
                className="h-11 sm:h-12 text-sm sm:text-base touch-friendly-input"
                required
              />
              {aadhaar.length > 0 && !validateAadhaar(aadhaar) && (
                <p className="text-xs text-destructive">Must be exactly 12 digits</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="h-11 sm:h-12 text-sm sm:text-base touch-friendly-input" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-wider">Confirm Password</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" className="h-11 sm:h-12 text-sm sm:text-base touch-friendly-input" required />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 p-5 sm:p-6 pt-0 sm:pt-0">
            <Button type="submit" className="w-full h-11 sm:h-12 min-h-[44px] text-sm sm:text-base font-bold touch-friendly-btn" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Create Account"}
            </Button>
            <p className="text-xs sm:text-sm text-muted-foreground text-center">
              Already have an account?{" "}
              <Link to="/login" className="text-primary hover:underline font-semibold">Sign In</Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Register;
