import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { Extension } from "@tiptap/core";

/**
 * Upload result returned by the host's `onUpload` callback. The plugin uses
 * `url` as the rendered `src` and `storageId` as the cleanup-tracking key
 * (FR-01, FR-03).
 */
export type InlineImageUploadResult = {
  storageId: string;
  url: string;
};

export type InlineImageUploadOptions = {
  onUpload: (file: File) => Promise<InlineImageUploadResult>;
};

/** Plugin key — exported for tests and consumers needing to inspect state. */
export const inlineImageUploadPluginKey = new PluginKey<DecorationSet>(
  "inline-image-upload",
);

/**
 * Object-identity placeholder id. Two simultaneous uploads each get a fresh
 * `id = {}` so `findPlaceholder` can locate the right one regardless of
 * resolution order (NFR-05).
 */
type PlaceholderId = Record<string, never>;

type PlaceholderMeta = {
  add?: { id: PlaceholderId; pos: number };
  remove?: { id: PlaceholderId };
};

/** Construct the placeholder DOM element used by the widget decoration. */
function createPlaceholderElement(): HTMLElement {
  const el = document.createElement("span");
  el.className = "inline-image-upload-placeholder";
  el.setAttribute("data-inline-image-placeholder", "true");
  return el;
}

/**
 * Locate a placeholder's current document position by its object-identity id.
 * Returns null if the placeholder no longer exists (e.g. user deleted the
 * region it was anchored to during the async upload).
 */
export function findPlaceholder(
  state: EditorState,
  id: PlaceholderId,
): number | null {
  const decorations = inlineImageUploadPluginKey.getState(state);
  if (!decorations) return null;
  const found = decorations.find(undefined, undefined, (spec) => spec.id === id);
  return found.length > 0 ? found[0].from : null;
}

/**
 * Returns true while at least one inline-image upload placeholder is live in
 * the editor state. Save flows that snapshot `editor.getJSON()` should gate
 * on this — widget decorations are not real ProseMirror nodes, so a save
 * during the upload window would persist a body with the image missing
 * (FG_092 / spec NFR-05). Boolean only — does not leak the DecorationSet.
 */
export function hasPendingUploads(state: EditorState): boolean {
  const decorations = inlineImageUploadPluginKey.getState(state);
  if (!decorations) return false;
  return decorations.find().length > 0;
}

/** Pull `File` objects with an `image/*` MIME type out of a DataTransfer. */
function collectImageFiles(dataTransfer: DataTransfer | null): File[] {
  if (!dataTransfer) return [];
  const files: File[] = [];
  for (let i = 0; i < dataTransfer.files.length; i += 1) {
    const file = dataTransfer.files[i];
    if (file && file.type.startsWith("image/")) {
      files.push(file);
    }
  }
  return files;
}

/**
 * Insert a placeholder, kick off the upload, and on resolution replace the
 * placeholder with the final image node. Position-drift safe via
 * `DecorationSet.map`; unmount-safe via `view.dom.isConnected` (NFR-05).
 */
function startUpload(
  view: EditorView,
  pos: number,
  file: File,
  onUpload: (file: File) => Promise<InlineImageUploadResult>,
): void {
  const id: PlaceholderId = Object.freeze({});
  const tr = view.state.tr.setMeta(inlineImageUploadPluginKey, {
    add: { id, pos },
  } satisfies PlaceholderMeta);
  view.dispatch(tr);

  onUpload(file).then(
    (result) => {
      if (!view.dom.isConnected) {
        // Editor unmounted mid-upload — discard placeholder and do NOT
        // dispatch. Dispatching to a destroyed view risks calling
        // updateState on detached DOM. The decoration leaks until GC,
        // which is harmless because the editor itself is unreachable.
        // Spec data-flow §11 says "remove decoration only; do not
        // dispatch", but in practice the safest move is to skip both —
        // the lingering decoration is invisible after unmount.
        return;
      }
      const finalPos = findPlaceholder(view.state, id);
      const removeTr = view.state.tr.setMeta(inlineImageUploadPluginKey, {
        remove: { id },
      } satisfies PlaceholderMeta);
      if (finalPos === null) {
        // User deleted the placeholder region during upload — silent discard.
        view.dispatch(removeTr);
        return;
      }
      const imageType = view.state.schema.nodes.image;
      if (!imageType) {
        view.dispatch(removeTr);
        return;
      }
      const node = imageType.create({
        src: result.url,
        storageId: result.storageId,
      });
      view.dispatch(removeTr.replaceWith(finalPos, finalPos, node));
    },
    (error) => {
      console.error("[inline-image-upload-plugin] upload failed", error);
      // Editor unmounted before reject handled — skip dispatch (see resolve
      // path comment above for rationale). Decoration leak is harmless.
      if (!view.dom.isConnected) return;
      view.dispatch(
        view.state.tr.setMeta(inlineImageUploadPluginKey, {
          remove: { id },
        } satisfies PlaceholderMeta),
      );
    },
  );
}

