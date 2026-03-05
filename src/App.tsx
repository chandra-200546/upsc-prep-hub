import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/hooks/use-theme";
import { AuthProvider } from "@/hooks/use-local-auth";
import LandingPage from "./pages/LandingPage";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import DashboardAnalytics from "./pages/DashboardAnalytics";
import DashboardLeaderboard from "./pages/DashboardLeaderboard";
import ProfileSettings from "./pages/ProfileSettings";
import Mentor from "./pages/Mentor";
import Prelims from "./pages/Prelims";
import Assistant from "./pages/Assistant";
import CurrentAffairs from "./pages/CurrentAffairs";
import StudyPlan from "./pages/StudyPlan";
import Mains from "./pages/Mains";
import NotesLibrary from "./pages/NotesLibrary";
import MapPractice from "./pages/MapPractice";
import MockInterview from "./pages/MockInterview";
import PYQEngine from "./pages/PYQEngine";
import MindMap from "./pages/MindMap";
import DailyIntelReport from "./pages/DailyIntelReport";
import OptionalProfessor from "./pages/OptionalProfessor";
import VoiceAI from "./pages/VoiceAI";
import Subscription from "./pages/Subscription";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/analytics" element={<DashboardAnalytics />} />
            <Route path="/dashboard/leaderboard" element={<DashboardLeaderboard />} />
            <Route path="/dashboard/profile" element={<ProfileSettings />} />
            <Route path="/mentor" element={<Mentor />} />
            <Route path="/prelims" element={<Prelims />} />
            <Route path="/assistant" element={<Assistant />} />
            <Route path="/current-affairs" element={<CurrentAffairs />} />
            <Route path="/study-plan" element={<StudyPlan />} />
            <Route path="/mains" element={<Mains />} />
            <Route path="/notes" element={<NotesLibrary />} />
            <Route path="/map-practice" element={<MapPractice />} />
            <Route path="/mock-interview" element={<MockInterview />} />
            <Route path="/pyq-engine" element={<PYQEngine />} />
            <Route path="/mind-map" element={<MindMap />} />
            <Route path="/daily-intel" element={<DailyIntelReport />} />
            <Route path="/optional-professor" element={<OptionalProfessor />} />
            <Route path="/voice-ai" element={<VoiceAI />} />
            <Route path="/subscription" element={<Subscription />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
