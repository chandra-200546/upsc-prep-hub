import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/use-local-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, User } from "lucide-react";
import upscMentorLogo from "@/assets/upsc-mentor-logo.jpeg";

const NAME_RE = /^[A-Za-z]+(?:[A-Za-z\s'-]*[A-Za-z])?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, isReady, profile } = useAuth();
  const auth = useAuth();

  const safeRedirectPath = (value: string | null) => {
    const redirect = String(value || "").trim();
    if (!redirect) return "/dashboard";
    if (!redirect.startsWith("/") || redirect.startsWith("//")) return "/dashboard";
    return redirect;
  };

  useEffect(() => {
    if (isReady && user && profile) {
      navigate(safeRedirectPath(searchParams.get("redirect")));
    }
  }, [isReady, user, profile, navigate, searchParams]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const result = await auth.signIn(email, password);
        if (result.error) throw new Error(result.error);
        toast({ title: "Welcome back!", description: "Successfully logged in" });
        navigate(safeRedirectPath(searchParams.get("redirect")));
      } else {
        if (!NAME_RE.test(name.trim())) {
          throw new Error("Name must contain only letters and valid separators.");
        }
        if (!EMAIL_RE.test(email.trim().toLowerCase())) {
          throw new Error("Please enter a valid email address.");
        }
        if (!PASSWORD_RE.test(password)) {
          throw new Error("Password must include at least one uppercase letter, one number, and one special character.");
        }
        const result = await auth.signUp(email, password, name);
        if (result.error) throw new Error(result.error);
        toast({ title: "Account created!", description: "Welcome to UPSC Mentor" });
        navigate("/onboarding");
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: "Email required", description: "Please enter your registered email.", variant: "destructive" });
      return;
    }
    if (resetPassword.length < 6) {
      toast({ title: "Weak password", description: "New password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      toast({ title: "Password mismatch", description: "New password and confirm password do not match.", variant: "destructive" });
      return;
    }

    setResetting(true);
    try {
      const result = await auth.forgotPassword(email, resetPassword);
      if (result.error) throw new Error(result.error);
      toast({ title: "Password reset successful", description: "Please sign in with your new password." });
      setShowForgotPassword(false);
      setIsLogin(true);
      setPassword("");
      setResetPassword("");
      setResetConfirmPassword("");
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to reset password", variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-accent/20 p-4">
      <Card className="w-full max-w-md p-8 space-y-6 shadow-xl">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-2xl bg-background/40 border border-border/60 flex items-center justify-center overflow-hidden">
              <img src={upscMentorLogo} alt="UPSC Mentor" className="w-full h-full object-cover" loading="eager" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">{showForgotPassword ? "Forgot Password" : isLogin ? "Welcome Back" : "Start Your Journey"}</h1>
          <p className="text-muted-foreground">
            {showForgotPassword
              ? "Reset your password to regain access"
              : isLogin
                ? "Sign in to continue your preparation"
                : "Create your account to begin"}
          </p>
        </div>

        <form onSubmit={showForgotPassword ? handleForgotPassword : handleAuth} className="space-y-4">
          {!showForgotPassword && !isLogin && (
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2"><User className="w-4 h-4" />Full Name</Label>
              <Input id="name" type="text" placeholder="Enter your name" value={name} onChange={(e) => setName(e.target.value)} required className="rounded-xl" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2"><Mail className="w-4 h-4" />Email</Label>
            <Input id="email" type="email" placeholder="your.email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl" />
          </div>

          {showForgotPassword ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="reset-password" className="flex items-center gap-2"><Lock className="w-4 h-4" />New Password</Label>
                <Input id="reset-password" type="password" placeholder="Enter new password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} required minLength={6} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-confirm-password" className="flex items-center gap-2"><Lock className="w-4 h-4" />Confirm Password</Label>
                <Input id="reset-confirm-password" type="password" placeholder="Confirm new password" value={resetConfirmPassword} onChange={(e) => setResetConfirmPassword(e.target.value)} required minLength={6} className="rounded-xl" />
              </div>
              <Button type="submit" className="w-full rounded-xl h-12 text-base font-semibold bg-gradient-primary hover:opacity-90" disabled={resetting}>
                {resetting ? "Resetting..." : "Reset Password"}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2"><Lock className="w-4 h-4" />Password</Label>
                <Input id="password" type="password" placeholder="********" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="rounded-xl" />
              </div>
              <Button type="submit" className="w-full rounded-xl h-12 text-base font-semibold bg-gradient-primary hover:opacity-90" disabled={loading}>
                {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
              </Button>
            </>
          )}
        </form>

        {!showForgotPassword ? (
          <div className="space-y-2 text-center">
            {isLogin && (
              <button onClick={() => setShowForgotPassword(true)} className="text-sm text-primary hover:underline font-medium">
                Forgot password?
              </button>
            )}
            <button onClick={() => setIsLogin(!isLogin)} className="block w-full text-sm text-primary hover:underline font-medium">
              {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </button>
          </div>
        ) : (
          <div className="text-center">
            <button
              onClick={() => {
                setShowForgotPassword(false);
                setResetPassword("");
                setResetConfirmPassword("");
              }}
              className="text-sm text-primary hover:underline font-medium"
            >
              Back to Sign In
            </button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Auth;
