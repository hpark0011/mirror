"use client";

import { Button } from "@feel-good/ui/primitives/button";
import { Icon } from "@feel-good/ui/components/icon";
import { type ContactEntry } from "../types";
import { CONTACT_KIND_PRESENTATION } from "../lib/contact-kind-presentation";
import { safeHttpsUrl } from "../lib/safe-http-url";

type ContactEntryCardProps = {
  entry: ContactEntry;
  isOwner: boolean;
  onEdit: (entry: ContactEntry) => void;
  onDelete: (entry: ContactEntry) => void;
  isDeleting?: boolean;
};

export function ContactEntryCard({
  entry,
  isOwner,
  onEdit,
  onDelete,
  isDeleting = false,
}: ContactEntryCardProps) {
  const presentation = CONTACT_KIND_PRESENTATION[entry.kind];
  const trimmed = entry.value.trim();

  // `mailto:` is always safe; URL kinds must pass `safeHttpsUrl` before
  // becoming an anchor target. If the value cannot be sanitized we fall back
  // to plain text — better than rendering a potentially malformed link.
  const href =
    entry.kind === "email"
      ? presentation.hrefFor(trimmed)
      : safeHttpsUrl(trimmed);

  return (
    <article
      data-testid="contact-entry-card"
      data-kind={entry.kind}
      className="flex text-foreground gap-4 group items-center"
    >
      <div className="flex items-center gap-2 max-w-[160px] w-full">
        <Icon name={presentation.iconName} className="size-4 text-icon-light" />
        <p className="text-[15px] text-foreground leading-[1.2] whitespace-nowrap">
          {presentation.label}
        </p>
      </div>
      <div className="w-full flex items-center justify-between">
        {href
          ? (
            <a
              href={href}
              target={entry.kind === "email" ? undefined : "_blank"}
              rel={entry.kind === "email" ? undefined : "noopener noreferrer"}
              className="text-[15px] text-primary underline-offset-2 hover:underline leading-[1.2] truncate"
              data-testid="contact-entry-link"
            >
              {trimmed}
            </a>
          )
          : (
            <span className="text-[15px] text-muted-foreground leading-[1.2] truncate">
              {trimmed}
            </span>
          )}

        {isOwner
          ? (
            <div className="hidden shrink-0 items-center gap-1.5 group-hover:flex group-focus-within:flex h-[16px] ml-3">
              <Button
                size="sm"
                variant="link"
                onClick={() => onEdit(entry)}
                data-testid="contact-entry-edit"
                className="h-fit px-0 underline-offset-2 font-normal"
              >
                Edit
              </Button>
              <span className="text-xs pb-0.5">/</span>
              <Button
                size="sm"
                variant="link"
                onClick={() => onDelete(entry)}
                disabled={isDeleting}
                data-testid="contact-entry-delete"
                className="h-fit px-0 underline-offset-2 font-normal"
              >
                Delete
              </Button>
            </div>
          )
          : null}
      </div>
    </article>
  );
}
