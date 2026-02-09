"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { SHEET_EASING } from "../lib/constants";

type DragState = "IDLE" | "DRAGGING" | "SCROLLING";

const SNAP_POINTS = [0.01, 1.0] as const;
const PEEK = SNAP_POINTS[0];
const VELOCITY_THRESHOLD = 0.3;
const SCROLL_TO_DRAG_DELAY = 100;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function nearestSnap(progress: number, velocity: number): number {
  if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
    return velocity > 0 ? SNAP_POINTS[1] : SNAP_POINTS[0];
  }
  const mid = (SNAP_POINTS[0] + SNAP_POINTS[1]) / 2;
  return progress > mid ? SNAP_POINTS[1] : SNAP_POINTS[0];
}

export function useBottomSheet() {
  const sheetRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  const [contentElement, setContentElement] = useState<HTMLDivElement | null>(
    null,
  );
  const contentRef = setContentElement;

  const isDraggingRef = useRef(false);

  const stateRef = useRef<DragState>("IDLE");
  const progressRef = useRef<number>(PEEK);
  const startYRef = useRef(0);
  const startProgressRef = useRef<number>(PEEK);
  const lastYRef = useRef(0);
  const lastTimeRef = useRef(0);
  const velocityRef = useRef(0);
  const rafRef = useRef<number>(0);
  const scrollToleranceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const aliveRef = useRef(true);

  const prefersReducedMotionRef = useRef(false);

  useEffect(() => {
    prefersReducedMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);

  const applyTransform = useCallback((p: number, animating: boolean) => {
    const sheet = sheetRef.current;
    if (!sheet) return;

    const bgScale = 1 - p * 0.2;
    const translateY = (1 - p) * 85;

    sheet.style.transform = `translateY(${translateY}%)`;

    if (animating && !prefersReducedMotionRef.current) {
      sheet.style.transition = `transform 300ms ${SHEET_EASING}`;
    } else {
      sheet.style.transition = "none";
    }

    const bg = bgRef.current;
    if (bg) {
      bg.style.transform = `scale(${bgScale})`;
      if (animating && !prefersReducedMotionRef.current) {
        bg.style.transition = `transform 300ms ${SHEET_EASING}`;
      } else {
        bg.style.transition = "none";
      }
    }
  }, []);

  useEffect(() => {
    applyTransform(progressRef.current, false);
  }, [applyTransform]);

  useEffect(() => {
    const sheet = sheetRef.current;
    const bg = bgRef.current;
    return () => {
      aliveRef.current = false;
      stateRef.current = "IDLE";
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      if (scrollToleranceTimerRef.current) {
        clearTimeout(scrollToleranceTimerRef.current);
        scrollToleranceTimerRef.current = null;
      }
      if (sheet) sheet.style.willChange = "";
      if (bg) bg.style.willChange = "";
    };
  }, []);

  const snapTo = useCallback(
    (target: number) => {
      progressRef.current = target;
      isDraggingRef.current = false;
      stateRef.current = "IDLE";
      applyTransform(target, true);

      const sheet = sheetRef.current;
      const bg = bgRef.current;

      const cleanup = () => {
        if (sheet) {
          sheet.style.willChange = "";
          sheet.removeEventListener("transitionend", cleanup);
        }
        if (bg) bg.style.willChange = "";
      };

      if (sheet) {
        sheet.addEventListener("transitionend", cleanup, { once: true });
      }
      // Safety net in case transitionend never fires (e.g. reduced motion, display:none)
      setTimeout(cleanup, 350);
    },
    [applyTransform],
  );

  const handlePointerDown = useCallback(
    (e: PointerEvent, isHandle: boolean) => {
      if (e.button !== 0) return;

      if (scrollToleranceTimerRef.current) {
        clearTimeout(scrollToleranceTimerRef.current);
        scrollToleranceTimerRef.current = null;
      }

      const scrollContainer = contentElement;

      if (!isHandle && progressRef.current >= 1) {
        const scrollTop = scrollContainer?.scrollTop ?? 0;
        if (scrollTop > 0) {
          stateRef.current = "SCROLLING";
          return;
        }
      }

      e.preventDefault();
      stateRef.current = "DRAGGING";
      isDraggingRef.current = true;

      startYRef.current = e.clientY;
      startProgressRef.current = progressRef.current;
      lastYRef.current = e.clientY;
      lastTimeRef.current = e.timeStamp;
      velocityRef.current = 0;

      const sheet = sheetRef.current;
      if (sheet) {
        sheet.style.willChange = "transform";
        sheet.style.transition = "none";
      }
      const bg = bgRef.current;
      if (bg) {
        bg.style.willChange = "transform";
        bg.style.transition = "none";
      }

      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [contentElement],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (stateRef.current !== "DRAGGING") return;

      const deltaY = startYRef.current - e.clientY;
      const viewportHeight = window.innerHeight;
      const deltaProgress = deltaY / viewportHeight;
      const newProgress = clamp(
        startProgressRef.current + deltaProgress,
        SNAP_POINTS[0],
        SNAP_POINTS[1],
      );

      const dt = e.timeStamp - lastTimeRef.current;
      if (dt > 0) {
        const dy = lastYRef.current - e.clientY;
        velocityRef.current = dy / dt;
      }
      lastYRef.current = e.clientY;
      lastTimeRef.current = e.timeStamp;

      progressRef.current = newProgress;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (!aliveRef.current) return;
        applyTransform(newProgress, false);
      });
    },
    [applyTransform],
  );

  const handlePointerUp = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }

    if (stateRef.current !== "DRAGGING") {
      stateRef.current = "IDLE";
      return;
    }

    const target = nearestSnap(progressRef.current, velocityRef.current);
    snapTo(target);
  }, [snapTo]);

  // Pointer events on the handle
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;

    const onDown = (e: PointerEvent) => handlePointerDown(e, true);
    const onMove = (e: PointerEvent) => handlePointerMove(e);
    const onUp = () => handlePointerUp();

    handle.addEventListener("pointerdown", onDown);
    handle.addEventListener("pointermove", onMove, { passive: true });
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);

    return () => {
      handle.removeEventListener("pointerdown", onDown);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
    };
  }, [handlePointerDown, handlePointerMove, handlePointerUp]);

  // Pointer events on the scrollable content for pull-to-collapse
  useEffect(() => {
    const scrollContainer = contentElement;
    if (!scrollContainer) return;

    const onDown = (e: PointerEvent) => handlePointerDown(e, false);
    const onMove = (e: PointerEvent) => handlePointerMove(e);
    const onUp = () => handlePointerUp();

    scrollContainer.addEventListener("pointerdown", onDown);
    scrollContainer.addEventListener("pointermove", onMove, { passive: true });
    scrollContainer.addEventListener("pointerup", onUp);
    scrollContainer.addEventListener("pointercancel", onUp);

    return () => {
      scrollContainer.removeEventListener("pointerdown", onDown);
      scrollContainer.removeEventListener("pointermove", onMove);
      scrollContainer.removeEventListener("pointerup", onUp);
      scrollContainer.removeEventListener("pointercancel", onUp);
    };
  }, [contentElement, handlePointerDown, handlePointerMove, handlePointerUp]);

  // Scroll-to-drag transition: at scrollTop=0 pulling down collapses the sheet
  useEffect(() => {
    const scrollContainer = contentElement;
    if (!scrollContainer) return;

    let lastScrollTop = 0;

    const onScroll = () => {
      const scrollTop = scrollContainer.scrollTop;

      if (
        stateRef.current === "SCROLLING" &&
        scrollTop <= 0 &&
        lastScrollTop <= 0
      ) {
        if (!scrollToleranceTimerRef.current) {
          scrollToleranceTimerRef.current = setTimeout(() => {
            scrollToleranceTimerRef.current = null;
            if (stateRef.current !== "SCROLLING") return;
            if (scrollContainer.scrollTop <= 0) {
              snapTo(PEEK);
            }
          }, SCROLL_TO_DRAG_DELAY);
        }
      } else {
        if (scrollToleranceTimerRef.current) {
          clearTimeout(scrollToleranceTimerRef.current);
          scrollToleranceTimerRef.current = null;
        }
      }

      lastScrollTop = scrollTop;
    };

    scrollContainer.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollContainer.removeEventListener("scroll", onScroll);
      if (scrollToleranceTimerRef.current) {
        clearTimeout(scrollToleranceTimerRef.current);
      }
    };
  }, [contentElement, snapTo]);

  return {
    sheetRef,
    handleRef,
    contentRef,
    contentElement,
    bgRef,
  };
}
