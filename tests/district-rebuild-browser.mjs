import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { districtRoutes } from './fixtures/district-routes.mjs';

const root = path.resolve(process.argv[2] ?? 'dist');
const requested = (process.argv[3] ?? '').split(',').filter(Boolean);
const routes = requested.length ? districtRoutes.filter(route => requested.includes(route.id)) : districtRoutes;
assert.equal(routes.length, requested.length || districtRoutes.length, 'Use valid, unique spawn IDs');
const destination = path.resolve(process.argv[4] ?? 'test-results/district-rebuild');
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const report = { routes: [], closedExits: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => report.errors.push(error.message));
  await page.route('http://127.0.0.1:4173/**', async route => {
    const file = new URL(route.request().url()).pathname.slice(1) || 'index.html';
    const mime = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html';
    await route.fulfill({ body: await readFile(path.join(root, file)), contentType: mime });
  });

  // Move the production loop forward at up to six 60 Hz simulation steps per frame.
  // Software WebGL still renders the evidence frames.
  await page.addInitScript(() => {
    // This replay sets yaw at waypoints. Ignore the pointer recenter from its UI clicks.
    window.addEventListener('mousemove', event => event.stopPropagation(), true);
    let queue = new Map(), id = 0, time, paint = true;
    window.requestAnimationFrame = callback => { queue.set(++id, callback); return id; };
    window.cancelAnimationFrame = key => queue.delete(key);
    for (const key of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      const draw = WebGL2RenderingContext.prototype[key];
      WebGL2RenderingContext.prototype[key] = function (...args) { if (paint) return draw.apply(this, args); };
    }
    window.advanceDistrict = (ms, render) => {
      time ??= performance.now();
      time += ms;
      const frame = queue;
      queue = new Map();
      paint = render;
      for (const callback of frame.values()) callback(time);
      paint = true;
    };
    const original = CanvasRenderingContext2D.prototype.fillText;
    window.exitMapLabels = [];
    CanvasRenderingContext2D.prototype.fillText = function (value, ...args) {
      if (this.canvas.id === 'map-canvas' && /检查口|部公路出口/.test(value)) window.exitMapLabels.push(value);
      return original.call(this, value, ...args);
    };
  });

  const tick = (count = 2, ms = 1000 / 60, paint = false) => page.evaluate(([n, interval, render]) => {
    for (let i = 0; i < n; i++) advanceDistrict(interval, render && i === n - 1);
  }, [count, ms, paint]);
  const state = () => page.evaluate(() => {
    const { feet, spawn, exits, countdown, result } = raidQA.state();
    return { feet, spawn, exits, countdown, result };
  });
  const resume = async () => {
    await page.locator('#primary').click({ force: true });
    await page.waitForFunction(() => raidQA.state().locked && document.querySelector('#overlay').hidden, undefined, { polling: 25 });
    await tick();
  };
  async function fresh(seed, practice = false) {
    await page.goto('http://127.0.0.1:4173/?qa=1&seed=' + seed, { timeout: 90000 });
    await page.locator('#primary:enabled').waitFor({ timeout: 90000 });
    await resume();
    if (practice) {
      await page.keyboard.press('Escape');
      await tick();
      await page.locator('#creative-toggle').click({ force: true });
      await page.locator('#creative-flight').uncheck({ force: true });
      await resume();
    }
  }
  async function walkTo(x, z) {
    await page.evaluate(([x, z]) => {
      const { feet } = raidQA.state();
      raidQA.pose(feet, Math.atan2(feet[0] - x, feet[2] - z));
    }, [x, z]);
    await page.keyboard.down('Shift');
    await page.keyboard.down('w');
    try {
      const progress = await page.evaluate(([x, z]) => {
        let feet = raidQA.state().feet;
        const remaining = () => Math.hypot(feet[0] - x, feet[2] - z);
        const frames = Math.ceil(remaining() / .32) + 70;
        let stopped = 0;
        for (let frame = 0; frame < frames && remaining() > .24 && stopped < 12; frame++) {
          const before = remaining();
          advanceDistrict(before > 2 ? 100 : 1000 / 60, false);
          feet = raidQA.state().feet;
          stopped = before - remaining() < .003 ? stopped + 1 : 0;
        }
        return { feet, distance: remaining() };
      }, [x, z]);
      assert.ok(progress.distance <= .24, 'Blocked approaching ' + [x, z] + ' at ' + progress.feet);
    } finally {
      await page.keyboard.up('w');
      await page.keyboard.up('Shift');
      await tick();
    }
  }
  async function capture(name) {
    await tick(1, 1000 / 60, true);
    await page.screenshot({ path: path.join(destination, name + '.jpg'), quality: 86, timeout: 60000 });
  }
  for (const route of routes) {
    await fresh(route.seed, true);
    assert.equal((await state()).spawn.id, route.id);
    for (const [x, z] of route.waypoints) await walkTo(x, z);
    const exitId = route.id[0] === 'N' ? 'highway' : 'north-gate';
    const arrival = await state();
    assert.equal(arrival.countdown?.exit.id, exitId);
    if (route.id === 'S-A' || route.id === 'N-A') await capture(exitId);
    await tick(52, 100);
    const { result } = await state();
    assert.equal(result?.outcome, 'extracted');
    assert.equal(result.exitId, exitId);
    assert.equal(result.practice, true);
    assert.equal(await page.locator('#stage').textContent(), arrival.countdown.exit.label);
    report.routes.push({ spawn: route.id, seed: route.seed, exit: exitId, feet: arrival.feet, seconds: result.seconds });
    console.log(route.id + ' → ' + exitId);
  }

  if (requested.length === 0) {
    for (const route of [districtRoutes[0], districtRoutes[4]]) {
      await fresh(route.seed);
      const { spawn, exits } = await state();
      const closed = exits.find(exit => exit.openForSpawnSide && exit.openForSpawnSide !== spawn.side);
      await page.evaluate(feet => raidQA.pose(feet, 0), closed.position);
      await tick(55, 100);
      assert.match(await page.locator('#prompt').textContent(), /本局未开放/);
      assert.equal((await state()).countdown, undefined);
      assert.equal((await state()).result, undefined);
      await page.keyboard.press('m');
      await tick();
      const labels = await page.evaluate(() => window.exitMapLabels);
      assert.ok(labels.includes(closed.label + ' · 本局未开放'), labels.join(', '));
      assert.ok(labels.some(text => text.endsWith(' · 可撤离')), labels.join(', '));
      await capture('map-' + spawn.side);
      report.closedExits.push(closed.id);
    }

    await fresh(districtRoutes[0].seed, true);
    await page.evaluate(() => raidQA.pose([38, 0, -3], Math.PI));
    await capture('cold-chain-approach');
    await walkTo(38, 31.6);
    assert.ok(Math.abs((await state()).feet[1] - 3.6) < .04);
    await walkTo(32, 31.6);
    await walkTo(32, 30.7);
    await page.evaluate(() => {
      const { feet, eye } = raidQA.state();
      const target = raidQA.state().interactions.find(item => item.id === 'cold-chain-medical').position;
      const [dx, dy, dz] = target.map((value, axis) => value - eye[axis]);
      raidQA.pose(feet, Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
    });
    await capture('cold-chain-medical');
    assert.match(await page.locator('#prompt').textContent(), /低温药品柜/);
    await page.keyboard.press('e');
    await tick(25, 100);
    await page.locator('.source-item.revealed').first().waitFor({ timeout: 10000 });
    assert.ok((await page.evaluate(() => raidQA.state().searched)).includes('cold-chain-medical'));
    report.search = 'cold-chain-medical';

    await fresh(districtRoutes[0].seed, true);
    await page.evaluate(() => raidQA.pose([120, 0, -57.5], 0));
    await capture('switchgear-exterior');
    await walkTo(120, -76);
    await page.evaluate(() => raidQA.pose(raidQA.state().feet, -Math.PI / 2));
    await capture('switchgear-interior');
    await walkTo(120, -93.5);
  }
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = String(error);
  throw error;
} finally {
  await writeFile(path.join(destination, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
