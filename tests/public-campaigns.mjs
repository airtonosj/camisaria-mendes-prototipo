import assert from 'node:assert/strict';
import { testEnvironment } from './test-environment.mjs';
import { prepareDatabase } from './helpers/environment.mjs';

const env = testEnvironment();
await prepareDatabase(env);
Object.assign(process.env, env);
const { pool } = await import('../api/database.mjs');
const { publicCampaignCatalog } = await import('../api/modules/campaigns/service.mjs');

try {
  const [[model]] = await pool.query("SELECT id FROM shirt_models WHERE active = TRUE ORDER BY id LIMIT 1");
  const [[color]] = await pool.query("SELECT id FROM colors WHERE active = TRUE ORDER BY id LIMIT 1");
  for (let index = 1; index <= 15; index++) {
    const [result] = await pool.execute(`INSERT INTO campaigns
      (code, title, phase, is_public, deadline_at, pickup_instructions, representative_name, real_photos_enabled)
      VALUES (?, ?, 'receiving_orders', TRUE, '2027-12-31', 'Retirada QA', 'Representante QA', ?)`,
    [`PUBLIC-${index}`, `Turma publica ${index}`, index === 15]);
    if (index === 15) {
      await pool.execute('INSERT INTO campaign_variants (campaign_id, shirt_model_id, color_id, unit_price_cents) VALUES (?, ?, ?, 5000)', [result.insertId, model.id, color.id]);
      await pool.execute('INSERT INTO campaign_color_photos (campaign_id, color_id, photo_url, sort_order) VALUES (?, ?, ?, 0)', [result.insertId, color.id, '/uploads/11111111-1111-1111-1111-111111111111.webp']);
    }
  }
  await pool.execute(`INSERT INTO campaigns (code, title, phase, is_public, deadline_at, pickup_instructions, representative_name)
    VALUES ('PRIVATE-QA', 'Turma privada', 'receiving_orders', FALSE, '2027-12-31', 'Retirada QA', 'Representante QA'),
           ('CLOSED-QA', 'Turma encerrada', 'orders_closed', TRUE, '2027-12-31', 'Retirada QA', 'Representante QA')`);
  const first = await publicCampaignCatalog();
  assert.equal(first.total, 15);
  assert.equal(first.campaigns.length, 12);
  assert.equal(first.campaigns[0].imageUrl, '/uploads/11111111-1111-1111-1111-111111111111.webp');
  assert.ok(first.campaigns.every((campaign) => !['PRIVATE-QA', 'CLOSED-QA'].includes(campaign.code)));
  const second = await publicCampaignCatalog({ page: 2 });
  assert.equal(second.campaigns.length, 3);
  assert.equal((await publicCampaignCatalog({ search: 'publica 15' })).campaigns[0].code, 'PUBLIC-15');
  console.log('✓ Catálogo público: opt-in, foto de venda, busca e paginação sem campanhas privadas.');
} finally { await pool.end(); }
