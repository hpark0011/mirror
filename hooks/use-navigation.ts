"use client";

import { NAV_ITEMS } from "@/config/nav-config";
import { usePathname, useRouter } from "next/navigation";

export function useNavigation() {
  const router = useRouter();
  const pathname = usePathname();

  // Map pathname to select value using NAV_ITEMS as source of truth
  const getCurrentValue = () => {
    const currentItem = NAV_ITEMS.find((item) => item.href === pathname);
    return currentItem?.label || "Tasks"; // default to Tasks if not found
  };

  // Handle navigation using NAV_ITEMS
  const handleNavigate = (value: string) => {
    const navItem = NAV_ITEMS.find((item) => item.label === value);
    if (navItem) {
      router.push(navItem.href);
    }
  };

  return {
    getCurrentValue,
    handleNavigate,
    navItems: NAV_ITEMS,
  };
}