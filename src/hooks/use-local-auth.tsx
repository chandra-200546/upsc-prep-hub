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
  signOut: () => Promise<void>;
  saveProfile: (profile: Omit<LocalProfile, "id" | "current_streak" | "total_xp" | "level" | "language" | "profile_photo_url">) => void;
  refreshProfile: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const LOCAL_USER_KEY = "upsc_local_user";
const LOCAL_USERS_DB_KEY = "upsc_local_users_db";
const LOCAL_PROFILES_KEY = "upsc_local_profiles";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLocalMode, setIsLocalMode] = useState(false);

  useEffect(() => {
    // Try Supabase first
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email || "" });
        setIsLocalMode(false);
        // Load Supabase profile
        supabase.from("profiles").select("*").eq("id", session.user.id).single()
          .then(({ data }) => {
            if (data) setProfile(data as unknown as LocalProfile);
            setIsReady(true);
          });
      } else {
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
      }
    }).catch(() => {
      // Supabase unreachable, use local
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
          setUser({ id: session.user.id, email: session.user.email || "" });
          setIsLocalMode(false);
          const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
          if (data) setProfile(data as unknown as LocalProfile);
          return {};
        }
      }
      // If it's a fetch error, fall through to local
      if (error?.message?.includes("fetch")) {
        // continue to local auth
      } else if (error) {
        return { error: error.message };
      }
    } catch {
      // Supabase unreachable
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
      if (error?.message?.includes("fetch")) {
        // continue to local
      } else if (error) {
        return { error: error.message };
      }
    } catch {
      // Supabase unreachable
    }

    // Local fallback
    setIsLocalMode(true);
    const usersDB = getLocalUsersDB();
    const existing = Object.values(usersDB).find(v => v.email === email);
    if (existing) return { error: "An account with this email already exists" };

    const id = crypto.randomUUID();
    usersDB[id] = { email, password, name };
    localStorage.setItem(LOCAL_USERS_DB_KEY, JSON.stringify(usersDB));

    const localUser: LocalUser = { id, email, name };
    setUser(localUser);
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(localUser));

    return {};
  };

  const signOut = async () => {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    setUser(null);
    setProfile(null);
    setIsLocalMode(false);
    localStorage.removeItem(LOCAL_USER_KEY);
  };

  const saveProfile = (p: Omit<LocalProfile, "id" | "current_streak" | "total_xp" | "level" | "language" | "profile_photo_url">) => {
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

  const refreshProfile = () => {
    if (!user) return;
    if (isLocalMode) {
      const profiles = getLocalProfiles();
      if (profiles[user.id]) setProfile(profiles[user.id]);
    } else {
      supabase.from("profiles").select("*").eq("id", user.id).single()
        .then(({ data }) => { if (data) setProfile(data as unknown as LocalProfile); });
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, isReady, isLocalMode, signIn, signUp, signOut, saveProfile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
