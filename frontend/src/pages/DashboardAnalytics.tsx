import { useAuth } from "@/hooks/use-local-auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import ActivityDashboard from "@/components/dashboard/ActivityDashboard";

const DashboardAnalytics = () => {
  const { profile } = useAuth();

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
