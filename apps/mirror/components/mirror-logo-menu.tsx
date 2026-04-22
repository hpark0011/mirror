"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@feel-good/ui/primitives/dropdown-menu";
import { ThemeToggleButton } from "@feel-good/features/theme/components";
import { signOut } from "@/lib/auth-client";
import { MirrorLogo } from "./mirror-logo";

export function MirrorLogoMenu() {
  const router = useRouter();

  async function handleLogout() {
    const { error } = await signOut();
    if (error) return;
    router.push("/sign-in");
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
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm text-foreground-subtle">Theme</span>
          <ThemeToggleButton />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          data-testid="logout-menu-item"
          variant="destructive"
          onClick={handleLogout}
        >
          <LogOutIcon />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
