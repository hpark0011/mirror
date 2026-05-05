/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as articles_actions from "../articles/actions.js";
import type * as articles_helpers from "../articles/helpers.js";
import type * as articles_inlineImages from "../articles/inlineImages.js";
import type * as articles_internalImages from "../articles/internalImages.js";
import type * as articles_mutations from "../articles/mutations.js";
import type * as articles_queries from "../articles/queries.js";
import type * as auth_client from "../auth/client.js";
import type * as auth_queries from "../auth/queries.js";
import type * as auth_testHelpers from "../auth/testHelpers.js";
import type * as auth_testMode from "../auth/testMode.js";
import type * as auth_triggers from "../auth/triggers.js";
import type * as betaAllowlist_mutations from "../betaAllowlist/mutations.js";
import type * as betaAllowlist_queries from "../betaAllowlist/queries.js";
import type * as bio_mutations from "../bio/mutations.js";
import type * as bio_queries from "../bio/queries.js";
import type * as bio_serializeForEmbedding from "../bio/serializeForEmbedding.js";
import type * as chat_actions from "../chat/actions.js";
import type * as chat_agent from "../chat/agent.js";
import type * as chat_helpers from "../chat/helpers.js";
import type * as chat_mutations from "../chat/mutations.js";
import type * as chat_queries from "../chat/queries.js";
import type * as chat_rateLimits from "../chat/rateLimits.js";
import type * as chat_testHelpers from "../chat/testHelpers.js";
import type * as chat_tonePresets from "../chat/tonePresets.js";
import type * as chat_toolQueries from "../chat/toolQueries.js";
import type * as chat_tools from "../chat/tools.js";
import type * as content_backfill from "../content/backfill.js";
import type * as content_bodyWalk from "../content/bodyWalk.js";
import type * as content_helpers from "../content/helpers.js";
import type * as content_href from "../content/href.js";
import type * as content_inlineImageOwnership from "../content/inlineImageOwnership.js";
import type * as content_inlineImageOwnershipSchema from "../content/inlineImageOwnershipSchema.js";
import type * as content_markdownImport from "../content/markdownImport.js";
import type * as content_safeFetch from "../content/safeFetch.js";
import type * as content_slug from "../content/slug.js";
import type * as content_storagePolicy from "../content/storagePolicy.js";
import type * as content_storageRegistry from "../content/storageRegistry.js";
import type * as crons from "../crons.js";
import type * as email_actions from "../email/actions.js";
import type * as embeddings_actions from "../embeddings/actions.js";
import type * as embeddings_chunker from "../embeddings/chunker.js";
import type * as embeddings_config from "../embeddings/config.js";
import type * as embeddings_mutations from "../embeddings/mutations.js";
import type * as embeddings_queries from "../embeddings/queries.js";
import type * as embeddings_textExtractor from "../embeddings/textExtractor.js";
import type * as env from "../env.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as posts_actions from "../posts/actions.js";
import type * as posts_categories from "../posts/categories.js";
import type * as posts_helpers from "../posts/helpers.js";
import type * as posts_inlineImages from "../posts/inlineImages.js";
import type * as posts_internalImages from "../posts/internalImages.js";
import type * as posts_mutations from "../posts/mutations.js";
import type * as posts_queries from "../posts/queries.js";
import type * as seed from "../seed.js";
import type * as users_helpers from "../users/helpers.js";
import type * as users_mutations from "../users/mutations.js";
import type * as users_queries from "../users/queries.js";
import type * as waitlistRequests_mutations from "../waitlistRequests/mutations.js";
import type * as waitlistRequests_queries from "../waitlistRequests/queries.js";
import type * as waitlistRequests_rateLimits from "../waitlistRequests/rateLimits.js";
import type * as waitlistRequests_testHelpers from "../waitlistRequests/testHelpers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "articles/actions": typeof articles_actions;
  "articles/helpers": typeof articles_helpers;
  "articles/inlineImages": typeof articles_inlineImages;
  "articles/internalImages": typeof articles_internalImages;
  "articles/mutations": typeof articles_mutations;
  "articles/queries": typeof articles_queries;
  "auth/client": typeof auth_client;
  "auth/queries": typeof auth_queries;
  "auth/testHelpers": typeof auth_testHelpers;
  "auth/testMode": typeof auth_testMode;
  "auth/triggers": typeof auth_triggers;
  "betaAllowlist/mutations": typeof betaAllowlist_mutations;
  "betaAllowlist/queries": typeof betaAllowlist_queries;
  "bio/mutations": typeof bio_mutations;
  "bio/queries": typeof bio_queries;
  "bio/serializeForEmbedding": typeof bio_serializeForEmbedding;
  "chat/actions": typeof chat_actions;
  "chat/agent": typeof chat_agent;
  "chat/helpers": typeof chat_helpers;
  "chat/mutations": typeof chat_mutations;
  "chat/queries": typeof chat_queries;
  "chat/rateLimits": typeof chat_rateLimits;
  "chat/testHelpers": typeof chat_testHelpers;
  "chat/tonePresets": typeof chat_tonePresets;
  "chat/toolQueries": typeof chat_toolQueries;
  "chat/tools": typeof chat_tools;
  "content/backfill": typeof content_backfill;
  "content/bodyWalk": typeof content_bodyWalk;
  "content/helpers": typeof content_helpers;
  "content/href": typeof content_href;
  "content/inlineImageOwnership": typeof content_inlineImageOwnership;
  "content/inlineImageOwnershipSchema": typeof content_inlineImageOwnershipSchema;
  "content/markdownImport": typeof content_markdownImport;
  "content/safeFetch": typeof content_safeFetch;
  "content/slug": typeof content_slug;
  "content/storagePolicy": typeof content_storagePolicy;
  "content/storageRegistry": typeof content_storageRegistry;
  crons: typeof crons;
  "email/actions": typeof email_actions;
  "embeddings/actions": typeof embeddings_actions;
  "embeddings/chunker": typeof embeddings_chunker;
  "embeddings/config": typeof embeddings_config;
  "embeddings/mutations": typeof embeddings_mutations;
  "embeddings/queries": typeof embeddings_queries;
  "embeddings/textExtractor": typeof embeddings_textExtractor;
  env: typeof env;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "posts/actions": typeof posts_actions;
  "posts/categories": typeof posts_categories;
  "posts/helpers": typeof posts_helpers;
  "posts/inlineImages": typeof posts_inlineImages;
  "posts/internalImages": typeof posts_internalImages;
  "posts/mutations": typeof posts_mutations;
  "posts/queries": typeof posts_queries;
  seed: typeof seed;
  "users/helpers": typeof users_helpers;
  "users/mutations": typeof users_mutations;
  "users/queries": typeof users_queries;
  "waitlistRequests/mutations": typeof waitlistRequests_mutations;
  "waitlistRequests/queries": typeof waitlistRequests_queries;
  "waitlistRequests/rateLimits": typeof waitlistRequests_rateLimits;
  "waitlistRequests/testHelpers": typeof waitlistRequests_testHelpers;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
};
