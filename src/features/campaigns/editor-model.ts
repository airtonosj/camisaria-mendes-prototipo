import { defaultCampaignColors, defaultCampaignSizes } from "../../data";
import type { ShirtColorName, ShirtColorOption, ShirtModelName, SizeCode } from "../../data";
import type { ArtworkTransform } from "../../data";

/* ------------------------------------------------------------------ */
/* Campanhas                                                           */
/* ------------------------------------------------------------------ */

export function defaultModelColorNames(): Record<ShirtModelName, ShirtColorName[]> {
  return {
    Comum: defaultCampaignColors.Comum.map((color) => color.name),
    Oversized: defaultCampaignColors.Oversized.map((color) => color.name),
  };
}

export function defaultModelSizes(): Record<ShirtModelName, SizeCode[]> {
  return { Comum: [...defaultCampaignSizes.Comum], Oversized: [...defaultCampaignSizes.Oversized] };
}

export function colorKey(name: string) {
  return name.trim().toLocaleLowerCase("pt-BR");
}

export function mergeCampaignColors(...groups: ShirtColorOption[][]) {
  const colors = new Map<string, ShirtColorOption>();
  groups.flat().forEach((color) => colors.set(colorKey(color.name), { name: color.name, hex: color.hex.toUpperCase() }));
  return [...colors.values()];
}

export function validHexColor(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

/**
 * Espelha `suggestedCampaignCode` da API para mostrar o código antes de salvar.
 * A API continua sendo a autoridade: se o campo vier vazio, ela gera o dela.
 */
export { suggestedCampaignCode as suggestCode } from '../../../shared/domain.mjs';

export type ArtDraft = { file: File | null; preview: string };

export type RealPhotoDraft = { file: File | null; preview: string; url: string | null };

export type RealVideoDraft = {
  preview: string;
  url: string | null;
  posterPreview: string;
  posterUrl: string | null;
  durationSeconds: number;
  bytes: number;
  progress: number;
  status: "processing" | "uploading" | "ready" | "error";
  error?: string;
};

export type EditableArtMode = "overlay" | "variant_mockup" | "legacy_mockup";

export type CampaignFormStep = "information" | "products" | "images" | "review";

export type ArtSideDraft = {
  file: File | null;
  preview: string;
  url: string | null;
  source: "inherit" | "custom" | "none";
  transformOverride: boolean;
  transform: ArtworkTransform;
};

export type VariantArtDraft = { front: ArtSideDraft; back: ArtSideDraft };

export const campaignFormSteps: Array<{ id: CampaignFormStep; label: string; description: string }> = [
  { id: "information", label: "Informações", description: "Dados básicos da campanha" },
  { id: "products", label: "Produtos", description: "Cores e tamanhos disponíveis" },
  { id: "images", label: "Imagens", description: "Arte, fotos e vídeo" },
  { id: "review", label: "Revisão", description: "Resumo e publicação" },
];

export const campaignDraftKey = "camisaria-mendes-campaign-draft-v1";

export const defaultTransform: ArtworkTransform = { x: 0, y: 0, scale: 1, rotation: 0 };

export function variantArtKey(model: ShirtModelName, color: string) {
  return `${model}::${color}`;
}

export function emptyArtSide(source: ArtSideDraft["source"] = "inherit"): ArtSideDraft {
  return { file: null, preview: "", url: null, source, transformOverride: false, transform: { ...defaultTransform } };
}

export function emptyVariantArt(mode: EditableArtMode): VariantArtDraft {
  const source = mode === "variant_mockup" ? "none" : "inherit";
  return { front: emptyArtSide(source), back: emptyArtSide(source) };
}

export function storedArtworkUrl(value: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value, window.location.origin);
    return /^\/uploads\/[0-9a-f-]{36}\.(png|jpg|webp|mp4)$/i.test(parsed.pathname) ? parsed.pathname : value;
  } catch {
    return value;
  }
}

export async function inspectCampaignVideo(file: File, preview: string) {
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = preview;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("O navegador não conseguiu reproduzir este MP4."));
  });
  if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > 15.05) {
    throw new Error("O vídeo deve ter no máximo 15 segundos.");
  }

  const durationSeconds = video.duration;
  let posterFile: File | null = null;
  try {
    const target = Math.min(0.25, video.duration / 2);
    await new Promise<void>((resolve) => {
      const timeout = window.setTimeout(resolve, 1800);
      video.onseeked = () => { window.clearTimeout(timeout); resolve(); };
      video.currentTime = target;
    });
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    if (blob) posterFile = new File([blob], `${file.name.replace(/\.mp4$/i, "")}-capa.webp`, { type: "image/webp" });
  } catch {
    // A capa é opcional; o painel e a loja mantêm um fallback visual com ícone de play.
  }
  video.removeAttribute("src");
  video.load();
  return { durationSeconds, posterFile };
}
