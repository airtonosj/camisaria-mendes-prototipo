import { formatDeliveryDate } from '../../shared/delivery.mjs';

type Props = {
  representative: string;
  expectedOn?: string | null;
  note?: string | null;
  className?: string;
  previous?: { expectedOn: string | null; note: string | null } | null;
};

export function CampaignDeliveryInfo({ representative, expectedOn, note, className = '', previous }: Props) {
  const date = formatDeliveryDate(expectedOn);
  const changed = previous && (previous.expectedOn !== (expectedOn ?? null) || previous.note !== (note ?? null));
  return <div className={`checkout-pickup campaign-delivery-info ${className}`} aria-label="Informações de retirada e entrega">
    <div><span className="material-symbols-rounded" aria-hidden="true">person</span><span>Retirada com <b>{representative}</b></span></div>
    <div><span className="material-symbols-rounded" aria-hidden="true">inventory_2</span><span>{date ? <>Entrega prevista para <b>{date}</b></> : 'Entrega prevista a definir'}</span></div>
    {note && <div><span className="material-symbols-rounded" aria-hidden="true">info</span><span>{note}</span></div>}
    {changed && <div><span className="material-symbols-rounded" aria-hidden="true">info</span><span>Previsão atualizada. Na compra: {formatDeliveryDate(previous.expectedOn) || 'a definir'}.</span></div>}
  </div>;
}
