import { Sun, Moon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/hooks/use-theme";

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <Sun className={`w-4 h-4 ${theme === "light" ? "text-warning" : "text-muted-foreground"}`} />
      <Switch
        checked={theme === "dark"}
        onCheckedChange={toggleTheme}
        className="data-[state=checked]:bg-primary"
      />
      <Moon className={`w-4 h-4 ${theme === "dark" ? "text-primary" : "text-muted-foreground"}`} />
    </div>
  );
};

export default ThemeToggle;
