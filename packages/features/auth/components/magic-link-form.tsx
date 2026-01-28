"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@feel-good/ui/primitives/button";
import { Input } from "@feel-good/ui/primitives/input";
import { Label } from "@feel-good/ui/primitives/label";
import type { AuthClient } from "../client";
import { getAuthErrorMessage, type AuthStatus } from "../types";
import { getSafeRedirectUrl } from "../utils/validate-redirect";

interface MagicLinkFormProps {
  authClient: AuthClient;
  callbackURL?: string;
}

export function MagicLinkForm({ authClient, callbackURL }: MagicLinkFormProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>("idle");
  const searchParams = useSearchParams();

  const redirectUrl = getSafeRedirectUrl(callbackURL ?? searchParams.get("next"));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("loading");

    await authClient.signIn.magicLink(
      { email, callbackURL: redirectUrl },
      {
        onSuccess: () => setStatus("success"),
        onError: (ctx) => {
          setStatus("error");
          setError(getAuthErrorMessage(ctx.error.code ?? "UNKNOWN"));
        },
      }
    );
  }

  const isLoading = status === "loading";
  const isSuccess = status === "success";

  if (isSuccess) {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-md bg-green-50 p-4 dark:bg-green-900/20">
          <h3 className="font-medium text-green-800 dark:text-green-200">
            Check your email
          </h3>
          <p className="mt-1 text-sm text-green-700 dark:text-green-300">
            We sent a magic link to {email}. Click the link to sign in.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => setStatus("idle")}
          className="text-sm"
        >
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="magic-email">Email</Label>
        <Input
          id="magic-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          disabled={isLoading}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Sending link..." : "Send magic link"}
      </Button>
    </form>
  );
}
