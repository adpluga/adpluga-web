export type AdSource = "house" | "pool" | "direto" | "external" | "self";

export type CreativeType = "image" | "html" | "native" | "video_vast" | "audio";

export type FormatId = "display" | "native" | "video" | "video_rewarded" | "vast";

export type EventName = "impression" | "click" | "conversion" | "viewable";

export type SdkEventType =
  | "init"
  | "serve_request"
  | "impression"
  | "click"
  | "error"
  | "upgrade_required";

export type SdkPlatform = "web" | "flutter" | "android" | "ios";

export interface NativeAssets {
  title?: string;
  body?: string;
  cta_text?: string;
  sponsored_by?: string;
  icon_url?: string;
  main_image_url?: string;
}

export interface QuartilePings {
  start?: string;
  firstQuartile?: string;
  midpoint?: string;
  thirdQuartile?: string;
  complete?: string;
}

export interface AdView {
  id: string;
  type: CreativeType;
  asset_url?: string | null;
  html?: string | null;
  native?: NativeAssets | null;
  vast_url?: string | null;
  audio_url?: string | null;
  video_url?: string | null;
  width: number;
  height: number;
  duration_ms?: number;
  skippable_after_ms?: number;
  reward_amount?: number;
  reward_currency?: string;
  format: FormatId;
}

export interface ServeResponse {
  ad: AdView;
  impression_url: string;
  click_url: string;
  conversion_url: string;
  track_token: string;
  conversion_token: string;
  source: AdSource;
  quartile_pings?: QuartilePings | null;
}

export interface TrackEventBody {
  token: string;
  event: EventName;
  value_cents?: number;
  currency?: string;
  conv_type?: string;
}

export interface ConversionOptions {
  token: string;
  value_cents?: number;
  currency?: string;
  conv_type?: string;
}

export interface ConsentState {
  gdprApplies?: boolean;
  hasAdConsent?: boolean;
  adPersonalization?: boolean;
  usPrivacy?: string;
  tcString?: string;
  gppString?: string;
}

export interface FeatureFlags {
  brand_safety: boolean;
  transparency: boolean;
  marketplace: boolean;
  pool: boolean;
  deals: boolean;
  inventory_request: boolean;
  reputation: boolean;
  payments: boolean;
  sdk_telemetry: boolean;
  mediation: boolean;
  [flag: string]: boolean;
}

export interface FeaturesResponse {
  flags: FeatureFlags;
  sdk_min_version: {
    flutter?: string;
    android?: string;
    ios?: string;
    web?: string;
  };
}

export interface ClientOptions {
  publisherKey: string;
  endpoint?: string;
  userId?: string;
  consent?: ConsentState;
  telemetry?: boolean;
  fetch?: typeof fetch;
  onUpgradeRequired?: (minVersion: string | undefined) => void;
  onEvent?: (event: SdkClientEvent) => void;
}

export type SdkClientEvent =
  | { kind: "ad_served"; slotId: string; adId: string; source: AdSource }
  | { kind: "ad_failed"; slotId: string; reason: string }
  | { kind: "impression"; slotId: string; adId: string }
  | { kind: "click"; slotId: string; adId: string }
  | { kind: "conversion"; adId?: string; valueCents?: number }
  | { kind: "consent_changed"; state: ConsentState }
  | { kind: "features_updated"; flags: FeatureFlags }
  | { kind: "upgrade_required"; minVersion: string | undefined };

export interface ServeOptions {
  format?: string;
  signal?: AbortSignal;
}
