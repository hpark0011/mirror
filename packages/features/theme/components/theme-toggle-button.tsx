"use client";

import { Icon } from "@feel-good/ui/components/icon";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggleButton() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch - render placeholder with same dimensions
  if (!mounted) {
    return <div className="flex h-5 w-20 items-center gap-2" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="size-5 flex items-center justify-center cursor-pointer"
    >
      {isDark
        ? <Icon name="MoonFillIcon" className="size-4.5 text-icon" />
        : <Icon name="SunMaxFillIcon" className="size-4.5 text-icon" />}
    </button>
  );
}
