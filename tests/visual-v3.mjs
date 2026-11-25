import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const destination = 'test-results/visual-v3';
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const report = { browser: browser.version(), url: base, viewport: [1600, 900], errors: [], shots: {}, performance: {} };
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) report.errors.push(response.status() + ' ' + response.url()); });
  const state = () => page.evaluate(() => window.raidQA.state());
  const pose = (feet, yaw = 0, pitch = 0) => page.evaluate(({ feet, yaw, pitch }) => window.raidQA.pose(feet, yaw, pitch), { feet, yaw, pitch });
  const shot = async name => {
    await page.screenshot({ path: `${destination}/${name}.png` });
    report.shots[name] = await state();
  };
  const enter = async () => {
    await page.locator('#primary').click();
    await page.waitForFunction(() => window.raidQA.state().locked);
  };
  await page.goto(new URL('?qa=1&seed=42', base).href);
  await page.locator('#primary:not([disabled])').waitFor();
  report.bundle = await page.evaluate(() => document.querySelector('script[type="module"][src]').src);
  report.gpu = await page.evaluate(() => {
    const gl = document.querySelector('#world').getContext('webgl2');
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    return extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : 'unavailable';
  });
  await enter();
  await page.waitForTimeout(2000);
  await shot('01-pistol-world');
  // One real shot makes a partial reload possible, without granting ammunition.
  await page.mouse.down(); await page.mouse.up();
  await page.waitForFunction(() => window.raidQA.state().weapon.loaded === 5);
  await page.keyboard.press('r');
  await page.waitForFunction(() => {
    const weapon = window.raidQA.state().weapon;
    return weapon.action === 'reloading' && weapon.actionProgress > .40 && weapon.actionProgress < .7;
  });
  await shot('02-reload-world');
  await page.waitForFunction(() => window.raidQA.state().weapon.action === 'ready');
  await page.keyboard.press('4');
  await page.waitForTimeout(450);
  await shot('03-knife-world');
  await page.keyboard.press('3');
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(450);
  await shot('04-ads-world');
  await page.mouse.up({ button: 'right' });

  // QA positions the player near a real spawned enemy; no replacement preview model is injected.
  await pose([33, 0, 28.8], 0, -.035);
  await page.waitForTimeout(550);
  await shot('05-infected-world');
  const enemy = (await state()).enemies.find(enemy => enemy.id === 'infected-7');
  assert.ok(enemy.health > 0);
  assert.ok(['moving', 'windup', 'attacking', 'recovering'].includes(enemy.action));
  const origin = (await state()).spawn;
  await pose(origin.position, origin.yaw);
  for (const quality of ['low', 'high', 'balanced']) {
    await page.keyboard.press('Escape');
    await page.locator('#settings-open').click();
    await page.locator('#quality').selectOption(quality);
    await page.locator('#settings-close').click();
    await enter();
    await page.waitForTimeout(700);
    report.performance[quality] = await page.evaluate(() => new Promise(resolve => {
      const frames = [];
      let previous;
      function sample(now) {
        if (previous !== undefined) frames.push(now - previous);
        previous = now;
        if (frames.length < 45) requestAnimationFrame(sample);
        else {
          frames.sort((a, b) => a - b);
          const current = window.raidQA.state();
          resolve({ medianFrameMs: frames[22], p95FrameMs: frames[42], fps: current.fps, calls: current.calls, triangles: current.triangles });
        }
      }
      requestAnimationFrame(sample);
    }));
    await shot(`06-quality-${quality}`);
  }
  assert.deepEqual(report.errors, []);
  console.log('Visual production captures passed, all three quality modes rendered');
} catch (error) {
  report.failure = String(error);
  throw error;
} finally {
  await writeFile(`${destination}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
