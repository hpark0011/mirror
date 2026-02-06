export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  image?: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSession {
  user: AuthUser;
  expiresAt: Date;
}

export type AuthProvider = "google" | "magic-link" | "email-otp";

export type AuthStatus = "idle" | "loading" | "success" | "error";

export type OTPStep = "email" | "verify";

export interface AuthError {
  code: string;
  message: string;
  field?: string; // For form validation errors
}

// Security: Generic error messages to prevent user enumeration
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  EMAIL_NOT_VERIFIED: "Please verify your email before signing in",
  EMAIL_ALREADY_EXISTS:
    "Unable to create account. Please try signing in instead.", // Vague to prevent enumeration
  INVALID_TOKEN: "This link is invalid or has expired",
  RATE_LIMITED: "Too many attempts. Please try again later.",
  INVALID_EMAIL: "Please enter a valid email address",
  NETWORK_ERROR: "Unable to connect. Please check your internet connection.",
  OAUTH_ERROR: "Unable to sign in with this provider. Please try again.",
  OTP_EXPIRED: "This code has expired. Please request a new one.",
  OTP_INVALID: "Invalid code. Please check and try again.",
  OTP_MAX_ATTEMPTS: "Too many attempts. Please request a new code.",
  // Better Auth upstream error codes (must match verbatim)
  INVALID_OTP: "Invalid code. Please check and try again.",
  TOO_MANY_ATTEMPTS: "Too many attempts. Please request a new code.",
  UNKNOWN: "Something went wrong. Please try again.",
};

export function getAuthErrorMessage(code: string | undefined | null): string {
  if (!code) return AUTH_ERROR_MESSAGES.UNKNOWN!;
  return AUTH_ERROR_MESSAGES[code] ?? AUTH_ERROR_MESSAGES.UNKNOWN!;
}
