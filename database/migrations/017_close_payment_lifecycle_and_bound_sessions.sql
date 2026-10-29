-- Camisaria Mendes - 017: encerra pagamentos fechados e sessoes antigas

UPDATE payment_checkouts pc
JOIN orders o ON o.id = pc.order_id
SET pc.status = 'expired',
    pc.locked_at = NULL,
    pc.last_error = 'Pedido cancelado ou reembolsado; checkout encerrado.'
WHERE o.status <> 'active'
   OR o.payment_status IN ('refunded', 'partially_refunded');

UPDATE payment_events pe
JOIN orders o ON o.id = pe.order_id
SET pe.dead_lettered_at = COALESCE(pe.dead_lettered_at, CURRENT_TIMESTAMP(3)),
    pe.locked_at = NULL,
    pe.processing_error = 'Pedido cancelado ou reembolsado; reconciliação encerrada.'
WHERE pe.processed_at IS NULL
  AND pe.dead_lettered_at IS NULL
  AND (o.status <> 'active' OR o.payment_status IN ('refunded', 'partially_refunded'));

DELETE FROM staff_sessions
WHERE created_at <= DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 7 DAY);

INSERT INTO schema_migrations (version) VALUES ('017_close_payment_lifecycle_and_bound_sessions')
ON DUPLICATE KEY UPDATE version = VALUES(version);