/**
 * ProseMirror plugin that intercepts paste/drop image files, inserts a widget
 * decoration as an upload placeholder, and replaces it with an image node
 * carrying `src` + `storageId` once the host's `onUpload` resolves.
 *
 * Concurrency / unmount semantics (NFR-05):
 *   - Each upload is keyed by a fresh `id = Object.freeze({})` so two pastes
 *     ~200ms apart never collide.
 *   - Decorations are mapped through every transaction so the resolution can
 *     find its position even after subsequent edits.
 *   - `view.dom.isConnected` guards every post-upload dispatch.
 */
export function createInlineImageUploadPlugin(
  options: InlineImageUploadOptions,
): Plugin<DecorationSet> {
  const { onUpload } = options;

  return new Plugin<DecorationSet>({
    key: inlineImageUploadPluginKey,
    state: {
      init(): DecorationSet {
        return DecorationSet.empty;
      },
      apply(tr: Transaction, set: DecorationSet): DecorationSet {
        let next = set.map(tr.mapping, tr.doc);
        const meta = tr.getMeta(inlineImageUploadPluginKey) as
          | PlaceholderMeta
          | undefined;
        if (meta?.add) {
          const widget = Decoration.widget(meta.add.pos, createPlaceholderElement, {
            id: meta.add.id,
            // Side > 0 keeps the widget after a position-equal text insertion,
            // which matches the user's expectation that the image appears
            // where the caret was when they pasted.
            side: 1,
          });
          next = next.add(tr.doc, [widget]);
        }
        if (meta?.remove) {
          const target = next.find(
            undefined,
            undefined,
            (spec) => spec.id === meta.remove!.id,
          );
          if (target.length > 0) {
            next = next.remove(target);
          }
        }
        return next;
      },
    },
    props: {
      decorations(state: EditorState): DecorationSet | undefined {
        return inlineImageUploadPluginKey.getState(state);
      },
      handlePaste(view, event) {
        const files = collectImageFiles(event.clipboardData);
        if (files.length === 0) return false;
        event.preventDefault();
        // Chain placeholders at distinct, sequentially-incrementing positions
        // (FG_099). `setMeta(add)` does not modify the document or selection,
        // so re-reading `view.state.selection.from` would yield the same value
        // for every iteration. Manually advance the local `insertPos` so each
        // placeholder is anchored to its own document position. Clamp to the
        // current doc size so an end-of-doc caret with multiple files does not
        // produce out-of-range positions.
        let insertPos = view.state.selection.from;
        for (const file of files) {
          const safePos = Math.min(insertPos, view.state.doc.content.size);
          startUpload(view, safePos, file, onUpload);
          insertPos = safePos + 1;
        }
        return true;
      },
      handleDrop(view, event) {
        const files = collectImageFiles(event.dataTransfer);
        if (files.length === 0) return false;
        event.preventDefault();
        const coords = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });
        // Same chaining strategy as handlePaste — placeholder dispatches do
        // not advance the selection or document, so we maintain `insertPos`
        // locally and bump it by 1 per iteration to keep placeholders
        // sequentially distinct.
        let insertPos = coords?.pos ?? view.state.selection.from;
        for (const file of files) {
          const safePos = Math.min(insertPos, view.state.doc.content.size);
          startUpload(view, safePos, file, onUpload);
          insertPos = safePos + 1;
        }
        return true;
      },
    },
  });
}

/**
 * Tiptap Extension wrapper around `createInlineImageUploadPlugin`. Use this
 * when registering through `useEditor({ extensions: [...] })` — the plugin
 * itself is also exported for headless ProseMirror tests.
 */
export function createInlineImageUploadExtension(
  options: InlineImageUploadOptions,
): Extension {
  return Extension.create({
    name: "inlineImageUpload",
    addProseMirrorPlugins() {
      return [createInlineImageUploadPlugin(options)];
    },
  });
}
