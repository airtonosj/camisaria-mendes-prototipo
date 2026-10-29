import { useState } from "react";
import { CampaignQrCode } from "../../components/CampaignQrCode";
import { CampaignCouponUsage } from "../../components/CampaignCouponUsage";
import { buildRoute } from '../../navigation';
import { phaseMeta } from "../admin/model";
import type { PanelCampaign } from "../admin/model";

export function CampaignSharePanel({ campaign, onClose }: { campaign: PanelCampaign; onClose: () => void }) {
  const [copied, setCopied] = useState<"" | "code" | "link" | "coupon" | "couponLink">("");
  const [qrWithDiscount, setQrWithDiscount] = useState(false);
  const campaignLink = buildRoute(undefined, campaign.code);
  const couponLink = campaign.activeCoupon ? buildRoute(undefined, campaign.code, undefined, undefined, campaign.activeCoupon.code) : "";
  const selectedCoupon = qrWithDiscount ? campaign.activeCoupon : null;

  async function copy(value: string, type: "code" | "link" | "coupon" | "couponLink") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(type);
    } catch {
      setCopied("");
    }
  }

  return (
    <section className="campaign-share-panel" aria-labelledby="campaign-share-title">
      <header><div><span className="campaign-share-success"><span className="material-symbols-rounded" aria-hidden="true">check</span>Campanha pronta para divulgação</span><h3 id="campaign-share-title">{campaign.title}</h3><p>Envie uma destas opções somente ao representante da turma.</p></div><button type="button" onClick={onClose} aria-label="Fechar compartilhamento"><span className="material-symbols-rounded" aria-hidden="true">close</span></button></header>
      <div className="campaign-share-content">
        <div className="campaign-share-options">
          <article><span className="material-symbols-rounded" aria-hidden="true">password</span><div><small>Código da campanha</small><strong>{campaign.code}</strong></div><button type="button" onClick={() => copy(campaign.code, "code")}><span className="material-symbols-rounded" aria-hidden="true">content_copy</span>Copiar</button></article>
          <article><span className="material-symbols-rounded" aria-hidden="true">link</span><div><small>Link privado</small><strong>{campaignLink}</strong></div><button type="button" onClick={() => copy(campaignLink, "link")}><span className="material-symbols-rounded" aria-hidden="true">content_copy</span>Copiar</button></article>
          {campaign.activeCoupon && <><article><span className="material-symbols-rounded" aria-hidden="true">sell</span><div><small>Cupom de desconto · a partir de {campaign.activeCoupon.minimumQuantity} peças{campaign.activeCoupon.maximumDiscountQuantity ? ` · até ${campaign.activeCoupon.maximumDiscountQuantity} com desconto` : ""}</small><strong>{campaign.activeCoupon.code}</strong></div><button type="button" onClick={() => copy(campaign.activeCoupon!.code, "coupon")}><span className="material-symbols-rounded" aria-hidden="true">content_copy</span>Copiar</button></article><article><span className="material-symbols-rounded" aria-hidden="true">link</span><div><small>Link com cupom aplicado</small><strong>{couponLink}</strong></div><button type="button" onClick={() => copy(couponLink, "couponLink")}><span className="material-symbols-rounded" aria-hidden="true">content_copy</span>Copiar</button></article></>}
          <dl className="campaign-share-sizes">
            <div><dt>Fase</dt><dd>{phaseMeta[campaign.phase].label}</dd></div>
            <div><dt>Prazo</dt><dd>{campaign.deadlineLabel}</dd></div>
            <div><dt>Representante</dt><dd>{campaign.representative}</dd></div>
          </dl>
          <a href={campaignLink} target="_blank" rel="noreferrer">Abrir página da campanha<span className="material-symbols-rounded" aria-hidden="true">open_in_new</span></a>
          <p role="status" aria-live="polite">{copied === "code" ? "Código copiado." : copied === "link" ? "Link privado copiado." : copied === "coupon" ? "Cupom copiado." : copied === "couponLink" ? "Link com cupom copiado." : "O acesso não aparece na página pública."}</p>
        </div>
        <div className="campaign-qr-options">
          {campaign.activeCoupon && <button className="campaign-qr-switch" type="button" role="switch" aria-checked={Boolean(selectedCoupon)} aria-label="QR code com desconto" onClick={() => setQrWithDiscount(value => !value)}>
            <span><strong>Com desconto</strong><small>{selectedCoupon ? 'Cupom incluído no QR code' : 'QR code sem cupom'}</small></span>
            <span className="campaign-qr-switch-track" aria-hidden="true"><span /></span>
          </button>}
          <CampaignQrCode url={selectedCoupon ? couponLink : campaignLink} campaignCode={campaign.code} couponCode={selectedCoupon?.code} />
        </div>
      </div>
      <CampaignCouponUsage coupons={campaign.couponHistory ?? []} />
    </section>
  );
}
