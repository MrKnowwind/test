import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:5182/';
const previewOnly = process.argv.includes('--preview');
const directory = 'tests/world-evidence';
const viewport = { width: 1120, height: 630 };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { date: new Date().toISOString(), url: base, chrome: browser.version(), viewport, files: {}, routes: [] };
await mkdir(directory, { recursive: true });
for (const file of ['firstMap', 'environment', 'worldQueries', 'surfaceMaterials', 'industrialDetails']) {
  const path = `src/world/${file}.ts`;
  report.files[path] = createHash('sha256').update(await readFile(path)).digest('hex');
}

async function verify(seed, spawn, waypoints, exitId = 'highway') {
  const page = await browser.newPage({ viewport });
  const errors = [];
  const evidence = { seed, spawn, waypoints: [], errors, navigations: 0 };
  report.routes.push(evidence);
  page.on('framenavigated', () => evidence.navigations++);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  const state = () => page.evaluate(() => window.raidQA.state());
  const capture = (label) => page.screenshot({ path: join(directory, `${spawn}-${label}.png`) });
  let mouseX = 0;
  let mouseY = 0;

  async function look(yaw, pitch = 0) {
    const before = await state();
    const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
    const sensitivity = before.weapon.aiming ? 0.0022 * 0.72 : 0.0022;
    mouseX -= Math.round(wrap(yaw - before.yaw) / sensitivity);
    mouseY -= Math.round((pitch - before.pitch) / sensitivity);
    await page.mouse.move(mouseX, mouseY);
    await page.waitForFunction(([yaw, pitch]) => {
      const current = window.raidQA.state();
      const offset = yaw - current.yaw;
      return Math.abs(Math.atan2(Math.sin(offset), Math.cos(offset))) < 0.012 && Math.abs(pitch - current.pitch) < 0.012;
    }, [yaw, pitch], { timeout: 3000 });
  }

  async function walk(x, z) {
    const before = await state();
    await look(Math.atan2(before.feet[0] - x, before.feet[2] - z));
    await page.keyboard.down('Shift');
    await page.keyboard.down('KeyW');
    try {
      await page.waitForFunction(([x, z]) => {
        const { feet, result } = window.raidQA.state();
        return result || Math.hypot(feet[0] - x, feet[2] - z) < 0.36;
      }, [x, z], { timeout: 30000 });
    } finally {
      await page.keyboard.up('KeyW');
      await page.keyboard.up('Shift');
    }
    const after = await state();
    evidence.waypoints.push({ target: [x, z], feet: after.feet, yaw: after.yaw, health: after.health });
    assert.equal(after.result, undefined);
    assert.ok(Math.hypot(after.feet[0] - x, after.feet[2] - z) < 0.52);
  }

  try {
    await page.goto(`${base}?qa=1&seed=${seed}`);
    await page.waitForFunction(() => window.raidQA?.state().calls > 0);
    const button = page.locator('#primary');
    const box = await button.boundingBox();
    mouseX = Math.round(box.x + box.width / 2);
    mouseY = Math.round(box.y + box.height / 2);
    await page.mouse.click(mouseX, mouseY);
    await page.waitForFunction(() => window.raidQA.state().locked);
    assert.equal((await state()).spawn.id, spawn);
    await capture('spawn');
    for (const [x, z] of waypoints) await walk(x, z);
    assert.equal((await state()).feet[1], 0);
    await capture('highway');
    await page.waitForFunction((id) => window.raidQA.state().countdown?.exit.id === id, exitId);
    await page.waitForFunction(() => !!window.raidQA.state().result, undefined, { timeout: 15000 });
    const after = await state();
    assert.equal(after.result.outcome, 'extracted');
    assert.equal(after.result.exitId, exitId);
    assert.equal(evidence.navigations, 1, 'The page was reloaded during the route');
    assert.deepEqual(errors, []);
    evidence.result = after.result;
    evidence.calls = after.calls;
    evidence.triangles = after.triangles;
    await capture('result');
    console.log('PASS', seed, spawn, exitId, 'HP', after.health);
  } catch (error) {
    evidence.error = String(error);
    evidence.state = await state().catch(() => null);
    await capture('failure').catch(() => {});
    throw error;
  } finally {
    await page.close();
  }
}

async function preview() {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.goto(`${base}?qa=1&seed=20261112`);
    await page.waitForFunction(() => window.raidQA?.state().calls > 0);
    report.preview = await page.evaluate(async () => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const { createFirstMap } = await import('/src/world/firstMap.ts');
      const map = createFirstMap(20261112);
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x526169);
      scene.fog = new THREE.FogExp2(0x526169, 0.024);
      scene.add(new THREE.HemisphereLight(0xc6d7e1, 0x3a342a, 1.2));
      const daylight = new THREE.DirectionalLight(0xc9dce4, 1.55);
      daylight.position.set(-5, 14, 8);
      scene.add(map.scene, daylight);
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      renderer.setSize(innerWidth, innerHeight);
      renderer.domElement.style.cssText = 'position:fixed;inset:0;z-index:1000';
      document.body.append(renderer.domElement);
      const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.035, 120);
      window.worldPreview = (eye, target) => {
        daylight.intensity = eye[1] < 0 ? 0.12 : 1.55;
        camera.position.set(...eye);
        camera.lookAt(...target);
        renderer.render(scene, camera);
        return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
      };
      const gl = renderer.getContext();
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      return { seed: 20261112, environmentOnly: true, gpu: debug && gl.getParameter(debug.UNMASKED_RENDERER_WEBGL), views: [] };
    });
    for (const [label, eye, target] of [
      ['shed', [-6, 1.65, 10], [0, 2.25, -4]],
      ['ramp', [14.6, 1.65, 11], [12, 1.15, 4.4]],
      ['lab', [5.5, -2.55, -8.4], [-5, -2.75, -13]],
      ['lift', [-6.2, -2.55, -9.5], [-8.9, -2.65, -6.6]],
      ['cabinet', [-5.1, -2.55, -12.2], [-7, -2.9, -15]],
    ]) {
      const counts = await page.evaluate(([eye, target]) => window.worldPreview(eye, target), [eye, target]);
      await page.screenshot({ path: join(directory, `environment-${label}.png`) });
      report.preview.views.push({ label, eye, target, ...counts });
    }
    assert.deepEqual(errors, []);
    console.log('PASS environment previews');
  } finally {
    await page.close();
  }
}

try {
  if (!previewOnly) {
    await verify(2, 'south-loading', [[-21, 19], [-21, -19]]);
    await verify(1, 'warehouse-alley', [[21, 10], [21, -19], [-21, -19]]);
    await verify(5, 'scrap-shelter', [[-21, 5], [-21, -19]]);
  }
  await preview();
} finally {
  await writeFile(join(directory, previewOnly ? 'preview-report.json' : 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}
