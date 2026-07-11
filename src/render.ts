import type { AdView } from "./types";

// Renders the creative into a container. Returns a teardown function that
// clears listeners, timers and DOM inserted by this renderer — callers must
// invoke it before removing the container from the tree.
export type RenderTeardown = () => void;

export interface RenderContext {
  container: HTMLElement;
  clickUrl: string;
  onClick: () => void;
}

export function renderCreative(ad: AdView, ctx: RenderContext): RenderTeardown {
  switch (ad.type) {
    case "image":
      return renderImage(ad, ctx);
    case "html":
      return renderHtml(ad, ctx);
    case "native":
      return renderNative(ad, ctx);
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
  ctx.container.replaceChildren(link);

  return () => {
    link.removeEventListener("click", onClick);
    link.remove();
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

  ctx.container.replaceChildren(iframe);

  return () => {
    window.removeEventListener("message", onMessage);
    iframe.remove();
  };
}

function renderNative(ad: AdView, ctx: RenderContext): RenderTeardown {
  const article = document.createElement("article");
  article.setAttribute("role", "link");
  article.style.display = "grid";
  article.style.gridTemplateColumns = "auto 1fr";
  article.style.gap = "12px";
  article.style.alignItems = "center";
  article.style.cursor = "pointer";
  article.style.font = "inherit";

  const native = ad.native ?? {};
  if (native.icon_url) {
    const icon = document.createElement("img");
    icon.src = native.icon_url;
    icon.alt = "";
    icon.width = 48;
    icon.height = 48;
    icon.decoding = "async";
    icon.loading = "lazy";
    icon.style.borderRadius = "8px";
    article.appendChild(icon);
  }

  const body = document.createElement("div");
  const title = document.createElement("div");
  title.textContent = native.title ?? "";
  title.style.fontWeight = "600";
  const desc = document.createElement("div");
  desc.textContent = native.body ?? "";
  desc.style.opacity = "0.8";
  const sponsor = document.createElement("small");
  sponsor.textContent = native.sponsored_by ? `Ad · ${native.sponsored_by}` : "Ad";
  sponsor.style.opacity = "0.6";
  body.appendChild(title);
  body.appendChild(desc);
  body.appendChild(sponsor);
  article.appendChild(body);

  const onClick = (): void => {
    ctx.onClick();
    window.open(ctx.clickUrl, "_blank", "noopener,noreferrer");
  };
  article.addEventListener("click", onClick, { passive: true });
  ctx.container.replaceChildren(article);

  return () => {
    article.removeEventListener("click", onClick);
    article.remove();
  };
}

function renderUnsupported(ctx: RenderContext): RenderTeardown {
  ctx.container.replaceChildren();
  return () => {
    /* nothing to teardown */
  };
}

function wrapClickTracking(html: string, clickUrl: string): string {
  const safeUrl = clickUrl.replace(/</g, "%3C").replace(/>/g, "%3E").replace(/"/g, "%22");
  const script = `<script>document.addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest("a");if(!a)return;parent.postMessage({adpluga:"click"},"*");a.href=${JSON.stringify(safeUrl)};a.target="_blank";a.rel="noopener noreferrer sponsored";},{capture:true});</script>`;
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"></head><body style="margin:0">${html}${script}</body></html>`;
}
