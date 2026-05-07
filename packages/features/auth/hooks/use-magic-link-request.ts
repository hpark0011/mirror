"use client";

import { useState, useCallback, useRef } from "react";
import { type AuthClient } from "../client";
import { getAuthErrorMessage, type AuthStatus, type AuthError } from "../types";
import { getSafeRedirectUrl } from "../utils/validate-redirect";

export interface UseMagicLinkRequestOptions {
  redirectTo?: string;
  onSuccess?: () => void;
  onError?: (error: AuthError) => void;
}

export interface UseMagicLinkRequestReturn {
  // Form state
  email: string;
  setEmail: (value: string) => void;

  // Status
  status: AuthStatus;
  error: AuthError | null;

  // Actions
  submit: () => Promise<void>;
  reset: () => void;
}

export function useMagicLinkRequest(
  authClient: AuthClient,
  options: UseMagicLinkRequestOptions = {}
): UseMagicLinkRequestReturn {
  const { redirectTo, onSuccess, onError } = options;
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [error, setError] = useState<AuthError | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;

  const submit = useCallback(async () => {
    if (statusRef.current === "loading") return;

    setError(null);
    setStatus("loading");

    const callbackURL = redirectTo
      ? getSafeRedirectUrl(redirectTo, undefined)
      : undefined;

    await authClient.signIn.magicLink(
      { email, callbackURL },
      {
        onSuccess: () => {
          setStatus("success");
          onSuccess?.();
        },
        onError: (ctx) => {
          const authError: AuthError = {
            code: ctx.error.code ?? "UNKNOWN",
            message: getAuthErrorMessage(ctx.error.code ?? "UNKNOWN"),
          };
          setStatus("error");
          setError(authError);
          onError?.(authError);
        },
      }
    );
  }, [email, authClient, redirectTo, onSuccess, onError]);

  const reset = useCallback(() => {
    setEmail("");
    setStatus("idle");
    setError(null);
  }, []);

  return {
    email,
    setEmail,
    status,
    error,
    submit,
    reset,
  };
}
