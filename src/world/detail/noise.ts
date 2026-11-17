export const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function randomSequence(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function hash(x: number, y: number, seed: number) {
  let h = Math.imul(x ^ seed, 0x9e3779b1) ^ Math.imul(y + seed, 0x85ebca77);
  h = Math.imul(h ^ h >>> 15, 0xc2b2ae3d);
  return ((h ^ h >>> 13) >>> 0) / 4294967296;
}

export function noise(u: number, v: number, nx: number, ny: number, seed: number) {
  const x = u * nx, y = v * ny;
  const ix = Math.floor(x), iy = Math.floor(y);
  const ax = (ix % nx + nx) % nx, ay = (iy % ny + ny) % ny;
  const bx = (ax + 1) % nx, by = (ay + 1) % ny;
  const s = smooth(0, 1, x - ix), t = smooth(0, 1, y - iy);
  return mix(mix(hash(ax, ay, seed), hash(bx, ay, seed), s),
    mix(hash(ax, by, seed), hash(bx, by, seed), s), t);
}
