"use client";

import { memo } from "react";
import { Button } from "@feel-good/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@feel-good/ui/primitives/card";
import { Field, FieldGroup, FieldLabel } from "@feel-good/ui/primitives/field";
import { Input } from "@feel-good/ui/primitives/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@feel-good/ui/primitives/input-otp";
import type { AuthError, AuthStatus, OTPStep } from "../types";
import { FormError } from "../components/shared/form-error";

export interface OTPViewProps {
  // Form state (controlled)
  email: string;
  otp: string;
  step: OTPStep;
  status: AuthStatus;
  error: AuthError | null;

  // Handlers
  onEmailChange: (value: string) => void;
  onOtpChange: (value: string) => void;
  onRequestOTP: () => void;
  onVerifyOTP: () => void;
  onResendOTP: () => void;
  onBack: () => void;

  // Resend
  resendCooldown: number;

  // Variant-specific content
  title: string;
  description: string;
  testIdPrefix: string;
  formErrorId: string;
  emailInputId: string;
  otpInputId: string;
}

export const OTPView = memo(function OTPView({
  email,
  otp,
  step,
  status,
  error,
  onEmailChange,
  onOtpChange,
  onRequestOTP,
  onVerifyOTP,
  onResendOTP,
  onBack,
  resendCooldown,
  title,
  description,
  testIdPrefix,
  formErrorId,
  emailInputId,
  otpInputId,
}: OTPViewProps) {
  const isLoading = status === "loading";

  // Step 1: Email input
  if (step === "email") {
    return (
      <Card className="w-full max-w-md rounded-4xl border-transparent p-0">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-medium">
            {title}
          </CardTitle>
          <CardDescription className="sr-only">{description}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onRequestOTP();
            }}
            aria-describedby={error ? formErrorId : undefined}
          >
            <FieldGroup>
              <FormError error={error} id={formErrorId} />

              <Field>
                <FieldLabel htmlFor={emailInputId} className="px-1.5">
                  Email{" "}
                  <span className="text-destructive" aria-hidden="true">
                    *
                  </span>
                </FieldLabel>
                <Input
                  id={emailInputId}
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  variant="underline"
                  autoComplete="email"
                  aria-required="true"
                  aria-invalid={error?.field === "email"}
                  disabled={isLoading}
                  data-testid={`${testIdPrefix}.email-input`}
                />
              </Field>

              <Field>
                <Button
                  type="submit"
                  size="lg"
                  variant="primary"
                  disabled={isLoading}
                  aria-busy={isLoading}
                  data-testid={`${testIdPrefix}.submit-btn`}
                >
                  {isLoading ? "Sending code..." : "Continue with Email"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    );
  }

  // Step 2: OTP verification
  return (
    <Card className="w-full max-w-md rounded-4xl border-transparent p-0">
      <CardHeader>
        <CardTitle className="text-center text-2xl font-medium">
          Enter verification code
        </CardTitle>
        <CardDescription className="text-center text-sm text-muted-foreground">
          We sent a code to {email}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onVerifyOTP();
          }}
          aria-describedby={error ? formErrorId : undefined}
        >
          <FieldGroup className="mx-auto">
            <FormError error={error} id={formErrorId} />

            <Field>
              <FieldLabel htmlFor={otpInputId} className="sr-only">
                Verification code
              </FieldLabel>
              <InputOTP
                id={otpInputId}
                maxLength={6}
                value={otp}
                onChange={onOtpChange}
                onComplete={onVerifyOTP}
                autoComplete="one-time-code"
                disabled={isLoading}
                data-testid={`${testIdPrefix}.otp-input`}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </Field>

            <Field>
              <Button
                type="submit"
                size="lg"
                variant="primary"
                disabled={isLoading}
                aria-busy={isLoading}
                data-testid={`${testIdPrefix}.verify-btn`}
              >
                {isLoading ? "Verifying..." : "Verify"}
              </Button>
            </Field>

            <Field>
              <Button
                type="button"
                variant="ghost"
                onClick={onResendOTP}
                disabled={isLoading || resendCooldown > 0}
                className="text-sm"
                data-testid={`${testIdPrefix}.resend-btn`}
              >
                {resendCooldown > 0
                  ? `Resend code (${resendCooldown}s)`
                  : "Resend code"}
              </Button>
            </Field>

            <Field>
              <Button
                type="button"
                variant="ghost"
                onClick={onBack}
                disabled={isLoading}
                className="text-sm"
                data-testid={`${testIdPrefix}.back-btn`}
              >
                Use a different email
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
});
