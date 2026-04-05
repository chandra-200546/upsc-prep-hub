import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-local-auth";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import Leaderboard from "@/components/dashboard/Leaderboard";

const DashboardLeaderboard = () => {
  const { user, isLocalMode } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || isLocalMode) {
      toast({
        title: "Backend required",
        description: "Leaderboard works only with backend-connected account.",
        variant: "destructive",
      });
      navigate("/auth");
    }
  }, [user, isLocalMode, navigate, toast]);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Leaderboard</h1>
        <Leaderboard />
      </div>
    </DashboardLayout>
  );
};

export default DashboardLeaderboard;
