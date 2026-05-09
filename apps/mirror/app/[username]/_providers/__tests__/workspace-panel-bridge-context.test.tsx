/**
 * PLAN_010 — pins the `WorkspacePanelBridgeProvider` contract:
 *  - `ensureContentPanelOpen()` is a no-op when nothing is registered,
 *  - the active registrant wins (re-registration overwrites),
 *  - the cleanup is identity-checked so a stale unregister does NOT
 *    clobber a fresh registration (the StrictMode dev double-mount
 *    foot-gun).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, act } from "@testing-library/react";
import { type ReactNode } from "react";

import {
  WorkspacePanelBridgeProvider,
  useWorkspacePanelBridge,
  useOptionalWorkspacePanelBridge,
} from "../workspace-panel-bridge-context";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <WorkspacePanelBridgeProvider>{children}</WorkspacePanelBridgeProvider>
  );
}

describe("WorkspacePanelBridgeProvider", () => {
  afterEach(() => {
    cleanup();
  });

  it("ensureContentPanelOpen() is a no-op when nothing is registered", () => {
    const { result } = renderHook(() => useWorkspacePanelBridge(), {
      wrapper,
    });

    expect(() => {
      act(() => {
        result.current.ensureContentPanelOpen();
      });
    }).not.toThrow();
  });

  it("register(fn) makes ensureContentPanelOpen() invoke fn exactly once per call", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useWorkspacePanelBridge(), {
      wrapper,
    });

    act(() => {
      result.current.register(fn);
    });

    act(() => {
      result.current.ensureContentPanelOpen();
    });
    expect(fn).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.ensureContentPanelOpen();
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("re-registering with a new fn' overwrites the previous registration", () => {
    const fn = vi.fn();
    const fnPrime = vi.fn();
    const { result } = renderHook(() => useWorkspacePanelBridge(), {
      wrapper,
    });

    act(() => {
      result.current.register(fn);
    });
    act(() => {
      result.current.register(fnPrime);
    });

    act(() => {
      result.current.ensureContentPanelOpen();
    });

    expect(fn).not.toHaveBeenCalled();
    expect(fnPrime).toHaveBeenCalledTimes(1);
  });

  it("the cleanup returned by register(fn) only clears the slot if fn is still the active registrant", () => {
    const fn = vi.fn();
    const fnPrime = vi.fn();
    const { result } = renderHook(() => useWorkspacePanelBridge(), {
      wrapper,
    });

    let cleanupFn: (() => void) | undefined;
    act(() => {
      cleanupFn = result.current.register(fn);
    });
    // fn' overwrites fn before fn's cleanup runs (the StrictMode-double-mount
    // shape).
    act(() => {
      result.current.register(fnPrime);
    });

    // Now run fn's stale cleanup — it must NOT clobber fnPrime.
    act(() => {
      cleanupFn?.();
    });

    act(() => {
      result.current.ensureContentPanelOpen();
    });

    expect(fn).not.toHaveBeenCalled();
    expect(fnPrime).toHaveBeenCalledTimes(1);
  });

  it("useWorkspacePanelBridge() throws outside a provider", () => {
    expect(() => {
      renderHook(() => useWorkspacePanelBridge());
    }).toThrow(
      /useWorkspacePanelBridge must be used within WorkspacePanelBridgeProvider/,
    );
  });

  it("useOptionalWorkspacePanelBridge() returns null outside a provider", () => {
    const { result } = renderHook(() => useOptionalWorkspacePanelBridge());
    expect(result.current).toBeNull();
  });
});
