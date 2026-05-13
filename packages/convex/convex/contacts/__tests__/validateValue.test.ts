import { describe, expect, it } from "vitest";
import { CONTACT_ENTRY_KIND_VALUES } from "../schema";
import {
  CONTACT_HOSTNAME_ALLOWLIST,
  validateValue,
} from "../hostnameAllowlist";

// All non-email kinds that have hostname enforcement.
const NON_EMAIL_KINDS = CONTACT_ENTRY_KIND_VALUES.filter(
  (k) => k !== "email",
) as Array<Exclude<(typeof CONTACT_ENTRY_KIND_VALUES)[number], "email">>;

describe("validateValue — email kind (unchanged)", () => {
  it("accepts a valid email", () => {
    expect(() => validateValue("email", "user@example.com")).not.toThrow();
  });

  it("rejects a non-email string for kind=email", () => {
    expect(() => validateValue("email", "not-an-email")).toThrow();
  });
});

describe("validateValue — non-email kinds: accepted hostnames", () => {
  it("accepts linkedin.com without www.", () => {
    expect(() =>
      validateValue("linkedin", "https://linkedin.com/in/alice"),
    ).not.toThrow();
  });

  it("accepts linkedin.com with www. prefix", () => {
    expect(() =>
      validateValue("linkedin", "https://www.linkedin.com/in/alice"),
    ).not.toThrow();
  });

  it("accepts instagram.com", () => {
    expect(() =>
      validateValue("instagram", "https://instagram.com/alice"),
    ).not.toThrow();
  });

  it("accepts x.com for kind=x", () => {
    expect(() =>
      validateValue("x", "https://x.com/alice"),
    ).not.toThrow();
  });

  it("accepts twitter.com alias for kind=x", () => {
    expect(() =>
      validateValue("x", "https://twitter.com/alice"),
    ).not.toThrow();
  });

  it("accepts www.twitter.com alias for kind=x", () => {
    expect(() =>
      validateValue("x", "https://www.twitter.com/alice"),
    ).not.toThrow();
  });

  it("accepts tiktok.com", () => {
    expect(() =>
      validateValue("tiktok", "https://tiktok.com/@alice"),
    ).not.toThrow();
  });

  it("accepts youtube.com for kind=youtube", () => {
    expect(() =>
      validateValue("youtube", "https://youtube.com/c/alice"),
    ).not.toThrow();
  });

  it("accepts youtu.be alias for kind=youtube", () => {
    expect(() =>
      validateValue("youtube", "https://youtu.be/dQw4w9WgXcQ"),
    ).not.toThrow();
  });
});

describe("validateValue — non-email kinds: rejected hostnames (mismatch)", () => {
  it("rejects a linkedin value pointing at tiktok.com", () => {
    expect(() =>
      validateValue("linkedin", "https://tiktok.com/@alice"),
    ).toThrow(/linkedin/i);
  });

  it("rejects a tiktok value pointing at instagram.com", () => {
    expect(() =>
      validateValue("tiktok", "https://instagram.com/alice"),
    ).toThrow(/tiktok/i);
  });

  it("rejects an x value pointing at facebook.com", () => {
    expect(() =>
      validateValue("x", "https://facebook.com/alice"),
    ).toThrow(/x/i);
  });

  it("rejects a youtube value pointing at vimeo.com", () => {
    expect(() =>
      validateValue("youtube", "https://vimeo.com/alice"),
    ).toThrow(/youtube/i);
  });

  it("rejects an instagram value pointing at linkedin.com", () => {
    expect(() =>
      validateValue("instagram", "https://linkedin.com/in/alice"),
    ).toThrow(/instagram/i);
  });

  it("still rejects a plain non-https URL", () => {
    expect(() =>
      validateValue("linkedin", "http://linkedin.com/in/alice"),
    ).toThrow(/https/i);
  });
});

describe("validateValue — exhaustive coverage: every non-email kind has at least one accepted URL", () => {
  // This test ensures that if a new kind is added to CONTACT_ENTRY_KIND_VALUES
  // without a corresponding entry in CONTACT_HOSTNAME_ALLOWLIST, the test fails.
  for (const kind of NON_EMAIL_KINDS) {
    it(`kind=${kind} has an entry in CONTACT_HOSTNAME_ALLOWLIST`, () => {
      expect(CONTACT_HOSTNAME_ALLOWLIST).toHaveProperty(kind);
      const hosts = CONTACT_HOSTNAME_ALLOWLIST[kind];
      expect(hosts.length).toBeGreaterThan(0);
    });

    it(`kind=${kind} accepts its first allowlisted hostname`, () => {
      const firstHost = CONTACT_HOSTNAME_ALLOWLIST[kind][0];
      expect(() =>
        validateValue(kind, `https://${firstHost}/example`),
      ).not.toThrow();
    });
  }
});

describe("validateValue — www. prefix normalization is exhaustive", () => {
  for (const kind of NON_EMAIL_KINDS) {
    const firstHost = CONTACT_HOSTNAME_ALLOWLIST[kind][0];
    it(`kind=${kind} accepts www.${firstHost}`, () => {
      expect(() =>
        validateValue(kind, `https://www.${firstHost}/example`),
      ).not.toThrow();
    });
  }
});
