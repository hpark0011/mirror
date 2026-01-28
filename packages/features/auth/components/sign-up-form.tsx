"use client";

import { useState } from "react";
import { Button } from "@feel-good/ui/primitives/button";
import { Input } from "@feel-good/ui/primitives/input";
import { Label } from "@feel-good/ui/primitives/label";
import type { AuthClient } from "../client";
import { getAuthErrorMessage, type AuthStatus } from "../types";

interface SignUpFormProps {
  authClient: AuthClient;
  onSuccess?: () => void;
}

export function SignUpForm({ authClient, onSuccess }: SignUpFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(getAuthErrorMessage("PASSWORD_TOO_SHORT"));
      return;
    }

    setStatus("loading");

    await authClient.signUp.email(
      { name, email, password },
      {
        onSuccess: () => {
          setStatus("success");
          onSuccess?.();
        },
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
            We sent a verification link to {email}. Please verify your email to
            continue.
          </p>
        </div>
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
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="Min 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          disabled={isLoading}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
