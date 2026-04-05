import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-local-auth";
import { toast } from "sonner";

const XP_REWARDS = {
  CORRECT_ANSWER: 10,
  LEVEL_CLEARANCE: 50,
  STREAK_5_DAYS: 100,
  STREAK_10_DAYS: 200,
  STREAK_30_DAYS: 500,
  MAINS_SUBMISSION: 30,
  DAILY_LOGIN: 5,
};

const STREAK_GUARD_PREFIX = "upsc_streak_guard";

const getLocalDateString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const parseDateString = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const clean = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
  const parts = clean.split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return null;
  const parsed = new Date(y, m - 1, d);
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const dayDiff = (fromDateStr: string, toDateStr: string): number | null => {
  const from = parseDateString(fromDateStr);
  const to = parseDateString(toDateStr);
  if (!from || !to) return null;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
};

const normalizeDateOnly = (value?: string | null): string => {
  if (!value) return "";
  return value.includes("T") ? value.split("T")[0] : value;
};

const streakGuardKey = (userId: string) => `${STREAK_GUARD_PREFIX}:${userId}`;

const readStreakGuard = (userId: string) => {
  try {
    return localStorage.getItem(streakGuardKey(userId)) || "";
  } catch {
    return "";
  }
};

const writeStreakGuard = (userId: string, date: string) => {
  try {
    localStorage.setItem(streakGuardKey(userId), date);
  } catch {
    // ignore localStorage write errors
  }
};

export function useGamification() {
  const { user, profile, isLocalMode, refreshProfile } = useAuth();

  const awardXP = async (amount: number, reason?: string) => {
    if (!user) return;
    if (isLocalMode) {
      toast.error("Backend connection required for XP updates.");
      return;
    }

    const currentXP = profile?.total_xp || 0;
    const newXP = currentXP + amount;
    const newLevel = Math.floor(newXP / 500) + 1;

    await supabase
      .from("profiles")
      .update({
        total_xp: newXP,
        level: newLevel,
      })
      .eq("id", user.id);

    if (reason) {
      toast.success(`+${amount} XP - ${reason}`, { duration: 2000 });
    }

    refreshProfile();
  };

  const updateStreak = async () => {
    if (!user || isLocalMode) return;

    const today = new Date();
    const todayStr = getLocalDateString(today);
    const alreadyProcessed = readStreakGuard(user.id);
    if (alreadyProcessed === todayStr) return;

    const { data } = await supabase
      .from("profiles")
      .select("current_streak, last_login_date, total_xp, level")
      .eq("id", user.id)
      .single();

    if (!data) return;

    const lastLogin = normalizeDateOnly(data.last_login_date);
    if (lastLogin === todayStr) {
      writeStreakGuard(user.id, todayStr);
      return;
    }

    let newStreak = 1;
    const diff = dayDiff(lastLogin || "", todayStr);
    if (diff === 1) {
      newStreak = (data.current_streak || 0) + 1;
    }

    const loginXP = XP_REWARDS.DAILY_LOGIN;
    const newXP = (data.total_xp || 0) + loginXP;
    const newLevel = Math.floor(newXP / 500) + 1;

    await supabase
      .from("profiles")
      .update({
        current_streak: newStreak,
        last_login_date: todayStr,
        total_xp: newXP,
        level: newLevel,
      })
      .eq("id", user.id);
    writeStreakGuard(user.id, todayStr);

    checkStreakMilestones(newStreak, data.current_streak || 0);
    refreshProfile();

    if (newStreak > 1) {
      toast.success(`Streak ${newStreak} days! +${loginXP} XP`, { duration: 2000 });
    } else {
      toast(`+${loginXP} XP for daily login`, { duration: 2000 });
    }
  };

  const checkStreakMilestones = async (newStreak: number, oldStreak: number) => {
    if (newStreak >= 5 && oldStreak < 5) {
      await awardXP(XP_REWARDS.STREAK_5_DAYS, "5-day streak bonus");
    }
    if (newStreak >= 10 && oldStreak < 10) {
      await awardXP(XP_REWARDS.STREAK_10_DAYS, "10-day streak bonus");
    }
    if (newStreak >= 30 && oldStreak < 30) {
      await awardXP(XP_REWARDS.STREAK_30_DAYS, "30-day streak legend bonus");
    }
  };

  return { awardXP, updateStreak, XP_REWARDS };
}
