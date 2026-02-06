import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import { emailOTP, magicLink } from "better-auth/plugins";
import { internal, components } from "./_generated/api";
import { type DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";
import { env } from "./env";

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: env.SITE_URL,
    database: authComponent.adapter(ctx),

    emailVerification: {
      sendVerificationEmail: ({ user, url }) => {
        // Fire-and-forget: don't block auth response waiting for email
        void ctx.runAction(internal.email.sendVerificationEmail, {
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
        "/sign-in/magic-link": { window: 60, max: 3 },
        "/email-otp/send-verification-otp": { window: 60, max: 3 },
        "/sign-in/email-otp": { window: 300, max: 5 },
      },
    },

    plugins: [
      convex({ authConfig }),
      magicLink({
        sendMagicLink: ({ email, url }) => {
          // Fire-and-forget: don't block auth response waiting for email
          void ctx.runAction(internal.email.sendMagicLink, {
            to: email,
            link: url,
          });
        },
        expiresIn: 900, // 15 minutes
      }),
      emailOTP({
        otpLength: 6,
        expiresIn: 300, // 5 minutes
        allowedAttempts: 5,
        sendVerificationOTP: ({ email, otp, type }) => {
          // Fire-and-forget: don't block auth response waiting for email
          void ctx.runAction(internal.email.sendOTP, { to: email, otp, type });
        },
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
