import { describe, expect, it } from "vitest";
import { resolveServerEnv } from "../server-core";

describe("resolveServerEnv", () => {
  it("prefers Convex's injected site URL over legacy public env", () => {
    expect(
      resolveServerEnv({
        NEXT_PUBLIC_CONVEX_URL: "https://fresh.convex.cloud",
        CONVEX_SITE_URL: "https://fresh.convex.site/",
        NEXT_PUBLIC_CONVEX_SITE_URL: "https://stale.convex.site",
        TAVUS_API_KEY: "tavus-api-key",
      }),
    ).toEqual({
      NEXT_PUBLIC_CONVEX_URL: "https://fresh.convex.cloud",
      CONVEX_SITE_URL: "https://fresh.convex.site",
      TAVUS_API_KEY: "tavus-api-key",
      TAVUS_PERSONA_ID: "p2679f6eae3f",
    });
  });

  it("derives the Convex site URL from the current Convex cloud URL", () => {
    expect(
      resolveServerEnv({
        NEXT_PUBLIC_CONVEX_URL: "https://fresh.convex.cloud",
        NEXT_PUBLIC_CONVEX_SITE_URL: "https://stale.convex.site",
        TAVUS_API_KEY: "tavus-api-key",
      }).CONVEX_SITE_URL,
    ).toBe("https://fresh.convex.site");
  });

  it("falls back to the legacy public Convex site URL for local env files", () => {
    expect(
      resolveServerEnv({
        NEXT_PUBLIC_CONVEX_URL: "https://local.convex.cloud",
        NEXT_PUBLIC_CONVEX_SITE_URL: "https://local.convex.site/",
        TAVUS_API_KEY: "tavus-api-key",
      }).CONVEX_SITE_URL,
    ).toBe("https://local.convex.site");
  });
});
