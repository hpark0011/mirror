"use client";

import { memo } from "react";
import type { AuthError, AuthStatus, OTPStep } from "../types";
import { OTPView } from "./otp-view";

export interface OTPLoginViewProps {
  email: string;
  otp: string;
  step: OTPStep;
  status: AuthStatus;
  error: AuthError | null;
  onEmailChange: (value: string) => void;
  onOtpChange: (value: string) => void;
  onRequestOTP: () => void;
  onVerifyOTP: () => void;
  onResendOTP: () => void;
  onBack: () => void;
  resendCooldown: number;
}

export const OTPLoginView = memo(function OTPLoginView(
  props: OTPLoginViewProps
) {
  return (
    <OTPView
      {...props}
      title="Login"
      description="Enter your email to receive a verification code"
      testIdPrefix="auth.otp-login"
      formErrorId="otp-login-form-error"
      emailInputId="otp-login-email"
      otpInputId="otp-login-code"
    />
  );
});
