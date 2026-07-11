import { FEATURES_REVALIDATE_MS } from "./constants";
import { log } from "./logger";
import type { FeaturesResponse } from "./types";

type FetchFn = typeof fetch;
type Listener = (features: FeaturesResponse) => void;

export class FeaturesCache {
  private current: FeaturesResponse | undefined;
  private inflight: Promise<FeaturesResponse | undefined> | undefined;
  private lastFetch = 0;
  private etag: string | undefined;
  private readonly listeners = new Set<Listener>();
  private disposed = false;

  constructor(
    private readonly base: string,
    private readonly fetchImpl: FetchFn = fetch,
  ) {}

  get value(): FeaturesResponse | undefined {
    return this.current;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  async ensure(): Promise<FeaturesResponse | undefined> {
    if (this.disposed) return undefined;
    if (this.current && Date.now() - this.lastFetch < FEATURES_REVALIDATE_MS) return this.current;
    if (this.inflight) return this.inflight;
    this.inflight = this.load().finally(() => {
      this.inflight = undefined;
    });
    return this.inflight;
  }

  invalidate(): void {
    this.lastFetch = 0;
    this.etag = undefined;
  }

  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
    this.current = undefined;
    this.etag = undefined;
  }

  private async load(): Promise<FeaturesResponse | undefined> {
    const url = resolveUrl(this.base, "features");
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (this.etag) headers["If-None-Match"] = this.etag;
      const resp = await this.fetchImpl(url, {
        method: "GET",
        headers,
        mode: "cors",
        credentials: "omit",
      });
      if (resp.status === 304 && this.current) {
        this.lastFetch = Date.now();
        return this.current;
      }
      if (!resp.ok) {
        log.warn("features fetch non-ok", resp.status);
        return this.current;
      }
      const etag = resp.headers.get("ETag");
      if (etag) this.etag = etag;
      const parsed = (await resp.json()) as FeaturesResponse;
      this.current = parsed;
      this.lastFetch = Date.now();
      this.emit(parsed);
      return parsed;
    } catch (err) {
      log.debug("features fetch failed", err);
      return this.current;
    }
  }

  private emit(f: FeaturesResponse): void {
    for (const fn of this.listeners) {
      try {
        fn(f);
      } catch {
        // isolation.
      }
    }
  }
}

function resolveUrl(base: string, path: string): string {
  const b = base.endsWith("/") ? base : base + "/";
  return new URL(path, b).toString();
}
