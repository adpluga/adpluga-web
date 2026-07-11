import type { ConsentState } from "./types";

type Listener = (state: ConsentState) => void;

export class ConsentStore {
  private state: ConsentState = {};
  private readonly listeners = new Set<Listener>();

  get snapshot(): ConsentState {
    return { ...this.state };
  }

  update(patch: ConsentState): void {
    const next: ConsentState = { ...this.state, ...patch };
    if (shallowEqual(this.state, next)) return;
    this.state = next;
    for (const fn of this.listeners) {
      try {
        fn(next);
      } catch {
        // listener isolation: one broken subscriber never blocks the rest.
      }
    }
  }

  reset(): void {
    this.state = {};
    this.listeners.clear();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // Publishers may opt users out of personalized ads via consent. When the
  // flag is explicitly false we hint the backend to serve HOUSE-safe creatives.
  isPersonalized(): boolean {
    return this.state.adPersonalization !== false;
  }
}

function shallowEqual(a: ConsentState, b: ConsentState): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof ConsentState>;
  for (const k of keys) if (a[k] !== b[k]) return false;
  return true;
}
