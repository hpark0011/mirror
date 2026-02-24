import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import { emailOTP, magicLink } from "better-auth/plugins";
import type { GenericActionCtx } from "convex/server";
import { internal, components } from "./_generated/api";
import { type DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";
import { env } from "./env";

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
// Explicit type annotation breaks circular inference between authComponent and
// the triggersApi exports in authTriggers.ts (TS2502).
export const authComponent: ReturnType<typeof createClient<DataModel>> = createClient<DataModel>(components.betterAuth, {
  triggers: {
    user: {
      onCreate: async (ctx, doc) => {
        await ctx.db.insert("users", {
          authId: doc._id,
          email: doc.email,
          onboardingComplete: false,
        });
      },
      onUpdate: async (ctx, newDoc, oldDoc) => {
        if (newDoc.email !== oldDoc.email) {
          const appUser = await ctx.db
            .query("users")
            .withIndex("by_authId", (q) => q.eq("authId", newDoc._id))
            .unique();
          if (appUser) {
            await ctx.db.patch(appUser._id, { email: newDoc.email });
          }
        }
      },
      onDelete: async (ctx, doc) => {
        const appUser = await ctx.db
          .query("users")
          .withIndex("by_authId", (q) => q.eq("authId", doc._id))
          .unique();
        if (appUser) {
          if (appUser.avatarStorageId) {
            await ctx.storage.delete(appUser.avatarStorageId);
          }
          await ctx.db.delete(appUser._id);
        }
      },
    },
  },
  authFunctions: {
    onCreate: internal.authTriggers.onCreate,
    onUpdate: internal.authTriggers.onUpdate,
    onDelete: internal.authTriggers.onDelete,
    // Trigger functions are in authTriggers.ts to break circular type inference
  },
});

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  // createAuth is called from HTTP actions, so ctx supports runAction at runtime.
  // GenericCtx is a union type, so we narrow to the action context for email calls.
  const actionCtx = ctx as GenericActionCtx<DataModel>;

  return betterAuth({
    baseURL: env.SITE_URL,
    database: authComponent.adapter(ctx),

    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        // Fire-and-forget: don't block auth response waiting for email
        void actionCtx.runAction(internal.email.sendVerificationEmail, {
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
        sendMagicLink: async ({ email, url }) => {
          // Fire-and-forget: don't block auth response waiting for email
          void actionCtx.runAction(internal.email.sendMagicLink, {
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
        sendVerificationOTP: async ({ email, otp, type }) => {
          // Fire-and-forget: don't block auth response waiting for email
          void actionCtx.runAction(internal.email.sendOTP, {
            to: email,
            otp,
            type,
          });
        },
      }),
    ],
  });
};

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return (await authComponent.safeGetAuthUser(ctx)) ?? null;
  },
});

export type Auth = ReturnType<typeof createAuth>;
