-- Camisaria Mendes - 016: limites duraveis para a fila de reconciliacao

ALTER TABLE payment_events
  ADD COLUMN order_id BIGINT UNSIGNED NULL AFTER provider,
  ADD COLUMN dead_lettered_at DATETIME(3) NULL AFTER processed_at;

UPDATE payment_events pe
JOIN orders o
  ON o.order_number = JSON_UNQUOTE(JSON_EXTRACT(pe.payload, '$.order_nsu'))
SET pe.order_id = o.id
WHERE pe.order_id IS NULL;

ALTER TABLE payment_events
  ADD KEY ix_payment_events_order_received (order_id, received_at),
  ADD KEY ix_payment_events_dead_lettered (dead_lettered_at),
  ADD CONSTRAINT fk_payment_events_order
    FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE RESTRICT;

INSERT INTO schema_migrations (version) VALUES ('016_bound_payment_event_queue')
ON DUPLICATE KEY UPDATE version = VALUES(version);
