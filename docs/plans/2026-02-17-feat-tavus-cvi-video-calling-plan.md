---
title: "feat: Tavus CVI Video Calling (Clone Avatar Experience)"
type: feat
date: 2026-02-17
---

# Tavus CVI Video Calling (Clone Avatar Experience)

## Overview

Add real-time video conversations with an AI avatar to the Mirror app. When a reader visits a profile page and clicks the "Video" button, they enter a video call with a Tavus-powered clone avatar that has been trained on the author's articles. The avatar can answer questions about the author's content using the articles as its knowledge base.

## Problem Statement / Motivation

Mirror is an interactive blogging platform that turns blog articles into a conversational digital clone. The profile page already has Text, Video, and Voice action buttons, but they are currently non-functional UI placeholders. The Video button is the highest-impact feature -- it brings the "digital clone" concept to life by letting readers have a face-to-face conversation with an AI representation of the author.

## Proposed Solution

### Architecture Overview

```
packages/tavus/                    # Shared package: API client, types, serializer
apps/mirror/features/video-call/   # App-level: UI, state, video call feature
apps/mirror/app/api/tavus/         # Server-side: API route for conversation creation
```

**Package boundary:**

- `@feel-good/tavus` -- Tavus API client, TypeScript types, article-to-context serializer
- `apps/mirror/features/video-call/` -- All UI components, hooks, context, and call management
- `apps/mirror/app/api/tavus/conversations/route.ts` -- Server-side API route (keeps API key secure)

**Video interface:** Full-screen modal overlay on both mobile and desktop. This avoids conflicts with the existing `ResizablePanelGroup` (desktop) and `Drawer` snap-point layout (mobile). The modal renders on top of the profile page, and dismissing returns to the profile.

### Component Tree

```
ProfileActions (Video button click)
  -> VideoCallModal (full-screen overlay, lazy-loaded)
    -> CVIProvider (Daily.co context)
      -> VideoCallView
        -> RemoteVideo (avatar stream)
        -> LocalVideo (user camera)
        -> CallControls (mic, camera, end call)
        -> ConnectionStatus (connecting/connected/error states)
```

### User Flow

```
[Click Video] -> [Loading overlay] -> [Browser asks camera/mic permission]
  -> [Permission granted] -> [Join Daily.co room] -> [Avatar appears, starts greeting]
  -> [User speaks] -> [Avatar responds using article knowledge base]
  -> [User clicks End Call] -> [Cleanup] -> [Return to profile]
```

## Technical Approach

### Phase 1: Foundation (Package + CSP + API Route)

**1a. Create `@feel-good/tavus` shared package**

```
packages/tavus/
  src/
    client.ts              # Tavus API client (server-side only)
    types.ts               # TypeScript types for API request/response
    serialize-articles.ts  # Convert JSONContent -> plain text for context
    index.ts               # Public API
  package.json
  tsconfig.json
```

`packages/tavus/package.json`:

```json
{
  "name": "@feel-good/tavus",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./client": "./src/client.ts",
    "./types": "./src/types.ts",
    "./serialize-articles": "./src/serialize-articles.ts"
  },
  "dependencies": {},
  "devDependencies": {
    "@feel-good/tsconfig": "workspace:*",
    "typescript": "catalog:"
  }
}
```

`packages/tavus/src/types.ts`:

```typescript
export type CreateConversationRequest = {
  persona_id: string;
  replica_id?: string;
  conversation_name?: string;
  conversational_context?: string;
  custom_greeting?: string;
  properties?: {
    max_duration?: number;
    enable_recording?: boolean;
  };
};

export type CreateConversationResponse = {
  conversation_id: string;
  conversation_url: string;
  status: string;
};

export type TavusErrorResponse = {
  error: string;
  message: string;
};
```

`packages/tavus/src/client.ts`:

```typescript
import type {
  CreateConversationRequest,
  CreateConversationResponse,
} from "./types";

const TAVUS_API_BASE = "https://tavusapi.com/v2";

export async function createConversation(
  apiKey: string,
  request: CreateConversationRequest,
): Promise<CreateConversationResponse> {
  const response = await fetch(`${TAVUS_API_BASE}/conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new Error(
      `Tavus API error (${response.status}): ${error.message || "Failed to create conversation"}`,
    );
  }

  return response.json();
}

