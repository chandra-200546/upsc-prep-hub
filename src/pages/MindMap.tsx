import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Brain, Loader2, Save, Trash2, History, Sparkles, Download, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface MindMapNode {
  id: string;
  label: string;
  children?: MindMapNode[];
}

interface SavedMindMap {
  id: string;
  topic: string;
  data: MindMapNode;
  created_at: string;
}

interface NodePosition {
  x: number;
  y: number;
  node: MindMapNode;
  level: number;
  angle: number;
  parentPos?: { x: number; y: number };
}

const COLORS = [
  { bg: "hsl(220, 90%, 56%)", glow: "hsl(220, 90%, 70%)" }, // Blue
  { bg: "hsl(160, 84%, 39%)", glow: "hsl(160, 84%, 55%)" }, // Emerald
  { bg: "hsl(280, 87%, 55%)", glow: "hsl(280, 87%, 70%)" }, // Purple
  { bg: "hsl(25, 95%, 53%)", glow: "hsl(25, 95%, 68%)" },   // Orange
  { bg: "hsl(340, 82%, 52%)", glow: "hsl(340, 82%, 67%)" }, // Pink
  { bg: "hsl(175, 84%, 32%)", glow: "hsl(175, 84%, 48%)" }, // Teal
];

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
  const [zoom, setZoom] = useState(1);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

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
      setZoom(1);
      toast({ title: "Mind map generated!", description: "Your visual map is ready" });
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
    setZoom(1);
  };

  // Calculate positions for radial mind map
  const calculatePositions = useCallback((root: MindMapNode): NodePosition[] => {
    const positions: NodePosition[] = [];
    const centerX = 400;
    const centerY = 300;
    
    // Root node
    positions.push({ x: centerX, y: centerY, node: root, level: 0, angle: 0 });
    
    if (!root.children) return positions;
    
    const childCount = root.children.length;
    const angleStep = (2 * Math.PI) / childCount;
    const level1Radius = 150;
    
    root.children.forEach((child, i) => {
      const angle = angleStep * i - Math.PI / 2;
      const x = centerX + Math.cos(angle) * level1Radius;
      const y = centerY + Math.sin(angle) * level1Radius;
      
      positions.push({ 
        x, y, node: child, level: 1, angle, 
        parentPos: { x: centerX, y: centerY } 
      });
      
      // Level 2 children
      if (child.children) {
        const level2Radius = 90;
        const childAngleSpread = Math.PI / 3;
        const startAngle = angle - childAngleSpread / 2;
        const childAngleStep = child.children.length > 1 
          ? childAngleSpread / (child.children.length - 1) 
          : 0;
        
        child.children.forEach((grandchild, j) => {
          const gAngle = child.children!.length === 1 
            ? angle 
            : startAngle + childAngleStep * j;
          const gx = x + Math.cos(gAngle) * level2Radius;
          const gy = y + Math.sin(gAngle) * level2Radius;
          
          positions.push({ 
            x: gx, y: gy, node: grandchild, level: 2, angle: gAngle,
            parentPos: { x, y }
          });
        });
      }
    });
    
    return positions;
  }, []);

  const downloadSVG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentTopic.replace(/\s+/g, "_")}_mindmap.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const positions = mindMapData ? calculatePositions(mindMapData) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/dashboard")}
              className="hover:bg-primary/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Brain className="h-7 w-7 text-primary" />
                <Sparkles className="h-3 w-3 text-yellow-500 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                  Mind Map Studio
                </h1>
                <p className="text-xs text-muted-foreground">AI-Powered Visual Learning</p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowSaved(!showSaved)}
            className="gap-2 border-primary/20 hover:border-primary/50"
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Saved</span>
            <span className="bg-primary/20 px-2 py-0.5 rounded-full text-xs">{savedMaps.length}</span>
          </Button>
        </div>

        {/* Input Section */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-purple-500/20 to-pink-500/20 rounded-2xl blur-xl opacity-50" />
          <div className="relative bg-card/80 backdrop-blur-sm border border-primary/20 rounded-2xl p-6">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Input
                  placeholder="Enter any UPSC topic... (e.g., Indian Monsoon, Fundamental Rights)"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && generateMindMap()}
                  className="h-12 pl-4 pr-4 bg-background/50 border-primary/20 focus:border-primary text-base"
                />
              </div>
              <Button 
                onClick={generateMindMap} 
                disabled={isLoading} 
                className="h-12 px-6 gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/25"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Brain className="h-5 w-5" />
                )}
                <span className="hidden sm:inline">Generate</span>
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {["Indian Monsoon", "Fundamental Rights", "Green Hydrogen", "Mughal Era"].map((example) => (
                <button
                  key={example}
                  onClick={() => setTopic(example)}
                  className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Saved Maps Panel */}
        {showSaved && (
          <div className="mb-6 bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-4 animate-in slide-in-from-top-2">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Saved Mind Maps
            </h3>
            {savedMaps.length === 0 ? (
              <p className="text-muted-foreground text-center py-4 text-sm">No saved mind maps yet</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {savedMaps.map((map) => (
                  <div
                    key={map.id}
                    className="group flex items-center justify-between p-3 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 hover:from-primary/10 hover:to-purple-500/10 border border-transparent hover:border-primary/30 transition-all cursor-pointer"
                    onClick={() => loadMindMap(map)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{map.topic}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(map.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); deleteMindMap(map.id); }}
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="relative bg-card/80 backdrop-blur-sm border border-primary/20 rounded-2xl p-16">
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <Brain className="h-8 w-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="text-center">
                <p className="font-medium">Creating your mind map...</p>
                <p className="text-sm text-muted-foreground mt-1">AI is analyzing "{topic}"</p>
              </div>
            </div>
          </div>
        )}

        {/* Mind Map Display */}
        {mindMapData && !isLoading && (
          <div className="relative bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/30">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                {currentTopic}
              </h2>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-background/50 rounded-lg p-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setZoom(z => Math.min(2, z + 0.1))}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setZoom(1)}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
                <Button onClick={downloadSVG} variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
                <Button onClick={saveMindMap} size="sm" className="gap-2 bg-primary hover:bg-primary/90">
                  <Save className="h-4 w-4" />
                  <span className="hidden sm:inline">Save</span>
                </Button>
              </div>
            </div>

            {/* SVG Mind Map */}
            <div className="overflow-auto bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800" style={{ minHeight: "500px" }}>
              <svg
                ref={svgRef}
                viewBox="0 0 800 600"
                className="w-full h-auto min-h-[500px]"
                style={{ transform: `scale(${zoom})`, transformOrigin: "center", transition: "transform 0.2s" }}
              >
                <defs>
                  {/* Gradients for nodes */}
                  <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                  </radialGradient>
                  {COLORS.map((color, i) => (
                    <linearGradient key={i} id={`grad${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={color.glow} />
                      <stop offset="100%" stopColor={color.bg} />
                    </linearGradient>
                  ))}
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                  <filter id="shadow">
                    <feDropShadow dx="0" dy="4" stdDeviation="8" floodOpacity="0.15"/>
                  </filter>
                </defs>

                {/* Background pattern */}
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="20" cy="20" r="1" fill="currentColor" opacity="0.1" />
                </pattern>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {/* Center glow */}
                <circle cx="400" cy="300" r="180" fill="url(#centerGlow)" />

                {/* Connection lines */}
                {positions.filter(p => p.parentPos).map((pos, i) => {
                  const isHovered = hoveredNode === pos.node.id;
                  const colorIdx = positions.findIndex(p => p.level === 1 && 
                    (pos.level === 1 ? p.node.id === pos.node.id : 
                    p.node.children?.some(c => c.id === pos.node.id || c.children?.some(gc => gc.id === pos.node.id))));
                  const color = COLORS[(colorIdx >= 0 ? colorIdx : i) % COLORS.length];
                  
                  // Curved path
                  const dx = pos.x - pos.parentPos!.x;
                  const dy = pos.y - pos.parentPos!.y;
                  const cx1 = pos.parentPos!.x + dx * 0.3;
                  const cy1 = pos.parentPos!.y + dy * 0.1;
                  const cx2 = pos.parentPos!.x + dx * 0.7;
                  const cy2 = pos.y - dy * 0.1;
                  
                  return (
                    <path
                      key={`line-${pos.node.id}`}
                      d={`M ${pos.parentPos!.x} ${pos.parentPos!.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pos.x} ${pos.y}`}
                      stroke={color.bg}
                      strokeWidth={isHovered ? 4 : pos.level === 1 ? 3 : 2}
                      fill="none"
                      strokeLinecap="round"
                      opacity={isHovered ? 1 : 0.6}
                      style={{ transition: "all 0.3s" }}
                    />
                  );
                })}

                {/* Nodes */}
                {positions.map((pos, i) => {
                  const isRoot = pos.level === 0;
                  const isHovered = hoveredNode === pos.node.id;
                  const colorIdx = isRoot ? -1 : 
                    positions.filter(p => p.level === 1).findIndex(p => 
                      p.node.id === pos.node.id || 
                      p.node.children?.some(c => c.id === pos.node.id));
                  const color = COLORS[(colorIdx >= 0 ? colorIdx : i) % COLORS.length];

                  // Node dimensions based on level
                  const nodeWidth = isRoot ? 140 : pos.level === 1 ? 120 : 100;
                  const nodeHeight = isRoot ? 50 : pos.level === 1 ? 40 : 32;
                  const fontSize = isRoot ? 13 : pos.level === 1 ? 11 : 10;
                  const rx = isRoot ? 25 : 16;

                  return (
                    <g
                      key={pos.node.id}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      onMouseEnter={() => setHoveredNode(pos.node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                      style={{ cursor: "pointer" }}
                    >
                      {/* Glow effect on hover */}
                      {isHovered && (
                        <rect
                          x={-nodeWidth / 2 - 4}
                          y={-nodeHeight / 2 - 4}
                          width={nodeWidth + 8}
                          height={nodeHeight + 8}
                          rx={rx + 4}
                          fill={isRoot ? "hsl(var(--primary))" : color.glow}
                          opacity="0.3"
                          filter="url(#glow)"
                        />
                      )}
                      
                      {/* Node background */}
                      <rect
                        x={-nodeWidth / 2}
                        y={-nodeHeight / 2}
                        width={nodeWidth}
                        height={nodeHeight}
                        rx={rx}
                        fill={isRoot ? "hsl(var(--primary))" : `url(#grad${(colorIdx >= 0 ? colorIdx : i) % COLORS.length})`}
                        filter="url(#shadow)"
                        style={{
                          transform: isHovered ? "scale(1.05)" : "scale(1)",
                          transformOrigin: "center",
                          transition: "transform 0.2s"
                        }}
                      />
                      
                      {/* Node text */}
                      <text
                        textAnchor="middle"
                        dy="0.35em"
                        fill="white"
                        fontSize={fontSize}
                        fontWeight={isRoot ? "700" : "600"}
                        style={{ pointerEvents: "none" }}
                      >
                        {pos.node.label.length > 18 
                          ? pos.node.label.substring(0, 16) + "..." 
                          : pos.node.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Legend */}
            <div className="p-3 border-t border-border/50 bg-muted/20 flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                Central Topic
              </span>
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600" />
                Main Branches
              </span>
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600" />
                Sub-topics
              </span>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!mindMapData && !isLoading && (
          <div className="relative bg-card/80 backdrop-blur-sm border border-dashed border-primary/30 rounded-2xl p-16">
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                  <Brain className="h-12 w-12 text-primary/50" />
                </div>
                <Sparkles className="h-5 w-5 text-yellow-500 absolute -top-1 right-0 animate-bounce" />
              </div>
              <div>
                <h3 className="font-semibold text-xl mb-2">Create Your Visual Mind Map</h3>
                <p className="text-muted-foreground max-w-md">
                  Enter any UPSC topic and AI will generate a beautiful, organized mind map with concepts, relationships & key points
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {["Constitution", "Economy", "Geography", "History", "Polity", "Science"].map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full bg-muted text-xs text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MindMap;
