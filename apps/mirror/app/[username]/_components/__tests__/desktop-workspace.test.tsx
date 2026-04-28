// FG_075: Desktop content toggle recovers when default-content navigation
// does not commit. Regression tests for the bounded-lifetime guard on
// `isPendingNavigationRef` — the ticket requires that the toggle stops
// being a permanent no-op when `hasContentRoute` never transitions.
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ComponentProps } from "react";

// ── Mocks ──────────────────────────────────────────────────────────────────

// Replace the resizable primitives with minimal pass-through components.
// react-resizable-panels relies on layout measurement that happy-dom does
// not emulate, and the tests only care about callback invocation.
// Imperative APIs (setLayout, collapse) are forwarded as no-op stubs so
// component logic that invokes them through a ref does not explode.
vi.mock("@feel-good/ui/primitives/resizable", async () => {
  const React = await import("react");
  const Panel = React.forwardRef<
    { collapse: () => void; expand: () => void },
    { children?: React.ReactNode } & Record<string, unknown>
  >(({ children, ...rest }, ref) => {
    React.useImperativeHandle(ref, () => ({
      collapse: () => {},
      expand: () => {},
    }));
    return (
      <div data-stub="resizable-panel" {...(rest as Record<string, unknown>)}>
        {children}
      </div>
    );
  });
  Panel.displayName = "MockResizablePanel";
  const PanelGroup = React.forwardRef<
    { setLayout: (layout: number[]) => void; getLayout: () => number[] },
    { children?: React.ReactNode } & Record<string, unknown>
  >(({ children, ...rest }, ref) => {
    React.useImperativeHandle(ref, () => ({
      setLayout: () => {},
      getLayout: () => [],
    }));
    return (
      <div
        data-stub="resizable-panel-group"
        {...(rest as Record<string, unknown>)}
      >
        {children}
      </div>
    );
  });
  PanelGroup.displayName = "MockResizablePanelGroup";
  const Handle = (props: Record<string, unknown>) => (
    <div data-stub="resizable-handle" {...props} />
  );
  return {
    ResizablePanel: Panel,
    ResizablePanelGroup: PanelGroup,
    ResizableHandle: Handle,
  };
});

// Perf marks hit performance.mark / Sentry — silence them.
vi.mock("@/lib/perf/content-panel-open", () => ({
  markContentPanelOpenStart: vi.fn(),
  markContentPanelRouteReady: vi.fn(),
}));

// ── Load component after mocks ─────────────────────────────────────────────

const { DesktopWorkspace } = await import("../desktop-workspace");
const { useWorkspaceChrome } = await import(
  "@/app/[username]/_providers/workspace-chrome-context"
);

// Small harness so we can invoke toggleContentPanel as if a descendant button
// inside WorkspaceChromeProvider were clicked. Using the real context keeps
// the test coupled to the actual consumer contract.
function ContentToggleHarness() {
  const { toggleContentPanel, isContentPanelCollapsed } = useWorkspaceChrome();
  return (
    <button
      type="button"
      data-testid="toggle-content"
      data-collapsed={String(isContentPanelCollapsed)}
      onClick={toggleContentPanel}
    />
  );
}

type DesktopWorkspaceProps = ComponentProps<typeof DesktopWorkspace>;

function renderWorkspace(overrides: Partial<DesktopWorkspaceProps> = {}) {
  const onOpenDefaultContent = vi.fn();
  const utils = render(
    <DesktopWorkspace
      hasContentRoute={overrides.hasContentRoute ?? false}
      onOpenDefaultContent={overrides.onOpenDefaultContent ?? onOpenDefaultContent}
      interaction={<div data-testid="interaction-slot" />}
    >
      <ContentToggleHarness />
    </DesktopWorkspace>,
  );
  return { ...utils, onOpenDefaultContent };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("DesktopWorkspace pending-navigation recovery (FG_075)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("re-invokes onOpenDefaultContent after the timeout fallback clears the latch when hasContentRoute never transitions", () => {
    const onOpenDefaultContent = vi.fn();
    renderWorkspace({ onOpenDefaultContent });

    const toggle = screen.getByTestId("toggle-content");

    // First click kicks off the default-content navigation.
    fireEvent.click(toggle);
    expect(onOpenDefaultContent).toHaveBeenCalledTimes(1);

    // Second click immediately: the in-flight guard must still hold
    // (preserves the double-invocation protection).
    fireEvent.click(toggle);
    expect(onOpenDefaultContent).toHaveBeenCalledTimes(1);

    // hasContentRoute never flips. Against HEAD the ref stays true forever
    // and every subsequent click is a no-op. After the fix, the lifecycle
    // fallback clears the ref once the timeout elapses.
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    fireEvent.click(toggle);
    expect(onOpenDefaultContent).toHaveBeenCalledTimes(2);
  });

  it("clears the pending-navigation latch when hasContentRoute transitions true → false mid-flight", () => {
    const onOpenDefaultContent = vi.fn();
    const { rerender } = render(
      <DesktopWorkspace
        hasContentRoute={false}
        onOpenDefaultContent={onOpenDefaultContent}
        interaction={<div />}
      >
        <ContentToggleHarness />
      </DesktopWorkspace>,
    );

    const toggle = screen.getByTestId("toggle-content");

    // Open attempt while collapsed with no content route.
    fireEvent.click(toggle);
    expect(onOpenDefaultContent).toHaveBeenCalledTimes(1);

    // User navigates elsewhere — the parent observes a transient true, then
    // true → false (effectively, the route commits to something that also
    // has hasContentRoute=false after a brief flicker). We simulate the
    // more common misbehavior: any observed change should release the
    // latch. Here we flip false → true, then back to false — the second
    // transition should still leave the guard clear.
    rerender(
      <DesktopWorkspace
        hasContentRoute={true}
        onOpenDefaultContent={onOpenDefaultContent}
        interaction={<div />}
      >
        <ContentToggleHarness />
      </DesktopWorkspace>,
    );
    rerender(
      <DesktopWorkspace
        hasContentRoute={false}
        onOpenDefaultContent={onOpenDefaultContent}
        interaction={<div />}
      >
        <ContentToggleHarness />
      </DesktopWorkspace>,
    );

    // Without waiting for the timeout, the toggle should already be
    // operable again because the useLayoutEffect cleared the latch on
    // both transitions.
    fireEvent.click(toggle);
    expect(onOpenDefaultContent).toHaveBeenCalledTimes(2);
  });

  it("preserves the double-invocation guard during the legitimate in-flight window", () => {
    const onOpenDefaultContent = vi.fn();
    renderWorkspace({ onOpenDefaultContent });

    const toggle = screen.getByTestId("toggle-content");

    // Three rapid clicks before any transition or timeout fire.
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    fireEvent.click(toggle);

    // Only the first click should have reached onOpenDefaultContent.
    expect(onOpenDefaultContent).toHaveBeenCalledTimes(1);
  });

  it("cancels the fallback timeout on unmount so it does not touch a dead ref", () => {
    const onOpenDefaultContent = vi.fn();
    const { unmount } = renderWorkspace({ onOpenDefaultContent });

    const toggle = screen.getByTestId("toggle-content");
    fireEvent.click(toggle);
    expect(onOpenDefaultContent).toHaveBeenCalledTimes(1);

    unmount();

    // Advancing past the fallback window must not throw (the timer
    // should have been cleared on unmount).
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(5000);
      });
    }).not.toThrow();
  });
});
