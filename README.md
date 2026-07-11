# AdPluga Web SDK

Typed TypeScript client and Web Component for the AdPluga edge
(`/v1/serve` + `/v1/track` + `/v1/sdk/telemetry`). Ships an ESM build,
a CJS build, a standalone bundle, and a custom element for zero-JS
integration.

- **Package**: [`@adpluga/web`](https://www.npmjs.com/package/@adpluga/web) on npm
- **Node**: `>=18.17.0`
- **Provenance**: signed via npm attestations
- **License**: Proprietary — see [LICENSE](./LICENSE)

## Install

```bash
npm install @adpluga/web
```

```bash
pnpm add @adpluga/web
```

## Quick start (TypeScript / ESM)

```ts
import { AdPluga } from '@adpluga/web';

const client = new AdPluga({ publisherKey: 'pk_live_...' });
const ad = await client.serve({ slotId: 'slot_home', format: 'banner_320x100' });
if (ad) client.mount(ad, document.getElementById('ad-slot')!);
```

## Web Component (zero-JS embed)

```html
<script type="module" src="https://cdn.adpluga.com/v1/adpluga.js"></script>
<adpluga-ad
    publisher-key="pk_live_..."
    slot-id="slot_home"
    format="banner_320x100">
</adpluga-ad>
```

Full API reference and integration guides: <https://app.adpluga.com/docs/sdk/web>.

## Support

- Issues and questions: <https://github.com/adpluga/adpluga-web/issues>
- Security disclosures: <security@adpluga.com>

This repository is a read-only mirror of the internal monorepo. Pull requests
are accepted for discussion but changes are integrated upstream.
