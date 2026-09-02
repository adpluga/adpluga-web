import type { AdView, QuartilePings, Slide } from "./types";

export type RenderTeardown = () => void;

export interface RenderContext {
  container: HTMLElement;
  clickUrl: string;
  onClick: () => void;
  quartilePings?: QuartilePings | null | undefined;
  apiBase?: string;
}

function resolveQuartileUrl(url: string | undefined, apiBase: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (!apiBase) return url;
  try {
    return new URL(url, apiBase).toString();
  } catch {
    return url;
  }
}

export function renderCreative(ad: AdView, ctx: RenderContext): RenderTeardown {
  switch (ad.type) {
    case "image":
      return renderImage(ad, ctx);
    case "html":
      return renderHtml(ad, ctx);
    case "native":
      return renderNative(ad, ctx);
    case "carousel":
      return renderCarousel(ad, ctx);
    case "video":
    case "video_rewarded":
    case "video_vast":
      return renderVideo(ad, ctx);
    case "audio":
      return renderAudio(ad, ctx);
    default:
      return renderUnsupported(ctx);
  }
}

function renderImage(ad: AdView, ctx: RenderContext): RenderTeardown {
  const link = document.createElement("a");
  link.href = ctx.clickUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer sponsored";
  link.style.display = "block";
  link.style.lineHeight = "0";
  const img = document.createElement("img");
  img.src = ad.asset_url ?? "";
  img.alt = "";
  img.decoding = "async";
  img.loading = "lazy";
  if (ad.width) img.width = ad.width;
  if (ad.height) img.height = ad.height;
  img.style.maxWidth = "100%";
  img.style.height = "auto";
  link.appendChild(img);

  const onClick = (): void => ctx.onClick();
  link.addEventListener("click", onClick, { passive: true });
  const root = mountRoot(link, ad.test);
  ctx.container.replaceChildren(root);

  return () => {
    link.removeEventListener("click", onClick);
    root.remove();
  };
}

// renderCarousel lays the deck out as a native scroll-snap track: no timers,
// no JS animation, so it inherits the platform's own momentum scrolling and
// stays accessible to keyboard and screen readers. Every card links to the
// same click URL because the deck is one advertiser and one auction — the
// SDK must never mint a second token per card.
function renderCarousel(ad: AdView, ctx: RenderContext): RenderTeardown {
  const deck: Slide[] = (ad.slides ?? []).filter((s) => !!s && !!s.asset_url);
  if (deck.length === 0) return renderUnsupported(ctx);

  const track = document.createElement("div");
  track.className = "adpluga-carousel";
  track.setAttribute("role", "group");
  track.setAttribute("aria-roledescription", "carousel");
  track.style.display = "flex";
  track.style.overflowX = "auto";
  track.style.scrollSnapType = "x mandatory";
  track.style.scrollBehavior = "smooth";
  track.style.setProperty("-webkit-overflow-scrolling", "touch");
  if (ad.width) track.style.maxWidth = `${ad.width}px`;

  const cards: HTMLAnchorElement[] = [];
  const onClick = (): void => ctx.onClick();

  for (let i = 0; i < deck.length; i += 1) {
    const slide = deck[i] as Slide;
    const card = document.createElement("a");
    card.className = "adpluga-carousel__slide";
    card.href = ctx.clickUrl;
    card.target = "_blank";
    card.rel = "noopener noreferrer sponsored";
    card.setAttribute("aria-label", `${i + 1} de ${deck.length}`);
    card.style.flex = "0 0 100%";
    card.style.scrollSnapAlign = "start";
    card.style.display = "block";
    card.style.textDecoration = "none";
    card.addEventListener("click", onClick, { passive: true });

    const img = document.createElement("img");
    img.className = "adpluga-carousel__image";
    img.src = slide.asset_url;
    img.alt = slide.title ?? "";
    img.decoding = "async";
    img.loading = i === 0 ? "eager" : "lazy";
    if (ad.width) img.width = ad.width;
    if (ad.height) img.height = ad.height;
    img.style.display = "block";
    img.style.width = "100%";
    img.style.height = "auto";
    card.appendChild(img);

    if (slide.title || slide.body || slide.cta_text) {
      const caption = document.createElement("div");
      caption.className = "adpluga-carousel__caption";
      if (slide.title) {
        const t = document.createElement("div");
        t.className = "adpluga-carousel__title";
        t.textContent = slide.title;
        caption.appendChild(t);
      }
      if (slide.body) {
        const b = document.createElement("div");
        b.className = "adpluga-carousel__desc";
        b.textContent = slide.body;
        caption.appendChild(b);
      }
      if (slide.cta_text) {
        const c = document.createElement("span");
        c.className = "adpluga-carousel__cta";
        c.textContent = slide.cta_text;
        caption.appendChild(c);
      }
      card.appendChild(caption);
    }

    cards.push(card);
    track.appendChild(card);
  }

  const root = mountRoot(track, ad.test);
  ctx.container.replaceChildren(root);

  return () => {
    for (let i = 0; i < cards.length; i += 1) {
      (cards[i] as HTMLAnchorElement).removeEventListener("click", onClick);
    }
    root.remove();
  };
}