export async function endConversation(
  apiKey: string,
  conversationId: string,
): Promise<void> {
  const response = await fetch(
    `${TAVUS_API_BASE}/conversations/${conversationId}/end`,
    {
      method: "POST",
      headers: { "x-api-key": apiKey },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to end conversation: ${response.status}`);
  }
}
```

`packages/tavus/src/serialize-articles.ts` -- Converts Tiptap `JSONContent` to Markdown-like plain text:

```typescript
// Recursively walks JSONContent tree and produces readable plain text
// Headings -> "## Title"
// Bold -> **text**
// Italic -> _text_
// Blockquotes -> "> text"
// Lists -> "- item" or "1. item"
// Code blocks -> included as-is
// Images/links -> stripped (text only)
// Each article separated by "---\n# Article Title\n"
// Truncated at MAX_CONTEXT_LENGTH (8000 chars) to stay within token limits
```

**1b. Update CSP and Permissions-Policy in `next.config.ts`**

Changes required in `apps/mirror/next.config.ts`:

```typescript
// Permissions-Policy: allow camera and microphone for self
"camera=(self), microphone=(self), geolocation=(), payment=()";

// CSP connect-src: add Daily.co WebRTC signaling
"connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.ingest.sentry.io https://*.daily.co wss://*.daily.co https://tavusapi.com";

// CSP frame-src: add Daily.co (may use iframes)
// Add new directive:
"frame-src https://*.daily.co";

// CSP media-src: allow media from Daily.co
"media-src 'self' https://*.daily.co blob:";
```

**1c. Create server-side API route**

`apps/mirror/app/api/tavus/conversations/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createConversation } from "@feel-good/tavus/client";
import { serializeArticlesToContext } from "@feel-good/tavus/serialize-articles";

export async function POST(request: Request) {
  const apiKey = process.env.TAVUS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Tavus API key not configured" },
      { status: 500 },
    );
  }

  const body = await request.json();
  const { articles } = body;

  const conversationalContext = serializeArticlesToContext(articles);

  const result = await createConversation(apiKey, {
    persona_id: process.env.TAVUS_PERSONA_ID || "p2679f6eae3f",
    conversational_context: conversationalContext,
    properties: {
      max_duration: 600, // 10 minutes
    },
  });

  return NextResponse.json({
    conversation_url: result.conversation_url,
    conversation_id: result.conversation_id,
  });
}
```

**1d. Add environment variables**

`.env.local` (mirror app):

```
TAVUS_API_KEY=your-api-key-here
TAVUS_PERSONA_ID=p2679f6eae3f
```

**1e. Install dependencies**

Add to `apps/mirror/package.json`:

```
"@daily-co/daily-js": "latest"
"@daily-co/daily-react": "latest"
"@feel-good/tavus": "workspace:*"
```

Note: `@tavus/cvi-ui` is a CLI scaffolding tool. We will run `npx @tavus/cvi-ui@latest init` and `npx @tavus/cvi-ui@latest add conversation` in the mirror app to scaffold the base components, then customize them. The scaffolded components go into `apps/mirror/features/video-call/components/cvi/`.

### Phase 2: Core Video Call Feature

**2a. Scaffold CVI components**

Run from `apps/mirror/`:

```bash
npx @tavus/cvi-ui@latest init
npx @tavus/cvi-ui@latest add conversation
```

Move the scaffolded files into the feature module structure:

```
apps/mirror/features/video-call/
  components/
    cvi/                        # Scaffolded from @tavus/cvi-ui (customized)
      cvi-provider.tsx          # Daily.co context wrapper
      conversation.tsx          # Main conversation UI
    video-call-modal.tsx        # Full-screen modal overlay
    video-call-view.tsx         # Layout: remote + local video + controls
    call-controls.tsx           # Mic, camera, end call buttons
    connection-status.tsx       # Connecting/connected/error states
  hooks/
    use-video-call.ts           # Manages call lifecycle: create -> join -> leave -> cleanup
    use-call-state.ts           # State machine: idle | creating | connecting | connected | error | ended
  context/
    video-call-context.tsx      # Provides call state and actions to children
  types.ts                      # Feature-local types
  index.ts                      # Public API
```

**2b. `use-video-call` hook -- Call lifecycle manager**

```typescript
type CallState =
  | { status: "idle" }
  | { status: "creating" } // API call to create conversation
  | { status: "connecting"; conversationUrl: string } // Joining Daily room
  | { status: "connected"; conversationId: string } // In call
  | { status: "error"; message: string } // Something went wrong
  | { status: "ended" }; // Call finished

// Actions
function startCall(articles: Article[]): void; // POST to /api/tavus/conversations
function endCall(): void; // Leave Daily room + cleanup
function resetCall(): void; // Return to idle
```

Key behaviors:

- **Double-click prevention**: `startCall` is a no-op if status is not `idle`
- **Cleanup on unmount**: Leave Daily room and call Tavus end endpoint
- **Cleanup on navigation**: `beforeunload` handler warns user, `visibilitychange` for tab close
- **Error recovery**: Any failure transitions to `error` state with user-friendly message

**2c. `VideoCallModal` -- Full-screen overlay**

```typescript
// Renders as a portal over the entire viewport
// Uses framer-motion for enter/exit animations
// Contains CVIProvider -> VideoCallView
// "X" button or "End Call" button to dismiss
// Lazy-loaded via next/dynamic to avoid loading Daily.co SDK on page load
```

**2d. `VideoCallView` -- Main layout**

```
+---------------------------------------------------+
|                                                   |
|           [Remote Video - Avatar]                 |
|                                                   |
|                                                   |
|              [Connection Status]                  |
|                                                   |
|   +--------+                                      |
|   | Local  |                                      |
|   | Video  |                                      |
|   +--------+                                      |
|                                                   |
|        [Mic] [Camera] [End Call]                  |
+---------------------------------------------------+
```

- Remote video fills the viewport (avatar stream)
- Local video is a small picture-in-picture overlay (bottom-left)
- Controls are a floating bar at the bottom center
- Connection status shows "Connecting..." while joining

**2e. `CallControls` component**

```typescript
// Uses Daily.co hooks:
// - useLocalCamera() for camera toggle
// - useLocalMicrophone() for mic toggle
// Buttons: Mic toggle, Camera toggle, End Call (red)
// Each button shows its current state (muted/unmuted icon)
```

### Phase 3: Integration with Profile

**3a. Wire up the Video button in `ProfileActions`**

Update `apps/mirror/features/profile/components/profile-actions.tsx`:

```typescript
// Add onClick handler for the Video button
// When clicked:
//   1. Set videoCallOpen state to true
//   2. This triggers the VideoCallModal to render

// The modal receives articles from ArticleWorkspaceContext
// or from a prop passed through ProfileShell
```

The `ProfileActions` component needs to evolve from a static array to support individual handlers:

```typescript
const PROFILE_ACTIONS = [
  { label: "Text", icon: "BubbleLeftFillIcon", onClick: undefined }, // Coming soon
  { label: "Video", icon: "VideoFillIcon", onClick: onVideoClick }, // Active
  { label: "Voice", icon: "WaveformIcon", onClick: undefined }, // Coming soon
];
```

Inactive buttons show a "Coming soon" toast on click.

**3b. State flow**

```
ProfileShell
  -> ProfileActions (Video button onClick sets videoCallOpen=true)
  -> {videoCallOpen && <VideoCallModal articles={articles} onClose={...} />}
```

The `videoCallOpen` state lives in `ProfileShell` or a new `VideoCallContext` at the profile level. The modal is lazy-loaded with `next/dynamic` to avoid loading the Daily.co SDK until needed.

**3c. Article knowledge base**

When the Video button is clicked:

1. Published articles are extracted from the current page data (passed as props through `ProfileShell`)
2. Articles are sent to `/api/tavus/conversations` in the request body
3. Server-side, `serializeArticlesToContext()` converts them to plain text
4. The plain text is passed as `conversational_context` to the Tavus API

Serialization format:

```
# The Art of Listening Deeply

Most people listen to confirm what they already believe...

## Hearing What Surprises You

When I sit with an artist in the studio...

---

# Why Constraints Fuel Creativity

The blank page terrifies because...
```

Only published articles are included (drafts excluded regardless of caller).

### Phase 4: Polish and Error Handling

**4a. Permission handling**

When `getUserMedia()` fails:

- **Camera denied**: Allow audio-only mode (user can hear/talk to avatar but not show their face)
- **Microphone denied**: Show error -- "Microphone access is required to talk with the avatar. Please enable it in your browser settings."
- **Both denied**: Same mic-denied error (mic is the critical one)

Show browser-specific instructions for re-enabling permissions.

**4b. Error states**

| Error                    | User Message                                       | Recovery                 |
| ------------------------ | -------------------------------------------------- | ------------------------ |
| API key missing          | "Video calling is not available right now."        | None (config issue)      |
| Tavus API 429            | "Too many requests. Please try again in a moment." | Retry after delay        |
| Tavus API 500            | "Something went wrong. Please try again."          | Retry button             |
| Daily.co join failure    | "Could not connect to the video call."             | Retry button             |
| Network lost during call | "Connection lost. Trying to reconnect..."          | Auto-reconnect via Daily |
| Max duration reached     | "The call has ended."                              | Close modal              |

**4c. Cleanup**

- `useEffect` cleanup: Leave Daily room on unmount
- `beforeunload`: Warn user if call is active
- Server-side: Call `POST /v2/conversations/{id}/end` when call ends
- Memory: Remove all Daily event listeners

**4d. Inactive action buttons**

The "Text" and "Voice" buttons show a toast: "Coming soon" when clicked.

## Acceptance Criteria

### Functional Requirements

- [ ] User can click "Video" button on profile page to start a video call
- [ ] Video call modal appears as full-screen overlay
- [ ] Avatar appears and delivers a greeting
- [ ] User can speak and avatar responds using article knowledge base
- [ ] User can toggle camera on/off during call
- [ ] User can toggle microphone on/off during call
- [ ] User can end the call via "End Call" button
- [ ] Modal dismisses and returns to profile after call ends
- [ ] Call has 10-minute maximum duration
- [ ] Proper cleanup when call ends (Daily room left, Tavus conversation ended)
- [ ] "Text" and "Voice" buttons show "Coming soon" toast

### Non-Functional Requirements

- [ ] Tavus API key is server-side only (never exposed to client)
- [ ] Camera and microphone permissions requested properly
- [ ] CSP headers updated to allow Daily.co WebRTC connections
- [ ] Daily.co SDK lazy-loaded (not in initial page bundle)
- [ ] Error states show user-friendly messages with recovery options
- [ ] No memory leaks from Daily.co event listeners
- [ ] Works on both mobile and desktop layouts

### Quality Gates

- [ ] `pnpm build` passes with no errors
- [ ] `pnpm lint` passes with no errors
- [ ] TypeScript strict mode -- no `any` types
- [ ] Tested manually: full call lifecycle (start -> talk -> end)
- [ ] Tested manually: error states (denied permissions, network failure)
- [ ] Tested on mobile viewport

## Dependencies & Prerequisites

| Dependency              | Type        | Notes                                  |
| ----------------------- | ----------- | -------------------------------------- |
| Tavus API key           | Credential  | Must be provisioned before development |
| Persona `p2679f6eae3f`  | External    | Must exist on the Tavus platform       |
| `@daily-co/daily-js`    | npm package | WebRTC SDK                             |
| `@daily-co/daily-react` | npm package | React hooks for Daily.co               |
| `@tavus/cvi-ui`         | CLI tool    | Scaffolds base components              |

## Risk Analysis & Mitigation

| Risk                                                     | Impact                          | Mitigation                                                                               |
| -------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| Daily.co WebRTC blocked by corporate firewalls           | Call fails silently             | Show clear error message; document known limitations                                     |
| Tavus API latency spikes                                 | Long wait before avatar appears | Loading state with timeout; show "Taking longer than expected..." after 10s              |
| CSP too restrictive for Daily.co                         | WebRTC connection fails         | Test CSP changes in dev before merging; use browser console to identify blocked requests |
| Mobile Safari WebRTC quirks                              | Call doesn't work on iOS        | Test on iOS Safari early; Daily.co SDK handles most quirks but verify                    |
| Bundle size increase from Daily.co SDK                   | Slower page load                | Lazy-load via `next/dynamic`; SDK only loads when user clicks Video                      |
| Orphaned Tavus conversations (tab close without cleanup) | Wasted API credits              | `beforeunload` handler + server-side `max_duration` as safety net                        |

## File Change Summary

### New Files

| File                                                               | Purpose                              |
| ------------------------------------------------------------------ | ------------------------------------ |
| `packages/tavus/src/client.ts`                                     | Tavus API client                     |
| `packages/tavus/src/types.ts`                                      | TypeScript types                     |
| `packages/tavus/src/serialize-articles.ts`                         | JSONContent -> plain text serializer |
| `packages/tavus/src/index.ts`                                      | Package barrel export                |
| `packages/tavus/package.json`                                      | Package config                       |
| `packages/tavus/tsconfig.json`                                     | TypeScript config                    |
| `apps/mirror/app/api/tavus/conversations/route.ts`                 | API route                            |
| `apps/mirror/features/video-call/components/video-call-modal.tsx`  | Full-screen modal                    |
| `apps/mirror/features/video-call/components/video-call-view.tsx`   | Video layout                         |
| `apps/mirror/features/video-call/components/call-controls.tsx`     | Mic/camera/end buttons               |
| `apps/mirror/features/video-call/components/connection-status.tsx` | Status indicator                     |
| `apps/mirror/features/video-call/components/cvi/cvi-provider.tsx`  | Daily.co wrapper                     |
| `apps/mirror/features/video-call/components/cvi/conversation.tsx`  | Conversation component               |
| `apps/mirror/features/video-call/hooks/use-video-call.ts`          | Call lifecycle hook                  |
| `apps/mirror/features/video-call/hooks/use-call-state.ts`          | State machine                        |
| `apps/mirror/features/video-call/context/video-call-context.tsx`   | React context                        |
| `apps/mirror/features/video-call/types.ts`                         | Feature types                        |
| `apps/mirror/features/video-call/index.ts`                         | Feature barrel export                |

### Modified Files

| File                                                          | Change                                                                |
| ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `apps/mirror/next.config.ts`                                  | Update CSP + Permissions-Policy for camera/mic/Daily.co               |
| `apps/mirror/package.json`                                    | Add `@daily-co/daily-js`, `@daily-co/daily-react`, `@feel-good/tavus` |
| `apps/mirror/features/profile/components/profile-actions.tsx` | Add onClick handler for Video button                                  |
| `apps/mirror/app/[username]/_components/profile-shell.tsx`    | Add video call state + lazy-loaded modal                              |
| `pnpm-workspace.yaml`                                         | Include `packages/tavus` if not auto-discovered                       |

## Decisions Log

| Decision                                 | Rationale                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Full-screen modal (not in-panel)         | Avoids conflicts with ResizablePanel (desktop) and Drawer (mobile). Cleanest integration.              |
| Skip HairCheck for v1                    | Reduces scope. User can toggle devices during call. Add in v2 if needed.                               |
| Skip screen sharing for v1               | Avatar cannot see screen (no perception model configured). No user value in v1.                        |
| Skip audio visualization for v1          | Polish feature, not core. Add in v2.                                                                   |
| Skip webhooks for v1                     | Client-side Daily.co events are sufficient for call lifecycle.                                         |
| Skip auth requirement for v1             | Profile page is public. Rate limit via `max_duration` (10 min per call). Re-evaluate if abuse occurs.  |
| `@feel-good/tavus` as separate package   | Generic Tavus code (API client, types, serializer) is reusable across apps. UI stays app-level.        |
| Serialize articles to Markdown-like text | Preserves structure (headings, lists) while being LLM-friendly. Better than raw JSON or stripped text. |
| 10-minute max duration                   | Balances user experience with API cost control. Configurable via env var later.                        |
| Lazy-load Daily.co SDK                   | SDK is large (~200KB). Only loaded when user clicks Video. No impact on page load.                     |

## References & Research

### Internal References

- Profile actions component: `apps/mirror/features/profile/components/profile-actions.tsx`
- Profile shell layout: `apps/mirror/app/[username]/_components/profile-shell.tsx`
- Mock articles (knowledge base): `apps/mirror/features/articles/lib/mock-articles.ts`
- CSP/security headers: `apps/mirror/next.config.ts:4-12`
- Root provider pattern: `apps/mirror/providers/root-provider.tsx`
- Provider architecture pattern: `docs/solutions/architecture-patterns/provider-separation-of-concerns.md`
- Features package exports pattern: `packages/features/package.json`

### External References

- [Tavus CVI Documentation](https://docs.tavus.io/sections/conversational-video-interface/component-library/overview)
- [Tavus Create Conversation API](https://docs.tavus.io/api-reference/conversations/create-conversation)
- [@tavus/cvi-ui npm package](https://www.npmjs.com/package/@tavus/cvi-ui)
- [Daily.co React SDK](https://docs.daily.co/reference/daily-react/daily-provider)
- [Tavus Knowledge Base](https://docs.tavus.io/sections/conversational-video-interface/knowledge-base)
- [Tavus Examples Repository](https://github.com/Tavus-Engineering/tavus-examples)

### Related Work

- Tavus CVI quickstart skill: `.agents/skills/tavus-cvi-quickstart/SKILL.md`
- Tavus video generation skill: `.agents/skills/tavus-video-gen/SKILL.md`
