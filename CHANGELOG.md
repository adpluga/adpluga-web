# Changelog

All notable changes to the AdPluga Web SDK are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/).

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
