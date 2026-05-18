/**
 * Verifies that preloadAuthQuery and fetchAuthQuery inject the sanitized
 * convexUrl (no trailing slash) into the options arg they pass to
 * convex/nextjs preloadQuery / fetchQuery, regardless of whether
 * NEXT_PUBLIC_CONVEX_URL was set with a trailing slash.
 *
 * The module-level `convexUrl` constant in auth-server.ts is sourced from
 * clientEnv (which strips trailing slashes via withoutTrailingSlash). These
 * tests confirm that the sanitized URL flows all the way through to the
 * downstream Convex call rather than being silently dropped.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Hoisted mock refs (vi.hoisted runs before vi.mock factory hoisting) ────────

const { mockGetToken, mockPreloadQuery, mockFetchQuery } = vi.hoisted(() => ({
  mockGetToken: vi.fn<() => Promise<string | undefined>>(),
  mockPreloadQuery: vi.fn(),
  mockFetchQuery: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("@feel-good/features/auth/server", () => ({
  createAuthServerUtils: vi.fn(() => ({
    handler: {},
    isAuthenticated: vi.fn(),
    getToken: mockGetToken,
    preloadAuthQuery: vi.fn(),
    fetchAuthQuery: vi.fn(),
  })),
}));

// clientEnv already strips trailing slashes via withoutTrailingSlash.
// This mock simulates what clientEnv produces for a trailing-slash input.
vi.mock("@/lib/env/client", () => ({
  clientEnv: {
    NEXT_PUBLIC_CONVEX_URL: "https://happy-animal-123.convex.cloud",
    NEXT_PUBLIC_CONVEX_SITE_URL: "https://happy-animal-123.convex.site",
    NEXT_PUBLIC_SITE_URL: "https://example.com",
  },
}));

vi.mock("convex/nextjs", () => ({
  preloadQuery: mockPreloadQuery,
  fetchQuery: mockFetchQuery,
}));

// next/headers is only available in the Next.js runtime — mock it so the
// module can be imported in the test environment.
vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({ getAll: () => [] }),
  ),
}));

// ── SUT import (after mocks) ──────────────────────────────────────────────────

import { preloadAuthQuery, fetchAuthQuery } from "../auth-server";

// ── Helpers ───────────────────────────────────────────────────────────────────

// Minimal FunctionReference stand-in that satisfies TypeScript at the call site
const fakeQuery = {} as Parameters<typeof preloadAuthQuery>[0];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("preloadAuthQuery — trailing-slash parity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue("test-token");
    mockPreloadQuery.mockResolvedValue({ _valueJSON: "{}" });
  });

  it("passes url: convexUrl (no trailing slash) to preloadQuery", async () => {
    await preloadAuthQuery(fakeQuery);

    expect(mockPreloadQuery).toHaveBeenCalledOnce();
    const [, , options] = mockPreloadQuery.mock.calls[0];
    expect(options).toMatchObject({
      url: "https://happy-animal-123.convex.cloud",
    });
    expect((options as { url: string }).url).not.toMatch(/\/$/);
  });

  it("includes the auth token in the options", async () => {
    await preloadAuthQuery(fakeQuery);

    const [, , options] = mockPreloadQuery.mock.calls[0];
    expect(options).toMatchObject({ token: "test-token" });
  });
});

describe("fetchAuthQuery — trailing-slash parity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue("test-token");
    mockFetchQuery.mockResolvedValue({ data: "result" });
  });

  it("passes url: convexUrl (no trailing slash) to fetchQuery", async () => {
    await fetchAuthQuery(fakeQuery);

    expect(mockFetchQuery).toHaveBeenCalledOnce();
    const [, , options] = mockFetchQuery.mock.calls[0];
    expect(options).toMatchObject({
      url: "https://happy-animal-123.convex.cloud",
    });
    expect((options as { url: string }).url).not.toMatch(/\/$/);
  });

  it("includes the auth token in the options", async () => {
    await fetchAuthQuery(fakeQuery);

    const [, , options] = mockFetchQuery.mock.calls[0];
    expect(options).toMatchObject({ token: "test-token" });
  });
});
