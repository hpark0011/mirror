"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { AuthClient } from "../client";
import {
  getAuthErrorMessage,
  type AuthStatus,
  type AuthError,
  type OTPStep,
} from "../types";

export interface UseOTPAuthOptions {
  type?: "sign-in" | "email-verification" | "forget-password";
  onSuccess?: () => void;
  onError?: (error: AuthError) => void;
}

export interface UseOTPAuthReturn {
  // Form state
  email: string;
  setEmail: (value: string) => void;
  otp: string;
  setOtp: (value: string) => void;
  step: OTPStep;

  // Status
  status: AuthStatus;
  error: AuthError | null;

  // Actions
  requestOTP: () => Promise<void>;
  verifyOTP: () => Promise<void>;
  resendOTP: () => Promise<void>;
  goBack: () => void;
  reset: () => void;

  // Resend
  resendCooldown: number;
}

export function useOTPAuth(
  authClient: AuthClient,
  options: UseOTPAuthOptions = {}
): UseOTPAuthReturn {
  const { type = "sign-in", onSuccess, onError } = options;
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<OTPStep>("email");
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [error, setError] = useState<AuthError | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const statusRef = useRef(status);
  statusRef.current = status;
  const resendCooldownRef = useRef(resendCooldown);
  resendCooldownRef.current = resendCooldown;

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resendCooldown > 0]);

  const handleAuthError = useCallback(
    (ctx: { error: Record<string, unknown> }) => {
      const code =
        typeof ctx.error.code === "string" ? ctx.error.code : "UNKNOWN";
      const authError: AuthError = {
        code,
        message: getAuthErrorMessage(code),
      };
      setStatus("error");
      setError(authError);
      onError?.(authError);
    },
    [onError]
  );

  const requestOTP = useCallback(async () => {
    if (statusRef.current === "loading") return;
    statusRef.current = "loading";

    setError(null);
    setStatus("loading");

    await authClient.emailOtp.sendVerificationOtp(
      { email, type },
      {
        onSuccess: () => {
          setStatus("idle");
          setStep("verify");
          setResendCooldown(60);
        },
        onError: handleAuthError,
      }
    );
  }, [email, type, authClient, handleAuthError]);

  const verifyOTP = useCallback(async () => {
    if (statusRef.current === "loading") return;
    statusRef.current = "loading";

    setError(null);
    setStatus("loading");

    await authClient.signIn.emailOtp(
      { email, otp },
      {
        onSuccess: () => {
          setStatus("success");
          onSuccess?.();
        },
        onError: handleAuthError,
      }
    );
  }, [email, otp, authClient, onSuccess, handleAuthError]);

  const resendOTP = useCallback(async () => {
    if (statusRef.current === "loading" || resendCooldownRef.current > 0)
      return;
    statusRef.current = "loading";

    setError(null);
    setStatus("loading");
    setOtp("");

    await authClient.emailOtp.sendVerificationOtp(
      { email, type },
      {
        onSuccess: () => {
          setStatus("idle");
          setResendCooldown(60);
        },
        onError: (ctx) => {
          handleAuthError(ctx);
          setResendCooldown(0);
        },
      }
    );
  }, [email, type, authClient, handleAuthError]);

  const goBack = useCallback(() => {
    setStep("email");
    setOtp("");
    setError(null);
    setStatus("idle");
    setResendCooldown(0);
  }, []);

  const reset = useCallback(() => {
    setEmail("");
    setOtp("");
    setStep("email");
    setStatus("idle");
    setError(null);
    setResendCooldown(0);
  }, []);

  return {
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
    reset,
  };
}
