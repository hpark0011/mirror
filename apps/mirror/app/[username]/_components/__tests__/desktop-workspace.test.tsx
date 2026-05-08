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
import { type ComponentProps } from "react";

// ── Mocks ──────────────────────────────────────────────────────────────────

// Stub ProfileRouteDataProvider dependency: WorkspaceInteractionPanel calls
// useProfileRouteData(), which throws when rendered outside its provider. The
// FG_075 tests only care about the pending-navigation latch, not edit-state
// UI, so a minimal stub is sufficient and avoids wiring the full Convex-backed
// provider (which requires preloadedProfile, ProfileProvider, etc.).
vi.mock("@/app/[username]/_providers/profile-route-data-context", () => ({
  useProfileRouteData: () => ({
    isOwner: false,
    isEditing: false,
    setIsEditing: vi.fn(),
    isSubmitting: false,
    setIsSubmitting: vi.fn(),
  }),
}));

// WorkspaceInteractionPanel also calls useChatSearchParams(), which reads from
// next/navigation. Stub just enough for the hook to return without throwing.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// Replace the resizable primitives with minimal pass-through components.
// react-resizable-panels relies on layout measurement that happy-dom does
// not emulate, and the tests only care about callback invocation.
// Imperative APIs (setLayout, collapse) are forwarded as spies so PLAN_010
// tests can assert the bridge's `ensureContentPanelOpen()` reaches
// `groupRef.current.setLayout([50, 50])`.
const { setLayoutSpy } = vi.hoisted(() => ({
  setLayoutSpy: vi.fn(),
}));

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
      setLayout: setLayoutSpy as (layout: number[]) => void,
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
const {
  WorkspacePanelBridgeProvider,
  useWorkspacePanelBridge,
} = await import(
  "@/app/[username]/_providers/workspace-panel-bridge-context"
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

// Sibling harness used by the PLAN_010 tests to invoke the bridge from
// outside DesktopWorkspace — proves the imperative loop wires through the
// real WorkspacePanelBridgeProvider.
function BridgeOpenHarness() {
  const { ensureContentPanelOpen } = useWorkspacePanelBridge();
  return (
    <button
      type="button"
      data-testid="bridge-open"
      onClick={ensureContentPanelOpen}
    />
  );
}

type DesktopWorkspaceProps = ComponentProps<typeof DesktopWorkspace>;

function renderWorkspace(overrides: Partial<DesktopWorkspaceProps> = {}) {
  const onOpenDefaultContent = vi.fn();
  const utils = render(
    <WorkspacePanelBridgeProvider>
      <DesktopWorkspace
        hasContentRoute={overrides.hasContentRoute ?? false}
        onOpenDefaultContent={
          overrides.onOpenDefaultContent ?? onOpenDefaultContent
        }
        interaction={<div data-testid="interaction-slot" />}
      >
        <ContentToggleHarness />
      </DesktopWorkspace>
    </WorkspacePanelBridgeProvider>,
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
      <WorkspacePanelBridgeProvider>
        <DesktopWorkspace
          hasContentRoute={false}
          onOpenDefaultContent={onOpenDefaultContent}
          interaction={<div />}
        >
          <ContentToggleHarness />
        </DesktopWorkspace>
      </WorkspacePanelBridgeProvider>,
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
      <WorkspacePanelBridgeProvider>
        <DesktopWorkspace
          hasContentRoute={true}
          onOpenDefaultContent={onOpenDefaultContent}
          interaction={<div />}
        >
          <ContentToggleHarness />
        </DesktopWorkspace>
      </WorkspacePanelBridgeProvider>,
    );
    rerender(
      <WorkspacePanelBridgeProvider>
        <DesktopWorkspace
          hasContentRoute={false}
          onOpenDefaultContent={onOpenDefaultContent}
          interaction={<div />}
        >
          <ContentToggleHarness />
        </DesktopWorkspace>
      </WorkspacePanelBridgeProvider>,
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

describe("DesktopWorkspace — panel-bridge registration (PLAN_010)", () => {
  // Anchors the wiring contract: DesktopWorkspace registers
  // `contentController.ensureExpanded` with `WorkspacePanelBridgeProvider`
  // on mount, and the bridge's `ensureContentPanelOpen()` invocation
  // reaches `groupRef.setLayout([50, 50])` end-to-end.
  beforeEach(() => {
    setLayoutSpy.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("invoking ensureContentPanelOpen() from a sibling consumer reaches the mocked panel group's setLayout([50, 50])", () => {
    // Mount with hasContentRoute=false so the controller starts already
    // collapsed — that's the bug repro state (visitor manually collapsed
    // the panel; agent or user-UI is about to navigate to a content URL).
    // ensureExpanded then has work to do regardless of hasContentRoute,
    // because the dispatcher is responsible for the upcoming push.
    render(
      <WorkspacePanelBridgeProvider>
        <DesktopWorkspace
          hasContentRoute={false}
          onOpenDefaultContent={vi.fn()}
          interaction={<div />}
        >
          <ContentToggleHarness />
        </DesktopWorkspace>
        <BridgeOpenHarness />
      </WorkspacePanelBridgeProvider>,
    );

    setLayoutSpy.mockClear();

    fireEvent.click(screen.getByTestId("bridge-open"));

    expect(setLayoutSpy).toHaveBeenCalledTimes(1);
    expect(setLayoutSpy).toHaveBeenCalledWith([50, 50]);
  });

  it("after the desktop workspace unmounts, a fresh provider's bridge is unregistered (no setLayout call)", () => {
    const { unmount } = render(
      <WorkspacePanelBridgeProvider>
        <DesktopWorkspace
          hasContentRoute={false}
          onOpenDefaultContent={vi.fn()}
          interaction={<div />}
        >
          <ContentToggleHarness />
        </DesktopWorkspace>
        <BridgeOpenHarness />
      </WorkspacePanelBridgeProvider>,
    );

    unmount();
    setLayoutSpy.mockClear();

    // Render a fresh consumer in a sibling tree against a fresh provider —
    // proves the new provider's slot is empty (no DesktopWorkspace
    // registered against it).
    const utils = render(
      <WorkspacePanelBridgeProvider>
        <BridgeOpenHarness />
      </WorkspacePanelBridgeProvider>,
    );

    fireEvent.click(utils.getByTestId("bridge-open"));

    expect(setLayoutSpy).not.toHaveBeenCalled();
  });
});
