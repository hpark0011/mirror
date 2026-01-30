"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@feel-good/ui/primitives/button";
import { Input } from "@feel-good/ui/primitives/input";
import { Label } from "@feel-good/ui/primitives/label";
import type { AuthClient } from "../client";
import { getAuthErrorMessage, type AuthStatus } from "../types";
import { FormError } from "./form-error";
import { FormSuccess } from "./form-success";
import { getSafeRedirectUrl } from "../utils/validate-redirect";

interface MagicLinkFormProps {
  authClient: AuthClient;
  redirectTo?: string;
}

export function MagicLinkForm({ authClient, redirectTo }: MagicLinkFormProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>("idle");
  const searchParams = useSearchParams();

  const safeRedirectTo = getSafeRedirectUrl(redirectTo ?? searchParams.get("next"));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("loading");

    await authClient.signIn.magicLink(
      { email, callbackURL: safeRedirectTo },
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
        <FormSuccess
          title="Check your email"
          message={`We sent a magic link to ${email}. Click the link to sign in.`}
        />
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
      <FormError message={error} />

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
