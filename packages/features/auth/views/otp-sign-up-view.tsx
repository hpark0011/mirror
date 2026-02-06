"use client";

import { memo } from "react";
import type { AuthError, AuthStatus, OTPStep } from "../types";
import { OTPView } from "./otp-view";

export interface OTPSignUpViewProps {
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

export const OTPSignUpView = memo(function OTPSignUpView(
  props: OTPSignUpViewProps
) {
  return (
    <OTPView
      {...props}
      title="Create Account"
      description="Enter your email to receive a verification code"
      testIdPrefix="auth.otp-sign-up"
      formErrorId="otp-sign-up-form-error"
      emailInputId="otp-sign-up-email"
      otpInputId="otp-sign-up-code"
    />
  );
});
