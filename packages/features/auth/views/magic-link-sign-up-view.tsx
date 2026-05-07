"use client";

import { memo } from "react";
import { type AuthError, type AuthStatus } from "../types";
import { MagicLinkView } from "./magic-link-view";

export interface MagicLinkSignUpViewProps {
  email: string;
  status: AuthStatus;
  error: AuthError | null;
  onEmailChange: (value: string) => void;
  onSubmit: () => void;
  onReset?: () => void;
}

export const MagicLinkSignUpView = memo(function MagicLinkSignUpView(
  props: MagicLinkSignUpViewProps
) {
  return (
    <MagicLinkView
      {...props}
      title="Create your account"
      description="Enter your email to receive a magic link to create your account"
      successMessage={`We sent a magic link to ${props.email}. Click the link to create your account.`}
      testIdPrefix="auth.magic-link-sign-up"
      formErrorId="magic-link-sign-up-form-error"
      emailInputId="magic-link-sign-up-email"
    />
  );
});
