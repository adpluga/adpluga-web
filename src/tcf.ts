// Purpose consents sit at bits 152..175 of the TCF v2 core segment ("Consent
// string and vendor list formats v2", IAB Tech Lab).
const PURPOSES_OFFSET = 152;

export function purposeConsent(tcString: string | undefined, purpose: number): boolean {
  if (!tcString || purpose < 1 || purpose > 24 || typeof atob !== "function") return false;
  const core = tcString.split(".", 1)[0] ?? "";
  let bin: string;
  try {
    bin = atob(core.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, ""));
  } catch {
    return false;
  }
  if (bin.length === 0 || bin.charCodeAt(0) >> 2 !== 2) return false;
  const bit = PURPOSES_OFFSET + purpose - 1;
  const byte = bit >> 3;
  if (byte >= bin.length) return false;
  return ((bin.charCodeAt(byte) >> (7 - (bit & 7))) & 1) === 1;
}
