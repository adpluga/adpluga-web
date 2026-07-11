import { afterEach, describe, expect, it } from "vitest";

import { _resetForTests, observeViewable, unobserveViewable } from "../src/viewability";

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  observed = new Set<Element>();
  disconnected = false;
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb;
    MockIntersectionObserver.instances.push(this);
  }
  observe(el: Element): void {
    this.observed.add(el);
  }
  unobserve(el: Element): void {
    this.observed.delete(el);
  }
  disconnect(): void {
    this.disconnected = true;
    this.observed.clear();
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  root = null;
  rootMargin = "";
  thresholds: number[] = [];
  emit(entries: Array<{ target: Element; intersectionRatio: number }>): void {
    this.callback(entries as unknown as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }
}

(globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
  MockIntersectionObserver as unknown as typeof IntersectionObserver;

afterEach(() => {
  _resetForTests();
  MockIntersectionObserver.instances = [];
});

describe("viewability", () => {
  it("fires callback after continuous visibility >= threshold for duration", async () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    let fired = 0;
    observeViewable(el, () => fired++);
    const obs = MockIntersectionObserver.instances[0];
    expect(obs).toBeDefined();
    obs?.emit([{ target: el, intersectionRatio: 0.8 }]);
    await new Promise((r) => setTimeout(r, 1100));
    expect(fired).toBe(1);
    unobserveViewable(el);
    el.remove();
  });

  it("cancels timer if visibility drops before threshold duration", async () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    let fired = 0;
    observeViewable(el, () => fired++);
    const obs = MockIntersectionObserver.instances[0];
    obs?.emit([{ target: el, intersectionRatio: 0.7 }]);
    await new Promise((r) => setTimeout(r, 500));
    obs?.emit([{ target: el, intersectionRatio: 0.1 }]);
    await new Promise((r) => setTimeout(r, 800));
    expect(fired).toBe(0);
    unobserveViewable(el);
    el.remove();
  });

  it("disconnects the shared observer when the last slot unobserves", () => {
    const a = document.createElement("div");
    const b = document.createElement("div");
    document.body.append(a, b);
    observeViewable(a, () => undefined);
    observeViewable(b, () => undefined);
    const obs = MockIntersectionObserver.instances[0];
    unobserveViewable(a);
    expect(obs?.disconnected).toBe(false);
    unobserveViewable(b);
    expect(obs?.disconnected).toBe(true);
    a.remove();
    b.remove();
  });
});
