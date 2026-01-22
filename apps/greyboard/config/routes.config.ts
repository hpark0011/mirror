// Route configuration
export const ROUTES = {
  protected: ["/dashboard", "/settings", "/profile"],
  auth: ["/sign-in", "/sign-up", "/forgot-password", "/reset-password"],
  redirects: {
    unauthenticated: "/sign-in",
    authenticated: "/dashboard",
  },
} as const;
