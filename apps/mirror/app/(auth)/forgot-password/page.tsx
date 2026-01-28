"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { ForgotPasswordForm } from "@feel-good/features/auth/components";

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          Reset your password
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      <ForgotPasswordForm authClient={authClient} />

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
