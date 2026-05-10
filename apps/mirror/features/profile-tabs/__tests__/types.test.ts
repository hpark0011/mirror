import { describe, expect, it } from "vitest";
import {
  buildBioHref,
  buildProfileSectionHref,
} from "@feel-good/convex/convex/content/href";
import {
  getProfileTabHref,
  isProfileTabKind,
  PROFILE_TAB_DEFAULT_KIND,
  PROFILE_TAB_DISPLAY_ORDER,
  PROFILE_TAB_KINDS,
} from "../types";

describe("PROFILE_TAB_KINDS", () => {
  it("contains exactly five kinds", () => {
    expect(PROFILE_TAB_KINDS.length).toBe(5);
  });

  it("includes bio at index 2 to preserve the position-independent default", () => {
    expect(PROFILE_TAB_KINDS[2]).toBe("bio");
  });

  it("includes the canonical five kinds", () => {
    expect(PROFILE_TAB_KINDS).toEqual([
      "posts",
      "articles",
      "bio",
      "clone-settings",
      "settings",
    ]);
  });
});

describe("PROFILE_TAB_DEFAULT_KIND", () => {
  // Regression guard for issue I4: the default must remain "posts" regardless
  // of how PROFILE_TAB_KINDS is reordered.
  it("is the literal 'posts', not derived from tuple position", () => {
    expect(PROFILE_TAB_DEFAULT_KIND).toBe("posts");
    expect(isProfileTabKind(PROFILE_TAB_DEFAULT_KIND)).toBe(true);
  });
});

describe("isProfileTabKind", () => {
  it("returns true for all defined kinds", () => {
    for (const kind of PROFILE_TAB_KINDS) {
      expect(isProfileTabKind(kind)).toBe(true);
    }
  });

  it("returns true specifically for posts, articles, bio, clone-settings, settings", () => {
    expect(isProfileTabKind("posts")).toBe(true);
    expect(isProfileTabKind("articles")).toBe(true);
    expect(isProfileTabKind("bio")).toBe(true);
    expect(isProfileTabKind("clone-settings")).toBe(true);
    expect(isProfileTabKind("settings")).toBe(true);
  });

  it("returns false for unknown strings", () => {
    expect(isProfileTabKind("unknown")).toBe(false);
    expect(isProfileTabKind("dashboard")).toBe(false);
    expect(isProfileTabKind("")).toBe(false);
  });

  it("returns false for null and undefined", () => {
    expect(isProfileTabKind(null)).toBe(false);
    expect(isProfileTabKind(undefined)).toBe(false);
  });
});

describe("getProfileTabHref", () => {
  it("builds the canonical /@username/<kind> path", () => {
    expect(getProfileTabHref("alice", "posts")).toBe("/@alice/posts");
    expect(getProfileTabHref("alice", "articles")).toBe("/@alice/articles");
    expect(getProfileTabHref("alice", "bio")).toBe("/@alice/bio");
    expect(getProfileTabHref("alice", "clone-settings")).toBe(
      "/@alice/clone-settings",
    );
    expect(getProfileTabHref("alice", "settings")).toBe("/@alice/settings");
  });

  it("agrees with buildBioHref for the 'bio' kind — href-parity invariant", () => {
    // `getProfileTabHref(_, "bio")` (user-UI Bio tab) and `buildBioHref(_)`
    // (agent-side openProfileSection tool result) are two independent
    // helpers that MUST produce the same string. `.claude/rules/identifiers.md`
    // §1 + `.claude/rules/agent-parity.md` § Href-parity invariant: a
    // future template change to either without updating the other silently
    // routes the agent to a 404 while users keep working. This test fails
    // loudly on divergence.
    expect(getProfileTabHref("alice", "bio")).toBe(buildBioHref("alice"));
    expect(getProfileTabHref("rick-rubin", "bio")).toBe(
      buildBioHref("rick-rubin"),
    );
  });

  it("agrees with buildProfileSectionHref for every kind — extended href-parity invariant", () => {
    // The profile-tabs dispatcher now drives every section. Both helpers
    // (the client-side `getProfileTabHref` and the server-side
    // `buildProfileSectionHref`) MUST produce the same string for every
    // `ProfileTabKind`, not just `bio`. A drift between the two would
    // silently route the agent (which uses `buildProfileSectionHref` via
    // the chat tool) to a 404 even when the user-UI tab works.
    for (const kind of PROFILE_TAB_KINDS) {
      expect(getProfileTabHref("alice", kind)).toBe(
        buildProfileSectionHref("alice", kind),
      );
      expect(getProfileTabHref("rick-rubin", kind)).toBe(
        buildProfileSectionHref("rick-rubin", kind),
      );
    }
  });
});

describe("PROFILE_TAB_DISPLAY_ORDER", () => {
  it("places bio first in the visual order", () => {
    expect(PROFILE_TAB_DISPLAY_ORDER[0]).toBe("bio");
  });

  // Issue iter2-Finding7: catches drift when a future tab is added to one
  // constant but forgotten in the other. Asserting set-equality is the
  // bidirectional guard that TypeScript's typing alone does not provide.
  it("contains the same set of kinds as PROFILE_TAB_KINDS", () => {
    const displaySet = new Set(PROFILE_TAB_DISPLAY_ORDER);
    const kindsSet = new Set(PROFILE_TAB_KINDS);
    expect(displaySet.size).toBe(PROFILE_TAB_KINDS.length);
    expect(displaySet).toEqual(kindsSet);
  });
});
