"use client";

import Link from "next/link";
import { ArrowshapeLeftFillIcon } from "@feel-good/icons";
import { Button } from "@feel-good/ui/primitives/button";

type WorkspaceBackButtonProps =
  | { href: string }
  | { onClick: () => void; disabled?: boolean; ariaLabel?: string };

export function WorkspaceBackButton(props: WorkspaceBackButtonProps) {
  if ("href" in props) {
    return (
      <Button
        asChild
        variant="wrapper"
        size="wrapper-xs"
        className="gap-1.5 relative left-[-1px]"
        data-testid="workspace-back-button"
      >
        <Link href={props.href} scroll={false}>
          <ArrowshapeLeftFillIcon className="size-4.5 transition-all duration-100" />
          Back
        </Link>
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant="wrapper"
      size="wrapper-xs"
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props.ariaLabel}
      className="gap-1.5 relative left-[-1px]"
      data-testid="workspace-back-button"
    >
      <ArrowshapeLeftFillIcon className="size-4.5 transition-all duration-100" />
      Back
    </Button>
  );
}
