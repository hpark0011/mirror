"use client";

import { memo } from "react";
import { type AuthError, type AuthStatus } from "../types";
import { MagicLinkView } from "./magic-link-view";

export interface MagicLinkLoginViewProps {
  email: string;
  status: AuthStatus;
  error: AuthError | null;
  onEmailChange: (value: string) => void;
  onSubmit: () => void;
  onReset?: () => void;
}

export const MagicLinkLoginView = memo(function MagicLinkLoginView(
  props: MagicLinkLoginViewProps
) {
  return (
    <MagicLinkView
      {...props}
      title="Login"
      description="Enter your email to receive a magic link"
      successMessage={`We sent a magic link to ${props.email}. Click the link to sign in.`}
      testIdPrefix="auth.magic-link"
      formErrorId="magic-link-form-error"
      emailInputId="magic-link-email"
    />
  );
});
