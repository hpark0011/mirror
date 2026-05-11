"use client";

function formatTimestamp(value: number): string {
  return new Date(value).toLocaleString();
}

function TimestampField({
  label,
  value,
  testId,
}: {
  label: string;
  value: number | null;
  testId: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div>{label}</div>
      <div data-testid={testId} className="text-foreground">
        {value !== null ? formatTimestamp(value) : "—"}
      </div>
    </div>
  );
}

export interface PostMetadataTimestampsProps {
  createdAt: number | null;
  publishedAt: number | null;
}

export function PostMetadataTimestamps({
  createdAt,
  publishedAt,
}: PostMetadataTimestampsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 text-[13px] text-muted-foreground">
      <TimestampField
        label="Created"
        value={createdAt}
        testId="post-created-at"
      />
      <TimestampField
        label="Published"
        value={publishedAt}
        testId="post-published-at"
      />
    </div>
  );
}
