"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

// Lifecycle fallback: if `hasContentRoute` never flips after a default-
// content navigation (aborted push, mid-flight navigation, stalled
// transition), clear the pending-navigation latch so subsequent toggle
// clicks are not permanent no-ops. Lifecycle recovery, not rendering
// timing — see `.claude/rules/react-components.md`.
const PENDING_NAVIGATION_TIMEOUT_MS = 1800;

export type PendingNavigationLatch = {
  /** True while a default-content navigation is in flight. */
  isArmed: () => boolean;
  /** Set the latch and arm the lifecycle-fallback timer. */
  arm: () => void;
  /** Release the latch and cancel the fallback timer. */
  clear: () => void;
};

/**
 * Encapsulates the "is a default-content navigation in flight?" concern.
 * The latch is a ref (not state) because its only consumers read it
 * inside event handlers and effects — flipping it should not trigger
 * renders. The timer is a bounded-lifetime fallback that guarantees the
 * latch cannot get stuck if the route transition never arrives.
 */
export function usePendingNavigationLatch(): PendingNavigationLatch {
  const armedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    armedRef.current = false;
    cancelTimeout();
  }, [cancelTimeout]);

  const arm = useCallback(() => {
    armedRef.current = true;
    cancelTimeout();
    timeoutRef.current = setTimeout(() => {
      armedRef.current = false;
      timeoutRef.current = null;
    }, PENDING_NAVIGATION_TIMEOUT_MS);
  }, [cancelTimeout]);

  const isArmed = useCallback(() => armedRef.current, []);

  // Ensure the timeout fallback does not fire after unmount.
  useEffect(() => cancelTimeout, [cancelTimeout]);

  return useMemo(() => ({ isArmed, arm, clear }), [isArmed, arm, clear]);
}
