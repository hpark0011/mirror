"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { UiControlAction } from "@feel-good/convex/convex/chat/uiControlTypes";
import { getContentHref, isContentKind, type ContentKind } from "@/features/content";

type UiControlContextValue = {
  dispatchUiControlActions: (actions: UiControlAction[]) => void;
  takeQueuedActions: (kind: ContentKind) => UiControlAction[];
  queuedVersion: number;
};

const UiControlContext = createContext<UiControlContextValue | null>(null);

type UiControlProviderProps = {
  username: string;
  children: ReactNode;
};

function getCurrentKind(pathname: string): ContentKind | null {
  const [, rawUsername, maybeKind] = pathname.split("/");
  void rawUsername;
  return isContentKind(maybeKind) ? maybeKind : null;
}

export function UiControlProvider({
  username,
  children,
}: UiControlProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queuedActionsRef = useRef<UiControlAction[]>([]);
  const [queuedVersion, setQueuedVersion] = useState(0);

  const buildChatAwareHref = useCallback(
    (basePath: string) => {
      const params = new URLSearchParams(searchParams);
      params.set("chat", "1");
      const queryString = params.toString();
      return queryString ? `${basePath}?${queryString}` : basePath;
    },
    [searchParams],
  );

  const dispatchUiControlActions = useCallback(
    (actions: UiControlAction[]) => {
      if (actions.length === 0) return;

      const routeAction = actions.find((action) =>
        action.type === "navigate" || action.type === "setListControls"
      );
      const nextKind = routeAction?.kind;
      const shouldNavigate =
        nextKind &&
        (routeAction.type === "setListControls" ||
          routeAction.type === "navigate");

      const queued = actions.filter((action) =>
        action.type === "setListControls" ||
        action.type === "clearListControls"
      );
      if (queued.length > 0) {
        queuedActionsRef.current = [...queuedActionsRef.current, ...queued];
        setQueuedVersion((version) => version + 1);
      }

      if (shouldNavigate && nextKind) {
        const slug = routeAction.type === "navigate" ? routeAction.slug : undefined;
        router.push(buildChatAwareHref(getContentHref(username, nextKind, slug)));
      } else if (queued.length > 0 && !getCurrentKind(pathname)) {
        router.push(buildChatAwareHref(getContentHref(username, queued[0]!.kind)));
      }
    },
    [buildChatAwareHref, pathname, router, username],
  );

  const takeQueuedActions = useCallback((kind: ContentKind) => {
    const taken = queuedActionsRef.current.filter((action) => action.kind === kind);
    if (taken.length > 0) {
      queuedActionsRef.current = queuedActionsRef.current.filter(
        (action) => action.kind !== kind,
      );
      setQueuedVersion((version) => version + 1);
    }
    return taken;
  }, []);

  const value = useMemo(
    () => ({ dispatchUiControlActions, takeQueuedActions, queuedVersion }),
    [dispatchUiControlActions, takeQueuedActions, queuedVersion],
  );

  return (
    <UiControlContext.Provider value={value}>
      {children}
    </UiControlContext.Provider>
  );
}

export function useUiControl() {
  const context = useContext(UiControlContext);
  if (!context) {
    throw new Error("useUiControl must be used within UiControlProvider");
  }
  return context;
}
