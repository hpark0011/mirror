---
date: 2026-05-04
topic: agent-driven UI control / agent parity
target: how Greyboard wires the clone agent to control UI affordances, and how that shape would map onto Mirror
source_repo: greyboard/
status: research
---

# Greyboard's agent-UI parity model — and how it would map onto Mirror

Mirror's clone agent today is read-only: it composes a system prompt at request time, retrieves user content via `vectorSearch` on `contentEmbeddings` (filtered by `userId`), and emits text. It cannot change the right panel, navigate the visitor, or take any UI action. `packages/convex/convex/chat/agent.ts:33-37` confirms — `cloneAgent` is constructed with no `tools` map.

Greyboard (a sibling Electron + React + Tailwind editor app at `greyboard/`) ships the agent-control-the-UI piece already built. This document captures the shape so we can decide what to lift back into Mirror.

## 1. Parity is the project thesis, not a per-feature aspiration

Greyboard's root `agents.md:35`:

> **Agent Parity** — Any action a user can take through the UI, the agent must be able to take through an MCP tool. A UI feature without an agent tool is a parity bug, not a feature.

`docs/architecture.md:11` calls parity *"a non-negotiable property of the system."* The phrase "Agent Native" in the project name is a literal commitment, not branding.

Mirror's `AGENTS.md` does not lift parity to a top-level project principle. It lives one layer down, in the `code-review-agent-native` reviewer prompt and `.claude/rules/embeddings.md`. The result: in Mirror, parity is enforced *on PRs that already touch parity-relevant code*; in Greyboard, parity is the first thing a contributor reads.

## 2. Architecture: two routes, one controller

The single most useful pattern. From `docs/architecture.md:101-104`:

```text
User path:   renderer → preload window.greyboard.* → main IPC handler → Controller
Agent path:  agent → MCP tool in src/main/agent/tools/ → SAME Controller
```

Concretely, `UiController` is one TypeScript interface with the verbs both sides need (`src/main/agent/greyboard-tools.ts:14-25`):

```ts
export interface UiController {
  setPanelVisibility(panelId: PanelId, visible: boolean): void;
  setPanelOrder(order: PanelId[]): void;
  setTheme(theme: AppConfig["theme"]): void;
  setLeftSidebarVisible(visible: boolean): void;
  setEditorToolbarVisible(visible: boolean): void;
  setShowDotFiles(visible: boolean): void;
  openNewTab(): void;
  createDocument(): void;
  openFile(filePath: string): void;
  updateFrontmatter(filePath: string, frontmatter: string): void;
}
```

The implementation is intentionally thin (`agent-ipc-handlers.ts:73-113`):

```ts
function createUiController(webContentsId: number): UiController {
  function sendToRenderer(channel: IpcChannel, ...args: unknown[]): void {
    const target = webContents.fromId(webContentsId);
    if (target && !target.isDestroyed()) {
      target.send(channel, ...args);
    }
  }

  return {
    setPanelVisibility(panelId, visible) {
      sendToRenderer(IpcChannel.SetPanelVisibility, panelId, visible);
    },
    setPanelOrder(order) {
      sendToRenderer(IpcChannel.SetPanelOrder, order);
    },
    setTheme(theme) {
      sendToRenderer(IpcChannel.SetTheme, theme);
    },
    // ...
    openFile(filePath) {
      sendToRenderer(IpcChannel.EditorOpenFile, filePath);
    },
  };
}
```

The renderer subscribes once via `useAgentIpcBridge` (`src/renderer/hooks/use-agent-ipc-bridge.ts`):

```ts
window.greyboard.onSetPanelVisibility((panelId, visible) => {
  if (panelId === "editor") actions.setEditorVisible(visible);
  else if (panelId === "agent") actions.setRightSidebarVisible(visible);
});
window.greyboard.onSetPanelOrder(actions.setPanelOrder);
window.greyboard.onSetTheme(actions.setTheme);
window.greyboard.onEditorOpenFile(actions.openFile);
// ...
```

