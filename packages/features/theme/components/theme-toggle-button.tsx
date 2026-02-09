"use client";

import { Icon } from "@feel-good/ui/components/icon";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Switch } from "@feel-good/ui/primitives/switch";

export function ThemeToggleButton() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggle = (checked: boolean) => {
    setTheme(checked ? "dark" : "light");
  };

  // Prevent hydration mismatch - render placeholder with same dimensions
  if (!mounted) {
    return <div className="flex h-5 w-20 items-center gap-2" />;
  }

  return (
    <div className="flex items-center gap-1">
      <Icon name="SunMaxFillIcon" className="size-5 text-icon" />
      <Switch
        checked={resolvedTheme === "dark"}
        onCheckedChange={handleToggle}
        variant="theme"
        aria-label="Toggle dark mode"
        size="sm"
      />
      <div className="size-4.5 flex items-center justify-center">
        <Icon name="MoonFillIcon" className="size-4 text-icon" />
      </div>
    </div>
  );
}
