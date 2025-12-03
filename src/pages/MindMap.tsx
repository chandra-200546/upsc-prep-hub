import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Brain, Loader2, Save, Trash2, History } from "lucide-react";

interface MindMapNode {
  id: string;
  label: string;
  children?: MindMapNode[];
  color?: string;
}

interface SavedMindMap {
  id: string;
  topic: string;
  data: MindMapNode;
  created_at: string;
}

const MindMap = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mindMapData, setMindMapData] = useState<MindMapNode | null>(null);
  const [currentTopic, setCurrentTopic] = useState("");
  const [savedMaps, setSavedMaps] = useState<SavedMindMap[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserId(user.id);
      loadSavedMaps(user.id);
    };
    checkAuth();
  }, [navigate]);

  const loadSavedMaps = async (uid: string) => {
    const { data, error } = await supabase
      .from("mind_maps" as any)
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setSavedMaps((data as any[]).map(m => ({
        id: m.id,
        topic: m.topic,
        data: m.data as MindMapNode,
        created_at: m.created_at || ""
      })));
    }
  };

  const generateMindMap = async () => {
    if (!topic.trim()) {
      toast({ title: "Please enter a topic", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setMindMapData(null);

    try {
      const response = await supabase.functions.invoke("mind-map-generator", {
        body: { topic: topic.trim() }
      });

      if (response.error) throw new Error(response.error.message);

      setMindMapData(response.data.mindMap);
      setCurrentTopic(topic.trim());
      toast({ title: "Mind map generated!" });
    } catch (error) {
      console.error("Error generating mind map:", error);
      toast({ title: "Failed to generate mind map", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const saveMindMap = async () => {
    if (!mindMapData || !userId) return;

    try {
      const { error } = await supabase.from("mind_maps" as any).insert({
        user_id: userId,
        topic: currentTopic,
        data: mindMapData as any
      });

      if (error) throw error;

      toast({ title: "Mind map saved!" });
      loadSavedMaps(userId);
    } catch (error) {
      console.error("Error saving mind map:", error);
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  const deleteMindMap = async (id: string) => {
    try {
      const { error } = await supabase.from("mind_maps" as any).delete().eq("id", id);
      if (error) throw error;
      
      setSavedMaps(prev => prev.filter(m => m.id !== id));
      toast({ title: "Mind map deleted" });
    } catch (error) {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const loadMindMap = (map: SavedMindMap) => {
    setMindMapData(map.data);
    setCurrentTopic(map.topic);
    setShowSaved(false);
  };

  const colors = [
    "bg-blue-500", "bg-green-500", "bg-purple-500", 
    "bg-orange-500", "bg-pink-500", "bg-teal-500"
  ];

  const renderNode = (node: MindMapNode, level: number = 0, index: number = 0) => {
    const colorClass = colors[index % colors.length];
    
    return (
      <div key={node.id} className={`flex flex-col items-center ${level > 0 ? "mt-4" : ""}`}>
        <div 
          className={`${level === 0 ? "bg-primary text-primary-foreground px-6 py-4 text-lg font-bold" : `${colorClass} text-white px-4 py-2 text-sm font-medium`} rounded-xl shadow-lg text-center max-w-xs transition-transform hover:scale-105`}
        >
          {node.label}
        </div>
        
        {node.children && node.children.length > 0 && (
          <>
            <div className="w-0.5 h-6 bg-muted-foreground/30" />
            <div className="flex flex-wrap justify-center gap-4">
              {node.children.map((child, idx) => (
                <div key={child.id} className="flex flex-col items-center">
                  <div className="w-0.5 h-4 bg-muted-foreground/30" />
                  {renderNode(child, level + 1, idx)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Mind Map Generator</h1>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowSaved(!showSaved)}
            className="gap-2"
          >
            <History className="h-4 w-4" />
            Saved ({savedMaps.length})
          </Button>
        </div>

        {/* Input Section */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Input
                placeholder="Enter any UPSC topic... (e.g., Indian Monsoon, Fundamental Rights)"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && generateMindMap()}
                className="flex-1"
              />
              <Button onClick={generateMindMap} disabled={isLoading} className="gap-2">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                Generate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Examples: GDP vs GNP, Mughal Administration, Green Hydrogen Mission, Preamble of India
            </p>
          </CardContent>
        </Card>

        {/* Saved Maps Panel */}
        {showSaved && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Saved Mind Maps</CardTitle>
            </CardHeader>
            <CardContent>
              {savedMaps.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No saved mind maps yet</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {savedMaps.map((map) => (
                    <div
                      key={map.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <button
                        onClick={() => loadMindMap(map)}
                        className="flex-1 text-left"
                      >
                        <p className="font-medium truncate">{map.topic}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(map.created_at).toLocaleDateString()}
                        </p>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMindMap(map.id)}
                        className="h-8 w-8 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Mind Map Display */}
        {isLoading && (
          <Card className="p-12">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Generating mind map for "{topic}"...</p>
            </div>
          </Card>
        )}

        {mindMapData && !isLoading && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl">{currentTopic}</CardTitle>
              <Button onClick={saveMindMap} variant="outline" className="gap-2">
                <Save className="h-4 w-4" />
                Save
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="min-w-max p-8 flex justify-center">
                {renderNode(mindMapData)}
              </div>
            </CardContent>
          </Card>
        )}

        {!mindMapData && !isLoading && (
          <Card className="p-12">
            <div className="flex flex-col items-center gap-4 text-center">
              <Brain className="h-16 w-16 text-muted-foreground/50" />
              <div>
                <h3 className="font-semibold text-lg">Enter a topic to visualize</h3>
                <p className="text-muted-foreground text-sm">
                  AI will create a structured mind map with concepts, relationships & examples
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MindMap;