Both the user's menu items and the agent's MCP tool calls dispatch to the same IPC channels, which the renderer handles identically. **There is no agent-only path that bypasses user-facing logic, and no user-only path that bypasses agent reach.**

## 3. Tool families mirror IPC families

`createGreyboardTools()` in `src/main/agent/greyboard-tools.ts:36-46` registers four MCP tool sets, each parallel to a slice of the IPC contract:

| Tool family       | Mirrors                          | What the agent gains                                        |
|-------------------|----------------------------------|-------------------------------------------------------------|
| `workspace-tools` | filesystem IPC channels          | read/write/create/delete files, like the user via file tree |
| `editor-tools`    | editor IPC events                | open files, create documents, update frontmatter            |
| `ui-tools`        | menu / panel / theme channels    | toggle panels, change theme, show/hide sidebar              |
| `app-tools`       | broader app control              | window and shell actions                                    |

Example tool — `ui_toggle_panel` (`src/main/agent/tools/ui-tools.ts:24-52`):

```ts
tool(
  "ui_toggle_panel",
  "Toggle visibility of a UI panel. Valid panel IDs: 'editor', 'agent'.",
  {
    panelId: z.string().describe("The panel to toggle: 'editor' or 'agent'"),
    visible: z.boolean().describe("Whether to show (true) or hide (false) the panel"),
  },
  async ({ panelId, visible }) => {
    if (!VALID_PANEL_IDS.has(panelId)) {
      return createTextResult(`Invalid panel ID "${panelId}". Valid IDs: ${[...VALID_PANEL_IDS].join(", ")}`);
    }
    const validPanelId = panelId as PanelId;

    await gate.execute({
      toolName: "ui_toggle_panel",
      capability: "write",
      inputSummary: `${validPanelId} → ${visible ? "show" : "hide"}`,
      description: `${visible ? "Show" : "Hide"} ${validPanelId} panel`,
      execute: async () => {
        uiController.setPanelVisibility(validPanelId, visible);
      },
      formatOutputSummary: () => `${visible ? "Showed" : "Hid"} the ${validPanelId} panel.`,
    });

    return createTextResult(`${visible ? "Showed" : "Hid"} the ${validPanelId} panel.`);
  },
)
```

Note: tool inputs are *data* (`panelId`, `visible`), not *decisions*. There is no `summarize_and_open_relevant_panel` workflow tool — the agent composes primitives.

## 4. Tools go through a `ToolExecutionGate` for human-in-the-loop

Every UI mutation wraps the controller call in `gate.execute(...)`. The gate routes through the user's permission mode (`agent-ipc-handlers.ts`), so the agent has the *capability* but supervision is a separate layer (`docs/architecture.md:115`). Read tools (`editor_get_frontmatter`) skip the gate; writes go through it.

This separates two concerns that are easy to conflate:
- **Capability**: can the agent reach this verb at all?
- **Authorization**: should this specific invocation execute now, or wait for a human?

Mirror today doesn't need either side because the agent has no verbs. When it adds them, both questions surface together.

## 5. Parity is enforced by a checklist rule + a code-review agent

`.claude/rules/agent-parity.md` is auto-loaded under `paths: src/preload/**, src/main/ipc/**, src/main/agent/**, src/main/menu.ts, packages/core/src/ipc.ts`. It mandates that **in the same commit** as a new IPC method, the diff must:

1. Add the matching MCP tool in the right family (`workspace-tools`, `editor-tools`, `ui-tools`, `app-tools`).
2. Both routes call the same controller method — do not duplicate logic in the tool.
3. Update the system prompt (`src/main/agent/system-prompt.ts`) so the agent knows the capability exists at runtime. *A tool the agent doesn't know about is invisible.*
4. Register the tool in `createGreyboardTools()` if a family was added.

