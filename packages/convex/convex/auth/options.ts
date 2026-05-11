import { oAuthProxy } from "better-auth/plugins";
import { type BetterAuthOptions } from "better-auth";
import { type Env } from "../env";

type AuthBaseURL = NonNullable<BetterAuthOptions["baseURL"]>;
type AuthPlugin = NonNullable<BetterAuthOptions["plugins"]>[number];
type AuthProtocol = "http" | "https" | "auto";

const LOCAL_ALLOWED_HOSTS = ["localhost:*", "127.0.0.1:*"] as const;

export function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function siteUrlHost(siteUrl: string): string {
  return new URL(siteUrl).host;
}

function isLocalSiteUrl(siteUrl: string): boolean {
  const hostname = new URL(siteUrl).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function authProtocolFor(siteUrl: string): AuthProtocol {
  return isLocalSiteUrl(siteUrl) ? "http" : "auto";
}

function allowedHostPatternsFor(
  env: Pick<Env, "SITE_URL" | "AUTH_ALLOWED_HOSTS">,
): string[] {
  const configuredHosts = parseCsv(env.AUTH_ALLOWED_HOSTS);
  if (configuredHosts.length > 0) {
    return unique([...configuredHosts, siteUrlHost(env.SITE_URL)]);
  }

  if (isLocalSiteUrl(env.SITE_URL)) {
    return unique([...LOCAL_ALLOWED_HOSTS, siteUrlHost(env.SITE_URL)]);
  }

  return [siteUrlHost(env.SITE_URL)];
}

function originMatchesAllowedHost(origin: string, patterns: string[]): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  return patterns.some((pattern) => {
    const hostSource = pattern.includes("://")
      ? (pattern.split("://", 2)[1] ?? "")
      : pattern;
    const hostPattern = hostSource.split(/[/?#]/, 1)[0] ?? "";
    if (hostPattern === url.host || hostPattern === url.hostname) {
      return true;
    }
    if (hostPattern.endsWith(":*")) {
      return url.hostname === hostPattern.slice(0, -2);
    }
    if (hostPattern.startsWith("*.")) {
      const root = hostPattern.slice(2);
      return url.hostname === root || url.hostname.endsWith(`.${root}`);
    }
    return false;
  });
}

export function resolveAuthBaseURL(
  env: Pick<Env, "SITE_URL" | "AUTH_ALLOWED_HOSTS">,
): AuthBaseURL {
  if (
    parseCsv(env.AUTH_ALLOWED_HOSTS).length > 0 ||
    isLocalSiteUrl(env.SITE_URL)
  ) {
    return {
      allowedHosts: allowedHostPatternsFor(env),
      fallback: env.SITE_URL,
      protocol: authProtocolFor(env.SITE_URL),
    };
  }

  return env.SITE_URL;
}

export function resolveTrustedOrigins(
  baseURL: AuthBaseURL,
  siteUrl: string,
): string[] | undefined {
  if (typeof baseURL !== "string") {
    return undefined;
  }
  return [siteUrl];
}

export function resolveRouteTrustedOrigins(
  env: Pick<Env, "SITE_URL" | "AUTH_ALLOWED_HOSTS">,
): (request?: Request) => string[] {
  const fallbackOrigin = new URL(env.SITE_URL).origin;
  const allowedHostPatterns = allowedHostPatternsFor(env);

  return (request?: Request) => {
    const requestOrigin = request?.headers.get("origin");
    if (
      requestOrigin &&
      originMatchesAllowedHost(requestOrigin, allowedHostPatterns)
    ) {
      return unique([requestOrigin, fallbackOrigin]);
    }
    return [fallbackOrigin];
  };
}

export function isOAuthProxyEnabled(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(value?.toLowerCase() ?? "");
}

export function resolveOAuthProxyPlugins(
  env: Pick<
    Env,
    | "SITE_URL"
    | "OAUTH_PROXY_ENABLED"
    | "OAUTH_PROXY_PRODUCTION_URL"
    | "OAUTH_PROXY_SECRET"
  >,
): AuthPlugin[] {
  if (!isOAuthProxyEnabled(env.OAUTH_PROXY_ENABLED)) {
    return [];
  }

  if (!env.OAUTH_PROXY_PRODUCTION_URL) {
    throw new Error(
      "OAUTH_PROXY_PRODUCTION_URL is required when OAUTH_PROXY_ENABLED is true.",
    );
  }

  return [
    oAuthProxy({
      currentURL: env.SITE_URL,
      productionURL: env.OAUTH_PROXY_PRODUCTION_URL,
      ...(env.OAUTH_PROXY_SECRET ? { secret: env.OAUTH_PROXY_SECRET } : {}),
    }),
  ];
}
