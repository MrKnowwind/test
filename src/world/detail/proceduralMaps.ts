import * as THREE from 'three';
import { clamp, hash, mix, noise, smooth } from './noise.ts';

type Kind = 'paint' | 'panel' | 'asphalt' | 'concrete' | 'zinc' | 'tool' | 'rubber' | 'timber';
interface Options {
  kind: Kind;
  seed: number;
  tint: [number, number, number];
  size?: number;
  repeat?: [number, number];
}

const library = new Map<string, THREE.MeshStandardMaterial>();

function makeTexture(data: Uint8Array, size: number, repeat: [number, number], color = false) {
  const texture = new THREE.DataTexture(data, size, size);
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

export function createProceduralMaterialSet({ kind, seed, tint, size = 256, repeat = [1, 1] }: Options) {
  const key = JSON.stringify([kind, seed, tint, size, repeat]);
  const cached = library.get(key);
  if (cached) return cached;
  const pixels = size * size;
  const albedo = new Uint8Array(pixels * 4);
  const rough = new Uint8Array(pixels * 4);
  const normal = new Uint8Array(pixels * 4);
  const height = new Float32Array(pixels);
  const n = (u: number, v: number, x: number, y: number, salt = 0) => noise(u, v, x, y, seed + salt);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size, i = y * size + x, p = i * 4;
      const grain = hash(x, y, seed);
      const cloud = n(u, v, 5, 5) * .58 + n(u, v, 13, 15, 4) * .29 + n(u, v, 39, 47, 9) * .13;
      let shade = 0.82 + cloud * .25 + (grain - .5) * .07;
      let roughness = .56;
      let relief = (grain - .5) * .025 + cloud * .08;
      let rust = 0, bare = 0;
      if (kind === 'paint') {
        const streak = n(u, v, 107, 3, 19) * .65 + n(u, v, 43, 5, 12) * .35;
        const chips = n(u, v, 94, 58, 31);
        const seam = Math.pow(1 - Math.min(u, 1 - u) * 2, 18);
        const sill = Math.exp(-v * 15);
        rust = smooth(.56, .76, cloud * .68 + chips * .23 + sill * .30 + seam * .19);
        rust = Math.max(rust, smooth(.66, .86, streak) * smooth(.44, .68, cloud) * .58);
        const abrasion = smooth(.84, .96, n(u, v, 15, 137, 44)) * smooth(.46, .65, cloud);
        bare = (1 - rust) * (abrasion * .85 + smooth(.72, .92, chips) * (sill + seam) * .58);
        rust *= .42;
        bare *= .56;
        shade *= (1 - smooth(.54, .84, streak) * .12) * (1 - sill * .14 - seam * .08);
        relief += rust * -.09 + (chips - .5) * .04 - abrasion * .045;
        roughness = .47 + cloud * .18 + rust * .24 - bare * .17;
      } else if (kind === 'asphalt' || kind === 'concrete') {
        const stone = n(u, v, 139, 153, 9) * .58 + n(u, v, 73, 61, 8) * .27 + grain * .15;
        const aggregate = smooth(.48, .88, stone);
        const warp = n(u, v, 21, 19, 20);
        const fault = Math.abs(n(u + warp * .021, v, 6, 7, 24) - .52);
        const crack = (1 - smooth(.0014, .009, fault)) * smooth(.43, .65, cloud);
        const damp = smooth(.38, .68, n(u, v, 5, 7, 29) * .75 + cloud * .25);
        shade = (0.82 + cloud * .14 + aggregate * .14) * (1 - crack * .24 - damp * .14);
        relief = aggregate * .12 + grain * .018 - crack * .055 + cloud * .06;
        roughness = kind === 'asphalt' ? .79 - damp * .35 + aggregate * .05 : .84 - damp * .07;
      } else if (kind === 'panel') {
        shade = .93 + cloud * .07 + grain * .018;
        relief = (grain - .5) * .007 + cloud * .008;
        roughness = .72 + cloud * .12;
      } else if (kind === 'timber') {
        const fiber = n(u, v + n(u, v, 4, 7) * .04, 7, 98, 42);
        shade *= .84 + fiber * .25;
        relief += fiber * .14;
        roughness = .73 + fiber * .15;
      } else {
        const brush = n(u, v, 9, 149, 25);
        const fleck = smooth(.64, .87, n(u, v, 78, 71, 30));
        shade *= .87 + brush * .20 + fleck * .23;
        relief += (brush - .5) * .048;
        roughness = kind === 'rubber' ? .85 : .38 + cloud * .29 - fleck * .13;
      }
      const rustTint = [88 + cloud * 47, 39 + cloud * 31, 22 + cloud * 21];
      for (let channel = 0; channel < 3; channel++) {
        albedo[p + channel] = clamp(mix(mix(tint[channel] * shade, rustTint[channel], rust), 141, bare), 0, 255);
        rough[p + channel] = clamp(roughness) * 255;
      }
      albedo[p + 3] = rough[p + 3] = 255;
      height[i] = relief;
    }
  }
  const scale = kind === 'asphalt' ? .65 : kind === 'concrete' ? .6 : 2.1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const p = (y * size + x) * 4;
      const dx = (height[y * size + (x + size - 1) % size] - height[y * size + (x + 1) % size]) * scale;
      const dy = (height[((y + size - 1) % size) * size + x] - height[((y + 1) % size) * size + x]) * scale;
      const length = Math.hypot(dx, dy, 1);
      normal[p] = 127.5 + 127.5 * dx / length;
      normal[p + 1] = 127.5 + 127.5 * dy / length;
      normal[p + 2] = 127.5 + 127.5 / length;
      normal[p + 3] = 255;
    }
  }
  const material = new THREE.MeshStandardMaterial({
    name: `${kind}-${seed}`,
    map: makeTexture(albedo, size, repeat, true),
    roughnessMap: makeTexture(rough, size, repeat),
    normalMap: makeTexture(normal, size, repeat),
    normalScale: new THREE.Vector2(kind === 'concrete' ? .28 : kind === 'asphalt' ? .34 : .48, kind === 'concrete' ? .28 : kind === 'asphalt' ? .34 : .48),
    metalness: kind === 'zinc' ? .73 : kind === 'paint' ? .29 : kind === 'tool' ? .48 : .04,
    roughness: 1,
  });
  library.set(key, material);
  return material;
}
