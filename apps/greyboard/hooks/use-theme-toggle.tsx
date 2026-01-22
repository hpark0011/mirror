"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

export function useThemeToggle() {
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setTheme(theme === "dark" ? "light" : "dark");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setTheme, theme]);
}
