export const PATHS = {
  auth: {
    signIn: "/sign-in",
    signUp: "/sign-up",
    forgotPassword: "/forgot-password",
    resetPassword: "/reset-password",
    verifyEmail: "/verify-email",
  },
  app: {
    dashboard: "/dashboard",
    files: "/dashboard/files",
    settings: "/settings",
    profile: "/profile",
  },
  public: {
    home: "/",
    about: "/about",
    pricing: "/pricing",
  },
} as const;

export type PathKey = keyof typeof PATHS;
export type AuthPathKey = keyof typeof PATHS.auth;
export type AppPathKey = keyof typeof PATHS.app;
export type PublicPathKey = keyof typeof PATHS.public;

export const getPath = (
  section: PathKey,
  path: AuthPathKey | AppPathKey | PublicPathKey
): string => {
  return PATHS[section][path as keyof (typeof PATHS)[typeof section]];
};
