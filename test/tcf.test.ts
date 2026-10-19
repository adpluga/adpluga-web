import { describe, expect, it } from "vitest";

import { purposeConsent } from "../src/tcf";

// Encoded with @iabtcf/core, the IAB reference implementation; the same
// strings back the server's decoder tests.
const ALL = "CQsVacAQsVacAAKABBENCWFAAPJAAAAAAB6YADgIAAAAAAAA.IKKQBIAAgAVAfQCAAF5gUUAA";
const NO_PURPOSE_ONE = "CQsVacAQsVacAAKABBENCWFAAHIAAAAAAB6YADgIAAAAAAAA.IKKQBIAAgAVAfQCAAF5gUUAA";
const NOTHING = "CQsVacAQsVacAAKABBENCWFAAAAAAAAAAB6YAAAAAAAA.IKKQBIAAgAVAfQCAAF5gUUAA";

describe("purposeConsent", () => {
  it.each([
    [ALL, 1, true],
    [ALL, 3, true],
    [ALL, 5, false],
    [NO_PURPOSE_ONE, 1, false],
    [NO_PURPOSE_ONE, 4, true],
    [NOTHING, 1, false],
  ])("%s purpose %i → %s", (tc, purpose, want) => {
    expect(purposeConsent(tc, purpose)).toBe(want);
  });

  it.each([undefined, "", "%%%", "BOEFEAyOEFEAyAHABDENAI4AAAB9vABAASA", "CQsV"])(
    "rejects %s",
    (tc) => {
      expect(purposeConsent(tc, 1)).toBe(false);
    },
  );
});
