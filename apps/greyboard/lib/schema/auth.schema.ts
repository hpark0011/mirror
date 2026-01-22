import { z } from "zod";
import { AUTH_METHODS } from "@/config/auth.config";

const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Invalid email address");

const passwordSchema = z
  .string()
  .min(
    AUTH_METHODS.password.minPasswordLength,
    `Password must be at least ${AUTH_METHODS.password.minPasswordLength} characters`
  )
  .max(
    AUTH_METHODS.password.maxPasswordLength,
    `Password must be less than ${AUTH_METHODS.password.maxPasswordLength} characters`
  );

export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signUpSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const magicLinkSchema = z.object({
  email: emailSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
