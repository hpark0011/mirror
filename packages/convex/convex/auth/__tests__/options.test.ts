import { describe, expect, it } from "vitest";
import {
  isOAuthProxyEnabled,
  parseCsv,
  resolveAuthBaseURL,
  resolveOAuthProxyPlugins,
  resolveRouteTrustedOrigins,
  resolveTrustedOrigins,
} from "../options";

describe("auth/options", () => {
  it("parses comma-separated env lists with trimming", () => {
    expect(parseCsv(" localhost:* , , 127.0.0.1:* ")).toEqual([
      "localhost:*",
      "127.0.0.1:*",
    ]);
  });

  it("keeps production-only deployments on a static base URL", () => {
    const baseURL = resolveAuthBaseURL({
      SITE_URL: "https://greymirror.ai",
      AUTH_ALLOWED_HOSTS: undefined,
    });

    expect(baseURL).toBe("https://greymirror.ai");
    expect(resolveTrustedOrigins(baseURL, "https://greymirror.ai")).toEqual([
      "https://greymirror.ai",
    ]);
  });

  it("uses dynamic base URL for configured allowed hosts", () => {
    const baseURL = resolveAuthBaseURL({
      SITE_URL: "https://greymirror.ai",
      AUTH_ALLOWED_HOSTS: "localhost:*,127.0.0.1:*,*.vercel.app",
    });

    expect(baseURL).toEqual({
      allowedHosts: [
        "localhost:*",
        "127.0.0.1:*",
        "*.vercel.app",
        "greymirror.ai",
      ],
      fallback: "https://greymirror.ai",
      protocol: "auto",
    });
    expect(
      resolveTrustedOrigins(baseURL, "https://greymirror.ai"),
    ).toBeUndefined();
  });

  it("uses dynamic base URL automatically when SITE_URL is localhost", () => {
    expect(
      resolveAuthBaseURL({
        SITE_URL: "http://localhost:3350",
        AUTH_ALLOWED_HOSTS: undefined,
      }),
    ).toEqual({
      allowedHosts: ["localhost:*", "127.0.0.1:*", "localhost:3350"],
      fallback: "http://localhost:3350",
      protocol: "http",
    });
  });

  it("resolves route trusted origins for worktree localhost ports", () => {
    const trustedOrigins = resolveRouteTrustedOrigins({
      SITE_URL: "http://localhost:3547",
      AUTH_ALLOWED_HOSTS: "localhost:*,127.0.0.1:*",
    });

    expect(
      trustedOrigins(
        new Request("https://example.convex.site/api/auth/session", {
          headers: { origin: "http://localhost:3548" },
        }),
      ),
    ).toEqual(["http://localhost:3548", "http://localhost:3547"]);
  });

  it("falls back to SITE_URL when the request origin is not allowed", () => {
    const trustedOrigins = resolveRouteTrustedOrigins({
      SITE_URL: "http://localhost:3547",
      AUTH_ALLOWED_HOSTS: "localhost:*,127.0.0.1:*",
    });

    expect(
      trustedOrigins(
        new Request("https://example.convex.site/api/auth/session", {
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toEqual(["http://localhost:3547"]);
  });

  it("treats common truthy strings as OAuth proxy enabled", () => {
    expect(isOAuthProxyEnabled("true")).toBe(true);
    expect(isOAuthProxyEnabled("1")).toBe(true);
    expect(isOAuthProxyEnabled("yes")).toBe(true);
    expect(isOAuthProxyEnabled("on")).toBe(true);
    expect(isOAuthProxyEnabled("false")).toBe(false);
    expect(isOAuthProxyEnabled(undefined)).toBe(false);
  });

  it("omits OAuth proxy plugin unless explicitly enabled", () => {
    expect(
      resolveOAuthProxyPlugins({
        SITE_URL: "http://localhost:3350",
        OAUTH_PROXY_ENABLED: undefined,
        OAUTH_PROXY_PRODUCTION_URL: undefined,
        OAUTH_PROXY_SECRET: undefined,
      }),
    ).toEqual([]);
  });

  it("fails fast when OAuth proxy is enabled without a production URL", () => {
    expect(() =>
      resolveOAuthProxyPlugins({
        SITE_URL: "http://localhost:3350",
        OAUTH_PROXY_ENABLED: "true",
        OAUTH_PROXY_PRODUCTION_URL: undefined,
        OAUTH_PROXY_SECRET: undefined,
      }),
    ).toThrow(/OAUTH_PROXY_PRODUCTION_URL/);
  });

  it("passes currentURL from SITE_URL into the OAuth proxy plugin", () => {
    const [plugin] = resolveOAuthProxyPlugins({
      SITE_URL: "http://localhost:3350",
      OAUTH_PROXY_ENABLED: "true",
      OAUTH_PROXY_PRODUCTION_URL: "https://greymirror.ai",
      OAUTH_PROXY_SECRET: "proxy-secret",
    });

    expect(plugin.id).toBe("oauth-proxy");
    expect(plugin.options).toMatchObject({
      currentURL: "http://localhost:3350",
      productionURL: "https://greymirror.ai",
      secret: "proxy-secret",
    });
  });
});
