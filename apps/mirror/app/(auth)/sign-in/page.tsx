"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { SignInForm, MagicLinkForm, OAuthButtons } from "@feel-good/features/auth/components";

type AuthMethod = "password" | "magic-link";

function SignInContent() {
  const [method, setMethod] = useState<AuthMethod>("password");

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          Welcome back
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Sign in to your account to continue
        </p>
      </div>

      <OAuthButtons authClient={authClient} />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-zinc-200 dark:border-zinc-700" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            Or continue with
          </span>
        </div>
      </div>

      <div className="flex rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
        <button
          type="button"
          onClick={() => setMethod("password")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            method === "password"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          }`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => setMethod("magic-link")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            method === "magic-link"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          }`}
        >
          Magic Link
        </button>
      </div>

      {method === "password" ? (
        <SignInForm authClient={authClient} />
      ) : (
        <MagicLinkForm authClient={authClient} />
      )}

      {method === "password" && (
        <div className="text-center">
          <Link
            href="/forgot-password"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            Forgot your password?
          </Link>
        </div>
      )}

      <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        Don&apos;t have an account?{" "}
        <Link
          href="/sign-up"
          className="font-medium text-zinc-900 hover:underline dark:text-white"
        >
          Sign up
        </Link>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />}>
      <SignInContent />
    </Suspense>
  );
}
