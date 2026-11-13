import type { CSSProperties, PointerEventHandler } from "react";
import type { CampaignArt, ShirtColorOption, ShirtModelName, VariantArtwork } from "../data";
import { shirtModels } from "../data";

type ShirtMockupPreviewProps = {
  model: ShirtModelName;
  color: ShirtColorOption;
  art: CampaignArt;
  side: "front" | "back";
  label: string;
  compact?: boolean;
  artwork?: VariantArtwork;
  interactive?: boolean;
  onPointerDown?: PointerEventHandler<HTMLDivElement>;
};

/**
 * Compõe, no navegador, três camadas independentes: cor, textura da peça e arte.
 * Assim uma única arte transparente serve para todos os cortes e cores da campanha.
 */
export function ShirtMockupPreview({ model, color, art, side, label, compact = false, artwork, interactive = false, onPointerDown }: ShirtMockupPreviewProps) {
  const shirt = shirtModels.find((item) => item.name === model) ?? shirtModels[0];
  const overlayMode = art.mode === "overlay";
  const fallbackUrl = side === "back" ? art.back : art.front;
  const fallbackTransform = side === "back" ? art.backTransform : art.frontTransform;
  const resolvedAsset = artwork ? artwork[side] : fallbackUrl ? {
    url: fallbackUrl,
    transform: fallbackTransform ?? { x: 0, y: 0, scale: 1, rotation: 0 },
  } : null;
  const artUrl = resolvedAsset?.url ?? null;

  if (!overlayMode) {
    const legacyImage = artUrl || (side === "back" ? shirt.backImage : art.front || shirt.image);
    return <img className="shirt-mockup-legacy" src={legacyImage} alt={label} />;
  }

  const mockup = side === "back" ? shirt.mockupBackImage : shirt.mockupImage;
  const style = {
    "--shirt-color": color.hex,
    "--shirt-mask": `url("${mockup}")`,
    "--art-x": `${resolvedAsset?.transform.x ?? 0}%`,
    "--art-y": `${resolvedAsset?.transform.y ?? 0}%`,
    "--art-scale": resolvedAsset?.transform.scale ?? 1,
    "--art-rotation": `${resolvedAsset?.transform.rotation ?? 0}deg`,
  } as CSSProperties;

  return (
    <div
      className={`shirt-mockup-composite shirt-mockup-composite--${side}${compact ? " is-compact" : ""}${interactive ? " is-interactive" : ""}`}
      style={style}
      role="img"
      aria-label={label}
      onPointerDown={onPointerDown}
    >
      <span className="shirt-mockup-color" aria-hidden="true" />
      <img className="shirt-mockup-texture" src={mockup} alt="" aria-hidden="true" />
      <img className="shirt-mockup-highlight" src={mockup} alt="" aria-hidden="true" />
      {artUrl && (
        <span className="shirt-mockup-art" aria-hidden="true">
          <img src={artUrl} alt="" />
        </span>
      )}
    </div>
  );
}
