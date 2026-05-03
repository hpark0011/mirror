// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { type DecorationSet } from "@tiptap/pm/view";
import { createInlineImageExtension } from "../lib/inline-image-extension";
import {
  createInlineImageUploadExtension,
  hasPendingUploads,
  inlineImageUploadPluginKey,
} from "../lib/inline-image-upload-plugin";

type DeferredUpload = {
  promise: Promise<{ storageId: string; url: string }>;
  resolve: (v: { storageId: string; url: string }) => void;
  reject: (e: unknown) => void;
};

function deferred(): DeferredUpload {
  let resolve!: DeferredUpload["resolve"];
  let reject!: DeferredUpload["reject"];
  const promise = new Promise<{ storageId: string; url: string }>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type Harness = {
  editor: Editor;
  fileFor: (name?: string) => File;
  paste: (file: File | File[]) => boolean;
  destroy: () => void;
};

function mountEditor(
  onUpload: (file: File) => Promise<{ storageId: string; url: string }>,
): Harness {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const editor = new Editor({
    element: host,
    extensions: [
      StarterKit,
      createInlineImageExtension(),
      createInlineImageUploadExtension({ onUpload }),
    ],
    content: "<p>hello world</p>",
  });

  const fileFor = (name = "a.png") =>
    new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], name, { type: "image/png" });

  const paste = (fileOrFiles: File | File[]) => {
    const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
    const dt = new DataTransfer();
    for (const f of files) dt.items.add(f);
    const event = new Event("paste", { bubbles: true, cancelable: true }) as unknown as ClipboardEvent;
    Object.defineProperty(event, "clipboardData", { value: dt });
    return editor.view.someProp("handlePaste", (handler) => handler(editor.view, event)) === true;
  };

  return {
    editor,
    fileFor,
    paste,
    destroy: () => {
      editor.destroy();
      host.remove();
    },
  };
}

function decorationCount(editor: Editor): number {
  const set = inlineImageUploadPluginKey.getState(editor.state) as DecorationSet | undefined;
  if (!set) return 0;
  return set.find().length;
}

