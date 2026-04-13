import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent, createAuth } from "./auth/client";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

const TEST_EMAIL_SUFFIX = "@mirror.test";

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
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }
  const secret = process.env.PLAYWRIGHT_TEST_SECRET;
  const header = req.headers.get("x-test-secret");
  if (!secret || !header || !secretsMatch(header, secret)) {
    return new Response("Forbidden", { status: 403 });
  }
  return null;
}

// Test-only routes: registered only outside production. Even if reached,
// every handler re-checks authorizeTestRequest for defense-in-depth.
if (process.env.NODE_ENV !== "production") {
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
}

export default http;
