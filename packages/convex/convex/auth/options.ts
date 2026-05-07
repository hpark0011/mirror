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

export function resolveAuthBaseURL(
  env: Pick<Env, "SITE_URL" | "AUTH_ALLOWED_HOSTS">,
): AuthBaseURL {
  const configuredHosts = parseCsv(env.AUTH_ALLOWED_HOSTS);

  if (configuredHosts.length > 0) {
    return {
      allowedHosts: unique([...configuredHosts, siteUrlHost(env.SITE_URL)]),
      fallback: env.SITE_URL,
      protocol: authProtocolFor(env.SITE_URL),
    };
  }

  if (isLocalSiteUrl(env.SITE_URL)) {
    return {
      allowedHosts: unique([...LOCAL_ALLOWED_HOSTS, siteUrlHost(env.SITE_URL)]),
      fallback: env.SITE_URL,
      protocol: "http",
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
