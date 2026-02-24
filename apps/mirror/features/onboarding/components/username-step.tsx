"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import { CheckIcon, XIcon, Loader2Icon } from "lucide-react";

import { Button } from "@feel-good/ui/primitives/button";
import { Input } from "@feel-good/ui/primitives/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@feel-good/ui/primitives/form";

import { isReservedUsername } from "@/lib/reserved-usernames";
import { useUsernameAvailability } from "../hooks/use-username-availability";

const usernameSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(
      /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/,
      "Username must be lowercase alphanumeric with hyphens, no leading or trailing hyphens"
    )
    .refine((val) => !isReservedUsername(val), {
      message: "This username is reserved",
    }),
});

type UsernameFormValues = z.infer<typeof usernameSchema>;

type UsernameStepProps = {
  onComplete: () => void;
};

export function UsernameStep({ onComplete }: UsernameStepProps) {
  const setUsername = useMutation(api.users.setUsername);

  const form = useForm<UsernameFormValues>({
    resolver: zodResolver(usernameSchema),
    defaultValues: {
      username: "",
    },
    mode: "onChange",
  });

  const usernameValue = form.watch("username");
  const { isAvailable, isChecking } = useUsernameAvailability(usernameValue);

  const isFormValid = form.formState.isValid;
  const canSubmit =
    isFormValid && isAvailable === true && !isChecking;

  async function onSubmit(values: UsernameFormValues) {
    await setUsername({ username: values.username });
    onComplete();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-[480px] space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Choose your username
          </h1>
          <p className="text-sm text-muted-foreground">
            This is your public handle on Mirror. You can change it later.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <div className="relative flex items-center">
                      <span className="pointer-events-none absolute left-3 select-none text-sm text-muted-foreground">
                        @
                      </span>
                      <Input
                        {...field}
                        placeholder="your-username"
                        autoComplete="off"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        className="pl-7 pr-9"
                      />
                      <div className="absolute right-3 flex items-center">
                        <UsernameStatusIcon
                          isChecking={isChecking}
                          isAvailable={isAvailable}
                          hasValue={usernameValue.length >= 3}
                          isValid={isFormValid}
                        />
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                  {!form.formState.errors.username && isAvailable === false && !isChecking && (
                    <p className="text-destructive text-sm">
                      This username is already taken
                    </p>
                  )}
                  {!form.formState.errors.username && isAvailable === true && !isChecking && (
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Username is available
                    </p>
                  )}
                </FormItem>
              )}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={!canSubmit || form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                "Continue"
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}

type UsernameStatusIconProps = {
  isChecking: boolean;
  isAvailable: boolean | null;
  hasValue: boolean;
  isValid: boolean;
};

function UsernameStatusIcon({
  isChecking,
  isAvailable,
  hasValue,
  isValid,
}: UsernameStatusIconProps) {
  if (!hasValue || !isValid) return null;

  if (isChecking) {
    return <Loader2Icon className="size-4 animate-spin text-muted-foreground" />;
  }

  if (isAvailable === true) {
    return <CheckIcon className="size-4 text-green-600 dark:text-green-400" />;
  }

  if (isAvailable === false) {
    return <XIcon className="size-4 text-destructive" />;
  }

  return null;
}
