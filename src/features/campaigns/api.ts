import { shirtColors, shirtModels, sortSizes } from "../../data";
import type { PrivateCampaign, ShirtColorOption, ShirtModelName, SizeCode } from "../../data";
import type { CampaignCoupon, ApiCampaign, ApiSettings, CampaignPhaseCode, ApiAdminCampaign, CreateCampaignPayload, UpdateCampaignPayload } from "../../../shared/contracts";
import { ApiRequestError, apiBase, request, assetUrl, staffToken, staffRequest } from "../../lib/http";

export function mapCampaign(campaign: ApiCampaign): PrivateCampaign {
  const prices = {} as Record<ShirtModelName, number>;
  const colors = {} as Record<ShirtModelName, ShirtColorOption[]>;
  const sizes = {} as Record<ShirtModelName, SizeCode[]>;
  const variantIds: NonNullable<PrivateCampaign["variantIds"]> = {};
  const variantArtworks: NonNullable<PrivateCampaign["variantArtworks"]> = {};
  const realPhotos: NonNullable<PrivateCampaign["realPhotos"]> = {};
  const realVideos: NonNullable<PrivateCampaign["realVideos"]> = {};
  const models: ShirtModelName[] = [];

  for (const model of shirtModels) {
    const variants = campaign.variants.filter((variant) => variant.model.name === model.name);
    if (variants.length > 0) models.push(model.name);
    prices[model.name] = (variants[0]?.unitPriceCents ?? 0) / 100;
    colors[model.name] = variants.map((variant) => {
      const known = shirtColors.find((color) => color.name === variant.color.name);
      return known ?? { name: variant.color.name, hex: variant.color.hex };
    });
    sizes[model.name] = sortSizes(
      campaign.sizes.filter((size) => size.model.name === model.name).map((size) => size.code as SizeCode),
    );
    variantIds[model.name] = Object.fromEntries(
      variants.map((variant) => [variant.color.name, variant.id]),
    );
    variants.forEach((variant) => {
      if (!variant.artwork) return;
      variantArtworks[variant.id] = {
        front: variant.artwork.front ? { ...variant.artwork.front, url: assetUrl(variant.artwork.front.url) ?? variant.artwork.front.url } : null,
        back: variant.artwork.back ? { ...variant.artwork.back, url: assetUrl(variant.artwork.back.url) ?? variant.artwork.back.url } : null,
      };
      if (variant.realPhotoUrls?.length && !realPhotos[variant.color.name]) {
        realPhotos[variant.color.name] = variant.realPhotoUrls.map((url) => assetUrl(url) ?? url);
      }
    });
  }
  for (const gallery of campaign.realPhotos ?? []) {
    realPhotos[gallery.colorName] = gallery.urls.map((url) => assetUrl(url) ?? url);
  }
  for (const video of campaign.realVideos ?? []) {
    realVideos[video.colorName] = {
      url: assetUrl(video.url) ?? video.url,
      posterUrl: assetUrl(video.posterUrl ?? null) ?? undefined,
      durationSeconds: video.durationSeconds ?? undefined,
      bytes: video.bytes,
    };
  }

  const deadline = new Date(campaign.deadlineAt);
  return {
    code: campaign.code,
    title: campaign.title,
    subtitle: campaign.subtitle ?? "Campanha exclusiva para os alunos da turma",
    art: {
      front: assetUrl(campaign.artFrontUrl) ?? shirtModels[0].image,
      back: assetUrl(campaign.artBackUrl),
      mode: campaign.artRenderMode,
      frontTransform: campaign.artworkConfig?.base.front?.transform,
      backTransform: campaign.artworkConfig?.base.back?.transform,
    },
    models,
    prices,
    sizes,
    deadline: Number.isNaN(deadline.getTime())
      ? "Prazo definido pela camisaria"
      : `Pedidos até ${deadline.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}`,
    pickup: campaign.pickupInstructions,
    deliveryExpectedOn: campaign.deliveryExpectedOn ?? null,
    deliveryNote: campaign.deliveryNote ?? null,
    representative: campaign.representativeName,
    representativeWhatsapp: campaign.representativeWhatsapp,
    colors,
    variantIds,
    variantArtworks,
    realPhotos,
    realVideos,
    presentation: campaign.presentationConfig ?? { mockupEnabled: true, realPhotosEnabled: false },
  };
}

