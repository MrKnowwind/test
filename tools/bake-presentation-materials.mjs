// Asset preparation only. The game has no dependency on sharp or this script.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require(process.argv[2] || resolve(process.env.USERPROFILE, '.codex/image-tools/node_modules/sharp'));
const source = resolve('assets/source/presentation-atlas-v1.png');
const destination = resolve('assets/materials');
await mkdir(destination, { recursive: true });
const { width, height } = await sharp(source).metadata();
const size = Math.floor(Math.min(width, height) / 2);
const tiles = ['rubber', 'fabric', 'metal', 'skin'];
const toLinear = value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
const stats = {};

for (const [tile, name] of tiles.entries()) {
  const original = await sharp(source).extract({ left: tile % 2 * size, top: Math.floor(tile / 2) * size, width: size, height: size })
    .removeAlpha().raw().toBuffer();
  const mean = [0, 0, 0];
  for (let i = 0; i < original.length; i++) mean[i % 3] += original[i] / (size * size);
  const pixels = new Uint8Array(original.length);
  // Neutral average lets the authored material tint retain its intended value.
  // Chromatic differences such as capillaries and soil remain in the texture.
  for (let i = 0; i < pixels.length; i++) pixels[i] = Math.min(255, original[i] / mean[i % 3] * 204);
  const edge = 24;
  for (const axis of [0, 1]) {
    const copy = pixels.slice();
    for (let row = 0; row < size; row++) for (let d = 0; d < edge; d++) {
      const a = axis === 0 ? (row * size + d) * 3 : (d * size + row) * 3;
      const b = axis === 0 ? (row * size + size - 1 - d) * 3 : ((size - 1 - d) * size + row) * 3;
      const weight = .5 * (1 - d / edge) ** 2;
      for (let c = 0; c < 3; c++) {
        pixels[a + c] = copy[a + c] * (1 - weight) + copy[b + c] * weight;
        pixels[b + c] = copy[b + c] * (1 - weight) + copy[a + c] * weight;
      }
    }
  }
  const luminance = new Float32Array(size * size);
  let linearMean = 0;
  for (let i = 0; i < luminance.length; i++) {
    luminance[i] = (pixels[i * 3] * .2126 + pixels[i * 3 + 1] * .7152 + pixels[i * 3 + 2] * .0722) / 255;
    linearMean += (toLinear(pixels[i * 3] / 255) * .2126 + toLinear(pixels[i * 3 + 1] / 255) * .7152 + toLinear(pixels[i * 3 + 2] / 255) * .0722) / luminance.length;
  }
  const index = (x, y) => ((y + size) % size) * size + (x + size) % size;
  const heights = new Float32Array(luminance.length);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let average = 0;
    for (const dy of [-3, 0, 3]) for (const dx of [-3, 0, 3]) average += luminance[index(x + dx, y + dy)] / 9;
    // Only small-scale relief is estimated from albedo; stains/veins are not treated as deep geometry.
    heights[index(x, y)] = luminance[index(x, y)] - average;
  }
  const normal = new Uint8Array(pixels.length);
  const roughness = new Uint8Array(luminance.length);
  const strength = name === 'metal' ? 1.3 : name === 'skin' ? 2 : 3.2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = index(x, y);
    const nx = (heights[index(x - 1, y)] - heights[index(x + 1, y)]) * strength;
    const ny = (heights[index(x, y - 1)] - heights[index(x, y + 1)]) * strength;
    const length = Math.hypot(nx, ny, 1);
    normal.set([127.5 + nx / length * 127.5, 127.5 + ny / length * 127.5, 127.5 + 127.5 / length], i * 3);
    roughness[i] = Math.max(170, Math.min(255, 240 + (luminance[i] - .8) * (name === 'metal' ? -190 : -65) + heights[i] * 80));
  }
  await sharp(pixels, { raw: { width: size, height: size, channels: 3 } }).webp({ quality: 95 }).toFile(resolve(destination, `${name}-color-v1.webp`));
  await sharp(normal, { raw: { width: size, height: size, channels: 3 } }).png().toFile(resolve(destination, `${name}-normal-v1.png`));
  await sharp(roughness, { raw: { width: size, height: size, channels: 1 } }).png().toFile(resolve(destination, `${name}-roughness-v1.png`));
  stats[name] = { width: size, height: size, colorCompensation: Number((1 / linearMean).toFixed(5)) };
}
const face = sharp(resolve('assets/source/infected-face-v1.png'));
const faceInfo = await face.metadata();
const facePixels = await face.removeAlpha().raw().toBuffer();
const faceMean = [0, 0, 0];
for (let i = 0; i < facePixels.length; i++) faceMean[i % 3] += facePixels[i] / (facePixels.length / 3);
for (let i = 0; i < facePixels.length; i++) facePixels[i] = Math.min(255, facePixels[i] / faceMean[i % 3] * 204);
await sharp(facePixels, { raw: { width: faceInfo.width, height: faceInfo.height, channels: 3 } }).webp({ quality: 96 }).toFile(resolve(destination, 'infected-face-color-v1.webp'));
await writeFile(resolve(destination, 'presentation-v1.json'), JSON.stringify({ source: 'AI-generated presentation-atlas-v1.png and infected-face-v1.png', normal: 'Albedo high-pass estimate, not a sculpt bake', face: { width: faceInfo.width, height: faceInfo.height }, materials: stats }, null, 2) + '\n');
console.log(JSON.stringify(stats));
