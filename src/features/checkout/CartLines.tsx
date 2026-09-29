import type { PrivateCampaign, ShirtModelName } from "../../data";
import { ShirtMockupPreview } from "../../components/ShirtMockupPreview";
import { itemKey, artworkForVariant, formatCents } from "./cart";
import type { CartItem } from "./cart";

/** Mostra a primeira combinação do carrinho; campanhas antigas mantêm a imagem completa. */
export function ArtThumbs({ campaign, label, items }: { campaign: PrivateCampaign; label: string; items: CartItem[] }) {
  if (items.length > 0 && campaign.presentation?.mockupEnabled === false && campaign.presentation.realPhotosEnabled) return (
    <div className={`campaign-art-thumbs campaign-art-thumbs--variants ${items.length === 1 ? "is-single" : ""}`} aria-label="Fotos reais das camisas selecionadas">
      {items.map((item) => {
        const photo = campaign.realPhotos?.[item.color.name]?.[0];
        return photo ? <img key={itemKey(item)} src={photo} alt={`${label} — ${item.modelName}, ${item.color.name}`} /> : null;
      })}
    </div>
  );
  if (items.length > 0 && campaign.art.mode !== "legacy_mockup") return (
    <div className={`campaign-art-thumbs campaign-art-thumbs--variants ${items.length === 1 ? "is-single" : ""}`} aria-label="Camisas selecionadas">
      {items.map((item) => {
        const artwork = artworkForVariant(campaign, item.variantId);
        const side = artwork.front ? "front" : "back";
        if (!artwork[side]) return null;
        return <ShirtMockupPreview key={itemKey(item)} model={item.modelName} color={item.color} art={campaign.art} artwork={artwork} side={side} label={`${label} — ${item.modelName}, ${item.color.name}`} compact />;
      })}
    </div>
  );
  return (
    <div className={`campaign-art-thumbs ${campaign.art.back ? "" : "is-single"}`} aria-label={campaign.art.back ? "Arte de frente e costas" : "Arte da campanha"}>
      <img src={campaign.art.front} alt={`${label} — frente`} />
      {campaign.art.back && <img src={campaign.art.back} alt={`${label} — costas`} />}
    </div>
  );
}

export function CartLines({ items, discountsByModel = {}, discountedQuantitiesByItem = {}, editable = false, onQuantity, onRemove }: {
  items: CartItem[];
  discountsByModel?: Partial<Record<ShirtModelName, number>>;
  discountedQuantitiesByItem?: Record<string, number>;
  editable?: boolean;
  onQuantity?: (key: string, quantity: number) => void;
  onRemove?: (key: string) => void;
}) {
  return (
    <div className="campaign-cart-lines">
      {items.map((item) => {
        const key = itemKey(item);
        const unitDiscountCents = discountsByModel[item.modelName] ?? 0;
        const discountedQuantity = discountedQuantitiesByItem[key] ?? 0;
        const regularQuantity = item.quantity - discountedQuantity;
        const discountedUnitPrice = item.unitPriceCents - unitDiscountCents;
        const lineTotalCents = item.unitPriceCents * item.quantity - unitDiscountCents * discountedQuantity;
        return (
          <article className="campaign-cart-line" key={key}>
            <i className="campaign-cart-color" style={{ backgroundColor: item.color.hex }} />
            <div className="campaign-cart-copy">
              <strong>{item.modelName} · {item.color.name} · {item.size}</strong>
              <small className={discountedQuantity ? "campaign-cart-price is-discounted" : "campaign-cart-price"}>
                {discountedQuantity === item.quantity && unitDiscountCents ? <><del>{formatCents(item.unitPriceCents)}</del><strong>{formatCents(discountedUnitPrice)} por unidade</strong></>
                  : discountedQuantity > 0 ? <><strong>{discountedQuantity}× {formatCents(discountedUnitPrice)} com desconto</strong><span>{regularQuantity}× {formatCents(item.unitPriceCents)} sem desconto</span></>
                    : <>{formatCents(item.unitPriceCents)} por unidade</>}
              </small>
            </div>
            {editable ? (
              <div className="campaign-cart-controls" aria-label={`Quantidade de ${item.modelName}, ${item.color.name}, tamanho ${item.size}`}>
                <button type="button" aria-label="Diminuir quantidade" onClick={() => onQuantity?.(key, item.quantity - 1)}>−</button>
                <output>{item.quantity}</output>
                <button type="button" aria-label="Aumentar quantidade" onClick={() => onQuantity?.(key, item.quantity + 1)}>+</button>
              </div>
            ) : <span className="campaign-cart-quantity">{item.quantity}×</span>}
            <b>{formatCents(lineTotalCents)}</b>
            {editable && <button className="campaign-cart-remove" type="button" onClick={() => onRemove?.(key)}>Remover</button>}
          </article>
        );
      })}
    </div>
  );
}
