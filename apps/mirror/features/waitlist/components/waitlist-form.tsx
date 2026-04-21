"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";

import { api } from "@feel-good/convex/convex/_generated/api";
import { ArrowLeftCircleFillIcon } from "@feel-good/icons";
import { Button } from "@feel-good/ui/primitives/button";
import { Card, CardContent } from "@feel-good/ui/primitives/card";
import { Field, FieldGroup, FieldLabel } from "@feel-good/ui/primitives/field";
import { Input } from "@feel-good/ui/primitives/input";

import {
  type WaitlistFormValues,
  waitlistSchema,
} from "../lib/waitlist.schema";

/**
 * Discriminated-union state for the waitlist form. Transitions are driven by
 * the mutation response or the duck-typed error code — never by `instanceof`
 * (see Architecture §2 step 11 of the waitlist spec for why).
 */
type WaitlistStatus =
  | "idle"
  | "success"
  | "already-on-list"
  | "rate-limit"
  | "error";

const FORM_ERROR_ID = "home-waitlist-form-error";
const EMAIL_INPUT_ID = "home-waitlist-email";

export function WaitlistForm() {
  const submit = useMutation(api.waitlistRequests.mutations.submit);
  const [status, setStatus] = useState<WaitlistStatus>("success");

  const form = useForm<WaitlistFormValues>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: WaitlistFormValues) {
    try {
      const { alreadyOnList } = await submit({ email: values.email });
      setStatus(alreadyOnList ? "already-on-list" : "success");
    } catch (err) {
      // Duck-type discrimination on `err.data.code` rather than
      // `instanceof ConvexError`. Prototype identity can silently fail if
      // pnpm ever ends up with two copies of the `convex` package in the
      // client bundle, and the failure mode (rate-limit copy never renders)
      // would be invisible.
      const code = typeof err === "object" &&
        err !== null &&
        "data" in err &&
        typeof (err as { data?: unknown }).data === "object" &&
        (err as { data?: { code?: unknown } }).data?.code;
      if (code === "RATE_LIMIT") {
        setStatus("rate-limit");
      } else {
        setStatus("error");
      }
    }
  }

  function handleReset() {
    form.reset({ email: "" });
    setStatus("idle");
  }

  const isSubmitting = form.formState.isSubmitting;
  const emailError = form.formState.errors.email;

  if (status === "success" || status === "already-on-list") {
    const message = status === "success"
      ? "You're on the list — we'll be in touch."
      : "Looks like you're already on the list — we'll be in touch.";
    const messageTestId = status === "success"
      ? "home.waitlist.success"
      : "home.waitlist.already-on-list";

    return (
      <Card className="w-full max-w-sm rounded-4xl border-transparent bg-transparent px-8 py-0">
        <CardContent className="pt-6">
          <div className="space-y-4 text-center">
            <p
              data-testid={messageTestId}
              className="text-foreground"
            >
              {message}
            </p>
            <Button
              variant="wrapper"
              onClick={handleReset}
              className="text-base font-normal hover:opacity-70 rounded-none has-[>svg]:px-0 gap-0.5 h-fit py-0 pb-0.5 mb-20 items-center"
              data-testid="home.waitlist.reset-link"
            >
              <ArrowLeftCircleFillIcon
                className="size-5.5"
                aria-hidden="true"
              />
              <span className="pb-px">
                Back
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const errorCopy = status === "rate-limit"
    ? "You've submitted a few times — please try again in a little while."
    : status === "error"
    ? "Something went wrong, please try again."
    : null;

  return (
    <Card className="w-full max-w-sm rounded-4xl border-transparent bg-transparent px-8 py-0">
      <CardContent className="p-0">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          aria-describedby={errorCopy ? FORM_ERROR_ID : undefined}
          noValidate
        >
          <FieldGroup>
            {errorCopy
              ? (
                <div
                  id={FORM_ERROR_ID}
                  role="alert"
                  aria-live="polite"
                  data-testid="home.waitlist.form-error"
                  className="bg-destructive/10 text-destructive rounded-md p-3 text-sm"
                >
                  {errorCopy}
                </div>
              )
              : null}

            <Field>
              <FieldLabel htmlFor={EMAIL_INPUT_ID} className="px-1.5">
                Email{" "}
                <span className="text-destructive" aria-hidden="true">
                  *
                </span>
              </FieldLabel>
              <Input
                id={EMAIL_INPUT_ID}
                type="email"
                placeholder="you@example.com"
                variant="underline"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-required="true"
                aria-invalid={!!emailError}
                disabled={isSubmitting}
                data-testid="home.waitlist.email-input"
                {...form.register("email")}
              />
              {emailError?.message
                ? (
                  <p className="text-destructive px-2.5 text-sm">
                    {emailError.message}
                  </p>
                )
                : null}
            </Field>

            <Field>
              <Button
                type="submit"
                size="lg"
                variant="primary"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                data-testid="home.waitlist.submit-btn"
              >
                {isSubmitting ? "Joining..." : "Join Waitlist"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
