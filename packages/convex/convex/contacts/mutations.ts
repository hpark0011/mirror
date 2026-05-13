import { v } from "convex/values";
import { authMutation } from "../lib/auth";
import { getAppUser } from "../users/helpers";
import { contactEntryKindValidator } from "./schema";
import {
  createContactEntryForUser,
  removeContactEntryForUser,
  updateContactEntryForUser,
  validateValue,
} from "./writeHelpers";

// Per-kind validation at the mutation boundary. The Zod form schema in
// apps/mirror/features/contact/lib/schemas/contact-entry.schema.ts already
// enforces these client-side; this is the server-side trust boundary.
// Exported so test-fixture seeders (`auth/testHelpers.ts`) cannot bypass
// validation and plant malformed values (including prompt-injection
// payloads) that would then flow through the embedding pipeline.
export { validateValue };

export const create = authMutation({
  args: {
    kind: contactEntryKindValidator,
    value: v.string(),
  },
  returns: v.id("contactEntries"),
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);
    return await createContactEntryForUser(ctx, appUser._id, args);
  },
});

/**
 * Update is value-only. Switching kinds would violate the one-per-platform
 * invariant without re-checking the index; instead, callers should delete +
 * re-add when changing platform.
 */
export const update = authMutation({
  args: {
    id: v.id("contactEntries"),
    value: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);
    await updateContactEntryForUser(ctx, appUser._id, args);
    return null;
  },
});

export const remove = authMutation({
  args: {
    id: v.id("contactEntries"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);
    await removeContactEntryForUser(ctx, appUser._id, args.id);
    return null;
  },
});
