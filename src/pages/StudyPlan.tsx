import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, Calendar, CheckCircle2, Circle, Sparkles, Target, TrendingUp, Clock, BookOpen
} from "lucide-react";

interface Task {
  id: string;
  title: string;
  subject: string;
  duration: string;
  completed: boolean;
}

interface StudyPlan {
  id: string;
  date: string;
  tasks: any;
  total_tasks: number;
  completed_tasks: number;
}

const StudyPlan = () => {
  const [todayPlan, setTodayPlan] = useState<StudyPlan | null>(null);
  const [weeklyPlans, setWeeklyPlans] = useState<StudyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingWeekly, setGeneratingWeekly] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

  const checkAuthAndFetch = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    await Promise.all([
      fetchTodayPlan(session.user.id),
      fetchWeeklyPlans(session.user.id)
    ]);
  };

  const fetchTodayPlan = async (userId: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from("study_plan")
        .select("*")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();

      if (error) throw error;
      setTodayPlan(data);
    } catch (error) {
      console.error("Error fetching study plan:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeeklyPlans = async (userId: string) => {
    try {
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      const { data, error } = await supabase
        .from("study_plan")
        .select("*")
        .eq("user_id", userId)
        .gte("date", startOfWeek.toISOString().split('T')[0])
        .lte("date", endOfWeek.toISOString().split('T')[0])
        .order("date", { ascending: true });

      if (error) throw error;
      setWeeklyPlans(data || []);
    } catch (error) {
      console.error("Error fetching weekly plans:", error);
    }
  };

  const generatePlan = async () => {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const today = new Date().toISOString().split('T')[0];
      
      // Get user profile for personalization
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      // Generate AI-powered study plan
      const tasks: Task[] = [
        {
          id: "1",
          title: "NCERT Polity - Chapter 3: Electoral Politics",
          subject: "Polity",
          duration: "1 hour",
          completed: false
        },
        {
          id: "2",
          title: "Current Affairs - Daily Update",
          subject: "Current Affairs",
          duration: "30 mins",
          completed: false
        },
        {
          id: "3",
          title: "Indian Economy - National Income",
          subject: "Economy",
          duration: "1 hour",
          completed: false
        },
        {
          id: "4",
          title: "Prelims Practice - 20 MCQs",
          subject: "Mixed",
          duration: "30 mins",
          completed: false
        },
        {
          id: "5",
          title: `${profile?.optional_subject || "Optional"} - Topic Revision`,
          subject: profile?.optional_subject || "Optional",
          duration: "1 hour",
          completed: false
        },
        {
          id: "6",
          title: "Answer Writing Practice - 250 words",
          subject: "Mains",
          duration: "45 mins",
          completed: false
        }
      ];

      const { error } = await supabase
        .from("study_plan")
        .insert({
          user_id: session.user.id,
          date: today,
          tasks: tasks as any,
          total_tasks: tasks.length,
          completed_tasks: 0
        });

      if (error) throw error;

      await fetchTodayPlan(session.user.id);
      
      toast({
        title: "Plan Generated! 🎯",
        description: "Your personalized study plan is ready"
      });
    } catch (error) {
      console.error("Error generating plan:", error);
      toast({
        title: "Error",
        description: "Failed to generate study plan",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  const generateWeeklyPlan = async () => {
    setGeneratingWeekly(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());

      const subjects = ["Polity", "Economy", "History", "Geography", "Environment", "Current Affairs", profile?.optional_subject || "Optional"];
      const plansToInsert = [];

      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        // Check if plan already exists
        const { data: existing } = await supabase
          .from("study_plan")
          .select("id")
          .eq("user_id", session.user.id)
          .eq("date", dateStr)
          .maybeSingle();

        if (existing) continue;

        const dailySubjects = [
          subjects[i % subjects.length],
          subjects[(i + 1) % subjects.length],
          "Current Affairs"
        ];

        const tasks: Task[] = [
          {
            id: "1",
            title: `${dailySubjects[0]} - Study Session`,
            subject: dailySubjects[0],
            duration: "2 hours",
            completed: false
          },
          {
            id: "2",
            title: `${dailySubjects[1]} - Revision`,
            subject: dailySubjects[1],
            duration: "1 hour",
            completed: false
          },
          {
            id: "3",
            title: "Current Affairs - Daily Update",
            subject: "Current Affairs",
            duration: "30 mins",
            completed: false
          },
          {
            id: "4",
            title: "Prelims Practice - 30 MCQs",
            subject: "Mixed",
            duration: "45 mins",
            completed: false
          },
          {
            id: "5",
            title: "Answer Writing - 1 Question",
            subject: "Mains",
            duration: "30 mins",
            completed: false
          }
        ];

        plansToInsert.push({
          user_id: session.user.id,
          date: dateStr,
          tasks: tasks as any,
          total_tasks: tasks.length,
          completed_tasks: 0
        });
      }

      if (plansToInsert.length > 0) {
        const { error } = await supabase
          .from("study_plan")
          .insert(plansToInsert);

        if (error) throw error;
      }

      await fetchWeeklyPlans(session.user.id);
      
      toast({
        title: "Weekly Plan Generated! 📅",
        description: "Your 7-day study schedule is ready"
      });
    } catch (error) {
      console.error("Error generating weekly plan:", error);
      toast({
        title: "Error",
        description: "Failed to generate weekly plan",
        variant: "destructive"
      });
    } finally {
      setGeneratingWeekly(false);
    }
  };

  const toggleTask = async (taskId: string) => {
    if (!todayPlan) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const updatedTasks = todayPlan.tasks.map((task: Task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      );

      const completedCount = updatedTasks.filter((t: Task) => t.completed).length;

      const { error } = await supabase
        .from("study_plan")
        .update({
          tasks: updatedTasks as any,
          completed_tasks: completedCount
        })
        .eq("id", todayPlan.id);

      if (error) throw error;

      setTodayPlan({
        ...todayPlan,
        tasks: updatedTasks,
        completed_tasks: completedCount
      });

      // Award XP on task completion
      if (completedCount > (todayPlan.completed_tasks || 0)) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("total_xp")
        .eq("id", session.user.id)
        .maybeSingle();

        await supabase
          .from("profiles")
          .update({ total_xp: (profile?.total_xp || 0) + 10 })
          .eq("id", session.user.id);

        toast({
          title: "Task Completed! +10 XP",
          description: "Great progress today!"
        });
      }
    } catch (error) {
      console.error("Error updating task:", error);
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive"
      });
    }
  };

  const getSubjectColor = (subject: string) => {
    const colors: { [key: string]: string } = {
      "Polity": "bg-blue-500/10 text-blue-500",
      "Economy": "bg-green-500/10 text-green-500",
      "Current Affairs": "bg-purple-500/10 text-purple-500",
      "Mixed": "bg-orange-500/10 text-orange-500",
      "Mains": "bg-pink-500/10 text-pink-500"
    };
    return colors[subject] || "bg-primary/10 text-primary";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading study plan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Study Plan</h1>
              <p className="text-xs text-muted-foreground">Personalized daily schedule</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <Tabs defaultValue="today" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="space-y-4">
            {!todayPlan ? (
              <Card className="p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center mx-auto">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-bold text-xl">No Plan for Today</h3>
                <p className="text-muted-foreground">
                  Let AI create a personalized study plan based on your profile
                </p>
                <Button 
                  onClick={generatePlan} 
                  disabled={generating}
                  size="lg"
                  className="mt-4"
                >
                  {generating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Today's Plan
                    </>
                  )}
                </Button>
              </Card>
            ) : (
              <>
                {/* Progress Card */}
                <Card className="p-6 bg-gradient-card border-0">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-lg">Today's Progress</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date().toLocaleDateString('en-IN', { 
                          weekday: 'long', 
                          day: 'numeric', 
                          month: 'long' 
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-primary">
                        {todayPlan.completed_tasks}/{todayPlan.total_tasks}
                      </p>
                      <p className="text-xs text-muted-foreground">Tasks completed</p>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-gradient-primary h-full transition-all duration-500"
                      style={{ 
                        width: `${(todayPlan.completed_tasks / todayPlan.total_tasks) * 100}%` 
                      }}
                    />
                  </div>
                </Card>

                {/* Tasks List */}
                <div className="space-y-3">
                  {todayPlan.tasks.map((task: Task) => (
                    <Card 
                      key={task.id} 
                      className={`p-5 transition-all cursor-pointer ${
                        task.completed ? 'bg-success/5 border-success/20' : 'hover:shadow-md'
                      }`}
                      onClick={() => toggleTask(task.id)}
                    >
                      <div className="flex items-start gap-4">
                        <div className="pt-1">
                          {task.completed ? (
                            <CheckCircle2 className="w-6 h-6 text-success" />
                          ) : (
                            <Circle className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-4">
                            <h4 className={`font-semibold leading-tight ${
                              task.completed ? 'line-through text-muted-foreground' : ''
                            }`}>
                              {task.title}
                            </h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${getSubjectColor(task.subject)}`}>
                              {task.subject}
                            </span>
                            <span className="text-xs text-muted-foreground">• {task.duration}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Regenerate Button */}
                <Button 
                  onClick={generatePlan} 
                  disabled={generating}
                  variant="outline"
                  className="w-full"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Regenerate Plan
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="weekly" className="space-y-4">
            {weeklyPlans.length === 0 ? (
              <Card className="p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center mx-auto">
                  <Calendar className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-bold text-xl">No Weekly Plan Yet</h3>
                <p className="text-muted-foreground">
                  Generate a complete 7-day study schedule with balanced subject coverage
                </p>
                <Button 
                  onClick={generateWeeklyPlan} 
                  disabled={generatingWeekly}
                  size="lg"
                  className="mt-4"
                >
                  {generatingWeekly ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Weekly Plan
                    </>
                  )}
                </Button>
              </Card>
            ) : (
              <>
                {/* Weekly Overview */}
                <Card className="p-6 bg-gradient-card border-0">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-lg">This Week's Progress</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date().toLocaleDateString('en-IN', { 
                          month: 'long',
                          day: 'numeric'
                        })} - {new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', { 
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-primary">
                        {weeklyPlans.reduce((acc, plan) => acc + (plan.completed_tasks || 0), 0)}/
                        {weeklyPlans.reduce((acc, plan) => acc + (plan.total_tasks || 0), 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">Tasks completed</p>
                    </div>
                  </div>
                  <Progress 
                    value={
                      (weeklyPlans.reduce((acc, plan) => acc + (plan.completed_tasks || 0), 0) / 
                      weeklyPlans.reduce((acc, plan) => acc + (plan.total_tasks || 0), 0)) * 100
                    } 
                    className="h-3"
                  />
                </Card>

                {/* Daily Cards */}
                <div className="grid gap-4">
                  {Array.from({ length: 7 }).map((_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() - date.getDay() + i);
                    const dateStr = date.toISOString().split('T')[0];
                    const plan = weeklyPlans.find(p => p.date === dateStr);
                    const isToday = dateStr === new Date().toISOString().split('T')[0];

                    return (
                      <Card 
                        key={i} 
                        className={`p-5 ${isToday ? 'border-primary border-2' : ''} ${!plan ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-semibold flex items-center gap-2">
                              {date.toLocaleDateString('en-IN', { weekday: 'long' })}
                              {isToday && <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Today</span>}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                          {plan && (
                            <div className="text-right">
                              <p className="font-bold text-lg">
                                {plan.completed_tasks}/{plan.total_tasks}
                              </p>
                              <p className="text-xs text-muted-foreground">tasks</p>
                            </div>
                          )}
                        </div>
                        {plan ? (
                          <>
                            <Progress 
                              value={(plan.completed_tasks / plan.total_tasks) * 100} 
                              className="h-2 mb-3"
                            />
                            <div className="space-y-2">
                              {(plan.tasks as Task[]).slice(0, 3).map((task: Task) => (
                                <div key={task.id} className="flex items-center gap-2 text-sm">
                                  {task.completed ? (
                                    <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                                  ) : (
                                    <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                  )}
                                  <span className={task.completed ? 'line-through text-muted-foreground' : ''}>
                                    {task.title}
                                  </span>
                                </div>
                              ))}
                              {(plan.tasks as Task[]).length > 3 && (
                                <p className="text-xs text-muted-foreground pl-6">
                                  +{(plan.tasks as Task[]).length - 3} more tasks
                                </p>
                              )}
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">No plan for this day</p>
                        )}
                      </Card>
                    );
                  })}
                </div>

                <Button 
                  onClick={generateWeeklyPlan} 
                  disabled={generatingWeekly}
                  variant="outline"
                  className="w-full"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Regenerate Weekly Plan
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="monthly" className="space-y-4">
            {/* Monthly Milestones */}
            <Card className="p-6 bg-gradient-card border-0">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Monthly Roadmap</h3>
                  <p className="text-sm text-muted-foreground">
                    {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
            </Card>

            {/* Subject-wise Goals */}
            <div className="grid gap-4">
              {[
                { subject: "Polity", target: "Complete NCERT + Laxmikanth Basics", progress: 45 },
                { subject: "Economy", target: "Indian Economy + Economic Survey", progress: 30 },
                { subject: "History", target: "Ancient & Medieval India", progress: 60 },
                { subject: "Geography", target: "Physical Geography + Maps", progress: 25 },
                { subject: "Current Affairs", target: "Daily Updates + Weekly Compilation", progress: 75 },
                { subject: "Prelims Practice", target: "1000 MCQs + 5 Mock Tests", progress: 40 }
              ].map((goal, i) => (
                <Card key={i} className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">{goal.subject}</h4>
                      <p className="text-sm text-muted-foreground">{goal.target}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-primary">{goal.progress}%</p>
                    </div>
                  </div>
                  <Progress value={goal.progress} className="h-2" />
                </Card>
              ))}
            </div>

            {/* Weekly Breakdown */}
            <Card className="p-6">
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                This Month's Schedule
              </h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold">W1</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Week 1: Foundation Building</p>
                    <p className="text-sm text-muted-foreground">Focus: Polity + Current Affairs</p>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-success" />
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold">W2</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Week 2: Economic Concepts</p>
                    <p className="text-sm text-muted-foreground">Focus: Economy + Prelims Practice</p>
                  </div>
                  <Clock className="w-5 h-5 text-warning" />
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold">W3</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Week 3: Historical Context</p>
                    <p className="text-sm text-muted-foreground">Focus: History + Answer Writing</p>
                  </div>
                  <Circle className="w-5 h-5 text-muted-foreground" />
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold">W4</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Week 4: Comprehensive Revision</p>
                    <p className="text-sm text-muted-foreground">Focus: All Subjects + Mock Test</p>
                  </div>
                  <Circle className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            </Card>

            {/* Study Hours Target */}
            <Card className="p-6 bg-gradient-card border-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">124 hours</p>
                    <p className="text-sm text-muted-foreground">Study time this month</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-success">83%</p>
                  <p className="text-xs text-muted-foreground">of target (150h)</p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default StudyPlan;
