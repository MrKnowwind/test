import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const destination = process.argv.includes('--final') ? 'test-results/next-pass-art' : 'test-results/procedural-p0';
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const report = { browser: browser.version(), url: base, viewport: [1600, 900], errors: [], shots: {}, images: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('request', request => { if (/\.(webp|png|jpg|jpeg)(\?|$)/.test(request.url())) report.images.push(request.url()); });
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

  // Reset the raid so the actual enemy has not chased the player during weapon captures.
  await page.reload();
  await page.locator('#primary:not([disabled])').waitFor();
  await enter();
  const target = (await state()).enemies.find(enemy => enemy.id === 'infected-7');
  await pose([target.position[0], 0, target.position[2] + 3.6], 0, -.015);
  await page.waitForTimeout(60);
  await shot('05-infected-world');
  await page.waitForFunction(() => window.raidQA.state().enemies.find(e=>e.id==='infected-7').action==='windup');
  await shot('08-enemy-windup');
  await page.waitForFunction(() => window.raidQA.state().enemies.find(e=>e.id==='infected-7').action==='attacking');
  await shot('09-enemy-strike');
  await page.keyboard.press('Escape');
  await page.locator('#overlay').evaluate(el => el.style.visibility = 'hidden');
  const current = (await state()).enemies.find(enemy => enemy.id === 'infected-7');
  await pose([current.position[0], 0, current.position[2] + 1.25], 0, .02);
  await page.waitForTimeout(100);
  await shot('06-enemy-front');
  await pose([current.position[0] + 1.25, 0, current.position[2]], Math.PI / 2, .02);
  await page.waitForTimeout(100);
  await shot('07-enemy-side');
  const labEnemy = (await state()).enemies.find(e=>e.id==='infected-11');
  await pose([labEnemy.position[0], labEnemy.position[1], labEnemy.position[2]+2],0,.015);
  await page.waitForTimeout(100);
  await shot('10-lab-enemy');
  assert.deepEqual(report.images, [], 'No content images may be requested');
  assert.deepEqual(report.errors, []);
  console.log('P0 procedural production captures passed; no image requests');
} catch (error) {
  report.failure = String(error);
  throw error;
} finally {
  await writeFile(`${destination}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