function imageNodes(editor: Editor): Array<{ src?: string; storageId?: string }> {
  const out: Array<{ src?: string; storageId?: string }> = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "image") {
      out.push({ src: node.attrs.src, storageId: node.attrs.storageId });
    }
  });
  return out;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("inline image upload plugin", () => {
  it("inserts a Decoration.widget placeholder on paste", () => {
    const d = deferred();
    const onUpload = vi.fn(() => d.promise);
    const h = mountEditor(onUpload);
    expect(decorationCount(h.editor)).toBe(0);

    const handled = h.paste(h.fileFor());
    expect(handled).toBe(true);
    expect(decorationCount(h.editor)).toBe(1);
    expect(onUpload).toHaveBeenCalledTimes(1);

    h.destroy();
  });

  it("replaces the placeholder with an image node when upload resolves", async () => {
    const d = deferred();
    const onUpload = vi.fn(() => d.promise);
    const h = mountEditor(onUpload);
    h.paste(h.fileFor());
    expect(imageNodes(h.editor)).toHaveLength(0);

    d.resolve({ storageId: "store-id-1", url: "https://cdn.example/1.png" });
    await d.promise;
    await Promise.resolve(); // flush microtasks for the .then handler

    expect(decorationCount(h.editor)).toBe(0);
    const imgs = imageNodes(h.editor);
    expect(imgs).toHaveLength(1);
    expect(imgs[0]?.src).toBe("https://cdn.example/1.png");
    expect(imgs[0]?.storageId).toBe("store-id-1");

    h.destroy();
  });

  it("removes the placeholder and inserts no image when upload rejects", async () => {
    const d = deferred();
    const onUpload = vi.fn(() => d.promise);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const h = mountEditor(onUpload);
    h.paste(h.fileFor());
    expect(decorationCount(h.editor)).toBe(1);

    d.reject(new Error("network down"));
    await d.promise.catch(() => {});
    await Promise.resolve();
    await Promise.resolve();

    expect(decorationCount(h.editor)).toBe(0);
    expect(imageNodes(h.editor)).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalled();

    h.destroy();
  });

  it("two concurrent uploads each replace their own placeholder regardless of resolution order", async () => {
    const d1 = deferred();
    const d2 = deferred();
    const queue = [d1, d2];
    const onUpload = vi.fn(() => queue.shift()!.promise);
    const h = mountEditor(onUpload);

    h.paste(h.fileFor("first.png"));
    h.paste(h.fileFor("second.png"));
    expect(decorationCount(h.editor)).toBe(2);

    // Resolve in REVERSE order — second upload finishes first.
    d2.resolve({ storageId: "store-2", url: "https://cdn.example/2.png" });
    await d2.promise;
    await Promise.resolve();

    expect(decorationCount(h.editor)).toBe(1);
    let imgs = imageNodes(h.editor);
    expect(imgs).toHaveLength(1);
    expect(imgs[0]?.storageId).toBe("store-2");

    d1.resolve({ storageId: "store-1", url: "https://cdn.example/1.png" });
    await d1.promise;
    await Promise.resolve();

    expect(decorationCount(h.editor)).toBe(0);
    imgs = imageNodes(h.editor);
    expect(imgs).toHaveLength(2);
    // Resolution order was d2 → d1. Both paste events captured the same
    // initial selection.from = N. When d2 resolved first, it inserted an
    // image at N and the still-pending decoration-1 mapped forward to N+1.
    // When d1 resolved, it landed at N+1. Document order:
    //   - index 0 (was decoration-2's pos): store-2
    //   - index 1 (was decoration-1's mapped pos after d2's insert): store-1
    // We assert exact order, NOT .sort(), so an off-by-one in
    // `findPlaceholder` that swapped positions would fail this test.
    expect(imgs.map((i) => i.storageId)).toEqual(["store-2", "store-1"]);

    h.destroy();
  });

  it("chains placeholders at distinct positions when a single paste carries multiple files (FG_099)", () => {
    // Single ClipboardEvent carrying TWO image Files — the production shape
    // when a user pastes a multi-image clipboard payload. The previous bug:
    // both placeholders landed at the same pos because `view.state.selection.from`
    // was sampled once outside the loop and `setMeta(add)` for a widget
    // decoration does not advance the selection.
    const d1 = deferred();
    const d2 = deferred();
    const queue = [d1, d2];
    const onUpload = vi.fn(() => queue.shift()!.promise);
    const h = mountEditor(onUpload);

    // Single paste event with two files via a real DataTransfer.
    const handled = h.paste([h.fileFor("first.png"), h.fileFor("second.png")]);
    expect(handled).toBe(true);
    expect(onUpload).toHaveBeenCalledTimes(2);

    const set = inlineImageUploadPluginKey.getState(h.editor.state) as
      | DecorationSet
      | undefined;
    expect(set).toBeDefined();
    const placeholders = set!.find();
    expect(placeholders).toHaveLength(2);

    // Distinct, sequentially-chained positions — NOT both at the same pos.
    const positions = placeholders.map((p) => p.from);
    expect(new Set(positions).size).toBe(2);
    const sorted = [...positions].sort((a, b) => a - b);
    expect(sorted[1]! - sorted[0]!).toBe(1);

    h.destroy();
  });

  it("silently discards when the user deletes the placeholder region during upload", async () => {
    const d = deferred();
    const onUpload = vi.fn(() => d.promise);
    const h = mountEditor(onUpload);
    h.paste(h.fileFor());
    expect(decorationCount(h.editor)).toBe(1);

    // Wipe the entire document — the placeholder's anchor is deleted.
    h.editor.commands.clearContent();

    d.resolve({ storageId: "store-1", url: "https://cdn.example/1.png" });
    await d.promise;
    await Promise.resolve();
    await Promise.resolve();

    expect(decorationCount(h.editor)).toBe(0);
    expect(imageNodes(h.editor)).toHaveLength(0);

    h.destroy();
  });

  it("no-ops dispatch when the editor view detaches mid-upload (NFR-05)", async () => {
    const d = deferred();
    const onUpload = vi.fn(() => d.promise);
    const h = mountEditor(onUpload);

    // Spy BEFORE pasting so we capture the placeholder-add dispatch too,
    // then snapshot the call count to compare against post-detach activity.
    const dispatchSpy = vi.spyOn(h.editor.view, "dispatch");

    h.paste(h.fileFor());
    // Sanity: the placeholder-add transaction was dispatched.
    expect(dispatchSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    const callsBeforeDetach = dispatchSpy.mock.calls.length;

    // Detach the view's DOM — simulates editor unmount.
    h.editor.view.dom.remove();
    expect(h.editor.view.dom.isConnected).toBe(false);

    d.resolve({ storageId: "store-1", url: "https://cdn.example/1.png" });
    await d.promise;
    await Promise.resolve();
    await Promise.resolve();

    // The plugin must NOT call view.dispatch after detach — proves the
    // `view.dom.isConnected` guard short-circuited before any transaction.
    expect(dispatchSpy.mock.calls.length).toBe(callsBeforeDetach);
    // No image node inserted (dispatch was guarded out entirely).
    expect(imageNodes(h.editor)).toHaveLength(0);
    // Intentional design: when the view is detached we do NOT dispatch a
    // remove-meta transaction (calling dispatch on a destroyed view risks
    // updateState on a detached DOM tree). The editor is GC'd shortly so
    // the lingering decoration is harmless. See production code comment
    // in inline-image-upload-plugin.ts ~line 92.
    expect(decorationCount(h.editor)).toBe(1);

    h.destroy();
  });

  it("hasPendingUploads returns true while a placeholder is live and false after replacement", async () => {
    const d = deferred();
    const onUpload = vi.fn(() => d.promise);
    const h = mountEditor(onUpload);

    // No paste yet — empty DecorationSet.
    expect(hasPendingUploads(h.editor.state)).toBe(false);

    h.paste(h.fileFor());
    // Placeholder is live during the upload window — Save must be gated.
    expect(hasPendingUploads(h.editor.state)).toBe(true);

    d.resolve({ storageId: "store-1", url: "https://cdn.example/1.png" });
    await d.promise;
    await Promise.resolve();
    await Promise.resolve();

    // Placeholder replaced with a real image node — Save can proceed.
    expect(hasPendingUploads(h.editor.state)).toBe(false);

    h.destroy();
  });

  it("tracks decoration through document mutations via DecorationSet.map", async () => {
    const d = deferred();
    const onUpload = vi.fn(() => d.promise);
    const h = mountEditor(onUpload);

    // Move caret to end of "hello world" (pos 12) before pasting.
    h.editor.commands.setTextSelection(h.editor.state.doc.content.size);
    h.paste(h.fileFor());

    // Insert text at the start of the doc — placeholder position should drift.
    h.editor.commands.setTextSelection(1);
    h.editor.commands.insertContent("PREFIX ");
    expect(decorationCount(h.editor)).toBe(1);

    d.resolve({ storageId: "drift-1", url: "https://cdn.example/d.png" });
    await d.promise;
    await Promise.resolve();
    await Promise.resolve();

    const imgs = imageNodes(h.editor);
    expect(imgs).toHaveLength(1);
    expect(imgs[0]?.storageId).toBe("drift-1");
    expect(decorationCount(h.editor)).toBe(0);

    h.destroy();
  });
});
