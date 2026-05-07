"use client";

import { useMagicLinkRequest } from "../../hooks";
import { MagicLinkSignUpView } from "../../views";
import { type AuthClient } from "../../client";
import { type AuthError } from "../../types";

export interface MagicLinkSignUpFormProps {
  authClient: AuthClient;
  redirectTo?: string;
  disabled?: boolean;
  onSuccess?: () => void;
  onError?: (error: AuthError) => void;
}

export function MagicLinkSignUpForm({
  authClient,
  disabled = false,
  ...options
}: MagicLinkSignUpFormProps) {
  const { email, setEmail, status, error, submit, reset } = useMagicLinkRequest(
    authClient,
    options
  );

  return (
    <MagicLinkSignUpView
      email={email}
      status={disabled ? "loading" : status}
      error={error}
      onEmailChange={setEmail}
      onSubmit={submit}
      onReset={reset}
    />
  );
}