function renderHtml(ad: AdView, ctx: RenderContext): RenderTeardown {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-scripts allow-popups allow-popups-to-escape-sandbox");
  iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  iframe.setAttribute("scrolling", "no");
  iframe.style.border = "0";
  iframe.style.display = "block";
  iframe.style.width = ad.width ? `${ad.width}px` : "100%";
  iframe.style.height = ad.height ? `${ad.height}px` : "auto";
  iframe.title = "advertisement";

  const html = wrapClickTracking(ad.html ?? "", ctx.clickUrl);
  iframe.srcdoc = html;

  // Bridge click events from the iframe (postMessage) to the tracker.
  const onMessage = (ev: MessageEvent): void => {
    if (ev.source !== iframe.contentWindow) return;
    if (ev.data && typeof ev.data === "object" && (ev.data as { adpluga?: string }).adpluga === "click") {
      ctx.onClick();
    }
  };
  window.addEventListener("message", onMessage);

  const root = mountRoot(iframe, ad.test);
  ctx.container.replaceChildren(root);

  return () => {
    window.removeEventListener("message", onMessage);
    root.remove();
  };
}

function renderNative(ad: AdView, ctx: RenderContext): RenderTeardown {
  // Native assets are flat top-level fields on the serve contract; `native`
  // is only a defensive fallback for legacy responses. Presentation is left
  // to integrator CSS via BEM-style class hooks — the SDK sets structure and
  // only the functional `cursor` inline style, so publisher classes win.
  const n = ad.native ?? {};
  const titleText = ad.title ?? n.title ?? "";
  const bodyText = ad.body ?? n.body ?? "";
  const ctaText = ad.cta_text ?? n.cta_text ?? "";
  const sponsoredBy = ad.sponsored_by ?? n.sponsored_by ?? "";
  const iconUrl = ad.icon_url ?? n.icon_url ?? "";
  const mainImageUrl = ad.main_image_url ?? n.main_image_url ?? "";

  const article = document.createElement("article");
  article.className = "adpluga-native";
  article.setAttribute("role", "link");
  article.style.cursor = "pointer";

  if (mainImageUrl) {
    const cover = document.createElement("img");
    cover.className = "adpluga-native__image";
    cover.src = mainImageUrl;
    cover.alt = "";
    cover.decoding = "async";
    cover.loading = "lazy";
    article.appendChild(cover);
  }

  const bodyWrap = document.createElement("div");
  bodyWrap.className = "adpluga-native__body";

  if (iconUrl) {
    const icon = document.createElement("img");
    icon.className = "adpluga-native__icon";
    icon.src = iconUrl;
    icon.alt = "";
    icon.width = 48;
    icon.height = 48;
    icon.decoding = "async";
    icon.loading = "lazy";
    bodyWrap.appendChild(icon);
  }

  const text = document.createElement("div");
  text.className = "adpluga-native__text";
  const title = document.createElement("div");
  title.className = "adpluga-native__title";
  title.textContent = titleText;
  const desc = document.createElement("div");
  desc.className = "adpluga-native__desc";
  desc.textContent = bodyText;
  const sponsor = document.createElement("small");
  sponsor.className = "adpluga-native__sponsor";
  sponsor.textContent = sponsoredBy ? `Ad · ${sponsoredBy}` : "Ad";
  text.appendChild(title);
  text.appendChild(desc);
  text.appendChild(sponsor);
  bodyWrap.appendChild(text);
  article.appendChild(bodyWrap);

  if (ctaText) {
    const cta = document.createElement("button");
    cta.type = "button";
    cta.className = "adpluga-native__cta";
    cta.textContent = ctaText;
    article.appendChild(cta);
  }

  const onClick = (): void => {
    ctx.onClick();
    window.open(ctx.clickUrl, "_blank", "noopener,noreferrer");
  };
  article.addEventListener("click", onClick, { passive: true });
  if (ad.test) {
    article.style.position = "relative";
    article.appendChild(testBadge());
  }
  ctx.container.replaceChildren(article);

  return () => {
    article.removeEventListener("click", onClick);
    article.remove();
  };
}

