"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { customToast } from "@/components/custom-toast";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  signInSchema,
  signUpSchema,
  type SignInInput,
  type SignUpInput,
} from "@/lib/schema/auth.schema";
import { signInAction, signUpAction } from "@/app/_actions/auth-actions";
import { AUTH_METHODS } from "@/config/auth.config";
import { PATHS } from "@/config/paths.config";

interface PasswordFormProps {
  mode: "sign-in" | "sign-up";
}

export function PasswordForm({ mode }: PasswordFormProps) {
  const [pending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();

  const isSignUp = mode === "sign-up";

  const form = useForm<SignInInput | SignUpInput>({
    resolver: zodResolver(isSignUp ? signUpSchema : signInSchema),
    defaultValues: {
      email: "",
      password: "",
      ...(isSignUp && { confirmPassword: "" }),
    },
  });

  const onSubmit = (data: SignInInput | SignUpInput) => {
    startTransition(async () => {
      const action = isSignUp
        ? signUpAction(data as SignUpInput)
        : signInAction(data as SignInInput);

      const result = await action;

      if (result.success) {
        customToast({
          type: "success",
          title: isSignUp ? "Account created!" : "Welcome back!",
          description: isSignUp
            ? "Your account has been created successfully."
            : "You've been signed in successfully.",
        });
        form.reset();
        router.push(PATHS.app.dashboard);
      } else {
        if (result.errors) {
          // Set field-level errors
          Object.entries(result.errors).forEach(([field, errors]) => {
            form.setError(field as keyof (SignInInput | SignUpInput), {
              message: errors[0],
            });
          });
          customToast({
            type: "error",
            title: "Validation Error",
            description: "Please check the form fields and try again.",
          });
        } else {
          customToast({
            type: "error",
            title: "Authentication Failed",
            description:
              result.message || "Please check your credentials and try again.",
          });
        }
      }
    });
  };

  if (!AUTH_METHODS.password.enabled) {
    return null;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <div className='relative'>
                  <Mail className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                  <Input
                    {...field}
                    type='email'
                    placeholder='Enter your email'
                    className='pl-10'
                    disabled={pending}
                    autoComplete='email'
                    data-slot='password-email-input'
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <div className='relative'>
                  <Lock className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                  <Input
                    {...field}
                    type={showPassword ? "text" : "password"}
                    placeholder='Enter your password'
                    className='pl-10 pr-10'
                    disabled={pending}
                    autoComplete={
                      isSignUp ? "new-password" : "current-password"
                    }
                    data-slot='password-input'
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={pending}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className='h-4 w-4 text-muted-foreground' />
                    ) : (
                      <Eye className='h-4 w-4 text-muted-foreground' />
                    )}
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {isSignUp && (
          <FormField
            control={form.control}
            name='confirmPassword'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm Password</FormLabel>
                <FormControl>
                  <div className='relative'>
                    <Lock className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                    <Input
                      {...field}
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder='Confirm your password'
                      className='pl-10 pr-10'
                      disabled={pending}
                      autoComplete='new-password'
                      data-slot='confirm-password-input'
                    />
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      disabled={pending}
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className='h-4 w-4 text-muted-foreground' />
                      ) : (
                        <Eye className='h-4 w-4 text-muted-foreground' />
                      )}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {!isSignUp && (
          <div className='flex items-center justify-end'>
            <Link
              href={PATHS.auth.forgotPassword}
              className='text-sm text-muted-foreground hover:text-primary'
            >
              Forgot password?
            </Link>
          </div>
        )}

        <Button
          type='submit'
          className='w-full'
          size='lg'
          disabled={pending}
          data-slot='password-submit-button'
        >
          {pending ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              {isSignUp ? "Creating account..." : "Signing in..."}
            </>
          ) : (
            <>{isSignUp ? "Create account" : "Sign in"}</>
          )}
        </Button>
      </form>
    </Form>
  );
}
