import { v, type Infer } from "convex/values";
import { type DefaultProfileSection } from "../content/href";

// Keep in sync with DEFAULT_PROFILE_SECTION_VALUES in
// packages/convex/convex/content/href.ts.
export const defaultProfileSectionValidator = v.union(
  v.literal("bio"),
  v.literal("contact"),
  v.literal("posts"),
  v.literal("articles"),
);

// Drift guard: the validator must accept exactly the same literals listed in
// `DEFAULT_PROFILE_SECTION_VALUES`. Adding a new section without widening
// this validator — or vice versa — is a compile-time error on the
// assignment below. Without this pin a stored `defaultProfileSection`
// could silently fall through to the `"posts"` default after a future
// schema widening.
type _Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
const _defaultProfileSectionDriftCheck: _Equal<
  Infer<typeof defaultProfileSectionValidator>,
  DefaultProfileSection
> = true;
void _defaultProfileSectionDriftCheck;
