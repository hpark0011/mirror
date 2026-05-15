import { describe, expect, it } from "vitest";
import {
  buildBioHref,
  buildContactHref,
  buildContentEditHref,
  buildContentHref,
  buildProfileSectionHref,
  buildProjectsHref,
} from "@feel-good/convex/convex/content/href";
import {
  getContentEditHref,
  getContentHref,
} from "@/features/content";
import {
  getProfileTabHref,
  isProfileTabKind,
  PROFILE_TAB_DEFAULT_KIND,
  PROFILE_TAB_DISPLAY_ORDER,
  PROFILE_TAB_KINDS,
} from "../types";

describe("PROFILE_TAB_KINDS", () => {
  it("contains exactly seven kinds", () => {
    expect(PROFILE_TAB_KINDS.length).toBe(7);
  });

  it("includes bio at index 2 to preserve the position-independent default", () => {
    expect(PROFILE_TAB_KINDS[2]).toBe("bio");
  });

  it("includes the canonical seven kinds", () => {
    expect(PROFILE_TAB_KINDS).toEqual([
      "posts",
      "articles",
      "bio",
      "contact",
      "projects",
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

  it("returns true specifically for posts, articles, bio, contact, projects, clone-settings, settings", () => {
    expect(isProfileTabKind("posts")).toBe(true);
    expect(isProfileTabKind("articles")).toBe(true);
    expect(isProfileTabKind("bio")).toBe(true);
    expect(isProfileTabKind("contact")).toBe(true);
    expect(isProfileTabKind("projects")).toBe(true);
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
    expect(getProfileTabHref("alice", "contact")).toBe("/@alice/contact");
    expect(getProfileTabHref("alice", "projects")).toBe("/@alice/projects");
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

  it("agrees with buildContactHref for the 'contact' kind — href-parity invariant", () => {
    // Parallel of the bio assertion above for the contact panel.
    expect(getProfileTabHref("alice", "contact")).toBe(
      buildContactHref("alice"),
    );
    expect(getProfileTabHref("rick-rubin", "contact")).toBe(
      buildContactHref("rick-rubin"),
    );
  });

  it("agrees with buildProjectsHref for the 'projects' kind — href-parity invariant", () => {
    expect(getProfileTabHref("alice", "projects")).toBe(
      buildProjectsHref("alice"),
    );
    expect(getProfileTabHref("rick-rubin", "projects")).toBe(
      buildProjectsHref("rick-rubin"),
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

describe("buildContentEditHref", () => {
  // The configuration agent's `applyContentPatch` tool returns a server-built
  // `editHref` on draft create/update so the watcher can route the owner to
  // `/@<username>/<kind>/<slug>/edit`. Tests pin the URL template against the
  // Next.js dynamic edit route at
  // `apps/mirror/app/[username]/<kind>/[slug]/edit/page.tsx`.
  it("builds /@<username>/<kind>/<slug>/edit for posts and articles", () => {
    expect(buildContentEditHref("alice", "posts", "my-post")).toBe(
      "/@alice/posts/my-post/edit",
    );
    expect(buildContentEditHref("alice", "articles", "my-article")).toBe(
      "/@alice/articles/my-article/edit",
    );
  });

  it("agrees with the client-side getContentEditHref re-export — href-parity invariant", () => {
    // Mirrors the bio↔section parity assertion above: server and client
    // helpers MUST produce the same string. If either drifts, the
    // configuration agent's editor handoff would 404 while users browsing
    // the same edit route directly still work.
    for (const kind of ["posts", "articles"] as const) {
      for (const slug of ["my-post", "deeply-nested-slug-2025"]) {
        expect(getContentEditHref("alice", kind, slug)).toBe(
          buildContentEditHref("alice", kind, slug),
        );
      }
    }
  });

  it("appends /edit to buildContentHref so the detail and edit paths stay aligned", () => {
    for (const kind of ["posts", "articles"] as const) {
      expect(buildContentEditHref("alice", kind, "x")).toBe(
        `${buildContentHref("alice", kind, "x")}/edit`,
      );
      expect(getContentEditHref("alice", kind, "x")).toBe(
        `${getContentHref("alice", kind, "x")}/edit`,
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
