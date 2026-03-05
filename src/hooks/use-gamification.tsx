import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-local-auth";
import { toast } from "sonner";

// XP rewards config
const XP_REWARDS = {
  CORRECT_ANSWER: 10,
  LEVEL_CLEARANCE: 50,
  STREAK_5_DAYS: 100,
  STREAK_10_DAYS: 200,
  STREAK_30_DAYS: 500,
  MAINS_SUBMISSION: 30,
  DAILY_LOGIN: 5,
};

export function useGamification() {
  const { user, profile, isLocalMode, refreshProfile } = useAuth();

  const awardXP = async (amount: number, reason?: string) => {
    if (!user) return;

    if (isLocalMode) {
      // Local mode: update localStorage
      const profilesRaw = localStorage.getItem("upsc_local_profiles");
      if (profilesRaw) {
        const profiles = JSON.parse(profilesRaw);
        if (profiles[user.id]) {
          profiles[user.id].total_xp = (profiles[user.id].total_xp || 0) + amount;
          // Level up every 500 XP
          profiles[user.id].level = Math.floor(profiles[user.id].total_xp / 500) + 1;
          localStorage.setItem("upsc_local_profiles", JSON.stringify(profiles));
        }
      }
    } else {
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
    }

    if (reason) {
      toast.success(`+${amount} XP — ${reason}`, { duration: 2000 });
    }

    refreshProfile();
  };

  const updateStreak = async () => {
    if (!user) return;

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    if (isLocalMode) {
      const profilesRaw = localStorage.getItem("upsc_local_profiles");
      if (!profilesRaw) return;
      const profiles = JSON.parse(profilesRaw);
      const p = profiles[user.id];
      if (!p) return;

      const lastLogin = p.last_login_date;
      if (lastLogin === todayStr) return; // Already logged in today

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      let newStreak = 1;
      if (lastLogin === yesterdayStr) {
        newStreak = (p.current_streak || 0) + 1;
      }

      profiles[user.id] = {
        ...p,
        current_streak: newStreak,
        last_login_date: todayStr,
      };
      localStorage.setItem("upsc_local_profiles", JSON.stringify(profiles));

      // Award streak milestones
      checkStreakMilestones(newStreak, p.current_streak || 0);
      refreshProfile();
      if (newStreak > 1) {
        toast.success(`🔥 ${newStreak} day streak!`, { duration: 2000 });
      }
    } else {
      // Supabase mode
      const { data } = await supabase
        .from("profiles")
        .select("current_streak, last_login_date, total_xp, level")
        .eq("id", user.id)
        .single();

      if (!data) return;

      const lastLogin = data.last_login_date;
      if (lastLogin === todayStr) return; // Already updated today

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      let newStreak = 1;
      if (lastLogin === yesterdayStr) {
        newStreak = (data.current_streak || 0) + 1;
      }

      // Award daily login XP
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

      checkStreakMilestones(newStreak, data.current_streak || 0);
      refreshProfile();

      if (newStreak > 1) {
        toast.success(`🔥 ${newStreak} day streak! +${loginXP} XP`, { duration: 2000 });
      } else {
        toast(`+${loginXP} XP for daily login`, { duration: 2000 });
      }
    }
  };

  const checkStreakMilestones = async (newStreak: number, oldStreak: number) => {
    if (newStreak >= 5 && oldStreak < 5) {
      await awardXP(XP_REWARDS.STREAK_5_DAYS, "5-day streak bonus! 🔥");
    }
    if (newStreak >= 10 && oldStreak < 10) {
      await awardXP(XP_REWARDS.STREAK_10_DAYS, "10-day streak bonus! 🔥🔥");
    }
    if (newStreak >= 30 && oldStreak < 30) {
      await awardXP(XP_REWARDS.STREAK_30_DAYS, "30-day streak! Legend! 🏆");
    }
  };

  return { awardXP, updateStreak, XP_REWARDS };
}
