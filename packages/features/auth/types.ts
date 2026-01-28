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

export type AuthProvider = "email" | "google" | "magic-link";

export type AuthStatus = "idle" | "loading" | "success" | "error";

export interface AuthError {
  code: string;
  message: string;
}

export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "Invalid email or password",
  USER_NOT_FOUND: "No account found with this email",
  EMAIL_NOT_VERIFIED: "Please verify your email before signing in",
  EMAIL_ALREADY_EXISTS: "An account with this email already exists",
  INVALID_TOKEN: "This link is invalid or has expired",
  RATE_LIMITED: "Too many attempts. Please try again later.",
  PASSWORD_TOO_SHORT: "Password must be at least 8 characters",
  INVALID_EMAIL: "Please enter a valid email address",
  NETWORK_ERROR: "Unable to connect. Please check your internet connection.",
  UNKNOWN: "Something went wrong. Please try again.",
};

export function getAuthErrorMessage(code: string | undefined | null): string {
  if (!code) return AUTH_ERROR_MESSAGES.UNKNOWN!;
  return AUTH_ERROR_MESSAGES[code] ?? AUTH_ERROR_MESSAGES.UNKNOWN!;
}
