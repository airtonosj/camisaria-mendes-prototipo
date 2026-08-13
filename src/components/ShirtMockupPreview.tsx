import type { CSSProperties } from "react";
import type { CampaignArt, ShirtColorOption, ShirtModelName } from "../data";
import { shirtModels } from "../data";

type ShirtMockupPreviewProps = {
  model: ShirtModelName;
  color: ShirtColorOption;
  art: CampaignArt;
  side: "front" | "back";
  label: string;
  compact?: boolean;
};

/**
 * Compõe, no navegador, três camadas independentes: cor, textura da peça e arte.
 * Assim uma única arte transparente serve para todos os cortes e cores da campanha.
 */
export function ShirtMockupPreview({ model, color, art, side, label, compact = false }: ShirtMockupPreviewProps) {
  const shirt = shirtModels.find((item) => item.name === model) ?? shirtModels[0];
  const overlayMode = art.mode === "overlay";
  const artUrl = side === "back" ? art.back : art.front;

  if (!overlayMode) {
    const legacyImage = artUrl || (side === "back" ? shirt.backImage : art.front || shirt.image);
    return <img className="shirt-mockup-legacy" src={legacyImage} alt={label} />;
  }

  const mockup = side === "back" ? shirt.mockupBackImage : shirt.mockupImage;
  const style = {
    "--shirt-color": color.hex,
    "--shirt-mask": `url("${mockup}")`,
  } as CSSProperties;

  return (
    <div
      className={`shirt-mockup-composite shirt-mockup-composite--${side}${compact ? " is-compact" : ""}`}
      style={style}
      role="img"
      aria-label={label}
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
