"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHasMounted } from "@/hooks/useHasMounted";
import { useTheme, type ThemePreference } from "@/hooks/useTheme";

const NEXT_LABEL: Record<ThemePreference, string> = {
  light: "Switch to dark theme",
  dark: "Match system theme",
  system: "Switch to light theme",
};

const CURRENT_LABEL: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

/**
 * One control cycling light → dark → system.
 *
 * A cycle rather than a binary toggle because "follow the system" is a real
 * third answer, not the absence of a choice — someone whose OS flips at sunset
 * wants the app to follow, and a two-state toggle silently takes that away the
 * first time it is touched.
 *
 * Renders nothing until mounted: the active theme lives in localStorage, so
 * the server cannot know which icon is correct, and guessing would mean
 * showing a sun to someone in dark mode for one frame.
 */
export function ThemeToggle() {
  const hasMounted = useHasMounted();
  const { theme, cycleTheme } = useTheme();

  if (!hasMounted) return null;

  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      className="h-8 w-8 shrink-0 text-muted-foreground"
      title={`Theme: ${CURRENT_LABEL[theme]}. ${NEXT_LABEL[theme]}.`}
      aria-label={`Theme: ${CURRENT_LABEL[theme]}. ${NEXT_LABEL[theme]}.`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}
