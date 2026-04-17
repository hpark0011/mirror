import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { emailOTP, magicLink } from "better-auth/plugins";
import type { GenericActionCtx } from "convex/server";
import { internal, components } from "../_generated/api";
import { type DataModel } from "../_generated/dataModel";
import authConfig from "../auth.config";
import { isPlaywrightTestEmail, isPlaywrightTestMode } from "./testMode";
import { env } from "../env";

/**
 * Tier 2 — early-rejection UX gate helper. Extracted from the inline
 * `sendVerificationOTP` callback so Vitest can exercise the exact branch
 * behavior (existing-user bypass, allowlist pass, BETA_CLOSED throw,
 * query-count accounting) without needing a full Better Auth HTTP runtime
 * under convex-test. The callback below delegates to this helper; the
 * helper contains no logic that isn't in the callback. Returns a discriminator
 * describing which branch was taken so tests can assert it, or throws an
 * `APIError` with `code: "BETA_CLOSED"` when the email is blocked.
 */
export type SendOtpGateCtx = {
  runQuery: GenericActionCtx<DataModel>["runQuery"];
};

export type SendOtpGateOutcome = "existing-user" | "allowlisted";

export async function runSendVerificationOtpGate(
  ctx: SendOtpGateCtx,
  email: string,
): Promise<SendOtpGateOutcome> {
  const normalized = email.toLowerCase();
  const existing = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "email", value: normalized }],
  });
  if (existing) {
    return "existing-user";
  }
  const allowed = await ctx.runQuery(
    internal.betaAllowlist.queries.isEmailAllowed,
    { email: normalized },
  );
  if (!allowed) {
    throw new APIError("FORBIDDEN", {
      code: "BETA_CLOSED",
      message:
        "Sign-ups are currently invite-only. Contact us if you'd like access.",
    });
  }
  return "allowlisted";
}

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
// Explicit type annotation breaks circular inference between authComponent and
// the triggersApi exports in auth/triggers.ts (TS2502).
export const authComponent: ReturnType<typeof createClient<DataModel>> =
  createClient<DataModel>(components.betterAuth, {
    triggers: {
      user: {
        onCreate: async (ctx, doc) => {
          // Tier 1 — authoritative allowlist gate. Runs inside the component's
          // create mutation; an uncaught throw atomically rolls back the
          // component user row across every provider path (email-OTP, Google
          // OAuth, future providers).
          if (!isPlaywrightTestEmail(doc.email)) {
            const allowed = await ctx.runQuery(
              internal.betaAllowlist.queries.isEmailAllowed,
              { email: doc.email.toLowerCase() },
            );
            if (!allowed) {
              throw new Error("BETA_CLOSED: " + doc.email);
            }
          }
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
              await ctx.db.patch("users", appUser._id, { email: newDoc.email });
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
            await ctx.db.delete("users", appUser._id);
          }
        },
      },
    },
    authFunctions: {
      onCreate: internal.auth.triggers.onCreate,
      onUpdate: internal.auth.triggers.onUpdate,
      onDelete: internal.auth.triggers.onDelete,
    },
  });

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  // createAuth is called from HTTP actions, so ctx supports runAction at runtime.
  // GenericCtx is a union type, so we narrow to the action context for email calls.
  const actionCtx = ctx as GenericActionCtx<DataModel>;

  return betterAuth({
    baseURL: env.SITE_URL,
    trustedOrigins: [env.SITE_URL],
    database: authComponent.adapter(ctx),

    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        // Fire-and-forget: don't block auth response waiting for email
        void actionCtx.runAction(internal.email.actions.sendVerificationEmail, {
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
          void actionCtx.runAction(internal.email.actions.sendMagicLink, {
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
          // Convex cloud dev can still report NODE_ENV=production, so the
          // Playwright secret is the explicit opt-in for test OTP capture.
          if (isPlaywrightTestMode() && isPlaywrightTestEmail(email)) {
            await actionCtx.runMutation(
              internal.auth.testHelpers.storeTestOtp,
              {
                email,
                otp,
              },
            );
            return;
          }
          // Tier 2 — early-rejection UX gate. Existing-user check first so the
          // common sign-in path only issues one query (NFR-01). Existing users
          // sign in even when off-allowlist (FR-08). Logic lives in
          // `runSendVerificationOtpGate` so it's unit-testable in isolation.
          await runSendVerificationOtpGate(actionCtx, email);
          // Fire-and-forget: don't block auth response waiting for email
          void actionCtx.runAction(internal.email.actions.sendOTP, {
            to: email,
            otp,
            type,
          });
        },
      }),
    ],
  });
};

export type Auth = ReturnType<typeof createAuth>;
