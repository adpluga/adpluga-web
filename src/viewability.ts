import { VIEWABILITY_DURATION_MS, VIEWABILITY_THRESHOLD } from "./constants";

// Single IntersectionObserver shared across every slot on the page. Memory
// is O(observed slots) with no strong ref beyond the caller's element.
// The observer is lazily created on first observe() and torn down when the
// last slot unobserves — this keeps the SDK zero-cost when no ads render.

type Callback = () => void;

interface Entry {
  cb: Callback;
  timerId: number;
}

let io: IntersectionObserver | null = null;
const entries = new Map<Element, Entry>();

function ensureObserver(): IntersectionObserver {
  if (io) return io;
  io = new IntersectionObserver(handleRecords, {
    threshold: [0, VIEWABILITY_THRESHOLD, 1],
  });
  return io;
}

function handleRecords(records: IntersectionObserverEntry[]): void {
  for (const r of records) {
    const item = entries.get(r.target);
    if (!item) continue;
    if (r.intersectionRatio >= VIEWABILITY_THRESHOLD) {
      if (item.timerId === 0) {
        item.timerId = window.setTimeout(() => fire(r.target), VIEWABILITY_DURATION_MS);
      }
    } else if (item.timerId !== 0) {
      clearTimeout(item.timerId);
      item.timerId = 0;
    }
  }
}

function fire(el: Element): void {
  const item = entries.get(el);
  if (!item) return;
  item.timerId = 0;
  try {
    item.cb();
  } catch {
    // callback isolation.
  }
}

export function observeViewable(el: Element, cb: Callback): void {
  if (entries.has(el)) return;
  entries.set(el, { cb, timerId: 0 });
  ensureObserver().observe(el);
}

export function unobserveViewable(el: Element): void {
  const item = entries.get(el);
  if (!item) return;
  if (item.timerId !== 0) clearTimeout(item.timerId);
  entries.delete(el);
  io?.unobserve(el);
  if (entries.size === 0 && io) {
    io.disconnect();
    io = null;
  }
}

export function _resetForTests(): void {
  for (const { timerId } of entries.values()) if (timerId !== 0) clearTimeout(timerId);
  entries.clear();
  io?.disconnect();
  io = null;
}
