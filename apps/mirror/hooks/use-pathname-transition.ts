"use client";

import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

export const isArticleDetailRoute = (path: string) =>
  /^\/@[^/]+\/.+/.test(path);

export type NavTransition = "forward" | "back" | "none";

// Global store for pathname transitions
let currentTransition: NavTransition = "none";
const transitionListeners: Set<() => void> = new Set();

function getTransition(): NavTransition {
  return currentTransition;
}

function subscribe(listener: () => void) {
  transitionListeners.add(listener);
  return () => {
    transitionListeners.delete(listener);
  };
}

function notifyListeners() {
  transitionListeners.forEach((listener) => listener());
}

export function usePathnameTransition(): NavTransition {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);

  useLayoutEffect(() => {
    if (pathname === prevPathname.current) return;

    const wasDetail = isArticleDetailRoute(prevPathname.current);
    const isDetail = isArticleDetailRoute(pathname);

    if (isDetail && !wasDetail) {
      currentTransition = "forward";
    } else if (!isDetail && wasDetail) {
      currentTransition = "back";
    } else {
      currentTransition = "none";
    }

    prevPathname.current = pathname;
    notifyListeners();
  }, [pathname]);

  return useSyncExternalStore(subscribe, getTransition, getTransition);
}
