"use node";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { z } from "zod";
import { createTool } from "@convex-dev/agent";
import { internal } from "../_generated/api";
import { type Id } from "../_generated/dataModel";
import { CONTACT_ENTRY_KIND_VALUES } from "../contacts/schema";
import {
  detectContactKind,
  type DetectedContactKind,
} from "../contacts/detectContactKind";
import { chatRateLimiter } from "./rateLimits";

const PROFILE_SOURCE_MAX_REDIRECTS = 3;
const PROFILE_SOURCE_MAX_BYTES = 1024 * 1024;
const PROFILE_SOURCE_MAX_TEXT_CHARS = 12000;
const PROFILE_SOURCE_TIMEOUT_MS = 5000;
const PROFILE_SOURCE_USER_AGENT =
  "MirrorProfileConfigurationHelper/1.0 (+https://mirror.feel-good.local)";

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

type BuildConfigurationToolsOptions = {
  viewerId?: Id<"users">;
  conversationId: Id<"conversations">;
};

function assertOwnerWriteAllowed(
  profileOwnerId: Id<"users">,
  viewerId: Id<"users"> | undefined,
) {
  if (viewerId !== profileOwnerId) {
    throw new Error("Only the profile owner can configure this profile.");
  }
}

function isBlockedHostname(hostname: string): boolean {
  const lowered = hostname.toLowerCase();
  return lowered === "localhost" || lowered.endsWith(".localhost");
}

function isBlockedIp(address: string): boolean {
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
      a === 0 ||
      a >= 224
    );
  }

  if (family === 6) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith("::ffff:")) {
      const mapped = normalized.slice("::ffff:".length);
      if (isIP(mapped) === 4) {
        return isBlockedIp(mapped);
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
    throw new Error("Profile source fetch timed out");
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
          () => reject(new Error("Profile source fetch timed out")),
          remainingMs(deadline),
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function assertPublicHostnameBeforeDeadline(
  hostname: string,
  deadline: number,
): Promise<void> {
  if (isBlockedHostname(hostname)) {
    throw new Error("Host is not publicly fetchable");
  }

  const records = await withDeadline(
    lookup(hostname, { all: true, verbatim: true }),
    deadline,
  );
  if (records.length === 0) {
    throw new Error("Host could not be resolved");
  }
  if (records.some((record) => isBlockedIp(record.address))) {
    throw new Error("Host resolves to a blocked network address");
  }
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
      throw new Error("Response body is too large");
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

async function guardedFetchProfileSource(url: string) {
  let current = new URL(url);
  if (current.protocol !== "https:") {
    throw new Error("Only https:// URLs can be fetched");
  }

  const deadline = Date.now() + PROFILE_SOURCE_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    PROFILE_SOURCE_TIMEOUT_MS,
  );

  try {
    for (let hop = 0; hop <= PROFILE_SOURCE_MAX_REDIRECTS; hop++) {
      if (current.protocol !== "https:") {
        throw new Error("Redirected to a non-HTTPS URL");
      }
      await assertPublicHostnameBeforeDeadline(current.hostname, deadline);
      remainingMs(deadline);

      const response = await fetch(current.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": PROFILE_SOURCE_USER_AGENT,
          Accept: "text/html,text/plain,application/json",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        response.body?.cancel().catch(() => {});
        if (hop === PROFILE_SOURCE_MAX_REDIRECTS) {
          throw new Error("Too many redirects");
        }
        const location = response.headers.get("location");
        if (!location) {
          throw new Error("Redirect missing location");
        }
        current = new URL(location, current);
        continue;
      }

      if (!response.ok) {
        response.body?.cancel().catch(() => {});
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
        throw new Error("Unsupported content type");
      }

      const raw = await readLimitedText(response);
      return {
        status: "available" as const,
        finalUrl: current.toString(),
        detectedKind: detectContactKind(current.toString()),
        contentType,
        text: extractText(raw, contentType),
      };
    }
  } catch (error) {
    return {
      status: "unavailable" as const,
      reason: error instanceof Error ? error.message : String(error),
      finalUrl: current.toString(),
      detectedKind: detectContactKind(current.toString()),
    };
  } finally {
    clearTimeout(timeout);
  }

  return {
    status: "unavailable" as const,
    reason: "Unable to fetch source",
    finalUrl: current.toString(),
    detectedKind: detectContactKind(current.toString()),
  };
}

async function enforceFetchLimit(
  ctx: Parameters<typeof chatRateLimiter.limit>[0],
  profileOwnerId: Id<"users">,
  conversationId: Id<"conversations">,
) {
  const minute = await chatRateLimiter.limit(ctx, "fetchProfileSource", {
    key: conversationId,
    throws: false,
  });
  if (!minute.ok) {
    throw new Error("Profile source fetch limit reached. Try again shortly.");
  }

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
        "Read the profile owner's current Bio and Contact entries before deciding what to add, update, or delete. The profile owner is resolved server-side from the configuration conversation.",
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
  };
}
