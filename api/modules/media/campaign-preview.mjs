export const shareImageWidth = 1200;
export const shareImageHeight = 630;
const uploadPathPattern = /^\/uploads\/([0-9a-f-]{36}\.(?:png|jpg|webp))$/;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

// Only files stored by this server can be converted into the share thumbnail.
function uploadFilename(value, baseUrl) {
  if (!value) return null;
  try {
    const base = new URL(baseUrl);
    const url = new URL(value, base);
    return url.origin === base.origin && !url.search ? uploadPathPattern.exec(url.pathname)?.[1] ?? null : null;
  } catch {
    return null;
  }
}

// Real shirt photos come first; the artwork is the fallback when the campaign has no photos.
export function campaignShareSource(campaign, baseUrl) {
  const photos = campaign.presentationConfig?.realPhotosEnabled
    ? (campaign.realPhotos ?? []).flatMap((group) => group.urls ?? []) : [];
  const artwork = campaign.presentationConfig?.mockupEnabled === false ? [] : [
    ...(campaign.variants ?? []).map((variant) => variant.artwork?.front?.url),
    campaign.artFrontUrl, campaign.artBackUrl,
  ];
  return [...photos, ...artwork].map((value) => uploadFilename(value, baseUrl)).find(Boolean) ?? null;
}

export function shareImagePath(code) {
  return `/compartilhar/${encodeURIComponent(code)}.jpg`;
}

// WhatsApp drops large, transparent or WebP previews, so every source becomes a small opaque JPEG.
export async function renderShareImage(input) {
  const { default: sharp } = await import("sharp");
  return sharp(input, { failOn: "error" })
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize(shareImageWidth, shareImageHeight, { fit: "contain", background: "#ffffff" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

// Metadata must be present before React runs so link crawlers can read it.
export async function campaignPreviewHtml(html, requestUrl, publicAppUrl, getCampaign) {
  const url = new URL(requestUrl, publicAppUrl);
  const code = url.searchParams.get("campanha")?.trim().toUpperCase();
  if (!code || code.length > 100 || url.searchParams.has("rota")
    || /\/(acesso-camisaria|acompanhar-pedido)\/?$/.test(url.pathname)) return html;
  let campaign;
  try {
    campaign = await getCampaign(code);
  } catch {
    // A missing campaign or unavailable database must not prevent the app from loading.
    return html;
  }
  const source = campaignShareSource(campaign, publicAppUrl);
  const image = source ? new URL(shareImagePath(campaign.code), publicAppUrl) : null;
  // The source file name changes whenever the photo changes, forcing crawlers to refresh their cache.
  image?.searchParams.set("v", source.slice(0, 8));
  const canonical = new URL(publicAppUrl);
  canonical.search = "";
  canonical.hash = "";
  canonical.searchParams.set("campanha", campaign.code);
  const title = `${campaign.title} | Camisaria Mendes`;
  const description = campaign.subtitle || "Confira os modelos e participe desta campanha da Camisaria Mendes.";
  const properties = {
    "og:type": "website", "og:site_name": "Camisaria Mendes", "og:locale": "pt_BR",
    "og:title": title, "og:description": description, "og:url": canonical.href,
    ...(image ? {
      "og:image": image.href,
      ...(image.protocol === "https:" ? { "og:image:secure_url": image.href } : {}),
      "og:image:type": "image/jpeg",
      "og:image:width": String(shareImageWidth), "og:image:height": String(shareImageHeight),
      "og:image:alt": campaign.title,
    } : {}),
  };
  const tags = [
    ...Object.entries(properties).map(([property, value]) =>
      `<meta property="${property}" content="${escapeHtml(value)}" />`),
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
  ].join("\n    ");
  return html.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/i,
      () => `<meta name="description" content="${escapeHtml(description)}" />`)
    .replace(/<\/head>/i, () => `    ${tags}\n  </head>`);
}
