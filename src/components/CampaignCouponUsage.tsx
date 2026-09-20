import type { CampaignCouponStats } from '../api';

export function CampaignCouponUsage({ coupons }: { coupons: CampaignCouponStats[] }) {
  if (!coupons.length) return null;
  return <section className="campaign-coupon-usage" aria-label="Uso de cupons desta campanha">
    <h3>Uso de cupons nesta campanha</h3>
    <p>Uma utilização por pedido. Pagos, pendentes e cancelados são apresentados separadamente.</p>
    <div className="coupon-usage-grid">{coupons.map(coupon => <article key={coupon.id}>
      <header><strong>{coupon.code}</strong><span>{coupon.active ? 'Ativo' : 'Desativado'}</span></header>
      <dl>
        <div><dt>Pagos</dt><dd>{coupon.paidCount}</dd></div>
        <div><dt>Aguardando pagamento</dt><dd>{coupon.pendingCount}</dd></div>
        <div><dt>Cancelados</dt><dd>{coupon.cancelledCount}</dd></div>
        <div><dt>Reembolso total ou parcial</dt><dd>{coupon.refundedCount}</dd></div>
        <div><dt>Pagamento falhou</dt><dd>{coupon.failedCount}</dd></div>
      </dl>
      <small>Limite ocupado: {coupon.usedCount}{coupon.usageLimit !== null ? ` de ${coupon.usageLimit}` : ' · sem limite'}. A regra atual reserva o uso para pedidos não cancelados.</small>
    </article>)}</div>
  </section>;
}
