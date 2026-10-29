-- Camisaria Mendes - 005: cancelamento de pedido
--
-- `orders.status` já previa 'cancelled' desde a 001, mas nenhuma rota escrevia esse
-- valor. Cancelar sem registrar o motivo deixaria a operação sem resposta para "por que
-- este pedido sumiu?", então o motivo é obrigatório e mora junto com quem cancelou.
--
-- O pedido não é apagado: as views de produção e entrega já filtram status = 'active',
-- então um cancelamento sai dos relatórios sem levar embora o histórico.

ALTER TABLE orders
  ADD COLUMN cancelled_at DATETIME(3) NULL AFTER delivered_at,
  ADD COLUMN cancellation_reason VARCHAR(500) NULL AFTER cancelled_at,
  ADD COLUMN cancelled_by_user_id BIGINT UNSIGNED NULL AFTER cancellation_reason,
  ADD CONSTRAINT fk_orders_cancelled_by FOREIGN KEY (cancelled_by_user_id) REFERENCES users (id) ON DELETE SET NULL;

INSERT INTO schema_migrations (version) VALUES ('005_order_cancellation')
ON DUPLICATE KEY UPDATE version = VALUES(version);
