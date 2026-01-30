import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { magicLink } from "better-auth/plugins";
import { components, api } from "./_generated/api";
import { type DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { betterAuth } from "better-auth";
import authConfig from "./auth.config";
import { env } from "./env";

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: env.SITE_URL,
    database: authComponent.adapter(ctx),

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification: true,
      sendResetPassword: ({ user, url }) => {
        // Fire-and-forget: don't block auth response waiting for email
        void ctx.runAction(api.email.sendPasswordReset, {
          to: user.email,
          link: url,
        });
      },
    },

    emailVerification: {
      sendVerificationEmail: ({ user, url }) => {
        // Fire-and-forget: don't block auth response waiting for email
        void ctx.runAction(api.email.sendVerificationEmail, {
          to: user.email,
          link: url,
        });
      },
      sendOnSignUp: true,
    },

    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 14, // 14 days
      updateAge: 60 * 60 * 24, // Update session every 24 hours
    },

    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google"],
      },
    },

    rateLimit: {
      enabled: true,
      window: 60,
      max: 10,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 5 },
        "/sign-in/magic-link": { window: 60, max: 3 },
        "/request-password-reset": { window: 60, max: 3 },
      },
    },

    plugins: [
      convex({ authConfig }),
      magicLink({
        sendMagicLink: ({ email, url }) => {
          // Fire-and-forget: don't block auth response waiting for email
          void ctx.runAction(api.email.sendMagicLink, {
            to: email,
            link: url,
          });
        },
        expiresIn: 900, // 15 minutes
      }),
    ],
  });
};

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});

export type Auth = ReturnType<typeof createAuth>;
