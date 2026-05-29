import * as React from "react";
import { useTheme } from "next-themes";
import { SunIcon, MoonIcon, MonitorIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const THEMES = ["light", "dark", "system"] as const;
type Theme = (typeof THEMES)[number];

const ICONS: Record<Theme, React.ElementType> = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
};

const LABELS: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  // Prevent hydration mismatch — render a stable placeholder until mounted
  if (!mounted) {
    return <div className="size-9 shrink-0" />;
  }

  const current = (THEMES.includes(theme as Theme) ? theme : "system") as Theme;
  const nextIndex = (THEMES.indexOf(current) + 1) % THEMES.length;
  const next = THEMES[nextIndex];
  const Icon = ICONS[current];

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(next)}
            aria-label={`Switch to ${LABELS[next]} theme`}
            className="size-9 text-muted-foreground hover:text-foreground"
          >
            <Icon className="size-4 transition-transform duration-200" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {LABELS[current]} — click for {LABELS[next]}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
