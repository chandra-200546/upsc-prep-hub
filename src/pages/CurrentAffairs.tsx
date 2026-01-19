import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, Calendar, Tag, TrendingUp, BookOpen, FileText, Brain, RefreshCw, Loader2
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

const TOPICS = [
  { name: "Polity", icon: "🏛️" },
  { name: "Economy", icon: "💰" },
  { name: "Science & Technology", icon: "🔬" },
  { name: "Environment", icon: "🌍" },
  { name: "International Relations", icon: "🌐" },
  { name: "Art & Culture", icon: "🎭" },
  { name: "Social Issues", icon: "👥" },
  { name: "Security", icon: "🛡️" },
];

const CurrentAffairs = () => {
  const [affairs, setAffairs] = useState<CurrentAffair[]>([]);
  const [weeklyAffairs, setWeeklyAffairs] = useState<CurrentAffair[]>([]);
  const [topicAffairs, setTopicAffairs] = useState<CurrentAffair[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingDaily, setGeneratingDaily] = useState(false);
  const [generatingWeekly, setGeneratingWeekly] = useState(false);
  const [generatingTopic, setGeneratingTopic] = useState<string | null>(null);
  const [selectedAffair, setSelectedAffair] = useState<CurrentAffair | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("daily");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }
    
    setLoading(false);
    // Auto-generate daily affairs on load
    generateDailyAffairs();
  };

  const generateDailyAffairs = async () => {
    if (generatingDaily) return;
    
    setGeneratingDaily(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-current-affairs', {
        body: { type: 'daily' }
      });

      if (error) throw error;
      
      if (data.error) {
        throw new Error(data.error);
      }

      setAffairs(data.affairs || []);
      toast({
        title: "Success",
        description: `Generated ${data.affairs?.length || 0} daily current affairs`,
      });
    } catch (error) {
      console.error("Error generating daily affairs:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate current affairs",
        variant: "destructive"
      });
    } finally {
      setGeneratingDaily(false);
    }
  };

  const generateWeeklyDigest = async () => {
    if (generatingWeekly) return;
    
    setGeneratingWeekly(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-current-affairs', {
        body: { type: 'weekly' }
      });

      if (error) throw error;
      
      if (data.error) {
        throw new Error(data.error);
      }

      setWeeklyAffairs(data.affairs || []);
      toast({
        title: "Success",
        description: `Generated weekly digest with ${data.affairs?.length || 0} items`,
      });
    } catch (error) {
      console.error("Error generating weekly digest:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate weekly digest",
        variant: "destructive"
      });
    } finally {
      setGeneratingWeekly(false);
    }
  };

  const generateTopicAffairs = async (topic: string) => {
    if (generatingTopic) return;
    
    setGeneratingTopic(topic);
    setSelectedTopic(topic);
    try {
      const { data, error } = await supabase.functions.invoke('generate-current-affairs', {
        body: { type: 'topic', topic }
      });

      if (error) throw error;
      
      if (data.error) {
        throw new Error(data.error);
      }

      setTopicAffairs(data.affairs || []);
      toast({
        title: "Success",
        description: `Generated ${data.affairs?.length || 0} articles for ${topic}`,
      });
    } catch (error) {
      console.error("Error generating topic affairs:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate topic affairs",
        variant: "destructive"
      });
    } finally {
      setGeneratingTopic(null);
    }
  };

  const getImportanceColor = (level: string | null) => {
    switch (level) {
      case "high": return "bg-destructive/10 text-destructive border-destructive/30";
      case "medium": return "bg-amber-500/10 text-amber-600 border-amber-500/30";
      case "low": return "bg-muted text-muted-foreground border-muted";
      default: return "bg-muted text-muted-foreground border-muted";
    }
  };

  const getCategoryIcon = (category: string) => {
    const topic = TOPICS.find(t => t.name.toLowerCase().includes(category.toLowerCase()) || 
                                   category.toLowerCase().includes(t.name.toLowerCase()));
    return topic?.icon || "📰";
  };

  const renderAffairCard = (affair: CurrentAffair) => (
    <Card 
      key={affair.id} 
      className="p-6 hover:shadow-lg transition-all cursor-pointer border-l-4 border-l-primary/50"
      onClick={() => setSelectedAffair(affair)}
    >
      <div className="flex items-start gap-4">
        <div className="text-3xl">{getCategoryIcon(affair.category)}</div>
        <div className="flex-1 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <h3 className="font-bold text-lg leading-tight hover:text-primary transition-colors">{affair.title}</h3>
            <Badge className={getImportanceColor(affair.importance_level)}>
              {affair.importance_level || "medium"}
            </Badge>
          </div>
          
          <p className="text-muted-foreground leading-relaxed line-clamp-2">{affair.summary}</p>
          
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
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-bold text-lg">Current Affairs</h1>
                <p className="text-xs text-muted-foreground">AI-Powered Daily Updates</p>
              </div>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={activeTab === "daily" ? generateDailyAffairs : activeTab === "weekly" ? generateWeeklyDigest : undefined}
            disabled={generatingDaily || generatingWeekly}
          >
            {(generatingDaily || generatingWeekly) ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="daily" className="space-y-6" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
            <TabsTrigger value="daily">Daily ({affairs.length})</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="topics">By Topic</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="space-y-4">
            {generatingDaily ? (
              <Card className="p-12 text-center">
                <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
                <h3 className="font-bold text-lg mb-2">Generating Daily Current Affairs...</h3>
                <p className="text-muted-foreground">AI is curating 20+ UPSC-relevant news items for today</p>
              </Card>
            ) : affairs.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">No current affairs loaded yet</p>
                <Button onClick={generateDailyAffairs}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Generate Daily Affairs
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {affairs.length} articles for {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      {affairs.filter(a => a.importance_level === 'high').length} High Priority
                    </Badge>
                  </div>
                </div>
                {affairs.map(renderAffairCard)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="weekly" className="space-y-4">
            {generatingWeekly ? (
              <Card className="p-12 text-center">
                <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
                <h3 className="font-bold text-lg mb-2">Generating Weekly Digest...</h3>
                <p className="text-muted-foreground">AI is compiling the week's most important news</p>
              </Card>
            ) : weeklyAffairs.length === 0 ? (
              <Card className="p-8 text-center">
                <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-bold text-lg mb-2">Weekly Digest</h3>
                <p className="text-muted-foreground mb-4">Comprehensive weekly summary with analysis</p>
                <Button onClick={generateWeeklyDigest}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Generate Weekly Digest
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Weekly digest: {weeklyAffairs.length} major developments
                  </p>
                </div>
                {weeklyAffairs.map(renderAffairCard)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="topics" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {TOPICS.map((topic) => (
                <Card 
                  key={topic.name} 
                  className={`p-6 text-center hover:shadow-lg transition-all cursor-pointer ${
                    selectedTopic === topic.name ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => generateTopicAffairs(topic.name)}
                >
                  {generatingTopic === topic.name ? (
                    <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-primary" />
                  ) : (
                    <div className="text-3xl mb-2">{topic.icon}</div>
                  )}
                  <h3 className="font-semibold text-sm">{topic.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">Click to load</p>
                </Card>
              ))}
            </div>

            {selectedTopic && topicAffairs.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg">{selectedTopic} - {topicAffairs.length} Articles</h3>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedTopic(null)}>
                    Clear
                  </Button>
                </div>
                {topicAffairs.map(renderAffairCard)}
              </div>
            )}
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
                  <p className="text-muted-foreground leading-relaxed font-medium">{selectedAffair.summary}</p>
                  {selectedAffair.full_content && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="whitespace-pre-wrap leading-relaxed">{selectedAffair.full_content}</p>
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
                    UPSC Relevance
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    This topic is relevant for GS papers focusing on {selectedAffair.category}. 
                    Key areas to focus: policy implications, constitutional aspects, and recent developments.
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
