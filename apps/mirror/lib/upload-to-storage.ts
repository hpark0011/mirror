import { type Id } from "@feel-good/convex/convex/_generated/dataModel";

type UploadToStorageOptions = {
  signal?: AbortSignal;
};

/**
 * Upload a file to Convex storage using a presigned URL produced by a
 * `ctx.storage.generateUploadUrl()` mutation. Returns the resulting
 * `Id<"_storage">` to persist on the owning record.
 */
export async function uploadToStorage(
  uploadUrl: string,
  file: File,
  options: UploadToStorageOptions = {},
): Promise<Id<"_storage">> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);
  const abortFromCaller = () => controller.abort();

  if (options.signal?.aborted) {
    controller.abort();
  } else {
    options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  let response: Response;
  try {
    response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }

  if (!response.ok) {
    throw new Error(
      `Upload failed (${response.status} ${response.statusText})`,
    );
  }

  const { storageId } = (await response.json()) as {
    storageId: Id<"_storage">;
  };
  return storageId;
}
