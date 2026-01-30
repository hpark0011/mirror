"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

import { Button } from "@feel-good/ui/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@feel-good/ui/primitives/dropdown-menu";

export function ThemeToggleButton() {
  const [mounted, setMounted] = React.useState(false);
  const { setTheme } = useTheme();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Always render the same component tree to avoid hydration mismatch
  // Use disabled state to prevent interaction before mount
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={!mounted}>
        <Button variant="outline" size="icon" disabled={!mounted}>
          <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
