import { test, expect } from '@playwright/test';
import sharp from 'sharp';

test('campaign link serves its image to crawlers and opens on desktop and mobile', async ({ request, page }) => {
  const url = '/?campanha=MENDES-ENG-26';
  const response = await request.get(url, { headers: { 'User-Agent': 'WhatsApp/2.0' } });
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(Number(response.headers()['content-length'])).toBe(Buffer.byteLength(html));
  const image = html.match(/property="og:image" content="([^"]+)"/)?.[1];
  expect(image).toBe('http://127.0.0.1:4186/compartilhar/MENDES-ENG-26.jpg?v=00000000');
  expect(html).toContain('property="og:image:width" content="1200"');
  expect(html).toContain('property="og:image:height" content="630"');
  const photo = await request.get(image, { headers: { 'User-Agent': 'WhatsApp/2.0' } });
  expect(photo.status()).toBe(200);
  expect(photo.headers()['content-type']).toBe('image/jpeg');
  const body = await photo.body();
  expect(Number(photo.headers()['content-length'])).toBe(body.length);
  expect(body.length).toBeLessThan(300 * 1024);
  const metadata = await sharp(body).metadata();
  expect([metadata.format, metadata.width, metadata.height]).toEqual(['jpeg', 1200, 630]);
  // The second request comes from the disk cache and must be byte-identical.
  expect((await (await request.get(image)).body()).equals(body)).toBe(true);
  const photoHead = await request.head(image);
  expect(photoHead.status()).toBe(200);
  expect((await photoHead.body()).length).toBe(0);
  expect((await request.get('/compartilhar/NAO-EXISTE.jpg')).status()).toBe(404);
  const head = await request.head(url);
  expect(head.status()).toBe(200);
  expect(head.headers()['content-length']).toBe(response.headers()['content-length']);
  expect((await head.body()).length).toBe(0);
  await page.route('**/*', route => {
    const target = new URL(route.request().url());
    return ['127.0.0.1', 'localhost'].includes(target.hostname) || target.protocol === 'data:'
      ? route.continue() : route.abort();
  });
  await page.goto(url);
  await expect(page.getByRole('button', { name: 'Adicionar', exact: true })).toBeVisible();
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', image);
});
