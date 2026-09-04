# Changelog

All notable changes to the AdPluga Web SDK are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.7.1] — 2026-09

### Fixed
- A slot that failed to fill stayed blank for the rest of the session. Only the
  success path armed the next attempt, so a transient miss — or a widget that
  mounted before the SDK was initialised — cost the publisher that slot until
  the view was recreated. Every failure path now schedules another attempt,
  backing off exponentially from the client's cadence floor up to five minutes.
  Retry is independent of the slot's rotation cadence, which is off by default:
  tying recovery to rotation is what made a single miss permanent.

## [0.7.0] — 2026-09

### Changed
- Version bump only, to keep the four SDKs aligned. The web SDK was not
  affected by the native tracking and click-through defects fixed in 0.7.0:
  it already wraps image creatives in an anchor to the click URL.

## [0.6.0] — 2026-09

### Added
- `renderCarousel` renders `type=carousel` decks as a CSS scroll-snap track, so
  it inherits native momentum scrolling and stays keyboard accessible. Every
  card links to the shared click URL: one advertiser, one auction, one
  impression.
- `Slide` type and `AdView.slides`.

### Changed
- A slot cadence below the client floor is raised to it instead of being
  ignored, so a slot set to 15s rotates every 15s on a `pk_test_` key and every
  30s on a live one.

## [0.5.0] — 2026-09

### Added
- Slot rotation: `<adpluga-slot>` now re-serves on the cadence the publisher
  configures for the slot (`refresh_after_seconds` on the serve response),
  so a single-page app no longer shows a frozen creative between navigations.
- Rotation never fires on a hidden tab (`document.hidden`) — the MRC guidelines
  treat out-of-view auto-refresh as non-viewable — is floored at 30s
  (`MIN_REFRESH_SECONDS`), and the timer is cleared on disconnect and reload.
- `serve()` accepts `refreshSeq` and sends it as `rq`, so refreshed impressions
  stay segregable from the initial render.

## [0.4.2] — 2026-08

### Added
- Test-mode badge: creatives served by a `pk_test_` key now render a
  non-interactive `TEST` chip (driven by the authoritative `ad.test` field
  from the serve response, not a client attribute) across image, html,
  native, video and audio surfaces.

## [0.4.1] — 2026-08

### Fixed
- Native ads now render from the flat serve fields (`title`, `body`,
  `cta_text`, `sponsored_by`, `icon_url`, `main_image_url`) instead of a
  nested `native` object, fixing native creatives that previously showed
  only the "Ad" fallback.
- Native renderer now includes `main_image_url` and a `cta_text` button and
  uses `adpluga-native*` class hooks instead of style-locking inline styles,
  so publisher CSS applies.

## [0.4.0] — 2026-07

### Added
- Audio ad rendering with autoplay, companion banner (title + sponsor) and
  playback controls.
- Video and audio ads render via `<video>` and `<audio>` elements with
  autoplay muted (video) / autoplay (audio) following browser policies.
- `title`, `body`, `sponsored_by`, `click_url` fields on the `AdView`
  interface for structured ad metadata.

### Fixed
- Audio banner now shows actual ad title instead of fallback "Audio Ad"
  by checking `ad.title` before `ad.native?.title`.

## [0.3.0] — 2026-07

### Added
- IAB viewability dispatch: `AdPlugaClient.fireViewable(resp, slotId)` posts
  `/v1/track/viewable` with the same track token. The bundled Web Component
  fires it in the same viewability callback that already recorded the
  impression, so hosts see one viewable event per served creative.

## [0.2.0] — 2025-11

### Added
- Web Component custom element (`<adpluga-ad>`) for zero-JS embedding.
- Signed publishing via npm provenance.
- Anti-drift version guard: `package.json` and `SDK_VERSION` must match
  before release.

### Changed
- ESM-first output with CJS interop and standalone global bundle.

## [0.1.0] — 2025-10

### Added
- Initial public release: `AdPluga` client, `serve`/`track`/`telemetry`
  transports, TypeScript types.
