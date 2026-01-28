"use client";

import { Suspense } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { ResetPasswordForm } from "@feel-good/features/auth/components";

function ResetPasswordContent() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          Set new password
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Enter your new password below
        </p>
      </div>

      <ResetPasswordForm authClient={authClient} />

      <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        Remember your password?{" "}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
