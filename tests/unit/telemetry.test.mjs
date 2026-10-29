import test from 'node:test';
import assert from 'node:assert/strict';
import { routeLabel } from '../../api/http/telemetry.mjs';
test('request labels never include order IDs, contacts or query tokens',()=>{
 assert.equal(routeLabel('/api/orders/CM-PRIVATE?whatsapp=98999991234'),'/api/orders');
 assert.equal(routeLabel('/api/admin/campaigns/PRIVATE'),'/api/admin/campaigns');
 assert.equal(routeLabel('/api/person@example.test'),'/api/other');
 assert.equal(routeLabel('/redefinir-senha?token=secret'),'/frontend');
});
