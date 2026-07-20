export const SDK_VERSION = "0.3.0";
export const SDK_PLATFORM = "web";

export const DEFAULT_ENDPOINT = "https://edge.adpluga.com/v1/";

// Mirrors adpluga-sdk/shared/constants.json — kept in sync via CI check.
export const VIEWABILITY_THRESHOLD = 0.5;
export const VIEWABILITY_DURATION_MS = 1000;

export const TELEMETRY_FLUSH_INTERVAL_MS = 300_000;
export const TELEMETRY_FLUSH_ON_COUNT = 100;
export const TELEMETRY_LATENCY_SAMPLE_CAP = 128;
export const TELEMETRY_MAX_EVENTS_PER_BATCH = 256;

export const FEATURES_REVALIDATE_MS = 300_000;

export const SERVE_TIMEOUT_MS = 3000;
export const TRACK_TIMEOUT_MS = 5000;
export const RETRY_MAX_ATTEMPTS = 2;
export const RETRY_BASE_BACKOFF_MS = 200;

export const HEADER_KEY = "X-AdPluga-Key";
export const HEADER_MIN_SDK = "X-AdPluga-Min-Sdk";

export const ELEMENT_TAG = "adpluga-slot";
export const ATTR_SLOT = "slot";
export const ATTR_PUBLISHABLE_KEY = "publishable-key";
export const ATTR_FORMAT = "format";
export const ATTR_LAZY = "lazy";
export const ATTR_AUTOLOAD = "autoload";

export const STORAGE_UID_KEY = "adpluga_uid";
