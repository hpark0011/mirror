"use client";

import { useMagicLinkRequest } from "../../hooks";
import { MagicLinkLoginView } from "../../views";
import { type AuthClient } from "../../client";
import { type AuthError } from "../../types";

export interface MagicLinkLoginFormProps {
  authClient: AuthClient;
  redirectTo?: string;
  disabled?: boolean;
  onSuccess?: () => void;
  onError?: (error: AuthError) => void;
}

export function MagicLinkLoginForm({
  authClient,
  disabled = false,
  ...options
}: MagicLinkLoginFormProps) {
  const { email, setEmail, status, error, submit, reset } = useMagicLinkRequest(
    authClient,
    options
  );

  return (
    <MagicLinkLoginView
      email={email}
      status={disabled ? "loading" : status}
      error={error}
      onEmailChange={setEmail}
      onSubmit={submit}
      onReset={reset}
    />
  );
}
