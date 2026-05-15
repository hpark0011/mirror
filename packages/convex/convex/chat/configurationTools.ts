"use node";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { z } from "zod";

// Undici is loaded lazily inside guardedFetchProfileSource. Its module-load
// path runs `new CacheStorage()` at the top of `undici/index.js`, which calls
// `util.markAsUncloneable` — a Node 21+ API absent from the sandbox Convex
// uses to analyze pushed modules at deploy time. Static `import "undici"`
// here would fail deploy analysis even though the action's runtime has the
// API at request time. The dynamic import inside the function defers
// evaluation past the deploy-time analyzer.
type UndiciModule = typeof import("undici");
let undiciModulePromise: Promise<UndiciModule> | null = null;
async function loadUndici(): Promise<UndiciModule> {
  if (!undiciModulePromise) undiciModulePromise = import("undici");
  return undiciModulePromise;
}
import { createTool } from "@convex-dev/agent";
import { internal } from "../_generated/api";
import { type Id } from "../_generated/dataModel";
import { CONTACT_ENTRY_KIND_VALUES } from "../contacts/schema";
import {
  detectContactKind,
  type DetectedContactKind,
} from "../contacts/detectContactKind";
import { NAVIGABLE_CONTENT_KINDS } from "../content/sourceRegistry";
import { chatRateLimiter } from "./rateLimits";

const PROFILE_SOURCE_MAX_REDIRECTS = 3;
const PROFILE_SOURCE_MAX_BYTES = 1024 * 1024;
const PROFILE_SOURCE_MAX_TEXT_CHARS = 12000;
const PROFILE_SOURCE_TIMEOUT_MS = 5000;
const PROFILE_SOURCE_USER_AGENT =
  "MirrorProfileConfigurationHelper/1.0 (+https://mirror.feel-good.local)";

// Expected failure modes of the fetcher. The catch in
// guardedFetchProfileSource only converts FetchSourceError to an
// `unavailable` result; any other thrown error (e.g. a programming bug
// introduced by a future refactor) propagates and surfaces in logs / Sentry
// rather than masquerading as a graceful "unavailable" response.
export type ProfileSourceFailureCategory =
  | "non_https"
  | "non_https_redirect"
  | "blocked_hostname"
  | "dns_unresolvable"
  | "blocked_ip"
  | "timeout"
  | "redirect_cap"
  | "redirect_missing_location"
  | "body_size"
  | "content_type";

export class FetchSourceError extends Error {
  readonly category: ProfileSourceFailureCategory;
  constructor(message: string, category: ProfileSourceFailureCategory) {
    super(message);
    this.name = "FetchSourceError";
    this.category = category;
  }
}

// Build an Undici Agent whose connect callback always dials the pre-validated IP
// rather than re-resolving the hostname. The hostname is kept in the URL so TLS
// SNI and certificate validation still reference the original name.
// family must be 4 (IPv4) or 6 (IPv6) — isIP() returns those values.
function pinnedDispatcher(
  undici: UndiciModule,
  validatedIp: string,
  family: 4 | 6,
): UndiciModule["Agent"]["prototype"] {
  return new undici.Agent({
    connect: {
      lookup: (
        _hostname: string,
        _opts: unknown,
        cb: (err: Error | null, address: string, family: number) => void,
      ) => cb(null, validatedIp, family),
    },
  });
}

const CONTACT_KIND_ENUM_VALUES = CONTACT_ENTRY_KIND_VALUES as unknown as [
  DetectedContactKind,
  ...DetectedContactKind[],
];
const BIO_ENTRY_KIND_ENUM_VALUES = ["work", "education"] as const;

const monthDateSchema = z.object({
  year: z.number().int().min(1900).max(3000),
  month: z.number().int().min(1).max(12).optional(),
});

const bioOperationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    kind: z.enum(BIO_ENTRY_KIND_ENUM_VALUES),
    title: z.string().min(1),
    startDate: monthDateSchema,
    endDate: z.union([monthDateSchema, z.null()]),
    description: z.string().optional(),
    link: z.string().optional(),
  }),
  z.object({
    action: z.literal("update"),
    id: z.string().min(1),
    kind: z.enum(BIO_ENTRY_KIND_ENUM_VALUES).optional(),
    title: z.string().min(1).optional(),
    startDate: monthDateSchema.optional(),
    endDate: z.union([monthDateSchema, z.null()]).optional(),
    description: z.string().optional(),
    link: z.string().optional(),
  }),
  z.object({
    action: z.literal("delete"),
    id: z.string().min(1),
  }),
]);

const contactOperationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set"),
    kind: z.enum(CONTACT_KIND_ENUM_VALUES),
    value: z.string().min(1),
  }),
  z.object({
    action: z.literal("delete"),
    kind: z.enum(CONTACT_KIND_ENUM_VALUES),
  }),
]);

const projectCoverOperationSchema = z
  .enum(["uploaded", "remove"])
  .describe(
    "Use 'uploaded' to use the image attached to the current owner message as the cover, or 'remove' to delete the existing cover.",
  );

const projectOperationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    title: z.string().min(1),
    startDate: monthDateSchema,
    endDate: z.union([monthDateSchema, z.null()]),
    description: z.string().optional(),
    link: z.string().optional(),
    coverImage: z.literal("uploaded").optional(),
  }),
  z.object({
    action: z.literal("update"),
    id: z.string().min(1),
    title: z.string().min(1).optional(),
    startDate: monthDateSchema.optional(),
    endDate: z.union([monthDateSchema, z.null()]).optional(),
    description: z.string().optional(),
    link: z.string().optional(),
    coverImage: projectCoverOperationSchema.optional(),
  }),
  z.object({
    action: z.literal("delete"),
    id: z.string().min(1),
  }),
]);

// PLAN_013: agent-visible content schemas.
//
// LLM-visible types are intentionally a strict subset of the editor's
// Tiptap node universe — text-only blocks (paragraph, heading at level
// 2 or 3, bulletList of strings). Server-side `agentBlocksToTiptapDoc`
// turns these into editor JSON before the row is written. The agent
// CANNOT supply raw Tiptap JSON; it CANNOT supply image, embed, cover
// image, cover video, or any storageId reference. See plan, Constraints.
const NAVIGABLE_CONTENT_KIND_ENUM_VALUES = NAVIGABLE_CONTENT_KINDS as unknown as [
  "posts" | "articles",
  ...Array<"posts" | "articles">,
];

const agentContentBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("paragraph"),
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal("heading"),
    level: z.union([z.literal(2), z.literal(3)]),
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal("bulletList"),
    items: z.array(z.string().min(1)).min(1),
  }),
]);

const contentOperationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    kind: z.enum(NAVIGABLE_CONTENT_KIND_ENUM_VALUES),
    title: z.string().min(1),
    slug: z.string().min(1).optional(),
    category: z.string().min(1),
    status: z.enum(["draft", "published"]).optional(),
    bodyBlocks: z.array(agentContentBlockSchema),
  }),
  z.object({
    action: z.literal("update"),
    kind: z.enum(NAVIGABLE_CONTENT_KIND_ENUM_VALUES),
    slug: z.string().min(1),
    title: z.string().min(1).optional(),
    newSlug: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
    status: z.enum(["draft", "published"]).optional(),
    bodyBlocks: z.array(agentContentBlockSchema).min(1).optional(),
  }),
  z.object({
    action: z.literal("delete"),
    kind: z.enum(NAVIGABLE_CONTENT_KIND_ENUM_VALUES),
    slug: z.string().min(1),
  }),
]);

type BuildConfigurationToolsOptions = {
  viewerId?: Id<"users">;
  conversationId: Id<"conversations">;
  latestImageAttachment?: {
    storageId: Id<"_storage">;
    thumbhash?: string;
  };
};

function assertOwnerWriteAllowed(
  profileOwnerId: Id<"users">,
  viewerId: Id<"users"> | undefined,
) {
  if (viewerId !== profileOwnerId) {
    throw new Error("Only the profile owner can configure this profile.");
  }
}

// URL-embedded userinfo (`https://user:pass@host`) is serialized as an
// `Authorization: Basic ...` header by fetch(). Strip credentials before every
// fetch call so an attacker-controlled redirect Location header cannot inject
// credentials into a follow-up request to a different target.
function stripUrlUserinfo(url: URL): URL {
  url.username = "";
  url.password = "";
  return url;
}

export function isBlockedHostname(hostname: string): boolean {
  const lowered = hostname.toLowerCase();
  return lowered === "localhost" || lowered.endsWith(".localhost");
}

