import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-local-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, BarChart3, Trophy, Settings, LogOut,
  MessageSquare, Brain, FileText, Calendar, Award,
  BookOpen, Map, Video, GitBranch, Newspaper, GraduationCap, MessageCircle,
  Mic,
  ClipboardList,
  MessageCircleQuestion,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import FeedbackForm from "@/components/FeedbackForm";

const mainNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Analytics", url: "/dashboard/analytics", icon: BarChart3 },
  { title: "Leaderboard", url: "/dashboard/leaderboard", icon: Trophy },
  { title: "Profile Settings", url: "/dashboard/profile", icon: Settings },
];

const allFeatures = [
  { title: "AI Mentor", url: "/mentor", icon: MessageSquare },
  { title: "Prelims Quiz", url: "/prelims", icon: Brain },
  { title: "Current Affairs", url: "/current-affairs", icon: FileText },
  { title: "Study Plan", url: "/study-plan", icon: Calendar },
  { title: "Mains Practice", url: "/mains", icon: Award },
  { title: "UPSC Notes", url: "/notes", icon: BookOpen },
  { title: "Notes Library", url: "/notes-library", icon: BookOpen },
  { title: "Map Practice", url: "/map-practice", icon: Map },
  { title: "Mock Interview", url: "/mock-interview", icon: Video },
  { title: "PYQ Engine", url: "/pyq-engine", icon: BarChart3 },
  { title: "Mind Map", url: "/mind-map", icon: GitBranch },
  { title: "Daily Intel", url: "/daily-intel", icon: Newspaper },
  { title: "Optional Prof.", url: "/optional-professor", icon: GraduationCap },
  { title: "Voice AI", url: "/voice-ai", icon: Mic },
  { title: "Weekly Test Series", url: "/weekly-test-series", icon: ClipboardList },
  { title: "UPSC Doubt Feed", url: "/doubt-feed", icon: MessageCircleQuestion },
];

export function DashboardSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showFeedback, setShowFeedback] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <>
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarContent className="bg-card/50 backdrop-blur-sm">
        {/* User Profile Summary */}
        <div className={`p-4 border-b border-border/50 ${collapsed ? "flex justify-center" : ""}`}>
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={profile?.profile_photo_url || undefined} alt={profile?.name} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {profile?.name?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{profile?.name}</p>
                <p className="text-xs text-muted-foreground">Level {profile?.level || 1}</p>
              </div>
            )}
          </div>
        </div>

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-muted/50"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* All Features */}
        <SidebarGroup>
          <SidebarGroupLabel>Features</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {allFeatures.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="hover:bg-muted/50"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Feedback */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setShowFeedback(true)}>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  {!collapsed && <span>Feedback</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/50 bg-card/50">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className={`w-full justify-start text-muted-foreground hover:text-destructive ${collapsed ? "justify-center px-2" : ""}`}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {!collapsed && <span>Logout</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>

    {showFeedback && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowFeedback(false)}>
        <div className="max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
          <FeedbackForm />
        </div>
      </div>
    )}
    </>
  );
}
