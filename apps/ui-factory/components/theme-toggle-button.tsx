"use client";

import { Icon } from "@feel-good/ui/components/icon";
import { useTheme } from "next-themes";
import * as React from "react";

import { Switch } from "@feel-good/ui/primitives/switch";

export function ThemeToggleButton() {
  const [mounted, setMounted] = React.useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

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
        checked={isDark}
        onCheckedChange={handleToggle}
        aria-label="Toggle dark mode"
      />
      <div className="size-4.5 flex items-center justify-center">
        <Icon name="MoonFillIcon" className="size-4 text-icon" />
      </div>
    </div>
  );
}
