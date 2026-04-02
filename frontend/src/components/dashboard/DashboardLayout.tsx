import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "./DashboardSidebar";
import ThemeToggle from "@/components/ThemeToggle";
import upscMentorLogo from "@/assets/upsc-mentor-logo.jpeg";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10 px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <img src={upscMentorLogo} alt="UPSC Mentor" className="w-8 h-8 rounded-lg object-cover" />
              <span className="font-bold text-sm hidden sm:inline">UPSC Mentor</span>
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
