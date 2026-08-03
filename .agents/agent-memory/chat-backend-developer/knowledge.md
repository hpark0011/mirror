# Chat Backend Knowledge

## Current contract

Mirror has one public-chat contract. Every conversation belongs to a profile owner and optionally to an authenticated viewer. Server code derives identity and never accepts owner ids through an LLM-visible tool schema.

## Request flow

1. `sendMessage` validates the public input and rate limits the viewer.
2. It creates or validates a conversation scoped to the profile owner and viewer.
3. It acquires the streaming lock and schedules `streamResponse`.
4. `streamResponse` loads the public prompt context, performs best-effort RAG, and streams through the clone agent.
5. A guarded `finally` path clears the lock.

## Prompt contract

`composeSystemPrompt` combines:

- A fixed safety prefix derived from the author's bounded display name.
- Fixed plain-text style rules.
- Public navigation/retrieval tool vocabulary.
- Owner publish/delete vocabulary only when the viewer is the profile owner.
- Optional author tagline.
- Fixed public-chat instructions.
- A compact inventory of populated public content.

The full prompt is capped by `SYSTEM_PROMPT_MAX_CHARS`. Fixed safety/style/tool sections must survive truncation.

## Retrieval

RAG is best-effort. Embedding or vector-search failures are logged and the response proceeds without retrieved context. Published content and structured public profile data remain scoped by `profileOwnerId`.

## Tool isolation

`buildCloneTools(profileOwnerId, { viewerId })` closes over server-derived ids. Tool input schemas contain only action data such as kind, slug, query, or section. Owner-write tools reject all viewers except the profile owner before reads or writes.

## Conversation safety

- New and existing conversation access is scoped by profile owner and viewer.
- Streaming locks use a start timestamp so an old completion cannot clear a newer lock.
- Retry resolves the latest user message when no prompt message id is supplied.
- Public daily and per-minute limits are centralized in `rateLimits.ts`.

## Verification map

- `chat/__tests__/helpers.test.ts`: prompt and inventory contract.
- `chat/__tests__/rateLimits.test.ts`: public limits, lock behavior, streaming arguments.
- `chat/__tests__/tools.test.ts`: tool schemas, cross-user isolation, navigation, owner writes.
- `chat/__tests__/ragContext.test.ts` and retrieval tests: source scoping and fallback.
- `pnpm --filter=@feel-good/convex check-types`
- `pnpm --filter=@feel-good/convex test`
- `pnpm build --filter=@feel-good/mirror` after generated API changes.
