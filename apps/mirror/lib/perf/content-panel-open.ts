"use client";

import * as Sentry from "@sentry/nextjs";
import { type Span } from "@sentry/nextjs";
import { logger } from "@/lib/sentry/logger";

const MARK_START = "content-panel:open:start";
const MARK_ROUTE_READY = "content-panel:open:route-ready";
const MARK_RENDERED = "content-panel:open:rendered";
const MARK_CONTENT_READY = "content-panel:open:content-ready";

const MEASURE_ROUTE_READY = "content-panel:open → route-ready";
const MEASURE_RENDERED = "content-panel:open → rendered";
const MEASURE_CONTENT_READY = "content-panel:open → content-ready";

// Module locals get wiped by Next.js Fast Refresh between the click and the
// render commit, so the span handle has to live somewhere that survives HMR.
// `performance.getEntriesByName` is the source of truth for whether the
// first-open cycle has completed; `window` holds the Sentry span handle.
type PerfWindow = typeof globalThis & {
  __contentPanelOpenSpan?: Span | null;
};

function canMeasure() {
  return typeof performance !== "undefined" &&
    typeof performance.mark === "function";
}

function hasMark(name: string) {
  return performance.getEntriesByName(name, "mark").length > 0;
}

function getOpenSpan(): Span | null {
  if (typeof window === "undefined") return null;
  return (window as PerfWindow).__contentPanelOpenSpan ?? null;
}

function setOpenSpan(span: Span | null) {
  if (typeof window === "undefined") return;
  (window as PerfWindow).__contentPanelOpenSpan = span;
}

export function markContentPanelOpenStart() {
  if (!canMeasure()) return;
  if (hasMark(MARK_RENDERED)) return; // already completed this pageload
  if (hasMark(MARK_START)) return; // already in flight

  performance.mark(MARK_START);
  Sentry.startSpanManual(
    { op: "ui.interaction", name: "content panel first open" },
    (span) => {
      setOpenSpan(span);
    },
  );
}

export function markContentPanelRouteReady() {
  if (!canMeasure()) return;
  if (!hasMark(MARK_START) || hasMark(MARK_ROUTE_READY)) return;

  performance.mark(MARK_ROUTE_READY);
  const measure = performance.measure(
    MEASURE_ROUTE_READY,
    MARK_START,
    MARK_ROUTE_READY,
  );
  const span = getOpenSpan();
  span?.setAttribute("route_ready_ms", measure.duration);
  console.info(
    `[content-panel-perf] route ready in ${measure.duration.toFixed(1)}ms`,
  );
  logger.info(
    logger.fmt`[content-panel-perf] route ready in ${measure.duration.toFixed(1)}ms`,
  );
}

// Close the span only after both rendered and content-ready have fired.
// When the RSC payload is already cached, Next.js commits the URL change and
// the list subtree together, so React runs the child ScrollableList effect
// before the parent ContentPanel effect — content-ready would land first and
// prematurely end the span, dropping rendered_ms. Guarding on both marks keeps
// the span open until whichever callback is actually last.
function closeSpanIfComplete() {
  if (!hasMark(MARK_RENDERED) || !hasMark(MARK_CONTENT_READY)) return;
  const span = getOpenSpan();
  if (span) {
    span.end();
    setOpenSpan(null);
  }
}

export function markContentPanelRendered() {
  if (!canMeasure()) return;
  if (!hasMark(MARK_START) || hasMark(MARK_RENDERED)) return;

  performance.mark(MARK_RENDERED);
  const measure = performance.measure(
    MEASURE_RENDERED,
    MARK_START,
    MARK_RENDERED,
  );
  getOpenSpan()?.setAttribute("rendered_ms", measure.duration);
  console.info(
    `[content-panel-perf] rendered in ${measure.duration.toFixed(1)}ms`,
  );
  logger.info(
    logger.fmt`[content-panel-perf] rendered in ${measure.duration.toFixed(1)}ms`,
  );
  closeSpanIfComplete();
}

export function markContentPanelContentReady() {
  if (!canMeasure()) return;
  if (!hasMark(MARK_START) || hasMark(MARK_CONTENT_READY)) return;

  performance.mark(MARK_CONTENT_READY);
  const measure = performance.measure(
    MEASURE_CONTENT_READY,
    MARK_START,
    MARK_CONTENT_READY,
  );
  getOpenSpan()?.setAttribute("content_ready_ms", measure.duration);
  console.info(
    `[content-panel-perf] content ready in ${measure.duration.toFixed(1)}ms`,
  );
  logger.info(
    logger.fmt`[content-panel-perf] content ready in ${measure.duration.toFixed(1)}ms`,
  );
  closeSpanIfComplete();
}
