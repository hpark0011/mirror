"use client";

import {
  type ImportResult,
  type ImportStatus,
} from "../hooks/use-create-post-from-file";

/**
 * Map known machine-readable failure reasons from
 * `importMarkdownInlineImagesCore` to user-facing copy. Unknown reasons
 * fall through verbatim so a future reason added on the backend still
 * renders something — just not as polished as the curated cases.
 */
function formatFailureReason(reason: string): string {
  switch (reason) {
    case "import-cap-exceeded":
      return "Skipped — too many images in one import. Re-import to fetch the rest.";
    case "invalid-magic-bytes":
      return "Skipped — image bytes don't match declared format.";
    default:
      return reason;
  }
}

type ImportResultStatusProps = {
  status?: ImportStatus;
  result?: ImportResult | null;
};

/**
 * Renders the inline-image import progress + result block of the
 * markdown-upload dialog. Extracted from `markdown-upload-dialog.tsx`
 * (FG_116) to keep the dialog under the ~100-line component guideline.
 */
export function ImportResultStatus({
  status,
  result,
}: ImportResultStatusProps) {
  if (status === "importing") {
    return (
      <p className="text-sm text-foreground-muted">
        Importing inline images...
      </p>
    );
  }

  if (status === "done" && result) {
    return (
      <div className="space-y-1 text-sm">
        <p className="text-foreground-muted">
          Imported {result.imported} of{" "}
          {result.imported + result.failed} images
        </p>
        {result.failures.length > 0 && (
          <ul className="list-disc pl-5 text-destructive" role="alert">
            {result.failures.map((f) => (
              <li key={`${f.src}:${f.reason}`}>
                {f.src} — {formatFailureReason(f.reason)}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return null;
}
