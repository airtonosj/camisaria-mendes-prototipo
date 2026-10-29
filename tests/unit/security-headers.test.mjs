import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { applySecurityHeaders } from '../../api/http/security-headers.mjs';
import { validApiResponse } from '../../shared/response-contracts.mjs';

test('security defaults survive errors, HEAD and a specialized CSP', async () => {
  const server = http.createServer((request, response) => {
    applySecurityHeaders(response);
    if (request.url === '/special') response.writeHead(200, { 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" });
    else response.writeHead(request.url === '/error' ? 500 : 200);
    response.end('test');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    for (const [path, method] of [['/', 'GET'], ['/error', 'GET'], ['/special', 'GET'], ['/', 'HEAD']]) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method });
      assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
      assert.equal(response.headers.get('x-frame-options'), 'DENY');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      if (path === '/special') assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
      await response.text();
    }
  } finally { server.close(); await once(server, 'close'); }
});

test('POST order tracking retains its response contract', () => {
  const path = '/orders/CM-2026-12345678';
  assert.equal(validApiResponse(path, 'POST', { order: { number: 'CM-2026-12345678', status: 'pending', totalCents: 1000, items: [] } }), true);
  assert.equal(validApiResponse(path, 'POST', { order: {} }), false);
  assert.equal(validApiResponse(path, 'POST', {}), false);
});
