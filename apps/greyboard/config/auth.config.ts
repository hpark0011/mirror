export const AUTH_PROVIDERS = {
  google: {
    name: "Google",
    enabled: true,
    icon: "Chrome",
  },
} as const;

export const AUTH_METHODS = {
  oauth: {
    enabled: true,
    providers: ["google"] as const,
  },
  magicLink: {
    enabled: true,
    emailPlaceholder: "Enter your email",
    buttonText: "Send magic link",
    successMessage: "Check your email for the magic link!",
  },
  password: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 100,
  },
} as const;

export type AuthProvider = keyof typeof AUTH_PROVIDERS;
export type AuthMethod = keyof typeof AUTH_METHODS;

export const DEFAULT_AUTH_METHOD: AuthMethod = "password";

export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: "Invalid email or password",
  USER_NOT_FOUND: "User not found",
  USER_ALREADY_EXISTS: "User already exists",
  INVALID_TOKEN: "Invalid or expired token",
  NETWORK_ERROR: "Network error. Please try again",
  UNKNOWN_ERROR: "An unexpected error occurred",
} as const;

export type AuthError = keyof typeof AUTH_ERRORS;
