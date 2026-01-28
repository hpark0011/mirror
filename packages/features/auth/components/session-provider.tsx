"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { AuthClient } from "../client";

interface User {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified: boolean;
}

interface Session {
  user: User;
}

interface SessionContextValue {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
  children: ReactNode;
  authClient: AuthClient;
}

export function createSessionProvider(authClient: AuthClient) {
  function SessionProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchSession = useCallback(async () => {
      try {
        const { data } = await authClient.getSession();
        if (data) {
          setSession({ user: data.user });
        } else {
          setSession(null);
        }
      } catch {
        setSession(null);
      } finally {
        setIsLoading(false);
      }
    }, []);

    useEffect(() => {
      fetchSession();
    }, [fetchSession]);

    // Refresh session on window focus
    useEffect(() => {
      function handleFocus() {
        fetchSession();
      }

      window.addEventListener("focus", handleFocus);
      return () => window.removeEventListener("focus", handleFocus);
    }, [fetchSession]);

    const signOut = useCallback(async () => {
      await authClient.signOut();
      setSession(null);
    }, []);

    const value = useMemo<SessionContextValue>(
      () => ({
        session,
        user: session?.user ?? null,
        isLoading,
        isAuthenticated: !!session,
        signOut,
        refresh: fetchSession,
      }),
      [session, isLoading, signOut, fetchSession]
    );

    return (
      <SessionContext.Provider value={value}>
        {children}
      </SessionContext.Provider>
    );
  }

  function useSession(): SessionContextValue {
    const context = useContext(SessionContext);
    if (!context) {
      throw new Error("useSession must be used within a SessionProvider");
    }
    return context;
  }

  return { SessionProvider, useSession };
}
