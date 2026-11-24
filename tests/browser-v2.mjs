import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:5173/';
const destination = 'test-results/v2';
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const report = { browser: browser.version(), url: base, viewport: [1600, 900], errors: [], checks: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) report.errors.push(response.status() + ' ' + response.url()); });
  const state = () => page.evaluate(() => window.raidQA.state());
  const shot = name => page.screenshot({ path: destination + '/' + name + '.png' });
  const wait = (predicate, value, timeout = 10000) => page.waitForFunction(predicate, value, { timeout });
  const pose = (position, yaw = 0, pitch = 0) => page.evaluate(
    ({ position, yaw, pitch }) => window.raidQA.pose(position, yaw, pitch), { position, yaw, pitch });
  const enter = async () => {
    await page.locator('#primary').click();
    await wait(() => window.raidQA.state().locked);
  };
  const closeBag = async () => {
    await page.locator('#bag-close').click();
    await wait(() => window.raidQA.state().locked);
  };
  const hold = async (key, duration) => {
    await page.keyboard.down(key);
    await page.waitForTimeout(duration);
    await page.keyboard.up(key);
  };
  const trigger = async () => { await page.mouse.down(); await page.mouse.up(); };
  async function searchAt(id, feet) {
    const target = (await state()).interactions.find(target => target.id === id);
    const eye = [feet[0], feet[1] + 1.65, feet[2]];
    const yaw = Math.atan2(eye[0] - target.position[0], eye[2] - target.position[2]);
    const pitch = Math.atan2(target.position[1] - eye[1], Math.hypot(target.position[0] - eye[0], target.position[2] - eye[2]));
    await pose(feet, yaw, pitch);
    await wait(id => document.querySelector('#prompt').textContent.includes(id), target.label);
    await page.keyboard.press('e');
    await page.locator('#backpack-panel').waitFor({ state: 'visible' });
    assert.ok((await state()).searched.includes(id));
  }
  await page.goto(new URL('?qa=1&seed=42', base).href);
  await page.locator('#primary:not([disabled])').waitFor();
  report.bundle = await page.evaluate(() => document.querySelector('script[type="module"][src]').src);
  await enter();
  await page.waitForTimeout(2400);
  report.performance = await state().then(({ fps, calls, triangles }) => ({ fps, calls, triangles }));
  await shot('01-spawn');
  const origin = (await state()).feet;
  await hold('w', 500);
  assert.ok(Math.hypot(...(await state()).feet.map((v, i) => v - origin[i])) > .5);
  for (const key of ['1', '2']) {
    await page.keyboard.press(key);
    assert.equal((await state()).weapon.id, 'pistol');
  }
  await page.keyboard.press('4');
  await wait(() => window.raidQA.state().weapon.id === 'knife');
  await trigger();
  await wait(() => window.raidQA.state().weapon.action === 'slashing');
  await shot('05-knife');
  await page.keyboard.press('3');
  await wait(() => window.raidQA.state().weapon.id === 'pistol');
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(500);
  assert.ok((await state()).fov < 49);
  await shot('06-ads');
  const rounds = (await state()).weapon.loaded;
  await trigger();
  await wait(rounds => window.raidQA.state().weapon.loaded === rounds - 1, rounds);
  await page.mouse.up({ button: 'right' });
  await page.keyboard.press('r');
  await wait(() => window.raidQA.state().weapon.action === 'reloading');
  await shot('07-reload');
  await wait(() => window.raidQA.state().weapon.action === 'ready');
  await page.keyboard.press('m');
  await page.locator('#tactical-map').waitFor();
  await shot('08-map');
  await page.keyboard.press('m');
  report.checks.push('normal movement, empty slots 1/2, knife 4, sidearm 3, ADS, fire, reload and map');

  await searchAt('duty-card', [-9, 0, 15]);
  await page.locator('#take-loot').click();
  assert.equal((await state()).items['service-card'], 1);
  await closeBag();
  await searchAt('yard-ammo', [-21, 0, 30.3]);
  await page.locator('#take-loot').click();
  const ammoEntry = (await state()).backpack.find(entry => entry.item === 'pistol-ammo');
  assert.equal(ammoEntry.quantity, 6);
  await page.locator('[data-entry="' + ammoEntry.id + '"]').dblclick();
  assert.equal((await state()).items['pistol-ammo'], undefined);
  await shot('09-backpack');
  await closeBag();
  await searchAt('factory-salvage', [37, 3.2, -6.8]);
  await page.locator('#take-loot').click();
  assert.equal((await state()).items.salvage, 3);
  const cargo = (await state()).backpack.find(entry => entry.item === 'salvage');
  await page.locator('[data-entry="' + cargo.id + '"]').click();
  await page.keyboard.press('r');
  await page.locator('[data-entry="' + cargo.id + '"]').dragTo(page.locator('.bag-cell[data-x="4"][data-y="3"]'));
  const moved = (await state()).backpack.find(entry => entry.id === cargo.id);
  assert.deepEqual([moved.x, moved.y, moved.rotated], [4, 3, true]);
  await shot('09-backpack');
  await closeBag();
  report.checks.push('timed container searches, actual transfer into cells, ammunition consumed from backpack');

  // Set up at an exit, then observe the automatic countdown.
  await pose([189, 0, -90]);
  await wait(() => !!window.raidQA.state().countdown);
  await wait(() => window.raidQA.state().result?.outcome === 'extracted');
  await shot('10-extracted');
  assert.ok((await state()).warehouse['service-card'] >= 1);
  const credits = (await state()).credits;
  await page.locator('[data-sell="service-card"]').click();
  await wait(credits => window.raidQA.state().credits === credits + 40, credits);
  const stock = (await state()).warehouse['service-card'] ?? 0;
  await page.reload();
  await page.locator('#primary:not([disabled])').waitFor();
  assert.equal((await state()).warehouse['service-card'] ?? 0, stock);
  assert.equal((await state()).credits, credits + 40);
  report.checks.push('conditional extraction, one-time stash credit, sale and persisted currency after reload');

  await enter();
  await pose([-40, -.8, 6], .45, -.04); await page.waitForTimeout(100);
  await shot('02-dock');
  await pose([45, 3.2, -4], 1.7, -.07); await page.waitForTimeout(100);
  await shot('03-factory');
  await pose([20.5, 0, -2], 0);
  await page.keyboard.down('w');
  await wait(() => window.raidQA.state().feet[1] < -5.2 && window.raidQA.state().feet[2] < -22, undefined, 14000);
  await page.keyboard.up('w');
  assert.ok((await state()).feet[2] < -19);
  await pose([20.5, -5.4, -24], .7, 0);
  await shot('04-lab');
  report.checks.push('actual continuous walk down the lab ramp with matching floor height');
  // Isolate the conditional-exit check from enemies pursuing during the previous screenshot setups.
  await page.reload();
  await page.locator('#primary:not([disabled])').waitFor();
  await enter();
  await pose([15.4, -5.4, -155]);
  await wait(() => document.querySelector('#prompt').textContent.includes('配电'));
  assert.equal((await state()).countdown, undefined);
  await pose([16, -5.4, -166.7], 0, -.16);
  await page.keyboard.press('e');
  await wait(() => window.raidQA.state().flags.includes('lab-power'));
  await pose([15.4, -5.4, -155]);
  await wait(() => !!window.raidQA.state().countdown);
  await wait(() => window.raidQA.state().result?.outcome === 'extracted');
  await shot('11-lab-extracted');
  report.checks.push('lab lift rejects without power and extracts after the physical panel is activated');

  await enter();
  const routes = {
    'south-loading': [[-24, 46.5], [-51, 46.5], [-51, 45]],
    'warehouse-alley': [[49, 40], [-51, 40], [-51, 45]],
    'scrap-shelter': [[-34, 24], [-34, 27], [-25, 27], [-25, 35], [-51, 35], [-51, 45]],
  };
  report.walkedRoute = { spawn: (await state()).spawn.id, points: [] };
  for (const [x, z] of routes[report.walkedRoute.spawn]) {
    const feet = (await state()).feet;
    // Only turn at the current position. All translation uses the real movement sampler.
    await pose(feet, Math.atan2(feet[0] - x, feet[2] - z));
    await page.keyboard.down('w');
    await wait(({ x, z }) => {
      const feet = window.raidQA.state().feet;
      return Math.hypot(feet[0] - x, feet[2] - z) < .55;
    }, { x, z }, 45000);
    await page.keyboard.up('w');
    report.walkedRoute.points.push((await state()).feet);
  }
  await page.keyboard.press('e');
  await wait(() => window.raidQA.state().result?.outcome === 'extracted');
  report.checks.push('complete spawn-to-highway extraction using real walking without position teleportation');
  report.materialResources = await page.evaluate(() => performance.getEntriesByType('resource')
    .map(entry => entry.name).filter(name => /(?:color|normal|roughness)-v1/.test(name)));
  assert.ok(report.materialResources.length >= 13, 'The production material textures must actually load');
  assert.deepEqual(report.errors, []);
  console.log('V2 browser checks passed');
} catch (error) {
  report.failure = String(error);
  throw error;
} finally {
  await writeFile(destination + '/report.json', JSON.stringify(report, null, 2));
  await browser.close();
}
