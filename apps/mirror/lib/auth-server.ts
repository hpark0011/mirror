import { createAuthServerUtils } from "@feel-good/features/auth/server";
import { preloadQuery, fetchQuery } from "convex/nextjs";
import { cookies } from "next/headers";
import { type FunctionReference, type FunctionReturnType } from "convex/server";
import { type Preloaded } from "convex/react";
import { clientEnv } from "./env/client";

const convexUrl = clientEnv.NEXT_PUBLIC_CONVEX_URL;

const authServerUtils = createAuthServerUtils({
  convexUrl,
  convexSiteUrl: clientEnv.NEXT_PUBLIC_CONVEX_SITE_URL,
});

export const { handler, isAuthenticated, getToken } = authServerUtils;

/**
 * Preloads an authenticated Convex query for use with usePreloadedQuery.
 * Injects the sanitized convexUrl so a trailing-slash NEXT_PUBLIC_CONVEX_URL
 * never reaches the raw process.env read inside convex/nextjs.
 */
export async function preloadAuthQuery<Query extends FunctionReference<"query">>(
  query: Query,
  ...args: Query["_args"] extends Record<string, never>
    ? [args?: Query["_args"]]
    : [args: Query["_args"]]
): Promise<Preloaded<Query>> {
  const token = await getToken();
  return preloadQuery(query, args[0] as Query["_args"], {
    token,
    url: convexUrl,
  });
}

/**
 * Fetches the result of an authenticated Convex query in a Server Component.
 * Injects the sanitized convexUrl so a trailing-slash NEXT_PUBLIC_CONVEX_URL
 * never reaches the raw process.env read inside convex/nextjs.
 */
export async function fetchAuthQuery<Query extends FunctionReference<"query">>(
  query: Query,
  ...args: Query["_args"] extends Record<string, never>
    ? [args?: Query["_args"]]
    : [args: Query["_args"]]
): Promise<FunctionReturnType<Query>> {
  const token = await getToken();
  return fetchQuery(query, args[0] as Query["_args"], {
    token,
    url: convexUrl,
  });
}

// Skips the Convex auth-token round-trip when there is no Better Auth session
// cookie. Use for queries that return authenticated-only fields (e.g. drafts)
// but also render meaningfully for anonymous visitors — the query itself must
// handle the no-auth case. Saves ~300-500ms on public-profile first paint.
async function hasBetterAuthSession(): Promise<boolean> {
  const store = await cookies();
  return store
    .getAll()
    .some(
      (c) => c.name.includes("better-auth") && c.name.includes("session_token"),
    );
}

export async function preloadAuthOptionalQuery<
  Query extends FunctionReference<"query">,
>(
  query: Query,
  ...args: Query["_args"] extends Record<string, never>
    ? [args?: Query["_args"]]
    : [args: Query["_args"]]
): Promise<Preloaded<Query>> {
  const hasSession = await hasBetterAuthSession();
  const token = hasSession ? await getToken() : undefined;
  // Always pass args[0] + options explicitly so Convex distinguishes the two
  // slots for zero-arg queries. preloadQuery's signature is
  // preloadQuery(query, args?, options?) — collapsing to two positional args
  // (query, { token }) would make Convex read the token object as query args.
  return preloadQuery(
    query,
    args[0] as Query["_args"],
    { token, url: convexUrl },
  );
}
