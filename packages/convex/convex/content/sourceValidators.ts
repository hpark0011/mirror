import { v, type Validator } from "convex/values";
import {
  INDEXABLE_CONTENT_SOURCE_TABLES,
  NAVIGABLE_CONTENT_KINDS,
  type IndexableContentSourceTable,
  type NavigableContentKind,
} from "./sourceRegistry";

function literalUnionValidator<T extends string>(
  values: readonly T[],
): Validator<T, "required", string> {
  if (values.length === 0) {
    throw new Error("Cannot build a Convex literal union from an empty list.");
  }

  const validators = values.map((value) => v.literal(value));
  return v.union(
    ...(validators as [
      (typeof validators)[number],
      ...(typeof validators)[number][],
    ]),
  ) as Validator<T, "required", string>;
}

export const indexableContentSourceTableValidator =
  literalUnionValidator<IndexableContentSourceTable>(
    INDEXABLE_CONTENT_SOURCE_TABLES,
  );

export const navigableContentKindValidator =
  literalUnionValidator<NavigableContentKind>(NAVIGABLE_CONTENT_KINDS);