export async function fetchCampaignFromApi(code: string) {
  const payload = await request<{ campaign: ApiCampaign }>(`/campaigns/${encodeURIComponent(code)}`);
  return mapCampaign(payload.campaign);
}

export async function validateCampaignCoupon(campaignCode: string, couponCode: string) {
  const query = new URLSearchParams({ code: couponCode });
  const payload = await request<{ coupon: CampaignCoupon }>(
    `/campaigns/${encodeURIComponent(campaignCode)}/coupon?${query.toString()}`,
  );
  return payload.coupon;
}

export async function fetchSettings() {
  return request<ApiSettings>("/settings");
}

export async function fetchAdminCampaigns() {
  const payload = await staffRequest<{ campaigns: ApiAdminCampaign[] }>("/admin/campaigns");
  return payload.campaigns;
}

/** Envia o binário puro: a campanha guarda só a URL, porque um data URI não caberia. */
export async function uploadCampaignArt(file: File) {
  const payload = await staffRequest<{ url: string; bytes: number }>(
    "/admin/uploads",
    { method: "POST", headers: { "Content-Type": file.type }, body: file },
    30000,
  );
  return payload.url;
}

/** XMLHttpRequest mantém o progresso real do corpo binário e permite cancelar o envio. */
export function uploadCampaignVideo(
  file: File,
  options: { onProgress?: (sent: number, total: number) => void; signal?: AbortSignal } = {},
) {
  const token = staffToken();
  if (!token) return Promise.reject(new ApiRequestError(401, "NO_SESSION", "Faça login para acessar o painel."));
  return new Promise<{ url: string; bytes: number }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    xhr.open("POST", `${apiBase()}/admin/video-uploads`);
    xhr.timeout = 60000;
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", "video/mp4");
    xhr.upload.onprogress = (event) => options.onProgress?.(event.loaded, event.lengthComputable ? event.total : file.size);
    xhr.onload = () => {
      options.signal?.removeEventListener("abort", abort);
      let payload: { url?: string; bytes?: number; error?: { code?: string; message?: string } } = {};
      try { payload = JSON.parse(xhr.responseText || "{}"); } catch { /* resposta inválida */ }
      if (xhr.status >= 200 && xhr.status < 300 && payload.url && typeof payload.bytes === "number") {
        resolve({ url: payload.url, bytes: payload.bytes });
      } else {
        reject(new ApiRequestError(xhr.status, payload.error?.code ?? "VIDEO_UPLOAD_FAILED", payload.error?.message ?? "Não foi possível enviar o vídeo."));
      }
    };
    xhr.onerror = () => reject(new ApiRequestError(0, "API_UNAVAILABLE", "Não foi possível conectar ao servidor."));
    xhr.ontimeout = () => reject(new ApiRequestError(0, "VIDEO_UPLOAD_TIMEOUT", "O envio do vídeo excedeu o tempo limite."));
    xhr.onabort = () => reject(new ApiRequestError(0, "VIDEO_UPLOAD_CANCELLED", "Envio cancelado."));
    if (options.signal?.aborted) return abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    xhr.send(file);
  });
}

export async function createCampaignInApi(input: CreateCampaignPayload) {
  const payload = await staffRequest<{ campaign: { code: string } }>("/admin/campaigns", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return payload.campaign;
}

/** Campanha crua, como a API devolve, para preencher o formulário de edição. */
export async function fetchCampaignDetail(code: string) {
  const payload = await staffRequest<{ campaign: ApiCampaign }>(`/admin/campaigns/${encodeURIComponent(code)}`);
  return payload.campaign;
}

export async function updateCampaignInApi(code: string, input: UpdateCampaignPayload) {
  const payload = await staffRequest<{ campaign: { code: string } }>(
    `/admin/campaigns/${encodeURIComponent(code)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return payload.campaign;
}

export async function deleteCampaignInApi(code: string) {
  const payload = await staffRequest<{ campaign: { code: string; deleted: true } }>(
    `/admin/campaigns/${encodeURIComponent(code)}`,
    { method: "DELETE" },
  );
  return payload.campaign;
}

export async function changeCampaignPhaseInApi(code: string, targetPhase: CampaignPhaseCode, reason?: string) {
  const payload = await staffRequest<{ campaign: { phase: CampaignPhaseCode; previousPhase: CampaignPhaseCode } }>(
    `/admin/campaigns/${encodeURIComponent(code)}/phase`,
    { method: "PATCH", body: JSON.stringify({ targetPhase, reason }) },
  );
  return payload.campaign;
}
