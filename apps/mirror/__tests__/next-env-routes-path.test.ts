import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("next-env.d.ts", () => {
  it("imports the prod routes types, not the dev-server variant", () => {
    const file = readFileSync(
      resolve(__dirname, "../next-env.d.ts"),
      "utf8",
    );
    expect(
      file,
      "next-env.d.ts must import ./.next/types/routes.d.ts (not the dev variant). " +
        "Regression of commit 2f37d72a (FG_261). `next dev` rewrites this file " +
        "to the dev path on startup; commit the prod form only.",
    ).toContain('import "./.next/types/routes.d.ts";');
  });
});
