"use client";

import { Suspense } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { SignUpForm, OAuthButtons } from "@feel-good/features/auth/components";

function SignUpContent() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          Create an account
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Get started with Mirror today
        </p>
      </div>

      <OAuthButtons authClient={authClient} />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-zinc-200 dark:border-zinc-700" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            Or continue with email
          </span>
        </div>
      </div>

      <SignUpForm authClient={authClient} />

      <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="font-medium text-zinc-900 hover:underline dark:text-white"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />}>
      <SignUpContent />
    </Suspense>
  );
}
