import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { PATHS } from "@/config/paths.config";

export const metadata: Metadata = {
  title: "Sign Up | Greyboard",
  description: "Create your Greyboard account",
};

export default function SignUpPage() {
  return (
    <div className='space-y-6'>
      <div className='space-y-2 text-center'>
        <h2 className='text-2xl font-semibold tracking-tight'>
          Create an account
        </h2>
        <p className='text-sm text-muted-foreground'>
          Enter your information to get started
        </p>
      </div>

      <AuthForm mode='sign-up' />

      <div className='text-center text-sm'>
        <span className='text-muted-foreground'>Already have an account? </span>
        <Link
          href={PATHS.auth.signIn}
          className='font-medium text-primary hover:underline'
          prefetch={true}
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
