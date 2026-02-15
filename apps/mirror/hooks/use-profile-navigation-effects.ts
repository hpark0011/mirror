"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { isArticleDetailRoute } from "./use-pathname-transition";

type ScrollContainers = {
  mobile: HTMLElement | null;
  desktop: HTMLElement | null;
};

type NavTransition = "forward" | "back" | "none";

function getTransition(prevPath: string, nextPath: string): NavTransition {
  const wasDetail = isArticleDetailRoute(prevPath);
  const isDetail = isArticleDetailRoute(nextPath);

  if (isDetail && !wasDetail) return "forward";
  if (!isDetail && wasDetail) return "back";
  return "none";
}

export function useProfileNavigationEffects(containers: ScrollContainers) {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);
  const savedScrollTop = useRef(0);
  const activeContainer = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    // Pick whichever container is currently mounted (mobile or desktop).
    activeContainer.current = containers.mobile ?? containers.desktop;
  }, [containers.mobile, containers.desktop]);

  useLayoutEffect(() => {
    if (pathname === prevPathname.current) return;

    const transition = getTransition(prevPathname.current, pathname);
    prevPathname.current = pathname;

    if (transition === "none") return;

    document.documentElement.dataset.navDirection = transition;

    const scrollContainer = activeContainer.current;
    if (scrollContainer) {
      if (transition === "forward") {
        savedScrollTop.current = scrollContainer.scrollTop;
        scrollContainer.scrollTo(0, 0);
      } else {
        scrollContainer.scrollTo(0, savedScrollTop.current);
      }
    }

    return () => {
      delete document.documentElement.dataset.navDirection;
    };
  }, [pathname]);
}
