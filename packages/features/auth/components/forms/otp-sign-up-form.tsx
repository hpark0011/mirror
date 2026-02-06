"use client";

import { useCallback } from "react";
import { useOTPAuth } from "../../hooks/use-otp-auth";
import { OTPSignUpView } from "../../views";
import type { AuthClient } from "../../client";
import type { AuthError } from "../../types";
import { getSafeRedirectUrl } from "../../utils/validate-redirect";

export interface OTPSignUpFormProps {
  authClient: AuthClient;
  redirectTo?: string;
  disabled?: boolean;
  onSuccess?: () => void;
  onError?: (error: AuthError) => void;
}

export function OTPSignUpForm({
  authClient,
  disabled = false,
  redirectTo,
  onSuccess,
  onError,
}: OTPSignUpFormProps) {
  const handleSuccess = useCallback(() => {
    onSuccess?.();
    if (redirectTo) {
      window.location.href = getSafeRedirectUrl(redirectTo, undefined);
    }
  }, [onSuccess, redirectTo]);

  const {
    email,
    setEmail,
    otp,
    setOtp,
    step,
    status,
    error,
    requestOTP,
    verifyOTP,
    resendOTP,
    resendCooldown,
    goBack,
  } = useOTPAuth(authClient, {
    onSuccess: handleSuccess,
    onError,
    type: "email-verification",
  });

  return (
    <OTPSignUpView
      email={email}
      otp={otp}
      step={step}
      status={disabled ? "loading" : status}
      error={error}
      onEmailChange={setEmail}
      onOtpChange={setOtp}
      onRequestOTP={requestOTP}
      onVerifyOTP={verifyOTP}
      onResendOTP={resendOTP}
      resendCooldown={resendCooldown}
      onBack={goBack}
    />
  );
}
