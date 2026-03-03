"use client";

import { useLayoutEffect, useRef } from "react";

export type RouteMode = "list" | "detail" | "chat";

export function useProfileNavigationEffects(
  scrollContainer: HTMLElement | null,
  routeMode: RouteMode,
) {
  const prevRouteMode = useRef(routeMode);
  const savedScrollTop = useRef(0);

  useLayoutEffect(() => {
    if (routeMode === prevRouteMode.current) return;

    const wasDetail = prevRouteMode.current === "detail";
    const isDetail = routeMode === "detail";
    prevRouteMode.current = routeMode;

    if (!scrollContainer) return;

    if (isDetail && !wasDetail) {
      // Forward: save scroll position and scroll to top
      savedScrollTop.current = scrollContainer.scrollTop;
      scrollContainer.scrollTo(0, 0);
    } else if (!isDetail && wasDetail) {
      // Back: restore saved scroll position
      scrollContainer.scrollTo(0, savedScrollTop.current);
    }
  }, [routeMode, scrollContainer]);
}
