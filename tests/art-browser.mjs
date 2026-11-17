import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const destination = resolve(process.argv[2] ?? 'assets/art-qa');
await mkdir(destination, { recursive: true });
const server = await createServer({
  configFile: false,
  server: { host: '127.0.0.1', port: 5198 },
});
await server.listen();
try {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const issues = [];
    page.on('pageerror', error => issues.push(error.message));
    page.on('console', message => { if (message.type() === 'error') issues.push(message.text()); });
    page.on('requestfailed', request => issues.push(`${request.url()} ${request.failure()?.errorText}`));
    page.on('response', response => { if (response.status() >= 400) issues.push(`${response.status()} ${response.url()}`); });
    await page.goto(new URL('tests/art-preview.html', server.resolvedUrls.local[0]).href);
    await page.waitForFunction(() => Boolean(window.artPose));
    await page.evaluate(() => window.artMaterialsReady);

    const shots = {
      '01-pistol-hip': {},
      '02-pistol-ads': { fov: 47, weapon: { aiming: true } },
      '03-pistol-shot': { fov: 47, weapon: { aiming: true, action: 'firing', actionProgress: 0.045 } },
      '04-pistol-reload': { weapon: { action: 'reloading', actionProgress: 0.48 } },
      '05-knife-ready': { weapon: { id: 'knife' } },
      '06-knife-strike': { weapon: { id: 'knife', action: 'slashing', actionProgress: 0.15 } },
      '07-enemies-idle': { enemyAction: 'idle', side: true },
      '08-enemies-windup': { enemyAction: 'windup', progress: 0.89, dark: true },
      '09-enemies-attack': { enemyAction: 'attacking', progress: 0.06, dark: true },
      '10-enemies-dead': { enemyAction: 'dead', side: true },
      '11-pistol-reload-seat': { weapon: { action: 'reloading', actionProgress: 0.81 } },
    };
    const frames = {};
    for (const [name, shot] of Object.entries(shots)) {
      frames[name] = await page.evaluate(state => window.artPose(state), shot);
      assert.ok(frames[name].calls > 25, 'The fixture must render the environment and models');
      await page.screenshot({ path: resolve(destination, `${name}.jpg`), quality: 89 });
    }
    await page.setViewportSize({ width: 1024, height: 768 });
    frames['12-ads-4by3'] = await page.evaluate(() => window.artPose({ fov: 47, weapon: { aiming: true }, moving: true }));
    await page.screenshot({ path: resolve(destination, '12-ads-4by3.jpg'), quality: 89 });
    await page.setViewportSize({ width: 1720, height: 720 });
    frames['13-ads-ultrawide'] = await page.evaluate(() => window.artPose({ fov: 47, weapon: { aiming: true }, moving: true }));
    await page.screenshot({ path: resolve(destination, '13-ads-ultrawide.jpg'), quality: 89 });
    await page.setViewportSize({ width: 1280, height: 720 });
    assert.deepEqual(issues, []);
    const summary = { chrome: browser.version(), viewport: page.viewportSize(), frames, issues };
    await writeFile(resolve(destination, 'metrics.json'), JSON.stringify(summary, null, 2));
    console.log(`${Object.keys(frames).length} captures in ${destination} (Chrome ${summary.chrome})`);
  } finally {
    await browser.close();
  }
} finally {
  await server.close();
}
