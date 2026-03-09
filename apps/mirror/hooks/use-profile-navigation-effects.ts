"use client";

import { useLayoutEffect, useRef } from "react";
import type { ContentRouteState } from "@/features/content";

export type RouteMode = "list" | "detail";

export function useProfileNavigationEffects(
  scrollContainer: HTMLElement | null,
  routeState: ContentRouteState,
) {
  const prevRouteState = useRef(routeState);
  const savedScrollTopByKind = useRef<Record<ContentRouteState["kind"], number>>(
    {
      articles: 0,
      posts: 0,
    },
  );

  useLayoutEffect(() => {
    const previousRouteState = prevRouteState.current;
    const routeChanged =
      routeState.kind !== previousRouteState.kind ||
      routeState.view !== previousRouteState.view;
    if (!routeChanged) return;

    prevRouteState.current = routeState;

    if (!scrollContainer) return;

    if (previousRouteState.view === "list") {
      savedScrollTopByKind.current[previousRouteState.kind] =
        scrollContainer.scrollTop;
    }

    if (routeState.kind !== previousRouteState.kind) {
      if (routeState.view === "detail") {
        scrollContainer.scrollTo(0, 0);
        return;
      }

      scrollContainer.scrollTo(
        0,
        savedScrollTopByKind.current[routeState.kind] ?? 0,
      );
      return;
    }

    const wasDetail = previousRouteState.view === "detail";
    const isDetail = routeState.view === "detail";

    if (isDetail && !wasDetail) {
      scrollContainer.scrollTo(0, 0);
    } else if (!isDetail && wasDetail) {
      scrollContainer.scrollTo(
        0,
        savedScrollTopByKind.current[routeState.kind] ?? 0,
      );
    }
  }, [routeState, scrollContainer]);
}
