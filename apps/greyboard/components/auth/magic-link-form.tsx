"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { magicLinkSchema, type MagicLinkInput } from "@/lib/schema/auth.schema";
import { magicLinkAction } from "@/app/_actions/auth-actions";
import { AUTH_METHODS } from "@/config/auth.config";

interface MagicLinkFormProps {
  mode?: "sign-in" | "sign-up";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function MagicLinkForm({ mode = "sign-in" }: MagicLinkFormProps) {
  const [pending, startTransition] = useTransition();

  const form = useForm<MagicLinkInput>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = (data: MagicLinkInput) => {
    startTransition(async () => {
      await toast.promise(magicLinkAction(data), {
        loading: "Sending magic link...",
        success: (result) => {
          if (result.success) {
            form.reset();
            return AUTH_METHODS.magicLink.successMessage;
          } else if (result.errors) {
            Object.entries(result.errors).forEach(([field, errors]) => {
              form.setError(field as keyof MagicLinkInput, {
                message: errors[0],
              });
            });
            throw new Error("Please check the form fields and try again.");
          } else {
            throw new Error(result.message || "Failed to send magic link");
          }
        },
        error: (error) => {
          return error instanceof Error
            ? error.message
            : "An unexpected error occurred.";
        },
      });
    });
  };

  if (!AUTH_METHODS.magicLink.enabled) {
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
                    placeholder={AUTH_METHODS.magicLink.emailPlaceholder}
                    className='pl-10'
                    disabled={pending}
                    autoComplete='email'
                    data-slot='magic-link-email-input'
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type='submit'
          className='w-full'
          size='lg'
          disabled={pending}
          data-slot='magic-link-submit-button'
        >
          {pending ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              Sending...
            </>
          ) : (
            <>
              <Mail className='mr-2 h-4 w-4' />
              {AUTH_METHODS.magicLink.buttonText}
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
