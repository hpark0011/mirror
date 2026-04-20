"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { Loader2Icon } from "lucide-react";

import { api } from "@feel-good/convex/convex/_generated/api";
import { Button } from "@feel-good/ui/primitives/button";
import { Input } from "@feel-good/ui/primitives/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@feel-good/ui/primitives/form";

import {
  waitlistSchema,
  type WaitlistFormValues,
} from "../lib/waitlist.schema";

/**
 * Discriminated-union state for the waitlist form. Only one of the error /
 * success panels renders at a time, and transitions are driven by the
 * mutation response or the duck-typed error code — never by `instanceof`
 * (see Architecture §2 step 11 of the waitlist spec for why).
 */
type WaitlistStatus =
  | "idle"
  | "success"
  | "already-on-list"
  | "rate-limit"
  | "error";

export function WaitlistForm() {
  const submit = useMutation(api.waitlistRequests.mutations.submit);
  const [status, setStatus] = useState<WaitlistStatus>("idle");

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
      const code =
        typeof err === "object" &&
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

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-3">
        <p
          data-testid="home.waitlist.success"
          className="text-sm text-foreground"
        >
          You&apos;re on the list — we&apos;ll be in touch.
        </p>
        <button
          type="button"
          onClick={handleReset}
          data-testid="home.waitlist.reset-link"
          className="text-sm text-muted-foreground hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  if (status === "already-on-list") {
    return (
      <div className="flex flex-col items-center gap-3">
        <p
          data-testid="home.waitlist.already-on-list"
          className="text-sm text-foreground"
        >
          Looks like you&apos;re already on the list — we&apos;ll be in touch.
        </p>
        <button
          type="button"
          onClick={handleReset}
          data-testid="home.waitlist.reset-link"
          className="text-sm text-muted-foreground hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  const errorCopy =
    status === "rate-limit"
      ? "You've submitted a few times — please try again in a little while."
      : status === "error"
        ? "Something went wrong, please try again."
        : null;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex w-full max-w-sm flex-col gap-3"
        noValidate
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">Email address</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  data-testid="home.waitlist.email-input"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={form.formState.isSubmitting}
          data-testid="home.waitlist.submit-btn"
        >
          {form.formState.isSubmitting ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            "Join Waitlist"
          )}
        </Button>

        {errorCopy ? (
          <p
            data-testid="home.waitlist.form-error"
            className="text-destructive text-sm"
            role="alert"
          >
            {errorCopy}
          </p>
        ) : null}
      </form>
    </Form>
  );
}
