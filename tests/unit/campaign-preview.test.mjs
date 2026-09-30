import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { campaignPreviewHtml, campaignShareSource, renderShareImage } from '../../api/modules/media/campaign-preview.mjs';

const html = '<html><head><meta name="description" content="Generic" /><title>Generic</title></head><body><div id="root"></div></body></html>';
const base = 'https://camisaria.example';
const photo = '/uploads/11111111-1111-4111-8111-111111111111.jpg';
const art = '/uploads/22222222-2222-4222-8222-222222222222.png';
const campaign = {
  code: 'TURMA', title: 'Turma <2026> "A"', subtitle: 'Camisas & amigos',
  presentationConfig: { realPhotosEnabled: true, mockupEnabled: true },
  realPhotos: [{ urls: [photo] }], artFrontUrl: art,
};

test('campaign HTML exposes escaped metadata and a versioned JPEG preview before JavaScript runs', async () => {
  const result = await campaignPreviewHtml(html, '/?campanha=turma&cupom=ABC&retomar=private', base, async (code) => {
    assert.equal(code, 'TURMA');
    return campaign;
  });
  assert.match(result, /property="og:image" content="https:\/\/camisaria.example\/compartilhar\/TURMA.jpg\?v=11111111"/);
  assert.match(result, /property="og:image:secure_url"/);
  assert.match(result, /property="og:image:type" content="image\/jpeg"/);
  assert.match(result, /property="og:image:width" content="1200"/);
  assert.match(result, /property="og:image:height" content="630"/);
  assert.match(result, /name="twitter:card" content="summary_large_image"/);
  assert.match(result, /Turma &lt;2026&gt; &quot;A&quot;/);
  assert.match(result, /Camisas &amp; amigos/);
  assert.match(result, /property="og:url" content="https:\/\/camisaria.example\/\?campanha=TURMA"/);
  assert.doesNotMatch(result, /private|cupom/);
  assert.match(result, /<div id="root"><\/div>/);
});

test('share source prefers real photos, falls back to artwork and skips foreign or unsafe URLs', () => {
  assert.equal(campaignShareSource(campaign, base), '11111111-1111-4111-8111-111111111111.jpg');
  assert.equal(campaignShareSource({
    ...campaign, presentationConfig: { realPhotosEnabled: false },
    variants: [{ artwork: { front: { url: 'javascript:alert(1)' } } }, { artwork: { front: { url: `https://other.example${photo}` } } }],
  }, base), '22222222-2222-4222-8222-222222222222.png');
  assert.equal(campaignShareSource({ ...campaign, artFrontUrl: '/uploads/../config.png', realPhotos: [] }, base), null);
  assert.equal(campaignShareSource({ ...campaign, presentationConfig: { mockupEnabled: false } }, base), null);
});

test('share thumbnail is an opaque 1200x630 JPEG small enough for WhatsApp', async () => {
  const transparent = await sharp({ create: { width: 3000, height: 3000, channels: 4, background: { r: 200, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  const image = await renderShareImage(transparent);
  const metadata = await sharp(image).metadata();
  assert.equal(metadata.format, 'jpeg');
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 630);
  assert.equal(metadata.hasAlpha, false);
  assert.ok(image.length < 300 * 1024);
  const { data } = await sharp(image).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([...data.subarray(0, 3)].map((value) => value > 245), [true, true, true]);
});

test('missing campaign or database failure preserves the application HTML', async () => {
  assert.equal(await campaignPreviewHtml(html, '/?campanha=MISSING', base, async () => { throw new Error('unavailable'); }), html);
});

test('ordinary and staff routes do not load campaign data', async () => {
  for (const url of ['/', '/?rota=admin&campanha=TURMA', '/acompanhar-pedido?campanha=TURMA']) {
    assert.equal(await campaignPreviewHtml(html, url, base, async () => { assert.fail('unexpected query'); }), html);
  }
});

test('campaign without images still has metadata without a broken image tag', async () => {
  const result = await campaignPreviewHtml(html, '/?campanha=TURMA', base, async () => ({ code: 'TURMA', title: 'Turma' }));
  assert.match(result, /og:title/);
  assert.match(result, /name="twitter:card" content="summary"/);
  assert.doesNotMatch(result, /og:image/);
});
