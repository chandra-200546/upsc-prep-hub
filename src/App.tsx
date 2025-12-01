import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Mentor from "./pages/Mentor";
import Prelims from "./pages/Prelims";
import Assistant from "./pages/Assistant";
import CurrentAffairs from "./pages/CurrentAffairs";
import StudyPlan from "./pages/StudyPlan";
import Mains from "./pages/Mains";
import NotesLibrary from "./pages/NotesLibrary";
import MapPractice from "./pages/MapPractice";
import MockInterview from "./pages/MockInterview";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/mentor" element={<Mentor />} />
          <Route path="/prelims" element={<Prelims />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/current-affairs" element={<CurrentAffairs />} />
          <Route path="/study-plan" element={<StudyPlan />} />
          <Route path="/mains" element={<Mains />} />
          <Route path="/notes" element={<NotesLibrary />} />
          <Route path="/map-practice" element={<MapPractice />} />
          <Route path="/mock-interview" element={<MockInterview />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