function renderVideo(ad: AdView, ctx: RenderContext): RenderTeardown {
  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  wrapper.style.width = ad.width ? `${ad.width}px` : "100%";
  wrapper.style.maxWidth = "100%";
  wrapper.style.background = "#000";

  const vid = document.createElement("video");
  vid.src = ad.video_url || ad.asset_url || "";
  vid.autoplay = true;
  vid.muted = true;
  vid.playsInline = true;
  vid.controls = true;
  vid.preload = "auto";
  vid.style.width = "100%";
  vid.style.display = "block";
  if (ad.width) vid.width = ad.width;
  if (ad.height) vid.height = ad.height;
  wrapper.appendChild(vid);

  const timers: number[] = [];
  const firedQuartiles = new Set<string>();

  const fireQuartile = (url: string | undefined, key: string): void => {
    const resolved = resolveQuartileUrl(url, ctx.apiBase);
    if (!resolved || firedQuartiles.has(key)) return;
    firedQuartiles.add(key);
    const img = new Image();
    img.src = resolved;
  };

  const pings = ctx.quartilePings;
  const onTimeUpdate = (): void => {
    if (!vid.duration || !pings) return;
    const pct = vid.currentTime / vid.duration;
    if (pct >= 0.0) fireQuartile(pings.start, "start");
    if (pct >= 0.25) fireQuartile(pings.firstQuartile, "firstQuartile");
    if (pct >= 0.5) fireQuartile(pings.midpoint, "midpoint");
    if (pct >= 0.75) fireQuartile(pings.thirdQuartile, "thirdQuartile");
  };
  const onEnded = (): void => {
    if (pings) fireQuartile(pings.complete, "complete");
  };
  vid.addEventListener("timeupdate", onTimeUpdate);
  vid.addEventListener("ended", onEnded);

  let skipBtn: HTMLButtonElement | undefined;
  if (ad.skippable_after_ms && ad.skippable_after_ms > 0) {
    skipBtn = document.createElement("button");
    skipBtn.textContent = `Skip in ${Math.ceil(ad.skippable_after_ms / 1000)}s`;
    skipBtn.disabled = true;
    skipBtn.style.cssText =
      "position:absolute;bottom:12px;right:12px;padding:6px 14px;background:rgba(0,0,0,.7);color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:4px;cursor:pointer;font:inherit;font-size:13px;z-index:1;";
    wrapper.appendChild(skipBtn);

    const skipMs = ad.skippable_after_ms;
    const btn = skipBtn;
    const countdown = window.setInterval(() => {
      const elapsed = vid.currentTime * 1000;
      const remaining = Math.ceil((skipMs - elapsed) / 1000);
      if (remaining > 0) {
        btn.textContent = `Skip in ${remaining}s`;
      } else {
        btn.textContent = "Skip";
        btn.disabled = false;
        window.clearInterval(countdown);
      }
    }, 250);
    timers.push(countdown);

    const onSkip = (): void => {
      vid.pause();
      ctx.onClick();
      window.open(ctx.clickUrl, "_blank", "noopener,noreferrer");
    };
    skipBtn.addEventListener("click", onSkip);
  }

  const ctaOverlay = document.createElement("a");
  ctaOverlay.href = ctx.clickUrl;
  ctaOverlay.target = "_blank";
  ctaOverlay.rel = "noopener noreferrer sponsored";
  ctaOverlay.textContent = "Learn more";
  ctaOverlay.style.cssText =
    "position:absolute;bottom:12px;left:12px;padding:6px 14px;background:rgba(0,0,0,.7);color:#fff;border-radius:4px;font:inherit;font-size:13px;text-decoration:none;z-index:1;";
  const onCtaClick = (): void => ctx.onClick();
  ctaOverlay.addEventListener("click", onCtaClick, { passive: true });
  wrapper.appendChild(ctaOverlay);

  if (ad.test) wrapper.appendChild(testBadge());
  vid.play().catch(() => {});
  ctx.container.replaceChildren(wrapper);

  return () => {
    for (const t of timers) window.clearInterval(t);
    vid.removeEventListener("timeupdate", onTimeUpdate);
    vid.removeEventListener("ended", onEnded);
    ctaOverlay.removeEventListener("click", onCtaClick);
    vid.pause();
    vid.removeAttribute("src");
    vid.load();
    wrapper.remove();
  };
}

function isImageUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    const path = new URL(url).pathname.toLowerCase();
    return /\.(jpe?g|png|gif|webp|svg|avif|bmp|ico)$/.test(path);
  } catch {
    return false;
  }
}

function renderAudio(ad: AdView, ctx: RenderContext): RenderTeardown {
  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  wrapper.style.width = ad.width ? `${ad.width}px` : "100%";
  wrapper.style.maxWidth = "100%";

  const candidateCompanion = ad.native?.main_image_url || ad.native?.icon_url || ad.asset_url;
  const companion = isImageUrl(candidateCompanion) ? candidateCompanion : undefined;

  if (companion) {
    const link = document.createElement("a");
    link.href = ctx.clickUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer sponsored";
    link.style.display = "block";
    link.style.lineHeight = "0";
    const img = document.createElement("img");
    img.src = companion;
    img.alt = "";
    img.decoding = "async";
    img.style.width = "100%";
    img.style.height = "auto";
    link.appendChild(img);
    const onImgClick = (): void => ctx.onClick();
    link.addEventListener("click", onImgClick, { passive: true });
    wrapper.appendChild(link);
  } else {
    const banner = document.createElement("a");
    banner.href = ctx.clickUrl;
    banner.target = "_blank";
    banner.rel = "noopener noreferrer sponsored";
    banner.style.cssText =
      "display:flex;align-items:center;gap:12px;padding:16px;background:#1a1a2e;color:#fff;border-radius:8px 8px 0 0;text-decoration:none;font:inherit;";
    const icon = document.createElement("div");
    icon.style.cssText = "width:48px;height:48px;border-radius:50%;background:#e94560;display:flex;align-items:center;justify-content:center;flex-shrink:0;";
    icon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>';
    banner.appendChild(icon);
    const info = document.createElement("div");
    info.style.cssText = "min-width:0;";
    const title = document.createElement("div");
    title.textContent = ad.title || ad.native?.title || "Audio Ad";
    title.style.cssText = "font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    info.appendChild(title);
    const sponsorText = ad.sponsored_by || ad.native?.sponsored_by;
    if (sponsorText) {
      const sponsor = document.createElement("div");
      sponsor.textContent = `Ad · ${sponsorText}`;
      sponsor.style.cssText = "font-size:12px;opacity:0.7;margin-top:2px;";
      info.appendChild(sponsor);
    }
    banner.appendChild(info);
    const onBannerClick = (): void => ctx.onClick();
    banner.addEventListener("click", onBannerClick, { passive: true });
    wrapper.appendChild(banner);
  }

  const audioSrc = ad.audio_url || ad.video_url || ad.asset_url || "";
  const audio = document.createElement("audio");
  audio.src = audioSrc;
  audio.autoplay = true;
  audio.controls = true;
  audio.preload = "auto";
  audio.style.width = "100%";
  audio.style.display = "block";
  if (!companion) {
    audio.style.borderRadius = "0 0 8px 8px";
  }
  wrapper.appendChild(audio);

  const firedQuartiles = new Set<string>();
  const fireQuartile = (url: string | undefined, key: string): void => {
    const resolved = resolveQuartileUrl(url, ctx.apiBase);
    if (!resolved || firedQuartiles.has(key)) return;
    firedQuartiles.add(key);
    const img = new Image();
    img.src = resolved;
  };

  const pings = ctx.quartilePings;
  const onTimeUpdate = (): void => {
    if (!audio.duration || !pings) return;
    const pct = audio.currentTime / audio.duration;
    if (pct >= 0.0) fireQuartile(pings.start, "start");
    if (pct >= 0.25) fireQuartile(pings.firstQuartile, "firstQuartile");
    if (pct >= 0.5) fireQuartile(pings.midpoint, "midpoint");
    if (pct >= 0.75) fireQuartile(pings.thirdQuartile, "thirdQuartile");
  };
  const onEnded = (): void => {
    if (pings) fireQuartile(pings.complete, "complete");
  };
  audio.addEventListener("timeupdate", onTimeUpdate);
  audio.addEventListener("ended", onEnded);

  if (ad.test) wrapper.appendChild(testBadge());
  audio.play().catch(() => {});
  ctx.container.replaceChildren(wrapper);

  return () => {
    audio.removeEventListener("timeupdate", onTimeUpdate);
    audio.removeEventListener("ended", onEnded);
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    wrapper.remove();
  };
}

