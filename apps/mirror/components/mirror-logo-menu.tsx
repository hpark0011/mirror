"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@feel-good/ui/primitives/dropdown-menu";
import { signOut } from "@/lib/auth-client";
import { MirrorLogo } from "./mirror-logo";

export function MirrorLogoMenu() {
  const router = useRouter();

  async function handleLogout() {
    await signOut();
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
