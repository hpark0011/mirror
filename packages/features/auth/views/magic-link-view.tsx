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
import { type AuthError, type AuthStatus } from "../types";
import { FormError } from "../components/shared/form-error";
import { FormSuccess } from "../components/shared/form-success";

export interface MagicLinkViewProps {
  // Form state (controlled)
  email: string;
  status: AuthStatus;
  error: AuthError | null;

  // Handlers
  onEmailChange: (value: string) => void;
  onSubmit: () => void;
  onReset?: () => void;

  // Variant-specific content
  title: string;
  description: string;
  successMessage: string;
  testIdPrefix: string;
  formErrorId: string;
  emailInputId: string;
}

export const MagicLinkView = memo(function MagicLinkView({
  email,
  status,
  error,
  onEmailChange,
  onSubmit,
  onReset,
  title,
  description,
  successMessage,
  testIdPrefix,
  formErrorId,
  emailInputId,
}: MagicLinkViewProps) {
  const isLoading = status === "loading";
  const isSuccess = status === "success";

  if (isSuccess) {
    return (
      <Card className="w-full max-w-md rounded-4xl border-transparent bg-transparent p-0">
        <CardContent className="pt-6">
          <div className="space-y-4 text-center">
            <FormSuccess title="Check your email" message={successMessage} />
            {onReset ? (
              <Button
                variant="ghost"
                onClick={onReset}
                className="text-sm"
                data-testid={`${testIdPrefix}.reset-btn`}
              >
                Use a different email
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md rounded-4xl border-transparent bg-transparent p-0">
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
            onSubmit();
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
                {isLoading ? "Sending link..." : "Continue with Email"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
});
