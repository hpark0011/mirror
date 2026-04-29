import type { Id } from "@feel-good/convex/convex/_generated/dataModel";

/**
 * Upload a file to Convex storage using a presigned URL produced by a
 * `ctx.storage.generateUploadUrl()` mutation. Returns the resulting
 * `Id<"_storage">` to persist on the owning record.
 */
export async function uploadToStorage(
  uploadUrl: string,
  file: File,
): Promise<Id<"_storage">> {
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });

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
