import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  path: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  isLocked?: boolean;
  className?: string;
}

const FeatureCard = ({ 
  path, 
  icon, 
  title, 
  description, 
  isLocked = false,
  className 
}: FeatureCardProps) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (isLocked) {
      navigate("/subscription");
    } else {
      navigate(path);
    }
  };

  return (
    <Card
      onClick={handleClick}
      className={cn(
        "p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-105 bg-gradient-card border-0 relative",
        isLocked && "opacity-80",
        className
      )}
    >
      {isLocked && (
        <div className="absolute top-2 right-2 bg-warning/20 text-warning rounded-full p-1.5">
          <Lock className="w-3.5 h-3.5" />
        </div>
      )}
      <div className="text-primary">{icon}</div>
      <h3 className="font-semibold mb-1 mt-3">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
      {isLocked && (
        <p className="text-xs text-warning mt-2 font-medium">Subscribe to unlock</p>
      )}
    </Card>
  );
};

export default FeatureCard;
