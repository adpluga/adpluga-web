# AdPluga Web SDK

Typed TypeScript client and Web Component for the AdPluga edge
(`/v1/serve` + `/v1/track` + `/v1/sdk/telemetry`). Ships an ESM build,
a CJS build, a standalone bundle, and a custom element for zero-JS
integration.

- **Package**: [`@adpluga/web`](https://www.npmjs.com/package/@adpluga/web) on npm
- **Node**: `>=18.17.0`
- **Provenance**: signed via npm attestations
- **License**: Proprietary — see [LICENSE](./LICENSE)

## Why AdPluga

- **100,000 ad decisions free every month.** No card, no expiry.
- **No traffic minimum.** When there is no demand, a house ad fills the slot so it never renders empty.
- **Test mode first.** A `pk_test_` key serves ads with no billing and no quota use; switch to `pk_live_` when you are ready.
- **One integration, every demand source.** Direct deals, network demand and mediation behind the same slot.

Create a free account at <https://adpluga.com/en/> and get your keys in the dashboard.

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

const client = new AdPluga({ publisherKey: 'pk_test_...' });
const ad = await client.serve({ slotId: 'slot_home', format: 'banner_320x100' });
if (ad) client.mount(ad, document.getElementById('ad-slot')!);
```

## Web Component (zero-JS embed)

```html
<script type="module" src="https://cdn.adpluga.com/v1/adpluga.js"></script>
<adpluga-ad
    publisher-key="pk_test_..."
    slot-id="slot_home"
    format="banner_320x100">
</adpluga-ad>
```

Integration guides and API reference: <https://adpluga.com/en/devs/sdks/> · quick start in two minutes: <https://adpluga.com/en/devs/quickstart/>.

## Support

- Issues and questions: <https://github.com/adpluga/adpluga-web/issues>
- Security disclosures: <security@adpluga.com>

This repository is a read-only mirror of the internal monorepo. Pull requests
are accepted for discussion but changes are integrated upstream.
