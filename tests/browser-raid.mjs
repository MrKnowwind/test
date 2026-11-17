import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const base = new URL(process.argv[2] ?? 'http://127.0.0.1:4173/');
const selected = process.argv.slice(3);
const directory = 'test-results/browser-raid';
const viewport = { width: 1024, height: 576 };
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport });
const report = { url: base.origin, chrome: browser.version(), viewport, scenarios: {} };
const failures = [];
await mkdir(directory, { recursive: true });

const wrap = (radians) => Math.atan2(Math.sin(radians), Math.cos(radians));

async function scenario(name, seed, play) {
  if (selected.length && !selected.includes(name)) return;
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (entry) => { if (entry.type() === 'error') errors.push(entry.text()); });
  page.on('requestfailed', (request) => errors.push(`${request.url()} ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  const url = new URL(base);
  url.searchParams.set('seed', seed);
  url.searchParams.set('qa', '1');
  const state = () => page.evaluate(() => window.raidQA.state());
  const wait = (predicate, value, timeout = 12000) => page.waitForFunction(predicate, value, { timeout });
  const screenshot = (stage) => page.screenshot({ path: join(directory, `${name}-${stage}.png`) });
  let x = 0, y = 0;

  async function enter() {
    const button = page.locator('#primary');
    await button.waitFor();
    const box = await button.boundingBox();
    x = Math.round(box.x + box.width / 2);
    y = Math.round(box.y + box.height / 2);
    await page.mouse.click(x, y);
    await wait(() => window.raidQA.state().locked);
  }

  async function look(yaw, pitch = 0) {
    const current = await state();
    const sensitivity = current.weapon.aiming ? 0.0022 * 0.72 : 0.0022;
    x -= Math.round(wrap(yaw - current.yaw) / sensitivity);
    y -= Math.round((pitch - current.pitch) / sensitivity);
    await page.mouse.move(x, y);
    await wait(([yaw, pitch]) => {
      const current = window.raidQA.state();
      const error = Math.atan2(Math.sin(yaw - current.yaw), Math.cos(yaw - current.yaw));
      return Math.abs(error) < 0.012 && Math.abs(pitch - current.pitch) < 0.012;
    }, [yaw, pitch], 2000);
  }

  async function aim([tx, ty, tz]) {
    const { eye } = await state();
    await look(Math.atan2(eye[0] - tx, eye[2] - tz),
      Math.max(-1.43, Math.min(1.43, Math.atan2(ty - eye[1], Math.hypot(tx - eye[0], tz - eye[2])))));
  }

  async function walkTo(tx, tz, radius = 0.43) {
    const { feet } = await state();
    if (Math.hypot(feet[0] - tx, feet[2] - tz) <= radius) return;
    await look(Math.atan2(feet[0] - tx, feet[2] - tz));
    await page.keyboard.down('Shift');
    await page.keyboard.down('KeyW');
    try {
      await wait(([tx, tz, radius]) => {
        const { feet, result } = window.raidQA.state();
        return !!result || Math.hypot(feet[0] - tx, feet[2] - tz) <= radius;
      }, [tx, tz, radius]);
    } catch (cause) {
      throw new Error(`无法走到 ${tx}, ${tz}。实际脚底 ${(await state()).feet.join(', ')}`, { cause });
    } finally {
      await page.keyboard.up('KeyW');
      await page.keyboard.up('Shift');
    }
    assert.equal((await state()).result, undefined, `出击在到达 ${tx}, ${tz} 前结束`);
  }

  const route = async (...waypoints) => { for (const point of waypoints) await walkTo(...point); };
  const key = (code) => page.keyboard.press(code);
  const attack = async () => { await page.mouse.down(); await page.mouse.up(); };

  async function fireAt(id) {
    await wait(() => window.raidQA.state().weapon.action === 'ready');
    const before = await state();
    const enemy = before.enemies.find((entry) => entry.id === id);
    const [ex, ey, ez] = enemy.position;
    await aim([ex, ey + (enemy.kind === 'infected' ? 0.95 : 0.85), ez]);
    await attack();
    await wait((ammo) => window.raidQA.state().weapon.loaded === ammo, before.weapon.loaded - 1, 2500);
    return (await state()).enemies.find((entry) => entry.id === id).health < enemy.health;
  }

  async function interact(id) {
    const target = (await state()).interactions.find((entry) => entry.id === id);
    assert.ok(target, id);
    await aim(target.position);
    await wait((label) => document.querySelector('#prompt').textContent.includes(label), target.label, 2500);
    await key('KeyE');
    await wait((id) => window.raidQA.state().consumed.includes(id), id, 2500);
  }

  async function reject(reason) {
    await key('KeyE');
    await wait((reason) => document.querySelector('#notice').textContent.includes(reason), reason, 2500);
    assert.equal((await state()).countdown, undefined);
  }

  async function extract(id) {
    await key('KeyE');
    await wait((id) => window.raidQA.state().countdown?.exit.id === id, id, 2500);
    await wait(() => Boolean(window.raidQA.state().result), undefined, 15000);
    const { result } = await state();
    assert.equal(result.outcome, 'extracted');
    assert.equal(result.exitId, id);
    await wait(() => document.querySelector('#title').textContent === '撤离成功');
    return result;
  }

  try {
    await page.goto(url.href);
    report.entryAsset = await page.locator('script[type="module"]').getAttribute('src');
    await wait(() => window.raidQA?.state().calls > 0);
    await enter();
    const initial = await state();
    const evidence = await play({ page, state, wait, enter, screenshot, route, aim, look, key, attack, fireAt, interact, reject, extract });
    assert.deepEqual(errors, []);
    report.scenarios[name] = { seed, spawn: initial.spawn.id, ...evidence };
    console.log(`PASS ${name}`, report.scenarios[name]);
  } catch (error) {
    report.scenarios[name] = { seed, error: String(error), errors, state: await state().catch(() => null) };
    await screenshot('failure').catch(() => {});
    failures.push(name);
    console.error(`FAIL ${name}`, error);
  } finally {
    await page.close();
  }
}

try {
  await scenario('road', 5, async ({ page, state, wait, enter, screenshot, route, key, extract }) => {
    await screenshot('spawn');
    const frameSample = await page.evaluate(async () => {
      const deltas = [];
      const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      let previous = await nextFrame();
      for (let frame = 0; frame < 30; frame += 1) {
        const now = await nextFrame();
        deltas.push(now - previous);
        previous = now;
      }
      deltas.sort((a, b) => a - b);
      const gl = document.querySelector('canvas').getContext('webgl2');
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      const { calls, triangles } = window.raidQA.state();
      return { medianMs: deltas[15], p95Ms: deltas[28], frames: deltas.length, calls, triangles,
        renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
    });
    await route([-21, 5], [-21, -19]);
    await key('KeyE');
    await wait(() => window.raidQA.state().countdown?.exit.id === 'highway');
    await route([-21, -15.8]);
    await wait(() => document.querySelector('#notice').textContent.includes('计时取消'));
    await key('Escape');
    await wait(() => !window.raidQA.state().locked && document.querySelector('#title').textContent === '已暂停');
    await enter();
    await route([-21, -19]);
    const result = await extract('highway');
    await screenshot('result');
    await page.reload();
    await wait(() => window.raidQA?.state().calls > 0);
    assert.equal((await state()).spawn.id, 'scrap-shelter');
    return { result, cancelled: true, resumed: true, frameSample };
  });

  await scenario('service', 1, async ({ page, state, wait, screenshot, route, interact, reject, extract }) => {
    const east = [[21, -14], [21, -18], [-16, -18], [-16, -3.8], [-10, -3.8], [-10, -8.1, 0.15]];
    await route([21, 10], [21, -14], [22.5, -14]);
    await reject('需要携带维修卡');
    await screenshot('locked');
    await route(...east);
    await interact('duty-card');
    await route(...east.slice(0, -1).reverse(), [22.5, -14]);
    const result = await extract('service-passage');
    assert.deepEqual(result.items, { 'service-card': 1 });
    await screenshot('result');
    await page.reload();
    await wait(() => window.raidQA?.state().warehouse?.['service-card'] === 1);
    assert.equal((await state()).warehouse['service-card'], 1);
    return { result, rejectedWithoutCard: true, warehouseAfterReload: (await state()).warehouse };
  });

  await scenario('lab', 1, async ({ page, state, wait, screenshot, route, key, fireAt, interact, reject, extract }) => {
    const clear = async (id, hits) => {
      for (let shot = 0; shot < hits; shot += 1) assert.ok(await fireAt(id), `未命中 ${id}（第 ${shot + 1} 枪）`);
      assert.equal((await state()).enemies.find((enemy) => enemy.id === id).action, 'dead');
    };
    await route([21, 10], [12, 8.5, 0.28], [12, -8.4, 0.28]);
    assert.equal((await state()).feet[1], -4.2);
    await screenshot('entrance');
    await page.mouse.down({ button: 'right' });
    await wait(() => window.raidQA.state().weapon.aiming);
    await clear('infected-5', 3);
    await clear('lab-security', 2);
    await page.mouse.up({ button: 'right' });
    await wait(() => !window.raidQA.state().weapon.aiming);
    await wait(() => window.raidQA.state().weapon.action === 'ready');
    await key('KeyR');
    await wait(() => window.raidQA.state().weapon.loaded === 6);
    await clear('infected-6', 3);
    await route([5.5, -8.4], [5.5, -13.4], [4.8, -13.4]);
    await interact('lab-research');
    await route([3.3, -13.4], [-2.8, -13.4]);
    await clear('infected-7', 3);
    await route([-7.7, -13.4], [-7.7, -12], [-7.7, -6.6]);
    await reject('需要开启实验室配电柜');
    await route([-7.7, -12], [-7, -12.7]);
    await interact('lab-power-panel');
    await route([-7.7, -12], [-7.7, -6.6]);
    const result = await extract('lab-lift');
    assert.deepEqual(result.items, { 'research-sample': 1 });
    await screenshot('result');
    await page.reload();
    await wait(() => window.raidQA?.state().warehouse?.['research-sample'] === 1);
    assert.deepEqual((await state()).flags, []);
    return { result, rejectedWithoutPower: true, warehouseAfterReload: (await state()).warehouse };
  });

  await scenario('failure', 2, async ({ page, state, wait, enter, screenshot, route, aim, key, attack, interact }) => {
    const stored = (await state()).warehouse;
    await page.mouse.down({ button: 'right' });
    await wait(() => window.raidQA.state().weapon.aiming && window.raidQA.state().fov < 49);
    await screenshot('ads');
    await attack();
    await wait(() => window.raidQA.state().weapon.loaded === 5);
    await page.mouse.up({ button: 'right' });
    await wait(() => window.raidQA.state().weapon.action === 'ready');
    await key('KeyR');
    await wait(() => window.raidQA.state().weapon.action === 'reloading');
    await wait(() => window.raidQA.state().weapon.loaded === 6 && window.raidQA.state().weapon.reserve === 5);
    await route([-21, 19], [-21, -3.8], [-10, -3.8], [-10, -8.1, 0.15]);
    await interact('duty-card');
    assert.equal((await state()).items['service-card'], 1);
    await route([-10, -3.8], [-9.2, 4.3]);
    await key('Digit1');
    await wait(() => window.raidQA.state().weapon.id === 'knife');
    await wait(() => {
      const { feet, enemies } = window.raidQA.state();
      return enemies.some((enemy) => enemy.id === 'infected-1' &&
        Math.hypot(enemy.position[0] - feet[0], enemy.position[2] - feet[2]) < 1.63);
    });
    const beforeKnife = await state();
    const target = beforeKnife.enemies.find((enemy) => enemy.id === 'infected-1');
    const dx = target.position[0] - beforeKnife.feet[0];
    const dz = target.position[2] - beforeKnife.feet[2];
    const advance = Math.max(0, 1 - 1.06 / Math.hypot(dx, dz));
    await route([beforeKnife.feet[0] + dx * advance, beforeKnife.feet[2] + dz * advance, 0.13]);
    await aim([target.position[0], target.position[1] + 0.95, target.position[2]]);
    await attack();
    await wait(() => window.raidQA.state().weapon.action === 'slashing');
    await wait(() => window.raidQA.state().enemies.find((enemy) => enemy.id === 'infected-1').health < 90);
    await screenshot('knife');
    await wait(() => window.raidQA.state().result?.outcome === 'dead');
    assert.deepEqual((await state()).items, {});
    assert.deepEqual((await state()).warehouse, stored);
    await screenshot('result');
    await enter();
    const next = await state();
    assert.equal(next.result, undefined);
    assert.equal(next.health, 100);
    assert.equal(next.weapon.id, 'pistol');
    assert.deepEqual([next.weapon.loaded, next.weapon.reserve], [6, 6]);
    assert.deepEqual(next.items, {});
    await key('Escape');
    await page.locator('#abandon').click();
    await wait(() => window.raidQA.state().result?.outcome === 'abandoned');
    assert.deepEqual((await state()).warehouse, stored);
    return { firedAndReloaded: true, knifeHit: true, diedWithLoot: true, abandoned: true, restartedHealth: next.health, warehouse: stored };
  });
} finally {
  await writeFile(join(directory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}
assert.deepEqual(failures, [], 'Chrome 出击验收失败');
