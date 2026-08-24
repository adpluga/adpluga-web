# Changelog

All notable changes to the AdPluga Web SDK are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/).

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