Reverse rule: a new MCP tool requires an equivalent user affordance unless explicitly exempt. Exemptions are enumerated (auth ceremony, native OS dialogs, permission approval, update consent — clearly human-only gestures).

`.claude/agents/code-review/agent-parity.md` enforces this on every PR. Mirror's `code-review-agent-native` is the same idea, but its parity surface is "RAG ingestion + system-prompt" rather than "IPC ↔ MCP tool."

## 6. Worked example — "show me the latest article"

In Greyboard's model, the visitor's question would resolve as:

1. Agent calls `editor_get_frontmatter` (or a workspace-tools list query) to find the latest article.
2. Agent calls `editor_open_file({ path })`.
3. The MCP handler runs `gate.execute(...)` → user sees an approval prompt (or auto-approves in `acceptEdits` mode).
4. `uiController.openFile(path)` → IPC push → renderer's `useAgentIpcBridge` receives → editor panel updates.

Same code path the user would hit by clicking a file in the tree.

## 7. Mapping to Mirror

Mirror's stack (Convex + Next.js + React) is different in transport (no IPC, no preload, no MCP server) but the *shape* transfers cleanly. To give Mirror's clone the same UI-control capability:

### 7a. Define a single dispatcher, not two parallel ones

Today, navigation in Mirror happens via Next.js routing — `router.push("/[username]/articles/[slug]")` from a click handler in the content panel. The agent equivalent should call **the same dispatcher**, not its own router.push.

Concretely: a new `useCloneActions` hook (in `apps/mirror/features/chat/hooks/`) exposes the verbs both sides need:

```ts
type CloneAction =
  | { kind: "navigate"; target: "article" | "post" | "bio"; slug?: string }
  | { kind: "openPanel"; panel: "content" | "interaction" }
  | { kind: "setTone"; preset: TonePreset };
```

The user's existing buttons call `dispatch(action)`; the chat-tool handler also calls `dispatch(action)`. The dispatcher does the actual `router.push` / Convex mutation / panel toggle.

This is the equivalent of Greyboard's `UiController` — one interface, two callers.

### 7b. Register tools on `cloneAgent`

`packages/convex/convex/chat/agent.ts:33-37` currently constructs the agent with `instructions: ""` and no `tools`. The `@convex-dev/agent` `Agent` constructor accepts a `tools` map; that's where parity tools land.

Tool design — keep it data-shaped, not decision-shaped:

```ts
// Good — data primitive
navigate_to_content({ kind: "article" | "post", slug: string })
get_latest_published({ kind: "article" | "post", limit?: number })

// Bad — encoded business logic
show_visitor_relevant_article({ topic: string })
```

The agent composes `get_latest_published` + `navigate_to_content` itself. Same instinct as Greyboard's `editor_get_frontmatter` + `editor_open_file`.

### 7c. Pin the tool's data plane to the existing isolation boundary

The same `userId` filter that `chat/actions.ts:110-118` uses on `vectorSearch` must apply to every tool's data resolution. A clone can only navigate within its profile owner's content. This extends `.claude/rules/embeddings.md`'s cross-user isolation invariant from the read path (RAG) to the action path (tools). Concretely: any `getLatestPublished` query the agent calls must take `userId` server-side from the conversation's `profileOwnerId`, never from a tool argument.

This is the agent-native security bug the `code-review-agent-native` reviewer would flag if a tool exposed `userId` as input.

### 7d. Permission gate model is different but the shape rhymes

Mirror's chat is sometimes used by anonymous visitors (the profile owner is not the chat user), so the gate model can't be Greyboard's "ask the user to approve every write." Reasonable defaults:

