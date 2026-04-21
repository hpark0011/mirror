import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Waitlist requests captured from the public landing page during the closed
 * beta. A row here means "this email wants access" — it is NOT an allowlist
 * entry. The closed-beta auth gate (`betaAllowlist`) is authoritative for
 * signup access and is intentionally independent (NFR-05).
 */
export const waitlistRequestsTable = defineTable({
  email: v.string(),
  submittedAt: v.number(),
}).index("by_email", ["email"]);
