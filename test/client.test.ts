import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdPlugaClient } from "../src/client";
import type { ServeResponse } from "../src/types";
import fixtureDisplay from "../../shared/fixtures/serve-response-display.json";

function fetchOk(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("AdPlugaClient", () => {
  let calls: Array<{ url: string; init?: RequestInit }>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    calls = [];
    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push({ url, init: init ?? undefined });
      if (url.endsWith("/serve") || url.includes("/serve?")) {
        return fetchOk(fixtureDisplay);
      }
      if (url.endsWith("/features")) {
        return fetchOk({
          flags: {
            brand_safety: true,
            transparency: true,
            marketplace: false,
            pool: true,
            deals: false,
            inventory_request: false,
            reputation: true,
            payments: true,
            sdk_telemetry: true,
            mediation: false,
          },
          sdk_min_version: { web: "0.1.0" },
        });
      }
      return new Response("", { status: 204 });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initialises and fetches an ad", async () => {
    const client = new AdPlugaClient({
      publisherKey: "pk_test_abc",
      endpoint: "https://edge.example/v1/",
      fetch: fetchMock as unknown as typeof fetch,
    });
    const resp = (await client.serve("slot_x")) as ServeResponse;
    expect(resp.ad.id).toBe(fixtureDisplay.ad.id);
    expect(fetchMock).toHaveBeenCalled();
    const serveCall = calls.find((c) => c.url.includes("/serve"));
    expect(serveCall).toBeDefined();
    expect(serveCall?.init?.headers).toMatchObject({ "X-AdPluga-Key": "pk_test_abc" });
    client.destroy();
  });

  it("emits ad_served on success and consent_changed on setConsent", async () => {
    const events: string[] = [];
    const client = new AdPlugaClient({
      publisherKey: "pk_test_abc",
      endpoint: "https://edge.example/v1/",
      fetch: fetchMock as unknown as typeof fetch,
      onEvent: (e) => events.push(e.kind),
    });
    await client.serve("slot_x");
    client.setConsent({ adPersonalization: false });
    await client.serve("slot_y");
    expect(events).toContain("ad_served");
    expect(events).toContain("consent_changed");
    const secondServe = calls.filter((c) => c.url.includes("/serve"))[1]?.url ?? "";
    expect(secondServe).toContain("non_personalized=true");
    client.destroy();
  });

  it("fireViewable posts /v1/track/viewable with the served track token", async () => {
    const beaconCalls: Array<{ url: string; body: string }> = [];
    const nav = globalThis.navigator as Navigator & { sendBeacon: (u: string, d?: unknown) => boolean };
    const beaconProto = Object.getPrototypeOf(nav) as { sendBeacon?: unknown };
    const priorProtoBeacon = beaconProto.sendBeacon;
    Object.defineProperty(beaconProto, "sendBeacon", {
      configurable: true,
      writable: true,
      value: (url: string, data: unknown) => {
        const body = data instanceof Blob ? "" : String(data ?? "");
        // Blob body cannot be read sync in happy-dom; test uses fetch fallback path.
        beaconCalls.push({ url, body });
        return false;
      },
    });
    try {
      const client = new AdPlugaClient({
        publisherKey: "pk_test_abc",
        endpoint: "https://edge.example/v1/",
        fetch: fetchMock as unknown as typeof fetch,
      });
      const resp = (await client.serve("slot_x")) as ServeResponse;
      client.fireImpression(resp, "slot_x");
      client.fireViewable(resp, "slot_x");

      const impression = beaconCalls.find((c) => /\/track(\?|$)/.test(c.url));
      const viewable = beaconCalls.find((c) => c.url.endsWith("/track/viewable"));
      expect(impression).toBeDefined();
      expect(viewable).toBeDefined();
      client.destroy();
    } finally {
      if (priorProtoBeacon === undefined) {
        delete (beaconProto as { sendBeacon?: unknown }).sendBeacon;
      } else {
        Object.defineProperty(beaconProto, "sendBeacon", {
          configurable: true,
          writable: true,
          value: priorProtoBeacon,
        });
      }
    }
  });

  it("treats 426 as upgrade_required and stops serving", async () => {
    const upgradeFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/serve")) {
        return new Response("", { status: 426, headers: { "X-AdPluga-Min-Sdk": "9.9.9" } });
      }
      return new Response("", { status: 204 });
    });
    let minReported: string | undefined;
    const client = new AdPlugaClient({
      publisherKey: "pk_test_abc",
      endpoint: "https://edge.example/v1/",
      fetch: upgradeFetch as unknown as typeof fetch,
      onUpgradeRequired: (v) => {
        minReported = v;
      },
    });
    const r1 = await client.serve("slot_a");
    const r2 = await client.serve("slot_b");
    expect(r1).toBeUndefined();
    expect(r2).toBeUndefined();
    expect(minReported).toBe("9.9.9");
    const serveHits = upgradeFetch.mock.calls.filter((c) => {
      const first = c[0];
      const u = typeof first === "string" ? first : (first as URL | Request).toString();
      return u.includes("/serve");
    });
    expect(serveHits).toHaveLength(1);
    client.destroy();
  });

  it("fires the bidder burl for a mediation fill and never posts a tokenless viewable", () => {
    const client = new AdPlugaClient({
      publisherKey: "pk_test_abc",
      endpoint: "https://edge.example/v1/",
      fetch: fetchMock as unknown as typeof fetch,
    });
    const mediation = {
      ...fixtureDisplay,
      ad: { ...fixtureDisplay.ad, billing_url: "https://ssp.example/bill?p=1" },
      track_token: "",
      source: "external",
    } as unknown as ServeResponse;

    client.fireViewable(mediation, "slot_x");

    expect(calls.some((c) => c.url === "https://ssp.example/bill?p=1")).toBe(true);
    expect(calls.some((c) => c.url.includes("/track/viewable"))).toBe(false);
    client.destroy();
  });

  it("posts the viewable and no bidder beacon for a first-party fill", () => {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal("navigator", { ...globalThis.navigator, sendBeacon });
    const client = new AdPlugaClient({
      publisherKey: "pk_test_abc",
      endpoint: "https://edge.example/v1/",
      fetch: fetchMock as unknown as typeof fetch,
    });
    const firstParty = { ...fixtureDisplay, track_token: "tok-1" } as unknown as ServeResponse;

    client.fireViewable(firstParty, "slot_x");

    expect(sendBeacon).toHaveBeenCalledWith(
      expect.stringContaining("/track/viewable"),
      expect.anything(),
    );
    // No third-party bidder beacon for first-party fills.
    expect(calls.every((c) => !c.url.startsWith("https://ssp"))).toBe(true);
    vi.unstubAllGlobals();
    client.destroy();
  });

  it("sends the rotation index and surfaces the slot cadence", async () => {
    const withCadence = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push({ url, init: init ?? undefined });
      if (url.includes("/serve")) {
        return fetchOk({ ...fixtureDisplay, refresh_after_seconds: 60 });
      }
      return new Response("", { status: 204 });
    });
    const client = new AdPlugaClient({
      publisherKey: "pk_test_abc",
      endpoint: "https://edge.example/v1/",
      fetch: withCadence as unknown as typeof fetch,
    });

    const first = (await client.serve("slot_x")) as ServeResponse;
    expect(first.refresh_after_seconds).toBe(60);
    await client.serve("slot_x", { refreshSeq: 2 });

    const serveCalls = calls.filter((c) => c.url.includes("/serve"));
    expect(serveCalls[0]?.url).not.toContain("rq=");
    expect(serveCalls[1]?.url).toContain("rq=2");
    client.destroy();
  });

});
