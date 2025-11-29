import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, Calendar, Tag, TrendingUp, BookOpen, FileText, Brain
} from "lucide-react";

interface CurrentAffair {
  id: string;
  title: string;
  summary: string;
  full_content: string | null;
  date: string;
  category: string;
  importance_level: string | null;
  tags: string[] | null;
}

const CurrentAffairs = () => {
  const [affairs, setAffairs] = useState<CurrentAffair[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAffair, setSelectedAffair] = useState<CurrentAffair | null>(null);
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

    await fetchCurrentAffairs();
  };

  const fetchCurrentAffairs = async () => {
    try {
      const { data, error } = await supabase
        .from("current_affairs")
        .select("*")
        .order("date", { ascending: false })
        .limit(20);

      if (error) throw error;
      setAffairs(data || []);
    } catch (error) {
      console.error("Error fetching current affairs:", error);
      toast({
        title: "Error",
        description: "Failed to load current affairs",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getImportanceColor = (level: string | null) => {
    switch (level) {
      case "high": return "bg-destructive/10 text-destructive";
      case "medium": return "bg-warning/10 text-warning";
      case "low": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case "politics": return "🏛️";
      case "economy": return "💰";
      case "science": return "🔬";
      case "environment": return "🌍";
      case "international": return "🌐";
      default: return "📰";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading current affairs...</p>
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
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Current Affairs</h1>
              <p className="text-xs text-muted-foreground">Stay updated daily</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="daily" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="topics">By Topic</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="space-y-4">
            {affairs.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No current affairs available yet</p>
              </Card>
            ) : (
              affairs.map((affair) => (
                <Card 
                  key={affair.id} 
                  className="p-6 hover:shadow-lg transition-all cursor-pointer"
                  onClick={() => setSelectedAffair(affair)}
                >
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">{getCategoryIcon(affair.category)}</div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="font-bold text-lg leading-tight">{affair.title}</h3>
                        <Badge className={getImportanceColor(affair.importance_level)}>
                          {affair.importance_level || "medium"}
                        </Badge>
                      </div>
                      
                      <p className="text-muted-foreground leading-relaxed">{affair.summary}</p>
                      
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          {new Date(affair.date).toLocaleDateString('en-IN', { 
                            day: 'numeric', 
                            month: 'short', 
                            year: 'numeric' 
                          })}
                        </div>
                        <Badge variant="outline">{affair.category}</Badge>
                        {affair.tags && affair.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="weekly" className="space-y-4">
            <Card className="p-8 text-center">
              <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-bold text-lg mb-2">Weekly Digest</h3>
              <p className="text-muted-foreground mb-4">Comprehensive weekly summary with analysis</p>
              <Button>Generate Weekly Digest</Button>
            </Card>
          </TabsContent>

          <TabsContent value="topics" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {["Politics", "Economy", "Science & Tech", "Environment", "International", "Society"].map((topic) => (
                <Card key={topic} className="p-6 text-center hover:shadow-lg transition-all cursor-pointer">
                  <div className="text-3xl mb-2">{getCategoryIcon(topic)}</div>
                  <h3 className="font-semibold">{topic}</h3>
                  <p className="text-sm text-muted-foreground mt-1">View articles</p>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Detail Modal */}
        {selectedAffair && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedAffair(null)}>
            <Card className="max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="font-bold text-2xl leading-tight">{selectedAffair.title}</h2>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedAffair(null)}>✕</Button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <Badge>{selectedAffair.category}</Badge>
                  <Badge className={getImportanceColor(selectedAffair.importance_level)}>
                    {selectedAffair.importance_level || "medium"}
                  </Badge>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {new Date(selectedAffair.date).toLocaleDateString('en-IN')}
                  </div>
                </div>

                <div className="prose prose-sm max-w-none">
                  <p className="text-muted-foreground leading-relaxed">{selectedAffair.summary}</p>
                  {selectedAffair.full_content && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="whitespace-pre-wrap">{selectedAffair.full_content}</p>
                    </div>
                  )}
                </div>

                {selectedAffair.tags && selectedAffair.tags.length > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-semibold mb-2">Tags:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedAffair.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          <Tag className="w-3 h-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    How to use in Mains?
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    This topic can be used in GS2/GS3 papers for questions related to {selectedAffair.category.toLowerCase()}. 
                    Focus on understanding the core concept and its implications.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default CurrentAffairs;
