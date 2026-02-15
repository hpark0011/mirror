"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathnameTransition } from "./use-pathname-transition";

type ScrollContainers = {
  mobile: HTMLElement | null;
  desktop: HTMLElement | null;
};

export function useScrollMemory(containers: ScrollContainers) {
  const transition = usePathnameTransition();
  const savedScrollTop = useRef(0);

  useLayoutEffect(() => {
    if (transition === "none") return;

    // Pick whichever container is currently rendered — fixes hydration race
    // where useIsMobile flips and the mobile container isn't ref'd yet
    const scrollContainer = containers.mobile ?? containers.desktop;
    if (!scrollContainer) return;

    if (transition === "forward") {
      savedScrollTop.current = scrollContainer.scrollTop;
      scrollContainer.scrollTo(0, 0);
    } else if (transition === "back") {
      scrollContainer.scrollTo(0, savedScrollTop.current);
    }
  }, [transition, containers.mobile, containers.desktop]);
}
