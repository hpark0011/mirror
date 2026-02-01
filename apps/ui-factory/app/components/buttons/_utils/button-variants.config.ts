import type React from "react";
import type { Button } from "@feel-good/ui/primitives/button";

export type ButtonVariant = NonNullable<
  React.ComponentProps<typeof Button>["variant"]
>;

/**
 * Ordered list of button variants for consistent display across the UI Factory.
 * This ensures all button showcases follow the same variant ordering.
 */
export const BUTTON_VARIANTS: ButtonVariant[] = [
  "primary",
  "default",
  "secondary",
  "destructive",
  "outline",
  "ghost",
  "link",
] as const;
