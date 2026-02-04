"use client";

import { useEffect, useState, useCallback } from "react";
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

/**
 * Factory function that creates a useSession hook bound to a specific auth client.
 * @param authClient - The auth client instance created by createAppAuthClient
 * @returns A useSession hook that provides session state and auth methods
 * @example
 * const useSession = createUseSession(authClient);
 *
 * // In a component:
 * const { user, isLoading, isAuthenticated, signOut } = useSession();
 */
export function createUseSession(authClient: AuthClient) {
  return function useSession() {
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
      authClient
        .getSession()
        .then(({ data }) => {
          if (data) {
            setSession({ user: data.user });
          }
        })
        .catch((err: unknown) => {
          const error =
            err instanceof Error ? err : new Error("Failed to fetch session");
          setError(error);
          console.error("Failed to fetch session:", error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }, []);

    const signOut = useCallback(async () => {
      await authClient.signOut();
      setSession(null);
    }, []);

    return {
      session,
      user: session?.user ?? null,
      isLoading,
      isAuthenticated: !!session,
      error,
      signOut,
    };
  };
}
