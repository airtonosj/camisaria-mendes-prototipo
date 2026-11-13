import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicCampaignDocumentHtml } from '../../api/modules/media/public-campaign-html.mjs';
import { validApiResponse } from '../../shared/response-contracts.mjs';

const shell = '<html><head><title>Original</title></head><body><div id="root"></div></body></html>';

test('public listing exposes crawlable campaign and next-page links without injecting titles', async () => {
  const html = await publicCampaignDocumentHtml(shell, '/campanhas', 'https://camisaria.example/', async () => ({
    campaigns: [{ code: 'TURMA-1', title: '<script>Turma</script>', subtitle: 'Arte & turma' }],
    pageSize: 12, total: 24,
  }));
  assert.match(html, /href="https:\/\/camisaria\.example\/\?campanha=TURMA-1"/);
  assert.match(html, /href="\/campanhas\?pagina=2"/);
  assert.match(html, /&lt;script&gt;Turma&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>Turma<\/script>/);
  assert.match(html, /rel="canonical"/);
});

test('filtered listing is not indexed as a duplicate page', async () => {
  const html = await publicCampaignDocumentHtml(shell, '/campanhas?busca=turma', 'https://camisaria.example/', async () => ({ campaigns: [], pageSize: 12, total: 0 }));
  assert.match(html, /name="robots" content="noindex"/);
});

test('browser accepts the public catalog response and rejects incomplete items', () => {
  const payload = { campaigns: [{ code: 'TURMA-1', title: 'Turma 1', subtitle: null, deadlineAt: '2027-12-31T00:00:00.000Z', imageUrl: '/uploads/photo.webp' }], total: 1, page: 1, pageSize: 12 };
  assert.equal(validApiResponse('/campaigns/public?pagina=1', 'GET', payload), true);
  assert.equal(validApiResponse('/campaigns/public?pagina=1', 'GET', { ...payload, campaigns: [{ code: 'TURMA-1' }] }), false);
});
