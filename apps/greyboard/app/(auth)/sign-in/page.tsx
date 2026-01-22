import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { PATHS } from "@/config/paths.config";

export const metadata: Metadata = {
  title: "Sign In | Greyboard",
  description: "Sign in to your Greyboard account",
};

export default function SignInPage() {
  return (
    <div className='space-y-6'>
      <div className='space-y-2 text-center'>
        <h2 className='text-2xl font-semibold tracking-tight'>Welcome back</h2>
        <p className='text-sm text-muted-foreground'>
          Sign in to your account to continue
        </p>
      </div>

      <AuthForm mode='sign-in' />

      <div className='text-center text-sm'>
        <span className='text-muted-foreground'>
          Don&apos;t have an account?{" "}
        </span>
        <Link
          href={PATHS.auth.signUp}
          className='font-medium text-primary hover:underline'
          prefetch={true}
        >
          Sign up
        </Link>
      </div>
    </div>
  );
}
