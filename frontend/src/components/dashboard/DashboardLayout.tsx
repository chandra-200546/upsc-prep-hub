import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "./DashboardSidebar";
import ThemeToggle from "@/components/ThemeToggle";
import upscMentorLogo from "@/assets/upsc-mentor-logo.jpeg";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type DoubtNotification = {
  id: string;
  type: string;
  message: string;
  relatedPostId?: string | null;
  isRead: boolean;
  createdAt: string;
};

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [notifications, setNotifications] = useState<DoubtNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  const backendBase = () => String(import.meta.env.VITE_BACKEND_URL || "http://localhost:8787").replace(/\/$/, "");

  const loadNotifications = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }
      const response = await fetch(`${backendBase()}/functions/v1/notifications?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return;
      setNotifications(payload.items || []);
      setUnreadCount(Number(payload.unreadCount || 0));
    } catch {
      // keep header stable even if backend is unavailable
    }
  };

  const markNotificationRead = async (id: string, relatedPostId?: string | null) => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) return;
      await fetch(`${backendBase()}/functions/v1/notifications/${id}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      await loadNotifications();
      if (relatedPostId) navigate(`/doubt-feed?postId=${encodeURIComponent(relatedPostId)}`);
    } catch {
      // ignore notification update error
    }
  };

  useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 45000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <Badge className="absolute -right-1 -top-1 min-w-[18px] px-1 h-[18px] text-[10px] flex items-center justify-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {!notifications.length && (
                    <DropdownMenuItem className="text-muted-foreground">No notifications yet.</DropdownMenuItem>
                  )}
                  {notifications.map((item) => (
                    <DropdownMenuItem key={item.id} onClick={() => markNotificationRead(item.id, item.relatedPostId)}>
                      <div className="space-y-0.5">
                        <p className={`text-xs ${item.isRead ? "text-muted-foreground" : "font-semibold"}`}>{item.message}</p>
                        <p className="text-[11px] text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
