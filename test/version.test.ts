import { describe, expect, it } from "vitest";
import { SDK_VERSION } from "../src/constants";
import pkg from "../package.json";

// The version the SDK reports to the server drives the minimum-version gate,
// so it must be the version that was published.
describe("SDK_VERSION", () => {
  it("matches package.json", () => {
    expect(SDK_VERSION).toBe(pkg.version);
  });
});
