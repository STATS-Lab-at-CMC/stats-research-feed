"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHasMounted } from "@/hooks/useHasMounted";
import { useTheme } from "@/hooks/useTheme";

/**
 * One click, one visible change.
 *
 * The icon shows what the click will *do* rather than what is currently on —
 * a moon while reading in light, a sun while reading in dark — which matches
 * the "Toggle" verb in the label and means the control always previews its own
 * effect.
 *
 * Renders nothing until mounted: the active theme lives in localStorage and in
 * the OS preference, neither of which the server can see, so any guess would
 * show the wrong icon for a frame.
 */
export function ThemeToggle() {
  const hasMounted = useHasMounted();
  const { resolvedTheme, toggleTheme } = useTheme();

  if (!hasMounted) return null;

  const isDark = resolvedTheme === "dark";
  const Icon = isDark ? Sun : Moon;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="h-8 w-8 shrink-0 text-muted-foreground"
      title="Toggle Dark Mode"
      aria-label={`Toggle dark mode (currently ${isDark ? "dark" : "light"})`}
      aria-pressed={isDark}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}
