import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LocalUser {
  id: string;
  email: string;
  name?: string;
}

interface LocalProfile {
  id: string;
  name: string;
  target_year: number;
  optional_subject: string | null;
  study_hours_per_day: number;
  mentor_personality: string;
  current_streak: number;
  total_xp: number;
  level: number;
  language: string;
  profile_photo_url: string | null;
  last_login_date: string | null;
}

interface AuthContextType {
  user: LocalUser | null;
  profile: LocalProfile | null;
  isReady: boolean;
  isLocalMode: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string }>;
  signInWithGoogle: (idToken: string) => Promise<{ error?: string }>;
  forgotPassword: (email: string, newPassword: string) => Promise<{ error?: string }>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  saveProfile: (profile: Omit<LocalProfile, "id" | "current_streak" | "total_xp" | "level" | "language" | "profile_photo_url" | "last_login_date">) => void;
  refreshProfile: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const LOCAL_USER_KEY = "upsc_local_user";
const LOCAL_USERS_DB_KEY = "upsc_local_users_db";
const LOCAL_PROFILES_KEY = "upsc_local_profiles";
const ALLOW_LOCAL_FALLBACK = String(import.meta.env.VITE_ALLOW_LOCAL_FALLBACK || "").toLowerCase() === "true";
const createId = () =>
  (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function getLocalUsersDB(): Record<string, { email: string; password: string; name: string }> {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_USERS_DB_KEY) || "{}");
  } catch { return {}; }
}

function getLocalProfiles(): Record<string, LocalProfile> {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_PROFILES_KEY) || "{}");
  } catch { return {}; }
}

