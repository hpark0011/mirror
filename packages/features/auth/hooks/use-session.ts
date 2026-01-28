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

export function createUseSession(authClient: AuthClient) {
  return function useSession() {
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      authClient.getSession().then(({ data }) => {
        if (data) {
          setSession({ user: data.user });
        }
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
      signOut,
    };
  };
}
