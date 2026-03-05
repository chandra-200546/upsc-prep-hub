import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import Leaderboard from "@/components/dashboard/Leaderboard";

const DashboardLeaderboard = () => {
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
