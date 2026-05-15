import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { type Id } from "./_generated/dataModel";
import {
  getPlaywrightTestSecret,
  isPlaywrightTestMode,
  TEST_EMAIL_SUFFIX,
} from "./auth/testMode";
import { authComponent, createAuth } from "./auth/client";

const http = httpRouter();

// CORS-scoped via Better Auth's `trustedOrigins` in convex/auth/client.ts.
// `cors: true` enables the CORS wrapper; allowed origins are sourced from
// `trustedOrigins` (see @convex-dev/better-auth create-client.ts).
authComponent.registerRoutes(http, createAuth, { cors: true });

// Constant-time string compare to avoid leaking secret length via timing.
function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function authorizeTestRequest(req: Request): Response | null {
  const secret = getPlaywrightTestSecret();
  const header = req.headers.get("x-test-secret");
  if (!secret || !header || !secretsMatch(header, secret)) {
    return new Response("Forbidden", { status: 403 });
  }
  return null;
}

// Test-only routes: registered only when the Playwright secret is configured.
// Convex cloud dev may still use NODE_ENV=production, so the secret is the
// explicit opt-in. Each handler re-checks authorizeTestRequest for
// defense-in-depth.
if (isPlaywrightTestMode()) {
  http.route({
    path: "/test/read-otp",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
      const deny = authorizeTestRequest(req);
      if (deny) return deny;
      const { email } = (await req.json()) as { email: string };
      if (!email || !email.endsWith(TEST_EMAIL_SUFFIX)) {
        return new Response(
          `Bad Request: email must end in ${TEST_EMAIL_SUFFIX}`,
          { status: 400 },
        );
      }
      const otp: string | null = await ctx.runQuery(
        internal.auth.testHelpers.readTestOtp,
        { email },
      );
      if (otp === null) {
        return new Response(JSON.stringify({ error: "OTP not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ otp }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  });

  http.route({
    path: "/test/ensure-user",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
      const deny = authorizeTestRequest(req);
      if (deny) return deny;
      const { email, username } = (await req.json()) as {
        email: string;
        username: string;
      };
      if (!email || !username) {
        return new Response("Bad Request: email and username required", {
          status: 400,
        });
      }
      if (!email.endsWith(TEST_EMAIL_SUFFIX)) {
        return new Response(
          `Bad Request: email must end in ${TEST_EMAIL_SUFFIX}`,
          { status: 400 },
        );
      }
      await ctx.runMutation(internal.auth.testHelpers.ensureTestUser, {
        email,
        username,
      });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  });

  http.route({
    path: "/test/reset-user",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
      const deny = authorizeTestRequest(req);
      if (deny) return deny;
      const { email } = (await req.json()) as { email: string };
      if (!email) {
        return new Response("Bad Request: email required", { status: 400 });
      }
      if (!email.endsWith(TEST_EMAIL_SUFFIX)) {
        return new Response(
          `Bad Request: email must end in ${TEST_EMAIL_SUFFIX}`,
          { status: 400 },
        );
      }
      await ctx.runMutation(internal.auth.testHelpers.resetTestUser, {
        email,
      });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  });

  http.route({
    path: "/test/ensure-post-fixtures",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
      const deny = authorizeTestRequest(req);
      if (deny) return deny;
      const { email } = (await req.json()) as { email: string };
      if (!email) {
        return new Response("Bad Request: email required", { status: 400 });
      }
      if (!email.endsWith(TEST_EMAIL_SUFFIX)) {
        return new Response(
          `Bad Request: email must end in ${TEST_EMAIL_SUFFIX}`,
          { status: 400 },
        );
      }
      const result = await ctx.runMutation(
        internal.auth.testHelpers.ensureTestPostFixtures,
        { email },
      );
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  });

  http.route({
    path: "/test/ensure-article-fixtures",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
      const deny = authorizeTestRequest(req);
      if (deny) return deny;
      const { email, key, relevantArticle } = (await req.json()) as {
        email: string;
        key?: string;
        relevantArticle?: boolean;
      };
      if (!email) {
        return new Response("Bad Request: email required", { status: 400 });
      }
      if (!email.endsWith(TEST_EMAIL_SUFFIX)) {
        return new Response(
          `Bad Request: email must end in ${TEST_EMAIL_SUFFIX}`,
          { status: 400 },
        );
      }
      if (key !== undefined && typeof key !== "string") {
        return new Response("Bad Request: key must be a string", {
          status: 400,
        });
      }
      if (
        relevantArticle !== undefined &&
        typeof relevantArticle !== "boolean"
      ) {
        return new Response("Bad Request: relevantArticle must be a boolean", {
          status: 400,
        });
      }
      const result = await ctx.runMutation(
        internal.auth.testHelpers.ensureTestArticleFixtures,
        {
          email,
          ...(key !== undefined ? { key } : {}),
          ...(relevantArticle !== undefined ? { relevantArticle } : {}),
        },
      );
      const { relevantArticleId, ...responseBody } = result;
      if (relevantArticleId) {
        await ctx.runAction(internal.embeddings.actions.generateEmbedding, {
          sourceTable: "articles",
          sourceId: relevantArticleId,
        });
      }
      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  });

  http.route({
    path: "/test/ensure-bio-fixtures",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
      const deny = authorizeTestRequest(req);
      if (deny) return deny;
      const { email, entries } = (await req.json()) as {
        email: string;
        entries: Array<{
          kind: "work" | "education";
          title: string;
          startDate: number;
          endDate: number | null;
          description?: string;
          link?: string;
        }>;
      };
      if (!email || !Array.isArray(entries)) {
        return new Response("Bad Request: email and entries array required", {
          status: 400,
        });
      }
      if (!email.endsWith(TEST_EMAIL_SUFFIX)) {
        return new Response(
          `Bad Request: email must end in ${TEST_EMAIL_SUFFIX}`,
          { status: 400 },
        );
      }
      const result = await ctx.runMutation(
        internal.auth.testHelpers.ensureTestBioFixtures,
        { email, entries },
      );
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  });

  http.route({
    path: "/test/ensure-contact-fixtures",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
      const deny = authorizeTestRequest(req);
      if (deny) return deny;
      const { email, entries } = (await req.json()) as {
        email: string;
        entries: Array<{
          kind:
            | "email"
            | "linkedin"
            | "instagram"
            | "x"
            | "tiktok"
            | "youtube";
          value: string;
        }>;
      };
      if (!email || !Array.isArray(entries)) {
        return new Response("Bad Request: email and entries array required", {
          status: 400,
        });
      }
      if (!email.endsWith(TEST_EMAIL_SUFFIX)) {
        return new Response(
          `Bad Request: email must end in ${TEST_EMAIL_SUFFIX}`,
          { status: 400 },
        );
      }
      const result = await ctx.runMutation(
        internal.auth.testHelpers.ensureTestContactFixtures,
        { email, entries },
      );
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  });

  http.route({
    path: "/test/ensure-project-fixtures",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
      const deny = authorizeTestRequest(req);
      if (deny) return deny;
      const { email, entries, embed } = (await req.json()) as {
        email: string;
        entries: Array<{
          title: string;
          startDate: number;
          endDate: number | null;
          description?: string;
          link?: string;
        }>;
        embed?: boolean;
      };
      if (!email || !Array.isArray(entries)) {
        return new Response("Bad Request: email and entries array required", {
          status: 400,
        });
      }
      if (!email.endsWith(TEST_EMAIL_SUFFIX)) {
        return new Response(
          `Bad Request: email must end in ${TEST_EMAIL_SUFFIX}`,
          { status: 400 },
        );
      }
      const result = await ctx.runMutation(
        internal.auth.testHelpers.ensureTestProjectFixtures,
        { email, entries },
      );
      if (embed === true) {
        for (const projectId of result.projectIds) {
          await ctx.runAction(internal.embeddings.actions.generateEmbedding, {
            sourceTable: "projects",
            sourceId: projectId,
          });
        }
      }
      const responseBody = {
        userId: result.userId,
        insertedCount: result.insertedCount,
      };
      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  });

  http.route({
    path: "/test/exhaust-chat-daily",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
      const deny = authorizeTestRequest(req);
      if (deny) return deny;
      const { username } = (await req.json()) as { username: string };
      if (!username) {
        return new Response("Bad Request: username required", { status: 400 });
      }
      await ctx.runMutation(internal.chat.testHelpers.exhaustAnonDailyBucket, {
        username,
      });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  });

  http.route({
    path: "/test/cover-blob-storage-state",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
      const deny = authorizeTestRequest(req);
      if (deny) return deny;
      const { storageId } = (await req.json()) as { storageId?: unknown };
      if (typeof storageId !== "string" || storageId.length === 0) {
        return new Response("Bad Request: storageId required", {
          status: 400,
        });
      }
      const result = await ctx.runQuery(
        internal.articles.testHelpers.readTestCoverBlobStorageState,
        { storageId: storageId as Id<"_storage"> },
      );
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  });

  http.route({
    path: "/test/cleanup-cover-storage-ids",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
      const deny = authorizeTestRequest(req);
      if (deny) return deny;
      const { storageIds } = (await req.json()) as { storageIds?: unknown };
      if (
        !Array.isArray(storageIds) ||
        storageIds.some((storageId) => typeof storageId !== "string")
      ) {
        return new Response("Bad Request: storageIds array required", {
          status: 400,
        });
      }
      const result = await ctx.runMutation(
        internal.auth.testHelpers.cleanupTestCoverStorageIds,
        { storageIds: storageIds as Id<"_storage">[] },
      );
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  });

  http.route({
    path: "/test/cleanup-article-cover-media",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
      const deny = authorizeTestRequest(req);
      if (deny) return deny;
      const { email, slugs } = (await req.json()) as {
        email?: unknown;
        slugs?: unknown;
      };
      if (typeof email !== "string" || email.length === 0) {
        return new Response("Bad Request: email required", { status: 400 });
      }
      if (
        !Array.isArray(slugs) ||
        slugs.some((slug) => typeof slug !== "string")
      ) {
        return new Response("Bad Request: slugs array required", {
          status: 400,
        });
      }
      const result = await ctx.runMutation(
        internal.auth.testHelpers.cleanupTestArticleCoverMedia,
        { email, slugs },
      );
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  });

  http.route({
    path: "/test/cleanup-storage",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
      const deny = authorizeTestRequest(req);
      if (deny) return deny;
      const body = (await req.json()) as {
        email?: unknown;
        olderThanMs?: unknown;
        dryRun?: unknown;
        includeTestArticleCoverMedia?: unknown;
        maxStorageRows?: unknown;
        maxArticles?: unknown;
      };
      if (typeof body.email !== "string" || body.email.length === 0) {
        return new Response("Bad Request: email required", { status: 400 });
      }
      if (
        typeof body.olderThanMs !== "number" ||
        !Number.isFinite(body.olderThanMs) ||
        body.olderThanMs < 0
      ) {
        return new Response(
          "Bad Request: olderThanMs must be a non-negative number",
          { status: 400 },
        );
      }
      if (typeof body.dryRun !== "boolean") {
        return new Response("Bad Request: dryRun boolean required", {
          status: 400,
        });
      }
      if (typeof body.includeTestArticleCoverMedia !== "boolean") {
        return new Response(
          "Bad Request: includeTestArticleCoverMedia boolean required",
          { status: 400 },
        );
      }
      if (
        body.maxStorageRows !== undefined &&
        typeof body.maxStorageRows !== "number"
      ) {
        return new Response("Bad Request: maxStorageRows must be a number", {
          status: 400,
        });
      }
      if (
        body.maxArticles !== undefined &&
        typeof body.maxArticles !== "number"
      ) {
        return new Response("Bad Request: maxArticles must be a number", {
          status: 400,
        });
      }

      const result = await ctx.runMutation(
        internal.auth.testHelpers.cleanupTestStorage,
        {
          email: body.email,
          olderThanMs: body.olderThanMs,
          dryRun: body.dryRun,
          includeTestArticleCoverMedia: body.includeTestArticleCoverMedia,
          ...(body.maxStorageRows !== undefined
            ? { maxStorageRows: body.maxStorageRows }
            : {}),
          ...(body.maxArticles !== undefined
            ? { maxArticles: body.maxArticles }
            : {}),
        },
      );
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  });
}

export default http;
