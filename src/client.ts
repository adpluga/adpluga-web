import { ConsentStore } from "./consent";
import { DEFAULT_ENDPOINT, STORAGE_UID_KEY } from "./constants";
import { FeaturesCache } from "./features";
import { log } from "./logger";
import { TelemetryBatcher } from "./telemetry";
import type {
  ClientOptions,
  ConsentState,
  ConversionOptions,
  FeaturesResponse,
  ServeOptions,
  ServeResponse,
  SdkClientEvent,
} from "./types";
import { fetchServe, postTrack, postTrackViewable, UpgradeRequiredError } from "./transport";

type FetchFn = typeof fetch;

export class AdPlugaClient {
  private readonly base: string;
  private readonly fetchImpl: FetchFn;
  private userId: string;
  private readonly consent = new ConsentStore();
  private readonly features: FeaturesCache;
  private readonly telemetry: TelemetryBatcher;
  private disposed = false;
  private upgradeRequired = false;
  private readonly listeners = new Set<(e: SdkClientEvent) => void>();
  private readonly consentUnsub: () => void;
  private readonly featuresUnsub: () => void;

  constructor(private readonly opts: ClientOptions) {
    if (!opts.publisherKey) throw new Error("publisher_key_required");
    this.base = normalizeBase(opts.endpoint ?? DEFAULT_ENDPOINT);
    this.fetchImpl = opts.fetch ?? fetch;
    this.userId = opts.userId ?? readOrCreateUid();
    if (opts.consent) this.consent.update(opts.consent);
    this.features = new FeaturesCache(this.base, this.fetchImpl);
    this.telemetry = new TelemetryBatcher(this.base, opts.publisherKey, this.fetchImpl);
    this.telemetry.setEnabled(opts.telemetry !== false);
    this.consentUnsub = this.consent.subscribe((state) => {
      this.emit({ kind: "consent_changed", state });
    });
    this.featuresUnsub = this.features.subscribe((f) => {
      this.telemetry.setEnabled(opts.telemetry !== false && f.flags.sdk_telemetry !== false);
      this.emit({ kind: "features_updated", flags: f.flags });
    });
    if (opts.onEvent) this.listeners.add(opts.onEvent);
    this.telemetry.record("init");
    void this.features.ensure();
  }

  get key(): string {
    return this.opts.publisherKey;
  }

  get endpoint(): string {
    return this.base;
  }

  get consentSnapshot(): ConsentState {
    return this.consent.snapshot;
  }

  setConsent(state: ConsentState): void {
    if (this.disposed) return;
    this.consent.update(state);
  }

  setUserId(id: string | undefined): void {
    if (this.disposed) return;
    this.userId = id ?? readOrCreateUid();
  }

  on(fn: (e: SdkClientEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  featuresValue(): FeaturesResponse | undefined {
    return this.features.value;
  }

  async ensureFeatures(): Promise<FeaturesResponse | undefined> {
    return this.features.ensure();
  }

  async serve(slotId: string, opts: ServeOptions = {}): Promise<ServeResponse | undefined> {
    if (this.disposed) return undefined;
    if (this.upgradeRequired) return undefined;
    const started = performance?.now?.() ?? Date.now();
    try {
      const req: Parameters<typeof fetchServe>[0] = {
        base: this.base,
        key: this.opts.publisherKey,
        slotId,
      };
      if (this.userId) req.userId = this.userId;
      if (opts.format !== undefined) req.format = opts.format;
      if (!this.consent.isPersonalized()) req.nonPersonalized = true;
      if (opts.signal) req.signal = opts.signal;
      const resp = await fetchServe(req, this.fetchImpl);
      const latency = Math.max(0, (performance?.now?.() ?? Date.now()) - started);
      this.telemetry.record("serve_request", latency);
      this.emit({ kind: "ad_served", slotId, adId: resp.ad.id, source: resp.source });
      return resp;
    } catch (err) {
      if (err instanceof UpgradeRequiredError) {
        this.upgradeRequired = true;
        this.telemetry.record("upgrade_required");
        this.opts.onUpgradeRequired?.(err.minVersion);
        this.emit({ kind: "upgrade_required", minVersion: err.minVersion });
        return undefined;
      }
      this.telemetry.record("error");
      const reason = err instanceof Error ? err.message : "unknown_error";
      log.debug("serve failed", err);
      this.emit({ kind: "ad_failed", slotId, reason });
      return undefined;
    }
  }

  fireImpression(resp: ServeResponse, slotId: string): void {
    if (this.disposed) return;
    postTrack(this.base, { token: resp.track_token, event: "impression" }, this.fetchImpl);
    this.telemetry.record("impression");
    this.emit({ kind: "impression", slotId, adId: resp.ad.id });
  }

  fireViewable(resp: ServeResponse, _slotId: string): void {
    if (this.disposed) return;
    postTrackViewable(this.base, resp.track_token, this.fetchImpl);
  }

  fireClick(resp: ServeResponse, slotId: string): void {
    if (this.disposed) return;
    postTrack(this.base, { token: resp.track_token, event: "click" }, this.fetchImpl);
    this.telemetry.record("click");
    this.emit({ kind: "click", slotId, adId: resp.ad.id });
  }

  conversion(opts: ConversionOptions): void {
    if (this.disposed) return;
    const body: Parameters<typeof postTrack>[1] = {
      token: opts.token,
      event: "conversion",
    };
    if (opts.value_cents !== undefined) body.value_cents = opts.value_cents;
    if (opts.currency !== undefined) body.currency = opts.currency;
    if (opts.conv_type !== undefined) body.conv_type = opts.conv_type;
    postTrack(this.base, body, this.fetchImpl);
    const evt: Extract<SdkClientEvent, { kind: "conversion" }> = { kind: "conversion" };
    if (opts.value_cents !== undefined) evt.valueCents = opts.value_cents;
    this.emit(evt);
  }

  async flushTelemetry(): Promise<void> {
    await this.telemetry.flush();
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.consentUnsub();
    this.featuresUnsub();
    this.telemetry.dispose();
    this.features.dispose();
    this.listeners.clear();
  }

  private emit(event: SdkClientEvent): void {
    for (const fn of this.listeners) {
      try {
        fn(event);
      } catch {
        // isolation.
      }
    }
  }
}

function normalizeBase(input: string): string {
  return input.endsWith("/") ? input : input + "/";
}

function readOrCreateUid(): string {
  if (typeof window === "undefined") return "";
  try {
    const stored = window.localStorage?.getItem(STORAGE_UID_KEY);
    if (stored) return stored;
    const id = randomId();
    window.localStorage?.setItem(STORAGE_UID_KEY, id);
    return id;
  } catch {
    return randomId();
  }
}

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
