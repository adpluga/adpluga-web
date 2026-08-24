import { describe, expect, it } from "vitest";

import { renderCreative, type RenderContext } from "../src/render";
import type { AdView } from "../src/types";

function ctxWith(): { ctx: RenderContext; container: HTMLElement } {
  const container = document.createElement("div");
  const ctx: RenderContext = {
    container,
    clickUrl: "https://track.example/click",
    onClick: () => {},
  };
  return { ctx, container };
}

const baseNative: AdView = {
  id: "ad-1",
  type: "native",
  title: "Promo Outono",
  body: "Descontos até 50%",
  cta_text: "Comprar",
  sponsored_by: "AdPluga",
  icon_url: "https://cdn.example/icon.png",
  main_image_url: "https://cdn.example/main.png",
  width: 320,
  height: 200,
  format: "native",
};

describe("renderNative", () => {
  it("reads flat fields (not a nested native object)", () => {
    const { ctx, container } = ctxWith();
    renderCreative(baseNative, ctx);
    const article = container.querySelector(".adpluga-native");
    expect(article).not.toBeNull();
    expect(container.querySelector(".adpluga-native__title")?.textContent).toBe("Promo Outono");
    expect(container.querySelector(".adpluga-native__desc")?.textContent).toBe("Descontos até 50%");
    expect(container.querySelector(".adpluga-native__sponsor")?.textContent).toBe("Ad · AdPluga");
    // regression: must not collapse to the bare "Ad" fallback
    expect(container.textContent).not.toBe("Ad");
  });

  it("renders main_image_url and a cta_text button", () => {
    const { ctx, container } = ctxWith();
    renderCreative(baseNative, ctx);
    const cover = container.querySelector<HTMLImageElement>(".adpluga-native__image");
    expect(cover?.src).toContain("main.png");
    const cta = container.querySelector<HTMLButtonElement>(".adpluga-native__cta");
    expect(cta?.textContent).toBe("Comprar");
  });

  it("does not lock presentation with inline styles (integrator CSS wins)", () => {
    const { ctx, container } = ctxWith();
    renderCreative(baseNative, ctx);
    const title = container.querySelector<HTMLElement>(".adpluga-native__title");
    expect(title?.style.fontWeight).toBe("");
    const desc = container.querySelector<HTMLElement>(".adpluga-native__desc");
    expect(desc?.style.opacity).toBe("");
  });

  it("falls back to a nested native object when flat fields are absent", () => {
    const { ctx, container } = ctxWith();
    const legacy: AdView = {
      id: "ad-2",
      type: "native",
      native: { title: "Legado", sponsored_by: "X" },
      width: 320,
      height: 200,
      format: "native",
    };
    renderCreative(legacy, ctx);
    expect(container.querySelector(".adpluga-native__title")?.textContent).toBe("Legado");
  });
});

describe("test-mode badge", () => {
  function hasTestBadge(container: HTMLElement): boolean {
    return Array.from(container.querySelectorAll("div")).some((d) => d.textContent === "TEST");
  }

  it("draws a TEST badge on native when ad.test is true", () => {
    const { ctx, container } = ctxWith();
    renderCreative({ ...baseNative, test: true }, ctx);
    expect(hasTestBadge(container)).toBe(true);
  });

  it("draws a TEST badge on image when ad.test is true", () => {
    const { ctx, container } = ctxWith();
    const ad: AdView = {
      id: "img-1",
      type: "image",
      asset_url: "https://cdn.example/banner.png",
      width: 300,
      height: 250,
      format: "display",
      test: true,
    };
    renderCreative(ad, ctx);
    expect(hasTestBadge(container)).toBe(true);
  });

  it("omits the badge on live creatives", () => {
    const { ctx, container } = ctxWith();
    renderCreative(baseNative, ctx);
    expect(hasTestBadge(container)).toBe(false);
  });
});

describe("renderCreative template", () => {
  it("renders server-composed html for type html (templates arrive as html)", () => {
    const { ctx, container } = ctxWith();
    const ad: AdView = {
      id: "ad-3",
      type: "html",
      html: "<div class='tpl'>Promo</div>",
      width: 300,
      height: 250,
      format: "display",
    };
    renderCreative(ad, ctx);
    // html renders inside a sandboxed iframe; container must not be empty
    expect(container.childElementCount).toBeGreaterThan(0);
  });
});
