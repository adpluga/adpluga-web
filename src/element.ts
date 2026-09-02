import { AdPlugaClient } from "./client";
import {
  ATTR_AUTOLOAD,
  ATTR_FORMAT,
  ATTR_LAZY,
  ATTR_PUBLISHABLE_KEY,
  ATTR_SLOT,
  ELEMENT_TAG,
  MIN_REFRESH_SECONDS,
} from "./constants";
import { renderCreative, type RenderTeardown } from "./render";
import type { ClientOptions, ServeResponse } from "./types";
import { observeViewable, unobserveViewable } from "./viewability";

function resolveRelativeUrl(url: string, base: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

let singleton: AdPlugaClient | undefined;
let pending: Array<() => void> = [];

export function getClient(): AdPlugaClient | undefined {
  return singleton;
}

export function initialize(opts: ClientOptions): AdPlugaClient {
  if (singleton) return singleton;
  singleton = new AdPlugaClient(opts);
  const queue = pending;
  pending = [];
  for (const fn of queue) fn();
  return singleton;
}

export function destroy(): void {
  singleton?.destroy();
  singleton = undefined;
  pending = [];
}

export function whenReady(fn: () => void): void {
  if (singleton) fn();
  else pending.push(fn);
}

export class AdPlugaSlotElement extends HTMLElement {
  static readonly observedAttributes = [ATTR_SLOT, ATTR_FORMAT, ATTR_LAZY, ATTR_AUTOLOAD];

  private response: ServeResponse | undefined;
  private teardownRender: RenderTeardown | undefined;
  private lazyObserver: IntersectionObserver | undefined;
  private impressionFired = false;
  private clickFired = false;
  private loadInFlight: AbortController | undefined;
  private connected = false;
  private readyUnsub: (() => void) | undefined;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private refreshSeq = 0;

  connectedCallback(): void {
    if (this.connected) return;
    this.connected = true;
    if (getComputedStyle(this).display === "inline") this.style.display = "block";
    if (this.getAttribute(ATTR_AUTOLOAD) === "false") return;

    // Drop-in mode: element carries the publishable key and no client is
    // initialised yet — bootstrap one silently so publishers can paste the
    // snippet without extra JS glue.
    if (!singleton) {
      const key = this.getAttribute(ATTR_PUBLISHABLE_KEY);
      if (key) initialize({ publisherKey: key });
    }

    if (!singleton) {
      const start = (): void => this.start();
      pending.push(start);
      this.readyUnsub = () => {
        const idx = pending.indexOf(start);
        if (idx >= 0) pending.splice(idx, 1);
      };
      return;
    }
    this.start();
  }

  disconnectedCallback(): void {
    this.connected = false;
    this.cancelRefresh();
    this.readyUnsub?.();
    this.readyUnsub = undefined;
    this.loadInFlight?.abort();
    this.loadInFlight = undefined;
    if (this.lazyObserver) {
      this.lazyObserver.disconnect();
      this.lazyObserver = undefined;
    }
    unobserveViewable(this);
    this.teardownRender?.();
    this.teardownRender = undefined;
    this.response = undefined;
    this.impressionFired = false;
    this.clickFired = false;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (!this.connected || oldValue === newValue) return;
    if (name === ATTR_SLOT) void this.reload();
  }

  async refresh(): Promise<void> {
    await this.reload();
  }

  private start(): void {
    if (this.hasAttribute(ATTR_LAZY)) this.armLazy();
    else void this.load();
  }

  private armLazy(): void {
    if (!("IntersectionObserver" in window)) {
      void this.load();
      return;
    }
    this.lazyObserver = new IntersectionObserver(
      (records) => {
        if (records.some((r) => r.isIntersecting)) {
          this.lazyObserver?.disconnect();
          this.lazyObserver = undefined;
          void this.load();
        }
      },
      { rootMargin: "200px" },
    );
    this.lazyObserver.observe(this);
  }

  private async reload(): Promise<void> {
    this.cancelRefresh();
    this.teardownRender?.();
    this.teardownRender = undefined;
    unobserveViewable(this);
    this.impressionFired = false;
    this.clickFired = false;
    this.refreshSeq = 0;
    await this.load();
  }

  // The cadence is published per slot on the serve response. Rotating a hidden
  // tab would spend a decision on an impression the MRC guidelines treat as
  // non-viewable, so wait for the tab to come back and re-arm instead.
  private scheduleRefresh(resp: ServeResponse): void {
    this.cancelRefresh();
    const secs = resp.refresh_after_seconds ?? 0;
    if (secs < MIN_REFRESH_SECONDS) return;
    this.refreshTimer = setTimeout(() => this.rotate(), secs * 1000);
  }

  private cancelRefresh(): void {
    if (this.refreshTimer !== undefined) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  private rotate(): void {
    this.refreshTimer = undefined;
    if (!this.connected || !this.response) return;
    if (typeof document !== "undefined" && document.hidden) {
      this.scheduleRefresh(this.response);
      return;
    }
    this.refreshSeq += 1;
    this.teardownRender?.();
    this.teardownRender = undefined;
    unobserveViewable(this);
    this.impressionFired = false;
    this.clickFired = false;
    void this.load();
  }

  private async load(): Promise<void> {
    const client = singleton;
    const slotId = this.getAttribute(ATTR_SLOT);
    if (!client || !slotId) return;
    this.loadInFlight?.abort();
    this.loadInFlight = new AbortController();
    const opts: Parameters<AdPlugaClient["serve"]>[1] = {
      signal: this.loadInFlight.signal,
    };
    const fmt = this.getAttribute(ATTR_FORMAT);
    if (fmt) opts.format = fmt;
    if (this.refreshSeq > 0) opts.refreshSeq = this.refreshSeq;
    const resp = await client.serve(slotId, opts);
    this.loadInFlight = undefined;
    if (!this.connected || !resp) return;
    this.response = resp;
    const clickUrl = resolveRelativeUrl(resp.click_url, client.endpoint);
    this.teardownRender = renderCreative(resp.ad, {
      container: this,
      clickUrl,
      quartilePings: resp.quartile_pings,
      apiBase: client.endpoint,
      onClick: () => {
        if (this.clickFired || !this.response) return;
        this.clickFired = true;
        client.fireClick(this.response, slotId);
      },
    });
    observeViewable(this, () => {
      if (this.impressionFired || !this.response) return;
      this.impressionFired = true;
      client.fireImpression(this.response, slotId);
      client.fireViewable(this.response, slotId);
    });
    this.scheduleRefresh(resp);
  }
}

export function defineAdPlugaElement(tag: string = ELEMENT_TAG): void {
  if (typeof customElements === "undefined") return;
  if (customElements.get(tag)) return;
  customElements.define(tag, AdPlugaSlotElement);
}
