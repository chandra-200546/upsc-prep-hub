import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-local-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, User } from "lucide-react";
import upscMentorLogo from "@/assets/upsc-mentor-logo.jpeg";

declare global {
  interface Window {
    google?: any;
  }
}

const GOOGLE_SCRIPT_ID = "google-gsi-client";
const GOOGLE_CLIENT_ID = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();

const loadGoogleScript = () =>
  new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const existing = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google script")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google script"));
    document.head.appendChild(script);
  });

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isReady, profile } = useAuth();
  const auth = useAuth();

  useEffect(() => {
    if (isReady && user && profile) {
      navigate("/dashboard");
    }
  }, [isReady, user, profile, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const result = await auth.signIn(email, password);
        if (result.error) throw new Error(result.error);
        toast({ title: "Welcome back!", description: "Successfully logged in" });
        navigate("/dashboard");
      } else {
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

  const handleGoogleAuth = async () => {
    if (!GOOGLE_CLIENT_ID) {
      toast({
        title: "Google login is not configured",
        description: "Set VITE_GOOGLE_CLIENT_ID in frontend env.",
        variant: "destructive",
      });
      return;
    }
    setGoogleLoading(true);
    try {
      await loadGoogleScript();
      if (!window.google?.accounts?.id) throw new Error("Google SDK unavailable");
      const token = await new Promise<string>((resolve, reject) => {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response: { credential?: string }) => {
            const cred = String(response?.credential || "").trim();
            if (!cred) reject(new Error("Google did not return credential"));
            else resolve(cred);
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        window.google.accounts.id.prompt((notification: any) => {
          if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
            reject(new Error("Google sign-in prompt was not displayed"));
          }
        });
      });

      const result = await auth.signInWithGoogle(token);
      if (result.error) throw new Error(result.error);
      toast({ title: "Welcome!", description: "Signed in with Google successfully." });
      navigate("/dashboard");
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Google sign-in failed", variant: "destructive" });
    } finally {
      setGoogleLoading(false);
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
          <h1 className="text-3xl font-bold text-foreground">
            {isLogin ? "Welcome Back" : "Start Your Journey"}
          </h1>
          <p className="text-muted-foreground">
            {isLogin ? "Sign in to continue your preparation" : "Create your account to begin"}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2"><User className="w-4 h-4" />Full Name</Label>
              <Input id="name" type="text" placeholder="Enter your name" value={name} onChange={(e) => setName(e.target.value)} required className="rounded-xl" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2"><Mail className="w-4 h-4" />Email</Label>
            <Input id="email" type="email" placeholder="your.email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="flex items-center gap-2"><Lock className="w-4 h-4" />Password</Label>
            <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="rounded-xl" />
          </div>
          <Button type="submit" className="w-full rounded-xl h-12 text-base font-semibold bg-gradient-primary hover:opacity-90" disabled={loading}>
            {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <Button type="button" variant="outline" className="w-full rounded-xl h-11" onClick={handleGoogleAuth} disabled={googleLoading}>
          {googleLoading ? "Connecting Google..." : "Continue with Google"}
        </Button>

        <div className="text-center">
          <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-primary hover:underline font-medium">
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
          </button>
        </div>
      </Card>
    </div>
  );
};

export default Auth;