export function isBlockedIp(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const parts = address.split(".").map((part) => Number.parseInt(part, 10));
    const [a, b] = parts;
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      // RFC 6598 Shared Address Space (CGNAT): 100.64.0.0/10
      (a === 100 && b >= 64 && b <= 127) ||
      a === 0 ||
      a >= 224
    );
  }

  if (family === 6) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith("::ffff:")) {
      const mapped = normalized.slice("::ffff:".length);
      // RFC 4291 §2.5.5.2 dotted-decimal form: ::ffff:127.0.0.1
      if (isIP(mapped) === 4) {
        return isBlockedIp(mapped);
      }
      // RFC 4291 §2.5.5.2 hex-group form: ::ffff:7f00:0001 (== 127.0.0.1)
      const hexGroups = mapped.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
      if (hexGroups) {
        const high = Number.parseInt(hexGroups[1], 16);
        const low = Number.parseInt(hexGroups[2], 16);
        const dotted = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
        if (isIP(dotted) === 4) {
          return isBlockedIp(dotted);
        }
      }
    }
    return (
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb") ||
      normalized === "::" ||
      normalized.startsWith("ff")
    );
  }

  return true;
}

function remainingMs(deadline: number): number {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    throw new FetchSourceError("Profile source fetch timed out", "timeout");
  }
  return remaining;
}

async function withDeadline<T>(
  promise: Promise<T>,
  deadline: number,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new FetchSourceError(
                "Profile source fetch timed out",
                "timeout",
              ),
            ),
          remainingMs(deadline),
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

// Returns the first resolved IP address so the caller can pin the TCP
// connection to that exact IP, closing the DNS-rebind SSRF window.
// The returned address is guaranteed to pass isBlockedIp at this point in
// time; the caller MUST use it immediately as the connect target and MUST
// re-call this function on every redirect hop.
async function assertPublicHostnameBeforeDeadline(
  hostname: string,
  deadline: number,
): Promise<{ address: string; family: 4 | 6 }> {
  if (isBlockedHostname(hostname)) {
    throw new FetchSourceError(
      "Host is not publicly fetchable",
      "blocked_hostname",
    );
  }

  const records = await withDeadline(
    lookup(hostname, { all: true, verbatim: true }),
    deadline,
  );
  if (records.length === 0) {
    throw new FetchSourceError("Host could not be resolved", "dns_unresolvable");
  }
  if (records.some((record) => isBlockedIp(record.address))) {
    throw new FetchSourceError(
      "Host resolves to a blocked network address",
      "blocked_ip",
    );
  }
  // Return the first record. All records passed the blocklist check above.
  // Pinning to the first record is sufficient — the dispatcher uses it for
  // every connection attempt, so no second resolution ever occurs.
  const first = records[0];
  return { address: first.address, family: first.family as 4 | 6 };
}

async function readLimitedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return await response.text();

  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    received += value.byteLength;
    if (received > PROFILE_SOURCE_MAX_BYTES) {
      await reader.cancel();
      throw new FetchSourceError("Response body is too large", "body_size");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function extractText(raw: string, contentType: string): string {
  const text =
    contentType === "text/html"
      ? raw
          .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
          .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ")
      : raw;

  return text
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, PROFILE_SOURCE_MAX_TEXT_CHARS);
}

