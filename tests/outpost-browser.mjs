import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const address = process.env.OUTPOST_QA_URL ?? 'http://127.0.0.1:4281/';
const output = 'test-results/outpost';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    let jobs = new Map(), count = 0, time, painting = true;
    window.requestAnimationFrame = job => { jobs.set(++count, job); return count; };
    window.cancelAnimationFrame = id => jobs.delete(id);
    window.keysSeen = [];
    for (const name of ['keydown', 'keyup', 'blur'])
      window.addEventListener(name, event => window.keysSeen.push([name, event.code, event.shiftKey]));
    for (const key of ['drawArrays', 'drawElements', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const draw = WebGL2RenderingContext.prototype[key];
      WebGL2RenderingContext.prototype[key] = function(...args) { if (painting) return draw.apply(this, args); };
    }
    window.tickRaid = (frames, paint) => {
      time ??= performance.now();
      for (let i = 0; i < frames; i++) {
        const queue = jobs;
        jobs = new Map();
        painting = paint && i === frames - 1;
        time += 1000 / 60;
        for (const job of queue.values()) job(time);
      }
      painting = true;
    };
  });
  const wait = (fn, arg) => page.waitForFunction(fn, arg, { polling: 25, timeout: 15000 });
  const tick = (n = 3, render = false) => page.evaluate(([n, render]) => window.tickRaid(n, render), [n, render]);
  const state = () => page.evaluate(() => raidQA.state());
  const pose = async (feet, yaw, pitch = 0) => {
    await page.evaluate(([feet, yaw, pitch]) => raidQA.pose(feet, yaw, pitch), [feet, yaw, pitch]);
    await tick();
  };
  const snap = name => page.screenshot({ path: output + '/' + name + '.jpg', quality: 85, timeout: 60000 });
  const press = async key => { await page.keyboard.press(key); await tick(); };
  const enter = async () => { await page.locator('#primary').click(); await wait(() => raidQA.state().locked); await tick(); };
  const openBag = async () => { await wait(() => !document.querySelector('#backpack-panel').hidden); };
  const closeBag = async () => {
    await page.locator('#bag-close').click();
    await wait(() => raidQA.state().locked);
    await tick();
  };
  await page.goto(address + '?qa=1&seed=42', { timeout: 90000 });
  await page.locator('#primary:enabled').waitFor({ timeout: 90000 });
  assert.equal((await state()).credits, 600);
  await snap('prepare');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.locator('#quality').selectOption('low');
  await tick(2, true);
  await page.locator('[data-binding=ammo]').click();
  await page.keyboard.press('KeyW');
  assert.match(await page.locator('#binding-status').textContent(), /已用于前进/);
  await page.keyboard.press('KeyN');
  await snap('settings');
  await page.locator('#settings-close').click();

  await page.locator('[data-outpost=buy]').click();
  await page.locator('[data-buy=repairpack]').click();
  await page.locator('[data-buy=medkit]').click();
  await wait(() => raidQA.state().warehouse.medkit === 1);
  await snap('shop');
  await page.locator('[data-outpost=prepare]').click();
  await page.getByLabel('背包', { exact: true }).selectOption('repairpack');
  await page.locator('[data-supply=medkit]').fill('1');
  await page.locator('[data-supply=medkit]').press('Tab');
  await enter();
  assert.equal((await state()).backpack.some(e => e.item === 'medkit'), true);
  assert.deepEqual((await state()).warehouse, {});
  assert.ok(await page.locator('#hud-minimap').isVisible());
  assert.ok(await page.locator('#raid-objectives').isHidden());
  assert.ok(await page.locator('#ammo-popup').isHidden());
  await press('KeyN');
  assert.ok(await page.locator('#ammo-popup').isVisible());
  await press('Tab'); await openBag();
  assert.equal(await page.locator('.pack-layout[data-pack=repairpack]').count(), 1);
  await page.getByRole('button', { name: '9mm 弹药', exact: true }).click();
  assert.ok(await page.locator('#bag-detail').isVisible());
  assert.match(await page.locator('#selected-item').textContent(), /×15/);
  await closeBag();

  await pose([-24, 0, 142.1], 0, -.78);
  await tick(2, true);
  assert.match(await page.locator('#prompt').textContent(), /基础小包/);
  await snap('ground-pack');
  await press('KeyE'); await openBag();
  await page.locator('button.pack-source').click();
  assert.ok(await page.getByRole('button', { name: '装备此包' }).isVisible());
  await closeBag();

  const target = (await state()).interactions.find(t => t.id === 'duty-card');
  const [x, , z] = target.position;
  await pose([x, 0, z + 1], 0, -.48);
  assert.match(await page.locator('#prompt').textContent(), /值班室文件盒/);
  await press('KeyE'); await openBag();
  await tick(260, true);
  const cards = page.locator('#container-content .source-item.revealed');
  assert.ok(await cards.count() > 1);
  const fitted = await cards.evaluateAll(tiles => tiles.every(tile => {
    const b = tile.getBoundingClientRect(), i = tile.firstElementChild.getBoundingClientRect();
    return i.width > 10 && i.height > 10 && i.top >= b.top && i.bottom <= b.bottom && i.left >= b.left && i.right <= b.right;
  }));
  assert.equal(fitted, true);
  const card = page.getByRole('button', { name: '维修卡', exact: true });
  await card.click();
  const anchor = await card.boundingBox(), detail = await page.locator('#bag-detail').boundingBox();
  const source = await page.locator('#container-content .section-grid').boundingBox();
  assert.ok(Math.abs(detail.y - anchor.y) < 3 && Math.abs(detail.x - source.x - source.width) < 10);
  assert.ok(await page.getByRole('button', { name: '丢弃', exact: true }).isVisible());
  await snap('loot-detail');
  await page.setViewportSize({ width: 768, height: 620 });
  await tick();
  const compact = await page.locator('#bag-detail').boundingBox();
  assert.ok(compact.x >= 0 && compact.x + compact.width <= 768 && compact.y + compact.height <= 620);
  await snap('loot-compact');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('button', { name: '拾取', exact: true }).click();
  assert.equal((await state()).items['service-card'], 1);
  await closeBag();
  assert.match(await page.locator('#raid-objectives').textContent(), /维修通道/);

  await pose([-24, 0, 149], 0);
  await page.keyboard.down('Shift'); await page.keyboard.down('w'); await tick(14);
  const sprint = await state();
  assert.ok(sprint.feet[2] < 147.75, JSON.stringify({feet: sprint.feet, health: sprint.health, weapon: sprint.weapon}));
  await page.keyboard.down('c'); await tick(); await page.keyboard.up('c');
  const afterSlide = await state();
  assert.equal(afterSlide.stance, 'slide', JSON.stringify({
    sprint: sprint.feet, now: afterSlide.feet, yaw: afterSlide.yaw, weapon: afterSlide.weapon,
    events: await page.evaluate(() => window.keysSeen.slice(-15)),
  }));
  await page.keyboard.up('w'); await page.keyboard.up('Shift');
  await press('Space');
  assert.ok((await state()).feet[1] > .1);
  assert.equal((await state()).stance, 'stand');
  await tick(60);
  await press('ControlLeft');
  assert.equal((await state()).stance, 'crouch');
  await press('ControlLeft');
  assert.equal((await state()).stance, 'stand');
  await tick(6, true); await snap('hud');
  await press('Escape');
  await page.locator('#settings-open').click();
  await page.locator('#stance-mode').selectOption('hold');
  await page.locator('#settings-close').click();
  await enter();
  await page.keyboard.down('c'); await tick();
  assert.equal((await state()).stance, 'crouch');
  await page.keyboard.up('c'); await tick();
  assert.equal((await state()).stance, 'stand');

  const road = (await state()).exits.find(e => e.id === 'highway');
  await pose(road.position, 0);
  await tick(315, true);
  assert.equal((await state()).result.outcome, 'extracted');
  await page.locator('#primary').click();
  await page.locator('[data-outpost=sell]').click();
  const sale = page.locator('[data-sell=service-card]');
  const price = Number((await sale.textContent()).match(/\d+/)[0]), before = (await state()).credits;
  await snap('warehouse');
  await sale.click();
  await wait(credits => raidQA.state().credits === credits, before + price);
  assert.deepEqual((await state()).warehouse, { medkit: 1, repairpack: 1 });
  await page.reload();
  await page.locator('#primary:enabled').waitFor({ timeout: 90000 });
  await page.locator('#settings-open').click();
  assert.equal(await page.locator('[data-binding=ammo]').textContent(), 'N');
  assert.equal(await page.locator('#stance-mode').inputValue(), 'hold');
  assert.equal((await state()).credits, before + price);
  assert.deepEqual(errors, []);
  await writeFile(output + '/report.json', JSON.stringify({ seed: 42, screenshots: 8, sale: price, errors }, null, 2));
  console.log('Verified outpost checkout, loot detail bounds, slide jump, opt-in objectives and extraction-to-sale.');
} finally {
  await browser.close();
}