const buildDefaultProfile = (user: LocalUser): LocalProfile => ({
  id: user.id,
  name: user.name || user.email?.split("@")[0] || "Aspirant",
  target_year: new Date().getFullYear() + 1,
  optional_subject: "Public Administration",
  study_hours_per_day: 4,
  mentor_personality: "friendly",
  current_streak: 0,
  total_xp: 0,
  level: 1,
  language: "English",
  profile_photo_url: null,
  last_login_date: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLocalMode, setIsLocalMode] = useState(false);

  const ensureRemoteProfile = async (u: LocalUser): Promise<LocalProfile | null> => {
    const { data } = await supabase.from("profiles").select("*").eq("id", u.id).maybeSingle();
    if (data) return data as unknown as LocalProfile;

    const fallback = buildDefaultProfile(u);
    const { error } = await supabase.from("profiles").upsert({
      id: fallback.id,
      name: fallback.name,
      target_year: fallback.target_year,
      optional_subject: fallback.optional_subject,
      study_hours_per_day: fallback.study_hours_per_day,
      mentor_personality: fallback.mentor_personality,
      current_streak: fallback.current_streak,
      total_xp: fallback.total_xp,
      level: fallback.level,
      language: fallback.language,
      profile_photo_url: fallback.profile_photo_url,
      last_login_date: fallback.last_login_date,
    });
    if (error) return null;

    const { data: created } = await supabase.from("profiles").select("*").eq("id", u.id).maybeSingle();
    return (created as unknown as LocalProfile) || fallback;
  };

  useEffect(() => {
    // Try Supabase first
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const sessionUser = { id: session.user.id, email: session.user.email || "" };
        setUser(sessionUser);
        setIsLocalMode(false);
        // Load Supabase profile
        ensureRemoteProfile(sessionUser)
          .then((profileData) => {
            if (profileData) setProfile(profileData);
            setIsReady(true);
          });
      } else if (ALLOW_LOCAL_FALLBACK) {
        // Fall back to localStorage
        setIsLocalMode(true);
        const stored = localStorage.getItem(LOCAL_USER_KEY);
        if (stored) {
          try {
            const u = JSON.parse(stored) as LocalUser;
            setUser(u);
            const profiles = getLocalProfiles();
            if (profiles[u.id]) setProfile(profiles[u.id]);
          } catch { /* ignore */ }
        }
        setIsReady(true);
      } else {
        setIsLocalMode(false);
        setUser(null);
        setProfile(null);
        setIsReady(true);
      }
    }).catch(() => {
      // Supabase/backend unreachable
      if (ALLOW_LOCAL_FALLBACK) {
        setIsLocalMode(true);
        const stored = localStorage.getItem(LOCAL_USER_KEY);
        if (stored) {
          try {
            const u = JSON.parse(stored) as LocalUser;
            setUser(u);
            const profiles = getLocalProfiles();
            if (profiles[u.id]) setProfile(profiles[u.id]);
          } catch { /* ignore */ }
        }
      } else {
        setIsLocalMode(false);
        setUser(null);
        setProfile(null);
      }
      setIsReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email || "" });
        setIsLocalMode(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    // Try Supabase first
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const sessionUser = { id: session.user.id, email: session.user.email || "" };
          setUser(sessionUser);
          setIsLocalMode(false);
          const profileData = await ensureRemoteProfile(sessionUser);
          if (profileData) setProfile(profileData);
          return {};
        }
      }
      if (error) {
        if (!ALLOW_LOCAL_FALLBACK) {
          return { error: error.message || "Sign in failed. Backend/Neon is required." };
        }
        console.warn("Backend sign-in failed, trying local fallback:", error.message);
      }
    } catch {
      // Supabase unreachable
    }

    if (!ALLOW_LOCAL_FALLBACK) {
      return { error: "Sign in failed. Backend/Neon is required and local fallback is disabled." };
    }

    // Local fallback
    setIsLocalMode(true);
    const usersDB = getLocalUsersDB();
    const userEntry = Object.entries(usersDB).find(([_, v]) => v.email === email);
    if (!userEntry) return { error: "No account found with this email" };
    if (userEntry[1].password !== password) return { error: "Invalid password" };
    
    const localUser: LocalUser = { id: userEntry[0], email, name: userEntry[1].name };
    setUser(localUser);
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(localUser));
    await supabase.auth.setSession({
      access_token: `local-token-${localUser.id}`,
      refresh_token: `local-refresh-${localUser.id}`,
      user: { id: localUser.id, email: localUser.email },
    });
    
    const profiles = getLocalProfiles();
    if (profiles[localUser.id]) setProfile(profiles[localUser.id]);
    
    return {};
  };

  const signUp = async (email: string, password: string, name: string) => {
    // Try Supabase first
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { name }, emailRedirectTo: `${window.location.origin}/dashboard` }
      });
      if (!error && data.user) {
        setUser({ id: data.user.id, email: data.user.email || "" });
        setIsLocalMode(false);
        return {};
      }
      if (error) {
        if (!ALLOW_LOCAL_FALLBACK) {
          return { error: error.message || "Sign up failed. Backend/Neon is required." };
        }
        console.warn("Backend sign-up failed, trying local fallback:", error.message);
      }
    } catch {
      // Supabase unreachable
    }

    if (!ALLOW_LOCAL_FALLBACK) {
      return { error: "Sign up failed. Backend/Neon is required and local fallback is disabled." };
    }

    // Local fallback
    setIsLocalMode(true);
    const usersDB = getLocalUsersDB();
    const existing = Object.values(usersDB).find(v => v.email === email);
    if (existing) return { error: "An account with this email already exists" };

    const id = createId();
    usersDB[id] = { email, password, name };
    localStorage.setItem(LOCAL_USERS_DB_KEY, JSON.stringify(usersDB));

    const localUser: LocalUser = { id, email, name };
    setUser(localUser);
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(localUser));
    await supabase.auth.setSession({
      access_token: `local-token-${localUser.id}`,
      refresh_token: `local-refresh-${localUser.id}`,
      user: { id: localUser.id, email: localUser.email },
    });

    return {};
  };

  const signInWithGoogle = async (idToken: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });
      if (error) {
        return { error: error.message || "Google sign-in failed" };
      }
      const sessionUser = data?.user || data?.session?.user;
      if (!sessionUser?.id) {
        return { error: "Google sign-in did not return a valid user." };
      }
      const nextUser = { id: sessionUser.id, email: sessionUser.email || "" };
      setUser(nextUser);
      setIsLocalMode(false);
      const profileData = await ensureRemoteProfile(nextUser);
      if (profileData) setProfile(profileData);
      return {};
    } catch (error: any) {
      return { error: error?.message || "Google sign-in failed" };
    }
  };

  const forgotPassword = async (email: string, newPassword: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { newPassword });
      if (!error) return {};
      if (!ALLOW_LOCAL_FALLBACK) {
        return { error: error.message || "Failed to reset password" };
      }
    } catch {
      if (!ALLOW_LOCAL_FALLBACK) {
        return { error: "Failed to reset password. Backend is required." };
      }
    }

    if (!ALLOW_LOCAL_FALLBACK) return { error: "Failed to reset password." };
    const usersDB = getLocalUsersDB();
    const entry = Object.entries(usersDB).find(([_, v]) => v.email.toLowerCase() === email.toLowerCase());
    if (!entry) return {};
    usersDB[entry[0]] = { ...usersDB[entry[0]], password: newPassword };
    localStorage.setItem(LOCAL_USERS_DB_KEY, JSON.stringify(usersDB));
    return {};
  };

  const updatePassword = async (currentPassword: string, newPassword: string) => {
    if (!user) return { error: "Not logged in" };
    try {
      const { error } = await supabase.auth.updateUser({ currentPassword, password: newPassword });
      if (!error) return {};
      if (!ALLOW_LOCAL_FALLBACK) {
        return { error: error.message || "Failed to update password" };
      }
    } catch {
      if (!ALLOW_LOCAL_FALLBACK) {
        return { error: "Failed to update password. Backend is required." };
      }
    }

    if (!ALLOW_LOCAL_FALLBACK) return { error: "Failed to update password." };
    const usersDB = getLocalUsersDB();
    const entry = Object.entries(usersDB).find(([id, v]) => id === user.id || v.email.toLowerCase() === (user.email || "").toLowerCase());
    if (!entry) return { error: "Account not found" };
    if (entry[1].password !== currentPassword) return { error: "Current password is incorrect" };
    usersDB[entry[0]] = { ...usersDB[entry[0]], password: newPassword };
    localStorage.setItem(LOCAL_USERS_DB_KEY, JSON.stringify(usersDB));
    return {};
  };

  const signOut = async () => {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    setUser(null);
    setProfile(null);
    setIsLocalMode(false);
    localStorage.removeItem(LOCAL_USER_KEY);
  };

  const saveProfile = (p: Omit<LocalProfile, "id" | "current_streak" | "total_xp" | "level" | "language" | "profile_photo_url" | "last_login_date">) => {
    if (!user) return;
    const fullProfile: LocalProfile = {
      ...p,
      id: user.id,
      current_streak: 0,
      total_xp: 0,
      level: 1,
      language: "English",
      profile_photo_url: null,
      last_login_date: null,
    };
    const profiles = getLocalProfiles();
    profiles[user.id] = fullProfile;
    localStorage.setItem(LOCAL_PROFILES_KEY, JSON.stringify(profiles));
    setProfile(fullProfile);
  };

  const refreshProfile = async () => {
    if (!user) return;
    if (isLocalMode) {
      const profiles = getLocalProfiles();
      if (profiles[user.id]) setProfile(profiles[user.id]);
    } else {
      const profileData = await ensureRemoteProfile(user);
      if (profileData) setProfile(profileData);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, isReady, isLocalMode, signIn, signUp, signInWithGoogle, forgotPassword, updatePassword, signOut, saveProfile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