export async function guardedFetchProfileSource(url: string) {
  let current = stripUrlUserinfo(new URL(url));
  const startedAt = Date.now();
  const hostname = current.hostname;

  console.log({ event: "fetchProfileSource:start", hostname });

  if (current.protocol !== "https:") {
    const latencyMs = Date.now() - startedAt;
    console.log({
      event: "fetchProfileSource:complete",
      hostname,
      status: "unavailable",
      failureCategory: "non_https",
      latencyMs,
    });
    throw new FetchSourceError(
      "Only https:// URLs can be fetched",
      "non_https",
    );
  }

  // Lazy-load undici so the deploy-time analyzer (which evaluates module
  // top-level code in a sandbox lacking Node 21+ APIs like
  // util.markAsUncloneable) never has to load it. Once at the function
  // entry, then reused on every redirect hop.
  const undici = await loadUndici();

  const deadline = startedAt + PROFILE_SOURCE_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    PROFILE_SOURCE_TIMEOUT_MS,
  );

  try {
    for (let hop = 0; hop <= PROFILE_SOURCE_MAX_REDIRECTS; hop++) {
      if (current.protocol !== "https:") {
        throw new FetchSourceError(
          "Redirected to a non-HTTPS URL",
          "non_https_redirect",
        );
      }
      // Re-validate on every hop and pin the connection to the validated IP.
      // Using the validated IP in the Undici dispatcher's connect callback
      // means no second DNS resolution can occur between the safety check
      // and the actual TCP connection, closing the DNS-rebind SSRF window.
      const validated = await assertPublicHostnameBeforeDeadline(
        current.hostname,
        deadline,
      );
      remainingMs(deadline);

      const dispatcher = pinnedDispatcher(
        undici,
        validated.address,
        validated.family,
      );
      // undici's Response and the global Response are structurally identical
      // at runtime, but their TypeScript types diverge under lib.dom-aware
      // configs (e.g. Next.js's build tsconfig pulls in DOM lib types whose
      // HeadersIterator carries `[Symbol.dispose]`, which undici's
      // SpecIterableIterator does not). Convex's own tsconfig does not pull
      // in lib.dom and accepts a direct `as Response` cast, but Next.js
      // rejects it with TS2352. `as unknown as Response` is the documented
      // escape hatch the compiler itself suggests.
      const response = (await undici.fetch(current.toString(), {
        dispatcher,
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": PROFILE_SOURCE_USER_AGENT,
          Accept: "text/html,text/plain,application/json",
        },
      })) as unknown as Response;

      if (response.status >= 300 && response.status < 400) {
        response.body?.cancel().catch(() => {});
        if (hop === PROFILE_SOURCE_MAX_REDIRECTS) {
          throw new FetchSourceError("Too many redirects", "redirect_cap");
        }
        const location = response.headers.get("location");
        if (!location) {
          throw new FetchSourceError(
            "Redirect missing location",
            "redirect_missing_location",
          );
        }
        current = stripUrlUserinfo(new URL(location, current));
        continue;
      }

      if (!response.ok) {
        response.body?.cancel().catch(() => {});
        const latencyMs = Date.now() - startedAt;
        console.log({
          event: "fetchProfileSource:complete",
          hostname,
          status: "unavailable",
          httpStatus: response.status,
          contentType: null,
          latencyMs,
        });
        return {
          status: "unavailable" as const,
          reason: `HTTP ${response.status}`,
          finalUrl: current.toString(),
          detectedKind: detectContactKind(current.toString()),
        };
      }

      const contentType = (response.headers.get("content-type") ?? "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      if (
        contentType !== "text/html" &&
        contentType !== "text/plain" &&
        contentType !== "application/json"
      ) {
        response.body?.cancel().catch(() => {});
        throw new FetchSourceError(
          "Unsupported content type",
          "content_type",
        );
      }

      const raw = await readLimitedText(response);
      const latencyMs = Date.now() - startedAt;
      console.log({
        event: "fetchProfileSource:complete",
        hostname,
        status: "available",
        httpStatus: response.status,
        contentType,
        latencyMs,
      });
      return {
        status: "available" as const,
        finalUrl: current.toString(),
        detectedKind: detectContactKind(current.toString()),
        contentType,
        text: extractText(raw, contentType),
      };
    }
  } catch (error) {
    // FetchSourceError is an EXPECTED failure mode the LLM is prompted to
    // handle (it asks the owner to paste text). Anything else — a TypeError,
    // a null deref from a refactor, a Convex runtime fault — must propagate
    // so on-call sees it in logs/Sentry rather than the LLM silently
    // swallowing the bug as a graceful "unavailable" response.
    if (!(error instanceof FetchSourceError)) {
      // AbortController firing mid-stream surfaces as a generic abort error
      // from the fetch/body reader rather than as a FetchSourceError("timeout").
      // Normalize that single case so the LLM's recovery path still triggers.
      const isAbort =
        error instanceof Error &&
        (error.name === "AbortError" || /abort/i.test(error.message));
      if (!isAbort) throw error;
      const latencyMs = Date.now() - startedAt;
      console.log({
        event: "fetchProfileSource:complete",
        hostname,
        status: "unavailable",
        failureCategory: "abort",
        latencyMs,
      });
      return {
        status: "unavailable" as const,
        reason: "Profile source fetch timed out",
        finalUrl: current.toString(),
        detectedKind: detectContactKind(current.toString()),
      };
    }
    const latencyMs = Date.now() - startedAt;
    console.log({
      event: "fetchProfileSource:complete",
      hostname,
      status: "unavailable",
      failureCategory: error.category,
      latencyMs,
    });
    return {
      status: "unavailable" as const,
      reason: error.message,
      finalUrl: current.toString(),
      detectedKind: detectContactKind(current.toString()),
    };
  } finally {
    clearTimeout(timeout);
  }

  // Unreachable: every loop iteration either returns or throws, and the catch
  // converts every FetchSourceError throw to a return. The throw documents
  // intent so a future refactor that adds a fall-through `continue` surfaces
  // as a clear failure rather than a silent generic "Unable to fetch source"
  // response.
  throw new Error(
    "guardedFetchProfileSource exited the redirect loop without returning",
  );
}

