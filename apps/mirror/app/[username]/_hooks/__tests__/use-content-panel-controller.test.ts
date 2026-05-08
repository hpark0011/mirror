/**
 * PLAN_010 — pins `ContentPanelController.ensureExpanded`. The contract:
 *  1. Collapsed + content route present → setLayout([50, 50]) once.
 *  2. Already expanded → no-op.
 *  3. Pending-navigation latch armed → no-op.
 *  4. !hasContentRoute → setLayout([50, 50]) WITHOUT calling
 *     onOpenDefaultContent (the dispatcher is itself about to push;
 *     a fallback default-content push would race it).
 *
 * #4 is the load-bearing assertion behind the "distinct verb" decision —
 * `ensureExpanded` differs from `expand()` exactly here.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, act } from "@testing-library/react";
import { useRef } from "react";

vi.mock("@/lib/perf/content-panel-open", () => ({
  markContentPanelOpenStart: vi.fn(),
  markContentPanelRouteReady: vi.fn(),
}));

import { useContentPanelController } from "../use-content-panel-controller";

type GroupRefStub = {
  setLayout: ReturnType<typeof vi.fn>;
  getLayout: ReturnType<typeof vi.fn>;
};

type PanelRefStub = {
  collapse: ReturnType<typeof vi.fn>;
  expand: ReturnType<typeof vi.fn>;
};

function buildGroupRef(): {
  ref: { current: GroupRefStub | null };
  setLayout: GroupRefStub["setLayout"];
} {
  const setLayout = vi.fn();
  const stub: GroupRefStub = {
    setLayout,
    getLayout: vi.fn(() => []),
  };
  return { ref: { current: stub }, setLayout };
}

function setUpController({
  hasContentRoute,
  onOpenDefaultContent,
}: {
  hasContentRoute: boolean;
  onOpenDefaultContent: (() => void) | null;
}) {
  const { ref: groupRef, setLayout } = buildGroupRef();
  const panelStub: PanelRefStub = {
    collapse: vi.fn(),
    expand: vi.fn(),
  };

  const { result, rerender } = renderHook(
    (props: {
      hasContentRoute: boolean;
      onOpenDefaultContent: (() => void) | null;
    }) => {
      // Memoize the imperative ref so the hook receives the same identity
      // across renders — matches DesktopWorkspace's `useRef` pattern.
      const stableGroupRef = useRef(groupRef.current);
      const controller = useContentPanelController({
        groupRef: stableGroupRef,
        hasContentRoute: props.hasContentRoute,
        onOpenDefaultContent: props.onOpenDefaultContent,
      });
      // Wire the panel ref so collapse/expand calls resolve.
      controller.setPanelRef(panelStub as unknown as never);
      return controller;
    },
    {
      initialProps: { hasContentRoute, onOpenDefaultContent },
    },
  );

  return { result, rerender, setLayout, panelStub };
}

describe("useContentPanelController.ensureExpanded (PLAN_010)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("collapsed + content route present → setLayout([50, 50]) exactly once", () => {
    // The hook starts !hasContentRoute=false → isCollapsed=false. To reach the
    // "collapsed + hasContentRoute=true" precondition without involving real
    // panel collapse callbacks, drive the collapse via onCollapse which the
    // resizable primitive would otherwise dispatch.
    const { result, setLayout } = setUpController({
      hasContentRoute: true,
      onOpenDefaultContent: vi.fn(),
    });

    // Layout effect on mount (transition false-init → true) calls setLayout once.
    setLayout.mockClear();

    act(() => {
      result.current.onCollapse();
    });

    act(() => {
      result.current.ensureExpanded();
    });

    expect(setLayout).toHaveBeenCalledTimes(1);
    expect(setLayout).toHaveBeenCalledWith([50, 50]);
  });

  it("already expanded → no setLayout call", () => {
    const { result, setLayout } = setUpController({
      hasContentRoute: true,
      onOpenDefaultContent: vi.fn(),
    });

    setLayout.mockClear();
    // Default state with hasContentRoute=true is isCollapsed=false.

    act(() => {
      result.current.ensureExpanded();
    });

    expect(setLayout).not.toHaveBeenCalled();
  });

  it("!hasContentRoute → still calls setLayout([50, 50]) and does NOT invoke onOpenDefaultContent", () => {
    const onOpenDefaultContent = vi.fn();
    const { result, setLayout } = setUpController({
      hasContentRoute: false,
      onOpenDefaultContent,
    });

    setLayout.mockClear();

    act(() => {
      result.current.ensureExpanded();
    });

    // The dispatcher is responsible for the upcoming `router.push`.
    // The controller must not double-push via openDefaultContentRoute.
    expect(onOpenDefaultContent).not.toHaveBeenCalled();
    expect(setLayout).toHaveBeenCalledTimes(1);
    expect(setLayout).toHaveBeenCalledWith([50, 50]);
  });

  it("pending-navigation latch armed → no setLayout call", () => {
    const onOpenDefaultContent = vi.fn();
    const { result, setLayout } = setUpController({
      hasContentRoute: false,
      onOpenDefaultContent,
    });

    // Arm the latch by calling expand() while !hasContentRoute. expand()
    // routes through openDefaultContentRoute → pendingNav.arm().
    act(() => {
      result.current.expand();
    });

    expect(onOpenDefaultContent).toHaveBeenCalledTimes(1);
    setLayout.mockClear();

    // Now ensureExpanded must observe pendingNav.isArmed() and bail.
    act(() => {
      result.current.ensureExpanded();
    });

    expect(setLayout).not.toHaveBeenCalled();
    expect(onOpenDefaultContent).toHaveBeenCalledTimes(1);
  });
});
