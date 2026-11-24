import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const state = () => page.evaluate(() => window.raidQA.state());
  const pose = (feet, pitch) => page.evaluate(([feet, pitch]) => raidQA.pose(feet, 0, pitch), [feet, pitch]);
  async function openCase(id) {
    const target = (await state()).interactions.find((t) => t.id === id);
    const [x, , z] = target.position;
    await pose([x, 0, z + (id === 'duty-card' ? 1 : 1.5)], -0.35);
    await page.waitForFunction(
      (label) => document.querySelector('#prompt').textContent.includes(label),
      target.label,
    );
    await page.keyboard.press('e');
    await page.locator('#backpack-panel:visible').waitFor();
  }
  async function closeBag() {
    await page.locator('#bag-close').click();
    await page.waitForFunction(() => raidQA.state().locked);
  }
  await page.goto('http://127.0.0.1:4173/?qa=1&seed=0');
  await page.locator('#primary:enabled').waitFor();
  await page.selectOption('#quality', 'low');
  await page.locator('#primary').click();
  await page.waitForFunction(() => raidQA.state().locked);
  await openCase('triage-tools');
  await page.getByRole('button', { name: '巡检挎包', exact: true }).click();
  await page.getByRole('button', { name: '直接装备', exact: true }).click();
  assert.equal(await page.locator('#carry-grids .section-grid').count(), 5);
  await closeBag();
  await openCase('duty-card');
  await page.getByRole('button', { name: '维修卡', exact: true }).click();
  await page.locator('#carry-grids [data-section="main"] .bag-cell[data-x="0"][data-y="0"]').click();
  assert.ok((await state()).backpack.some((e) => e.item === 'service-card' && e.section === 'main'));
  await closeBag();
  await pose([189, 0, -90], 0);
  await page.waitForFunction(() => !!raidQA.state().countdown);
  await page.waitForFunction(() => raidQA.state().result?.outcome === 'extracted');
  assert.deepEqual((await state()).warehouse, { 'service-card': 1, sling: 1 });
  await page.locator('[data-sell="service-card"]').click();
  await page.waitForFunction(() => raidQA.state().credits === 40);
  await page.reload();
  await page.locator('#primary:enabled').waitFor();
  assert.equal((await state()).credits, 40);
  assert.deepEqual(errors, []);
  console.log('Confirmed direct equip, manual card placement, maintenance extraction, sale and reload.');
} finally {
  await browser.close();
}