async function enforceFetchLimit(
  ctx: Parameters<typeof chatRateLimiter.limit>[0],
  profileOwnerId: Id<"users">,
  conversationId: Id<"conversations">,
) {
  // Check the daily owner cap FIRST. Each chatRateLimiter.limit call is a
  // separate cross-call mutation in an action context, so a successful
  // minute-check consumes a token even when the subsequent daily-check
  // rejects. Inverting the order means a rejected fetch counts against
  // neither budget.
  const daily = await chatRateLimiter.limit(
    ctx,
    "fetchProfileSourceDailyOwner",
    {
      key: profileOwnerId,
      throws: false,
    },
  );
  if (!daily.ok) {
    throw new Error("Daily profile source fetch limit reached.");
  }

  const minute = await chatRateLimiter.limit(ctx, "fetchProfileSource", {
    key: conversationId,
    throws: false,
  });
  if (!minute.ok) {
    throw new Error("Profile source fetch limit reached. Try again shortly.");
  }
}

export function buildConfigurationTools(
  profileOwnerId: Id<"users">,
  options: BuildConfigurationToolsOptions,
) {
  const assertOwner = () =>
    assertOwnerWriteAllowed(profileOwnerId, options.viewerId);

  return {
    getProfileConfiguration: createTool({
      description:
        "Read the profile owner's current Bio, Contact, and Projects entries before deciding what to add, update, or delete. The profile owner is resolved server-side from the configuration conversation.",
      inputSchema: z.object({}),
      execute: async (ctx) => {
        assertOwner();
        const config = await ctx.runQuery(
          internal.chat.toolQueries.queryProfileConfiguration,
          { userId: profileOwnerId },
        );
        if (!config) {
          throw new Error("Profile configuration is unavailable.");
        }
        return config;
      },
    }),

    fetchProfileSource: createTool({
      description:
        "Best-effort fetch of a public HTTPS resume or social-profile URL the owner provided. Use only when a URL may contain profile text to configure Bio or Contact. If unavailable, ask the owner to paste the relevant text.",
      inputSchema: z.object({
        url: z
          .string()
          .url()
          .describe("A public https URL provided by the owner."),
      }),
      execute: async (ctx, { url }) => {
        assertOwner();
        await enforceFetchLimit(
          ctx as Parameters<typeof chatRateLimiter.limit>[0],
          profileOwnerId,
          options.conversationId,
        );
        return await guardedFetchProfileSource(url);
      },
    }),

    applyBioEntryPatch: createTool({
      description:
        "Apply an all-or-nothing batch of Bio entry changes for the profile owner. Use create for work or education entries, update with ids from getProfileConfiguration, and delete only after the owner clearly requested it.",
      inputSchema: z.object({
        operations: z.array(bioOperationSchema).min(1).max(10),
      }),
      execute: async (ctx, { operations }) => {
        assertOwner();
        return await ctx.runMutation(
          internal.chat.toolMutations.applyBioEntryPatch,
          {
            userId: profileOwnerId,
            operations: operations.map((operation) =>
              operation.action === "update" || operation.action === "delete"
                ? {
                    ...operation,
                    id: operation.id as Id<"bioEntries">,
                  }
                : operation,
            ),
          },
        );
      },
    }),

    applyContactEntryPatch: createTool({
      description:
        "Apply an all-or-nothing batch of Contact entry changes for the profile owner. Use set to create or update email and social links by kind, and delete to remove a kind.",
      inputSchema: z.object({
        operations: z.array(contactOperationSchema).min(1).max(10),
      }),
      execute: async (ctx, { operations }) => {
        assertOwner();
        return await ctx.runMutation(
          internal.chat.toolMutations.applyContactEntryPatch,
          { userId: profileOwnerId, operations },
        );
      },
    }),

    applyProjectPatch: createTool({
      description:
        "Apply an all-or-nothing batch of Project changes for the profile owner. Use create for projects, update with ids from getProfileConfiguration, and delete only after the owner clearly requested it. If the owner attached an image in the current message and wants it as the cover, set coverImage to 'uploaded'; use coverImage 'remove' to delete an existing cover.",
      inputSchema: z.object({
        operations: z.array(projectOperationSchema).min(1).max(10),
      }),
      execute: async (ctx, { operations }) => {
        assertOwner();
        const latestImageAttachment = options.latestImageAttachment;

        return await ctx.runMutation(
          internal.chat.toolMutations.applyProjectPatch,
          {
            userId: profileOwnerId,
            operations: operations.map((operation) => {
              if (operation.action === "delete") {
                return {
                  action: "delete" as const,
                  id: operation.id as Id<"projects">,
                };
              }

              const coverPatch =
                operation.coverImage === "uploaded"
                  ? (() => {
                      if (!latestImageAttachment) {
                        throw new Error(
                          "No uploaded image is available for this project cover.",
                        );
                      }
                      return {
                        coverImageStorageId: latestImageAttachment.storageId,
                        ...(latestImageAttachment.thumbhash
                          ? {
                              coverImageThumbhash:
                                latestImageAttachment.thumbhash,
                            }
                          : {}),
                      };
                    })()
                  : operation.coverImage === "remove"
                    ? { clearCover: true }
                    : {};

              if (operation.action === "create") {
                return {
                  action: "create" as const,
                  title: operation.title,
                  startDate: operation.startDate,
                  endDate: operation.endDate,
                  description: operation.description,
                  link: operation.link,
                  ...coverPatch,
                };
              }

              return {
                action: "update" as const,
                id: operation.id as Id<"projects">,
                title: operation.title,
                startDate: operation.startDate,
                endDate: operation.endDate,
                description: operation.description,
                link: operation.link,
                ...coverPatch,
              };
            }),
          },
        );
      },
    }),

    getProfileContentLibrary: createTool({
      description:
        "List the profile owner's draft and published posts and articles before deciding what to create, edit, or delete. Returns kind, title, slug, category, status, timestamps, and server-built list/detail/edit hrefs. Filter by kind ('posts' or 'articles') or status ('draft' or 'published') when relevant.",
      inputSchema: z.object({
        kind: z
          .enum(NAVIGABLE_CONTENT_KIND_ENUM_VALUES)
          .optional()
          .describe("Restrict to a single content kind."),
        status: z
          .enum(["draft", "published"])
          .optional()
          .describe("Restrict to draft or published rows."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Max rows to return per kind (default 25, max 50)."),
      }),
      execute: async (ctx, args) => {
        assertOwner();
        const library = await ctx.runQuery(
          internal.chat.toolQueries.queryProfileContentLibrary,
          {
            userId: profileOwnerId,
            ...(args.kind !== undefined ? { kind: args.kind } : {}),
            ...(args.status !== undefined ? { status: args.status } : {}),
            ...(args.limit !== undefined ? { limit: args.limit } : {}),
          },
        );
        if (!library) {
          throw new Error("Content library is unavailable for this profile.");
        }
        return library;
      },
    }),

    getProfileContentForEdit: createTool({
      description:
        "Fetch a single owned post or article by kind and slug for editing. Returns metadata plus a plain-text body, an agent-friendly block projection, and a projectionLossy flag with the list of unsupportedNodeTypes that the block projection cannot round-trip. Always call this before replacing a body — it is the only way to inspect what is already there.",
      inputSchema: z.object({
        kind: z.enum(NAVIGABLE_CONTENT_KIND_ENUM_VALUES),
        slug: z.string().min(1),
      }),
      execute: async (ctx, args) => {
        assertOwner();
        // The query returns a discriminated union { found: false, kind, slug }
        // or { found: true, ...rest } — pass it through unchanged. `found` is
        // now part of the query validator (approach a), so the LLM-visible
        // shape has a single structural source of truth.
        return await ctx.runQuery(
          internal.chat.toolQueries.queryOwnedContentForEdit,
          { userId: profileOwnerId, ...args },
        );
      },
    }),

    applyContentPatch: createTool({
      description:
        "Apply an all-or-nothing batch of post/article changes for the profile owner. Use create for a brand-new draft (prefer drafts unless the owner explicitly asks to publish), update with the current slug to edit fields or replace the body via bodyBlocks, and delete to remove an owned row. Max 5 operations per call.",
      inputSchema: z.object({
        operations: z.array(contentOperationSchema).min(1).max(5),
      }),
      execute: async (ctx, { operations }) => {
        assertOwner();
        return await ctx.runMutation(
          internal.chat.toolMutations.applyContentPatch,
          {
            userId: profileOwnerId,
            operations,
          },
        );
      },
    }),
  };
}