- **Read tools** (`get_latest_published`, future `search_content`): always allowed; visitors expect the agent to surface stuff.
- **UI navigation tools** (`navigate_to_content`, `open_panel`): auto-allowed. The visitor sees the panel change and can navigate away. No write to user state.
- **Write tools** (future: `agent_drafts_a_bio_entry`, `agent_edits_a_post`): only when the chat user *is* the profile owner. Other cases reject at the tool boundary, mirroring `authMutation`'s pattern.

The gate is one place, like Greyboard's `ToolExecutionGate` — not scattered across each tool.

### 7e. Promote parity to AGENTS.md

Greyboard's win is structural: the principle is on the front page. Mirror should:

1. Add a top-level "Agent Parity" bullet to `AGENTS.md` § Core Principles.
2. Add `.claude/rules/agent-parity.md` with `paths: apps/mirror/features/chat/**, packages/convex/convex/chat/**` (and any new "user can do X" surface) so it auto-loads when relevant code is touched.
3. Tighten the `code-review-agent-native` reviewer to also check the action surface (today it focuses on RAG ingestion + system-prompt mention).

## 8. Concrete differences vs. Mirror today

| Dimension                     | Greyboard                                                     | Mirror today                              |
|-------------------------------|---------------------------------------------------------------|-------------------------------------------|
| Agent verbs                   | ~15 MCP tools across 4 families                              | 0 (text emission only)                    |
| Controller layer              | `UiController` interface, one impl, two callers              | Does not exist                            |
| Tool/IPC channel definition   | Single `IpcChannel` enum + `GreyboardApi` type, `satisfies`-checked | N/A                                       |
| Permission gate               | `ToolExecutionGate` with read/write distinction              | N/A                                       |
| Parity rule auto-load         | `paths: src/preload/**, src/main/ipc/**, src/main/agent/**`  | `paths: packages/convex/convex/embeddings/**` (RAG-side only) |
| Parity rule in AGENTS.md      | Top-level Core Principle                                      | Implicit, lives in reviewer prompt        |
| RAG-side parity               | N/A (no RAG; agent reads files directly)                     | Strong (`embeddingSourceTableValidator` + reviewer) |

## 9. What to lift, in priority order

1. **Promote parity to AGENTS.md** as a Core Principle. Cheapest move; biggest cultural lift.
2. **Define the `CloneAction` dispatcher** (`apps/mirror/features/chat/lib/clone-actions.ts` or similar). One interface, two callers — the user's UI and the agent's tool handler. This is the architectural unlock; everything else composes on top.
3. **Register `navigate_to_content` and `get_latest_published` tools on `cloneAgent`.** Smallest meaningful tool surface that demonstrates the pattern. Pin both to `profileOwnerId` server-side.
4. **System-prompt mention.** Same pattern as the bio noun-test gap (FG_124) — the agent must know the verbs exist.
5. **`.claude/rules/agent-parity.md`** auto-loaded under chat paths, with a checklist mirroring Greyboard's.
6. **Permission gate.** Defer until first write tool lands; until then read + nav tools don't need it.

## Sources

- `greyboard/agents.md:35` — Core Principle statement
- `greyboard/docs/architecture.md:91-125` — § Agent parity
- `greyboard/.claude/rules/agent-parity.md` — checklist rule
- `greyboard/.claude/agents/code-review/agent-parity.md` — review enforcement
- `greyboard/src/main/agent/greyboard-tools.ts:14-46` — `UiController` interface, tool registration
- `greyboard/src/main/agent/agent-ipc-handlers.ts:73-113` — `UiController` impl
- `greyboard/src/main/agent/tools/ui-tools.ts` — UI tool definitions
- `greyboard/src/main/agent/tools/editor-tools.ts:54-76` — `editor_open_file` (the `navigate_to_content` analog)
- `greyboard/src/renderer/hooks/use-agent-ipc-bridge.ts` — renderer-side dispatcher
- Mirror counterparts: `packages/convex/convex/chat/agent.ts:33-37`, `packages/convex/convex/chat/actions.ts:76-146`, `.claude/agents/code-review/agent-native.md`
