import test from 'node:test';
import assert from 'node:assert/strict';
import { validDeliveryDate, formatDeliveryDate } from '../../shared/delivery.mjs';

test('delivery dates reject calendar rollover and keep the displayed day without a year', () => {
  for (const value of ['2026-02-29', '2026-04-31', '2026-11-10T00:00:00Z', '10/11/2026', '0000-01-01', null, 123]) assert.equal(validDeliveryDate(value), false);
  assert.equal(validDeliveryDate('2028-02-29'), true);
  assert.equal(formatDeliveryDate('2026-11-10'), '10 de novembro');
  assert.equal(formatDeliveryDate(null), '');
});
