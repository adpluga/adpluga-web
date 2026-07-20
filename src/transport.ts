import {
  HEADER_KEY,
  HEADER_MIN_SDK,
  RETRY_BASE_BACKOFF_MS,
  RETRY_MAX_ATTEMPTS,
  SDK_VERSION,
  SERVE_TIMEOUT_MS,
  TRACK_TIMEOUT_MS,
} from "./constants";
import { log } from "./logger";
import type { ServeResponse, TrackEventBody } from "./types";

type FetchFn = typeof fetch;

export class UpgradeRequiredError extends Error {
  readonly minVersion: string | undefined;
  constructor(minVersion: string | undefined) {
    super("upgrade_required");
    this.name = "UpgradeRequiredError";
    this.minVersion = minVersion;
  }
}

export interface ServeRequest {
  base: string;
  key: string;
  slotId: string;
  userId?: string;
  format?: string;
  nonPersonalized?: boolean;
  signal?: AbortSignal;
}

function resolveUrl(base: string, path: string): string {
  const b = base.endsWith("/") ? base : base + "/";
  return new URL(path, b).toString();
}

async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  external?: AbortSignal,
): Promise<T> {
  const ctrl = new AbortController();
  const onExternal = () => ctrl.abort(external?.reason);
  if (external) {
    if (external.aborted) ctrl.abort(external.reason);
    else external.addEventListener("abort", onExternal, { once: true });
  }
  const t = setTimeout(() => ctrl.abort(new DOMException("timeout", "TimeoutError")), timeoutMs);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(t);
    external?.removeEventListener("abort", onExternal);
  }
}

function isRetryable(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

export async function fetchServe(req: ServeRequest, fetchImpl: FetchFn = fetch): Promise<ServeResponse> {
  const url = new URL(resolveUrl(req.base, "serve"));
  url.searchParams.set("slot", req.slotId);
  if (req.userId) url.searchParams.set("u", req.userId);
  if (req.format) url.searchParams.set("fmt", req.format);
  if (req.nonPersonalized) url.searchParams.set("non_personalized", "true");

  let attempt = 0;
  let lastError: unknown;
  while (attempt <= RETRY_MAX_ATTEMPTS) {
    try {
      const resp = await withTimeout(
        (signal) =>
          fetchImpl(url.toString(), {
            method: "GET",
            headers: {
              [HEADER_KEY]: req.key,
              [HEADER_MIN_SDK]: SDK_VERSION,
              Accept: "application/json",
            },
            mode: "cors",
            credentials: "omit",
            cache: "no-store",
            signal,
          }),
        SERVE_TIMEOUT_MS,
        req.signal,
      );
      if (resp.status === 426) {
        const min = resp.headers.get(HEADER_MIN_SDK) ?? undefined;
        throw new UpgradeRequiredError(min);
      }
      if (!resp.ok) {
        if (isRetryable(resp.status) && attempt < RETRY_MAX_ATTEMPTS) {
          await backoff(attempt);
          attempt++;
          continue;
        }
        throw new Error("serve_status_" + resp.status);
      }
      return (await resp.json()) as ServeResponse;
    } catch (err) {
      if (err instanceof UpgradeRequiredError) throw err;
      if (req.signal?.aborted) throw err;
      lastError = err;
      if (attempt >= RETRY_MAX_ATTEMPTS) break;
      await backoff(attempt);
      attempt++;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("serve_failed");
}

export function postTrack(base: string, body: TrackEventBody, fetchImpl: FetchFn = fetch): void {
  postTrackTo(base, "track", body, fetchImpl);
}

export function postTrackViewable(base: string, token: string, fetchImpl: FetchFn = fetch): void {
  postTrackTo(base, "track/viewable", { token, event: "viewable" }, fetchImpl);
}

function postTrackTo(base: string, path: string, body: TrackEventBody, fetchImpl: FetchFn): void {
  const url = resolveUrl(base, path);
  const payload = JSON.stringify(body);
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const ok = navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
      if (ok) return;
    }
    void fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      mode: "cors",
      credentials: "omit",
      keepalive: true,
      cache: "no-store",
      // best-effort short deadline; page unload will still deliver via keepalive.
      signal: AbortSignal.timeout(TRACK_TIMEOUT_MS),
    }).catch((err: unknown) => log.debug("track post failed", err));
  } catch (err) {
    log.debug("track post threw", err);
  }
}

function backoff(attempt: number): Promise<void> {
  const jitter = Math.random() * RETRY_BASE_BACKOFF_MS;
  const delay = RETRY_BASE_BACKOFF_MS * 2 ** attempt + jitter;
  return new Promise((r) => setTimeout(r, delay));
}
