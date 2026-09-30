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

## Quick start: the web component

Importing `@adpluga/web/element` registers `<adpluga-slot>`; the element starts the client from its own key.

```ts
import "@adpluga/web/element";
```

```html
<adpluga-slot publishable-key="pk_test_..." slot="your-slot-id" lazy></adpluga-slot>
```

Without a bundler, load the prebuilt bundle:

```html
<script src="https://cdn.jsdelivr.net/npm/@adpluga/web@0.7.2/dist/element.global.js"></script>
<adpluga-slot publishable-key="pk_test_..." slot="your-slot-id" lazy></adpluga-slot>
```

Attributes: `publishable-key`, `slot` (id or name), `format` (a size hint such as `300x250`), `lazy`, `autoload="false"`. In TSX, declare the element once in `JSX.IntrinsicElements`; the package does not ship those types.

## Programmatic client

```ts
import { initialize } from "@adpluga/web";

const client = initialize({ publisherKey: "pk_test_..." });
const resp = await client.serve("your-slot-id", { format: "300x250" });
if (resp) {
  // render resp.ad yourself, then report what happened
  client.fireImpression(resp, "your-slot-id");
}
```

Integration guides and API reference: <https://adpluga.com/en/devs/sdks/> · quick start in two minutes: <https://adpluga.com/en/devs/quickstart/>.

## Support

- Issues and questions: <https://github.com/adpluga/adpluga-web/issues>
- Security disclosures: <security@adpluga.com>

This repository is a read-only mirror of the internal monorepo. Pull requests
are accepted for discussion but changes are integrated upstream.
