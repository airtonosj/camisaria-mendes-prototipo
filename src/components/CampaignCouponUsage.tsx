import type { CampaignCouponStats } from '../api';

export function CampaignCouponUsage({ coupons }: { coupons: CampaignCouponStats[] }) {
  if (!coupons.length) return null;
  return <section className="campaign-coupon-usage" aria-label="Uso de cupons desta campanha">
    <h3>Uso de cupons nesta campanha</h3>
    <p>Uma utilização por pedido. Acompanhe os resultados de cada cupom.</p>
    <div className="coupon-usage-grid">{coupons.map(coupon => <article className="coupon-usage-card" key={coupon.id} aria-label={`Uso do cupom ${coupon.code}`}>
      <header className="coupon-usage-identity">
        <span className="coupon-usage-eyebrow">Cupom da campanha</span>
        <strong className="coupon-usage-code">{coupon.code}</strong>
        <span className={`coupon-usage-status${coupon.active ? ' is-active' : ''}`}>{coupon.active ? 'Ativo' : 'Desativado'}</span>
        <small>{coupon.usageLimit === null ? 'Sem limite de uso' : `Limite de ${coupon.usageLimit} ${coupon.usageLimit === 1 ? 'utilização' : 'utilizações'}`}</small>
      </header>
      <div className="coupon-usage-summary">
      <div className="coupon-usage-numbers">
      <dl className="coupon-usage-paid"><div><dd>{coupon.paidCount}</dd><dt>{coupon.paidCount === 1 ? 'Pedido pago' : 'Pedidos pagos'}</dt></div></dl>
      <dl className="coupon-usage-secondary">
        <div><dt>Aguardando pagamento</dt><dd>{coupon.pendingCount}</dd></div>
        <div><dt>Cancelados</dt><dd>{coupon.cancelledCount}</dd></div>
        <div><dt>Reembolso total ou parcial</dt><dd>{coupon.refundedCount}</dd></div>
        <div><dt>Pagamento falhou</dt><dd>{coupon.failedCount}</dd></div>
      </dl>
      </div>
      <footer className="coupon-usage-note"><strong>Limite ocupado: {coupon.usedCount}{coupon.usageLimit !== null ? ` de ${coupon.usageLimit}` : ''}</strong><span>Pedidos não cancelados reservam uma utilização.</span></footer>
      </div>
    </article>)}</div>
  </section>;
}
