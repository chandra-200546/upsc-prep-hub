import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, FileText, Loader2, RefreshCw, Globe, 
  TrendingUp, Leaf, Tag, Clock, Shield
} from "lucide-react";

interface IntelSection {
  title: string;
  icon: string;
  items: {
    headline: string;
    detail: string;
    upscTag?: string;
  }[];
}

interface DailyReport {
  date: string;
  sections: IntelSection[];
  oneLineNotes: string[];
}

const DailyIntelReport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<DailyReport | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      generateReport();
    };
    checkAuth();
  }, [navigate]);

  const generateReport = async () => {
    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke("daily-intel-report", {});

      if (response.error) throw new Error(response.error.message);

      setReport(response.data.report);
      toast({ title: "Intelligence Report Generated" });
    } catch (error) {
      console.error("Error generating report:", error);
      toast({ title: "Failed to generate report", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const getIconForSection = (iconName: string) => {
    switch (iconName) {
      case "shield": return <Shield className="h-5 w-5" />;
      case "globe": return <Globe className="h-5 w-5" />;
      case "trending": return <TrendingUp className="h-5 w-5" />;
      case "leaf": return <Leaf className="h-5 w-5" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  const getTagColor = (tag?: string) => {
    if (!tag) return "secondary";
    if (tag.includes("GS1")) return "default";
    if (tag.includes("GS2")) return "destructive";
    if (tag.includes("GS3")) return "default";
    if (tag.includes("GS4")) return "secondary";
    if (tag.includes("Prelims")) return "outline";
    if (tag.includes("Essay")) return "secondary";
    return "secondary";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg">Daily Intelligence Report</h1>
                <p className="text-xs text-muted-foreground">Officer-Grade UPSC Brief</p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={generateReport}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {isLoading && (
          <Card className="p-12">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium">Generating Intelligence Report...</p>
                <p className="text-sm text-muted-foreground">Analyzing today's developments</p>
              </div>
            </div>
          </Card>
        )}

        {report && !isLoading && (
          <div className="space-y-6">
            {/* Report Header */}
            <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-6 w-6 text-amber-600" />
                      <span className="font-bold text-lg">UPSC Intelligence Brief</span>
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {new Date(report.date).toLocaleDateString("en-IN", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric"
                      })}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-amber-500/10 border-amber-500/30 text-amber-700">
                    CLASSIFIED
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Report Sections */}
            {report.sections.map((section, idx) => (
              <Card key={idx}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {getIconForSection(section.icon)}
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {section.items.map((item, itemIdx) => (
                    <div key={itemIdx} className="border-l-2 border-primary/30 pl-4 py-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-sm">{item.headline}</h4>
                        {item.upscTag && (
                          <Badge variant={getTagColor(item.upscTag)} className="text-xs shrink-0">
                            <Tag className="h-3 w-3 mr-1" />
                            {item.upscTag}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{item.detail}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}

            {/* One-Line Notes */}
            <Card className="bg-muted/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Quick Reference Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {report.oneLineNotes.map((note, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-primary font-bold">→</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default DailyIntelReport;
