import * as THREE from 'three';

export type Finish = 'fabric' | 'metal' | 'skin' | 'rubber' | 'polymer' | 'leather';
const cache = new Map<Finish, { color: THREE.Texture; normal: THREE.Texture; roughness: THREE.Texture }>();
const size = 512;
const tints = new WeakMap<THREE.Material, THREE.Color>();
export function presentationMaterialsReady() { return Promise.resolve(); }
const hash = (x: number, y: number) => {
  let h = Math.imul(x + 513, 374761393) ^ Math.imul(y + 917, 668265263);
  h = Math.imul(h ^ h >>> 13, 1274126177);
  return ((h ^ h >>> 16) >>> 0) / 4294967295;
};
const smooth = (v: number) => v * v * (3 - 2 * v);
const mix = THREE.MathUtils.lerp;
function noise(x: number, y: number, frequency: number) {
  const u = x * frequency / size, v = y * frequency / size;
  const a = Math.floor(u), b = Math.floor(v);
  const p = smooth(u - a), q = smooth(v - b);
  const sample = (x: number, y: number) => hash((x + frequency) % frequency, (y + frequency) % frequency);
  return mix(mix(sample(a, b), sample(a + 1, b), p), mix(sample(a, b + 1), sample(a + 1, b + 1), p), q);
}

function texture(data: Uint8Array, color: boolean) {
  const map = new THREE.DataTexture(data, size, size);
  map.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.anisotropy = 8;
  map.needsUpdate = true;
  return map;
}

export function finishMaps(kind: Finish) {
  const saved = cache.get(kind);
  if (saved) return saved;
  const color = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(color.length);
  const normal = new Uint8Array(color.length);
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const grain = hash(x, y);
    const cloud = noise(x, y, 5) * .55 + noise(x, y, 19) * .30 + noise(x, y, 63) * .15;
    // UV borders follow model seams; hand contact and seams polish before sheltered panels.
    const seam = Math.exp(-Math.min(x, size - x, y, size - y) / 4);
    const contact = Math.exp(-((x / size - .5) ** 2 / .035 + (y / size - .55) ** 2 / .10));
    let value = .84 + cloud * .15;
    let height = grain * .015;
    let rough = .76;
    if (kind === 'fabric') {
      const warp = Math.cos(x * Math.PI / 2) * .5 + .5;
      const weft = Math.cos(y * Math.PI / 2 + (x % 8 < 4 ? Math.PI : 0)) * .5 + .5;
      const thread = Math.max(warp, weft * .76);
      const soil = Math.max(0, (cloud - .46) * 1.8);
      const stitch = seam * (.5 + .5 * Math.cos((x + y) * Math.PI / 4));
      value = .73 + thread * .12 + cloud * .16 - soil * .27 + grain * .026 + stitch * .07;
      height = thread * .041 + grain * .008 + stitch * .03;
      rough = .8 + thread * .16;
    } else if (kind === 'metal') {
      const scratch = noise(x, y, 179) > .72 && hash(Math.floor(x / 8), y) > .63 ? .13 : 0;
      const scuff = noise(x, y, 47) * .6 + noise(x, y, 13) * .4;
      const abrasion = Math.max(0, scuff - .68) * .55;
      const oil = Math.max(0, .49 - cloud) * .18;
      const brushed = hash(0, y) * .032;
      const edge = Math.pow(Math.abs(2 * x / size - 1), 30) * .045;
      value = .69 + cloud * .25 + brushed + scratch + edge + abrasion - oil + seam * .09 + contact * .025;
      height = grain * .009 - scratch * .08 - abrasion * .025;
      rough = .50 + cloud * .21 - scratch * .7 - abrasion * .35 - oil * .5 - seam * .2 - contact * .08;
    } else if (kind === 'skin') {
      const pores = noise(x, y, 149);
      const crease = Math.exp(-(((y / size - .36 - .018 * Math.sin(x / 31)) / .008) ** 2)) * contact;
      value = .81 + cloud * .16 + grain * .025 - crease * .065;
      height = pores * .018 - crease * .02;
      rough = .74 + cloud * .19 - contact * .07;
    } else if (kind === 'polymer') {
      const stipple = Math.max(0, Math.cos(x * 1.57) * Math.cos(y * 1.57));
      value = .85 + grain * .04 + seam * .08 + contact * .04;
      height = stipple * .018 * (1 - contact * .5) + grain * .008;
      rough = .86 + grain * .08 - contact * .12;
    } else {
      const pores = noise(x, y, 113);
      const creased = Math.max(0, .07 - Math.abs(noise(x, y, 17) - .49)) * 2.0;
      value = .76 + cloud * .20 + grain * .045 - creased * .35 + seam * .07 + contact * .05;
      height = grain * .014 + pores * .024 - creased * .065 + seam * .015;
      rough = .81 + cloud * .15 - contact * (kind === 'leather' ? .21 : .07);
    }
    const index = (y * size + x) * 4;
    const c = THREE.MathUtils.clamp(value * 255, 0, 255);
    color.set(kind === 'skin' ? [c, c * (.975 + cloud * .02), c * .95, 255] : [c, c, c, 255], index);
    const r = THREE.MathUtils.clamp(rough, 0, 1) * 255;
    roughness.set([r, r, r, 255], index);
    heights[y * size + x] = height;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = (heights[y * size + (x + size - 1) % size] - heights[y * size + (x + 1) % size]) * 3;
    const ny = (heights[((y + size - 1) % size) * size + x] - heights[((y + 1) % size) * size + x]) * 3;
    const l = Math.hypot(nx, ny, 1);
    normal.set([127.5 + nx / l * 127.5, 127.5 + ny / l * 127.5, 127.5 + 127.5 / l, 255], (y * size + x) * 4);
  }
  const maps = { color: texture(color, true), normal: texture(normal, false), roughness: texture(roughness, false) };
  cache.set(kind, maps);
  return maps;
}

