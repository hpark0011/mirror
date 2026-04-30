"use client";

type BioFormErrorProps = {
  message: string | null;
};

/**
 * Inline error banner rendered inside the bio form dialog's `errorSlot` when a
 * create/update mutation rejects (e.g. the Wave-1 soft-cap "Bio entry limit
 * reached (50)" ConvexError on the 51st create).
 *
 * Returns `null` when there is no message, so the call site can pass the
 * component unconditionally.
 */
export function BioFormError({ message }: BioFormErrorProps) {
  if (!message) return null;
  return (
    <p
      role="alert"
      data-testid="bio-form-error"
      className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </p>
  );
}
