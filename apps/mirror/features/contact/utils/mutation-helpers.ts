import { type ContactEntry } from "../types";
import { type ContactEntryFormValues } from "../lib/schemas/contact-entry.schema";

/**
 * Maps RHF form values to the shape expected by the contact create/update
 * Convex mutations. Trim the payload here so optimistic-update entries match
 * what the server will persist (which also trims at the mutation boundary).
 */
export function toCreateMutationArgs(values: ContactEntryFormValues): {
  kind: ContactEntry["kind"];
  value: string;
} {
  return {
    kind: values.kind,
    value: values.value.trim(),
  };
}

export function toUpdateMutationArgs(values: ContactEntryFormValues): {
  value: string;
} {
  return {
    value: values.value.trim(),
  };
}
