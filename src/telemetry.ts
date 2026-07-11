import {
  HEADER_KEY,
  SDK_PLATFORM,
  SDK_VERSION,
  TELEMETRY_FLUSH_INTERVAL_MS,
  TELEMETRY_FLUSH_ON_COUNT,
  TELEMETRY_LATENCY_SAMPLE_CAP,
  TELEMETRY_MAX_EVENTS_PER_BATCH,
} from "./constants";
import { log } from "./logger";
import type { SdkEventType } from "./types";

type FetchFn = typeof fetch;

interface Bucket {
  eventType: SdkEventType;
  count: number;
  latencies: number[];  // circular buffer capped at TELEMETRY_LATENCY_SAMPLE_CAP
  next: number;         // circular head
  filled: boolean;
}

interface Payload {
  nonce: string;
  events: Array<{
    platform: string;
    sdk_version: string;
    event_type: SdkEventType;
    count: number;
    latency_p50_ms?: number;
    latency_p95_ms?: number;
    latency_p99_ms?: number;
  }>;
}

export class TelemetryBatcher {
  private readonly buckets = new Map<SdkEventType, Bucket>();
  private totalCount = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private disposed = false;
  private enabled = true;
  private inflight: Promise<void> | undefined;

  constructor(
    private readonly base: string,
    private readonly publisherKey: string,
    private readonly fetchImpl: FetchFn = fetch,
  ) {
    if (typeof window !== "undefined") {
      this.timer = setInterval(() => void this.flush(), TELEMETRY_FLUSH_INTERVAL_MS);
      window.addEventListener("pagehide", this.flushSync, { capture: true });
      window.addEventListener("beforeunload", this.flushSync, { capture: true });
    }
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (!v) this.buckets.clear();
  }

  record(eventType: SdkEventType, latencyMs?: number): void {
    if (this.disposed || !this.enabled) return;
    let b = this.buckets.get(eventType);
    if (!b) {
      b = {
        eventType,
        count: 0,
        latencies: new Array<number>(TELEMETRY_LATENCY_SAMPLE_CAP),
        next: 0,
        filled: false,
      };
      this.buckets.set(eventType, b);
    }
    b.count++;
    this.totalCount++;
    if (typeof latencyMs === "number" && latencyMs >= 0) {
      b.latencies[b.next] = latencyMs;
      b.next = (b.next + 1) % TELEMETRY_LATENCY_SAMPLE_CAP;
      if (b.next === 0) b.filled = true;
    }
    if (this.totalCount >= TELEMETRY_FLUSH_ON_COUNT) void this.flush();
  }

  async flush(): Promise<void> {
    if (this.inflight) return this.inflight;
    if (this.buckets.size === 0) return;
    const payload = this.drainToPayload();
    if (payload.events.length === 0) return;
    this.inflight = this.send(payload)
      .catch((err: unknown) => log.debug("telemetry send failed", err))
      .finally(() => {
        this.inflight = undefined;
      });
    return this.inflight;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.timer) clearInterval(this.timer);
    if (typeof window !== "undefined") {
      window.removeEventListener("pagehide", this.flushSync, { capture: true });
      window.removeEventListener("beforeunload", this.flushSync, { capture: true });
    }
    // Best-effort final flush via keepalive fetch. Errors are swallowed inside send().
    void this.flush();
    this.buckets.clear();
  }

  private drainToPayload(): Payload {
    const events: Payload["events"] = [];
    let taken = 0;
    for (const b of this.buckets.values()) {
      if (taken >= TELEMETRY_MAX_EVENTS_PER_BATCH) break;
      if (b.count === 0) continue;
      const p = percentiles(b);
      const evt: Payload["events"][number] = {
        platform: SDK_PLATFORM,
        sdk_version: SDK_VERSION,
        event_type: b.eventType,
        count: b.count,
      };
      if (p) {
        evt.latency_p50_ms = p.p50;
        evt.latency_p95_ms = p.p95;
        evt.latency_p99_ms = p.p99;
      }
      events.push(evt);
      taken++;
    }
    this.buckets.clear();
    this.totalCount = 0;
    return { nonce: nonce(), events };
  }

  private async send(payload: Payload): Promise<void> {
    const url = resolveUrl(this.base, "sdk/telemetry");
    const body = JSON.stringify(payload);
    try {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        // Beacon cannot set headers, but the endpoint accepts X-AdPluga-Key via
        // the URL search when body is used; fall back to fetch when possible.
      }
      await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [HEADER_KEY]: this.publisherKey,
        },
        body,
        mode: "cors",
        credentials: "omit",
        keepalive: true,
        cache: "no-store",
      });
    } catch (err) {
      log.debug("telemetry post threw", err);
    }
  }

  private readonly flushSync = (): void => {
    if (this.buckets.size === 0) return;
    const payload = this.drainToPayload();
    if (payload.events.length === 0) return;
    const url = resolveUrl(this.base, "sdk/telemetry");
    const body = JSON.stringify(payload);
    try {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      }
    } catch {
      // ignore.
    }
  };
}

function percentiles(b: Bucket): { p50: number; p95: number; p99: number } | undefined {
  const size = b.filled ? b.latencies.length : b.next;
  if (size === 0) return undefined;
  const sample = b.latencies.slice(0, size).sort((a, z) => a - z);
  return {
    p50: quantile(sample, 0.5),
    p95: quantile(sample, 0.95),
    p99: quantile(sample, 0.99),
  };
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)));
  return sorted[idx] ?? 0;
}

function nonce(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const buf = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

function resolveUrl(base: string, path: string): string {
  const b = base.endsWith("/") ? base : base + "/";
  return new URL(path, b).toString();
}
