import { describe, expect, it } from "vitest";
import {
  assertValidSlug,
  generateSlug,
  isValidSlug,
  SLUG_PATTERN,
} from "../slug";

describe("generateSlug", () => {
  it("strips trailing punctuation that previously leaked into stored slugs", () => {
    // Regression: this exact title produced "why-do-product-builders-build-product?"
    // in the DB before the fix. Verify the canonical normalizer drops the `?`.
    expect(generateSlug("why do product builders build product?")).toBe(
      "why-do-product-builders-build-product",
    );
  });

  it("collapses runs of non-alphanumerics into a single dash", () => {
    expect(generateSlug("hello   world")).toBe("hello-world");
    expect(generateSlug("hello---world")).toBe("hello-world");
    expect(generateSlug("hello!!!world???")).toBe("hello-world");
    expect(generateSlug("foo & bar @ baz")).toBe("foo-bar-baz");
  });

  it("trims leading and trailing dashes", () => {
    expect(generateSlug("---hello---")).toBe("hello");
    expect(generateSlug("?hello?")).toBe("hello");
  });

  it("lowercases", () => {
    expect(generateSlug("Hello World")).toBe("hello-world");
    expect(generateSlug("ALLCAPS")).toBe("allcaps");
  });

  it("throws when the input has no alphanumeric characters", () => {
    expect(() => generateSlug("")).toThrow(/cannot generate slug/i);
    expect(() => generateSlug("???")).toThrow(/cannot generate slug/i);
    expect(() => generateSlug("   ")).toThrow(/cannot generate slug/i);
    expect(() => generateSlug("---")).toThrow(/cannot generate slug/i);
  });

  it("is idempotent — generateSlug(generateSlug(x)) === generateSlug(x)", () => {
    // Property check across a representative sample. Idempotency is the
    // invariant that lets the mutation always normalize without surprise.
    const samples = [
      "Hello World",
      "why do product builders build product?",
      "foo-bar-baz",
      "FOO_BAR_BAZ",
      "Trailing punctuation!!!",
      "leading-dashes",
      "trailing-dashes",
      "mixed 123 and abc",
      "café résumé naïve", // unicode degrades to alphanumeric subset
    ];
    for (const input of samples) {
      const once = generateSlug(input);
      const twice = generateSlug(once);
      expect(twice).toBe(once);
    }
  });

  it("output always matches SLUG_PATTERN (fuzz)", () => {
    // Property test: fuzz random strings of mixed ASCII + punctuation and
    // assert the output is always a valid slug or the function throws.
    // Seeded LCG so the corpus is reproducible across CI runs.
    let _seed = 0x9e3779b9;
    const rand = () => {
      _seed = Math.imul(_seed ^ (_seed >>> 15), 0x2545f491) >>> 0;
      return _seed / 0xffffffff;
    };
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 _-?!@#$%^&*()/.,;:'\"";
    let validProduced = 0;
    for (let i = 0; i < 200; i++) {
      const len = Math.floor(rand() * 30) + 1;
      let input = "";
      for (let j = 0; j < len; j++) {
        input += charset[Math.floor(rand() * charset.length)];
      }
      try {
        const slug = generateSlug(input);
        expect(SLUG_PATTERN.test(slug)).toBe(true);
        // Idempotency: re-running the normalizer on its own output is a no-op.
        expect(generateSlug(slug)).toBe(slug);
        validProduced++;
      } catch (error) {
        // generateSlug throws when no alphanumerics remain — acceptable.
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/cannot generate slug/i);
      }
    }
    // Sanity: with the alphanumeric-rich charset, well over 150 of 200
    // inputs should produce valid slugs.
    expect(validProduced).toBeGreaterThan(150);
  });
});

describe("isValidSlug", () => {
  it("accepts canonical slugs", () => {
    expect(isValidSlug("hello")).toBe(true);
    expect(isValidSlug("hello-world")).toBe(true);
    expect(isValidSlug("a")).toBe(true);
    expect(isValidSlug("123")).toBe(true);
    expect(isValidSlug("foo-bar-baz-123")).toBe(true);
  });

  it("rejects malformed slugs", () => {
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("Hello")).toBe(false); // uppercase
    expect(isValidSlug("hello world")).toBe(false); // space
    expect(isValidSlug("hello?")).toBe(false); // punctuation
    expect(isValidSlug("-hello")).toBe(false); // leading dash
    expect(isValidSlug("hello-")).toBe(false); // trailing dash
    expect(isValidSlug("hello--world")).toBe(false); // double dash
    expect(isValidSlug("hello_world")).toBe(false); // underscore
  });
});

describe("assertValidSlug", () => {
  it("returns silently on valid slugs", () => {
    expect(() => assertValidSlug("hello-world")).not.toThrow();
  });

  it("throws on malformed slugs with the field name in the message", () => {
    expect(() => assertValidSlug("hello?")).toThrow(/hello\?/);
    expect(() => assertValidSlug("Bad", "Custom")).toThrow(/Custom/);
  });
});