function renderUnsupported(ctx: RenderContext): RenderTeardown {
  ctx.container.replaceChildren();
  return () => {
    /* nothing to teardown */
  };
}

// testBadge builds the non-interactive "TEST" chip drawn over sandbox
// (pk_test_) creatives. It rides `ad.test`, which the server sets from the
// authenticated key mode, so it cannot be spoofed away by advertiser HTML.
function testBadge(): HTMLElement {
  const b = document.createElement("div");
  b.textContent = "TEST";
  b.setAttribute("aria-hidden", "true");
  b.style.cssText =
    "position:absolute;top:6px;left:6px;z-index:2147483647;pointer-events:none;" +
    "background:#b45309;color:#fff;font:700 10px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;" +
    "letter-spacing:.08em;padding:3px 6px;border-radius:4px;opacity:.92;";
  return b;
}

// mountRoot overlays the TEST badge on a render whose outer element is not
// already positioned (image, html). Live renders return the element as-is.
function mountRoot(el: HTMLElement, test: boolean | null | undefined): HTMLElement {
  if (!test) return el;
  const wrap = document.createElement("div");
  wrap.style.position = "relative";
  wrap.style.display = "inline-block";
  wrap.style.maxWidth = "100%";
  wrap.appendChild(el);
  wrap.appendChild(testBadge());
  return wrap;
}

function wrapClickTracking(html: string, clickUrl: string): string {
  const safeUrl = clickUrl.replace(/</g, "%3C").replace(/>/g, "%3E").replace(/"/g, "%22");
  const script = `<script>document.addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest("a");if(!a)return;parent.postMessage({adpluga:"click"},"*");a.href=${JSON.stringify(safeUrl)};a.target="_blank";a.rel="noopener noreferrer sponsored";},{capture:true});</script>`;
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"></head><body style="margin:0">${html}${script}</body></html>`;
}
