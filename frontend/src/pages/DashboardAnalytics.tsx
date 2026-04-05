import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-local-auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import ActivityDashboard from "@/components/dashboard/ActivityDashboard";
import { useToast } from "@/hooks/use-toast";

const DashboardAnalytics = () => {
  const { profile, user, isLocalMode } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || isLocalMode) {
      toast({
        title: "Backend required",
        description: "Analytics works only with backend-connected account.",
        variant: "destructive",
      });
      navigate("/auth");
    }
  }, [user, isLocalMode, navigate, toast]);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Analytics</h1>
        <ActivityDashboard profile={profile} />
      </div>
    </DashboardLayout>
  );
};

export default DashboardAnalytics;
