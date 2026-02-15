"use client";

import { useLayoutEffect } from "react";
import { usePathnameTransition } from "./use-pathname-transition";

export function useNavDirection() {
  const transition = usePathnameTransition();

  useLayoutEffect(() => {
    if (transition === "none") return;
    document.documentElement.dataset.navDirection = transition;
    return () => {
      delete document.documentElement.dataset.navDirection;
    };
  }, [transition]);
}
