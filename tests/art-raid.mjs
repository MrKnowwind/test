import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';

await mkdir('assets/art-qa', { recursive: true });
const server = await createServer({ configFile: false, server: { host: '127.0.0.1', port: 5199 } });
await server.listen();
try {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const issues = [];
    page.on('pageerror', e => issues.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') issues.push(msg.text()); });
    page.on('response', response => { if (response.status() >= 400) issues.push(response.url()); });
    await page.goto(new URL('?qa=1&seed=2', server.resolvedUrls.local[0]).href);
    const state = () => page.evaluate(() => window.raidQA.state());
    const wait = async (label, condition) => {
      try { await page.waitForFunction(condition, undefined, { timeout: 6000 }); }
      catch (error) { throw new Error(label + ' ' + JSON.stringify((await state()).weapon), { cause: error }); }
    };
    const capture = label => page.screenshot({ path: 'assets/art-qa/raid-' + label + '.jpg', quality: 89 });
    const fire = async () => { await page.mouse.down(); await page.mouse.up(); };
    await page.evaluate(() => {
      const stream = document.querySelector('#world').captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 1600000 });
      const chunks = [];
      const result = new Promise(resolve => {
        recorder.ondataavailable = event => chunks.push(event.data);
        recorder.onstop = async () => resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())));
      });
      window.artRecording = { recorder, result, stream };
      recorder.start();
    });
    await page.locator('#primary').click();
    await wait('enter', () => window.raidQA.state().locked);
    const hip = await state();
    await capture('hip');
    await page.mouse.down({ button: 'right' });
    await wait('aim', () => window.raidQA.state().weapon.aiming);
    await page.waitForTimeout(370);
    await capture('ads');
    await fire();
    await wait('fire', () => window.raidQA.state().weapon.loaded === 5);
    await page.mouse.up({ button: 'right' });
    await wait('ready after shot', () => window.raidQA.state().weapon.action === 'ready');
    await page.keyboard.press('KeyR');
    await wait('reload extract', () => {
      const { action, actionProgress } = window.raidQA.state().weapon;
      return action === 'reloading' && actionProgress >= 0.41;
    });
    await capture('reload');
    await wait('reload complete', () => window.raidQA.state().weapon.loaded === 6 && window.raidQA.state().weapon.reserve === 5);
    await page.keyboard.press('Digit1');
    await wait('switch', () => window.raidQA.state().weapon.id === 'knife');
    await capture('knife');
    await fire();
    await wait('knife swing', () => window.raidQA.state().weapon.action === 'slashing');
    await page.waitForTimeout(700);
    assert.deepEqual(issues, []);
    await writeFile('assets/art-qa/raid-input.json', JSON.stringify({
      chrome: browser.version(), seed: 2, viewport: page.viewportSize(), spawn: hip.spawn,
      entry: { calls: hip.calls, triangles: hip.triangles },
      inputs: 'Start, RMB, fire 1 round, wait until ready, R, 1, left click', issues,
    }, null, 2));
    const video = await page.evaluate(async () => {
      const { recorder, result, stream } = window.artRecording;
      recorder.stop();
      const bytes = await result;
      stream.getTracks().forEach(track => track.stop());
      return bytes;
    });
    assert.ok(video.length > 30000);
    await writeFile('assets/art-qa/raid-actions.webm', Buffer.from(video));
    await page.close();
    console.log('Real raid entry, ADS, fire, reload and slash verified.');
  } finally {
    await browser.close();
  }
} finally {
  await server.close();
}
