"use client";

import { signOut } from "@/lib/auth-client";
import { ThemeToggleButton } from "@feel-good/features/theme/components";
import { PersonCropCircleFillIcon } from "@feel-good/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@feel-good/ui/primitives/dropdown-menu";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { MirrorLogo } from "./mirror-logo";

export function MirrorLogoMenu() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  async function handleLogout() {
    const { error } = await signOut();
    if (error) return;
    router.push("/sign-in");
  }

  function handleThemeToggle(event: Event) {
    event.preventDefault();
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="mirror-logo-menu-trigger"
          className="cursor-pointer outline-hidden"
        >
          <span className="pointer-events-none">
            <MirrorLogo />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8}>
        <DropdownMenuItem
          data-testid="theme-toggle-item"
          onSelect={handleThemeToggle}
          className="pr-[5px] has-[svg]:pr-[5px] w-40"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[13px] text-foreground">Theme</span>
            <span className="pointer-events-none">
              <ThemeToggleButton />
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="logout-menu-item"
          onClick={handleLogout}
          className="pr-1 has-[svg]:pr-1"
        >
          <div className="flex items-center justify-between w-full">
            Log out
            <PersonCropCircleFillIcon className="size-5.5 text-icon" />
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