export function applyFinish(material: THREE.MeshStandardMaterial, kind: Finish) {
  const maps = finishMaps(kind);
  if (!tints.has(material)) tints.set(material, material.color.clone());
  material.color.copy(tints.get(material)!);
  material.map = maps.color;
  material.normalMap = maps.normal;
  const relief = kind === 'metal' ? .12 : kind === 'rubber' ? .32 : kind === 'polymer' ? .15 : .3;
  material.normalScale.set(relief, relief);
  material.roughnessMap = maps.roughness;
  material.userData.finish = kind;
  material.needsUpdate = true;
  return material;
}

// Analytic facial marks in the projection coordinates used by infectedModel.
// Eyelids, eyes and nasal/lip silhouette remain real geometry, with color following them.
function createFaceAlbedo() {
  const pixels = new Uint8Array(size * size * 4);
  const bell = (v: number, c: number, w: number) => Math.exp(-(((v - c) / w) ** 2));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const mottling = noise(x, y, 17) * .08 + noise(x, y, 53) * .025;
    const socket = bell(Math.abs(u - .5), .194, .12) * bell(v, .61, .075);
    const lip = bell(u, .518, .17) * bell(v, .205, .032);
    const nostril = bell(Math.abs(u - .49), .065, .025) * bell(v, .37, .022);
    const wound = bell(u, .79 + .035 * Math.sin(v * 28), .023) * bell(v, .42, .16);
    const veins = Math.exp(-(((u - .24 - .04 * Math.sin(v * 24) - .02 * Math.sin(v * 53)) / .006) ** 2)) * bell(v, .8, .2);
    const base = .86 + mottling + hash(x, y) * .025;
    const shade = socket * .31 + lip * .27 + nostril * .6 + wound * .3;
    pixels.set([255 * (base - shade), 255 * (base - shade - wound * .18 - lip * .09 - veins * .05),
      255 * (base - shade - wound * .15 - lip * .06), 255], (y * size + x) * 4);
  }
  const map = texture(pixels, true);
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  return map;
}
export const faceAlbedo = createFaceAlbedo();

