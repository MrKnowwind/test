import * as THREE from 'three';

const size = 128;

function grain(x: number, y: number) {
  const hash = Math.imul(x + 577, 374761393) ^ Math.imul(y + 915, 668265263);
  return ((Math.imul(hash ^ (hash >>> 13), 1274126177) >>> 0) % 1024) / 1023;
}

function mottling(x: number, y: number, cells: number) {
  const ix = Math.floor(x * cells);
  const iy = Math.floor(y * cells);
  const fx = x * cells - ix;
  const fy = y * cells - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = THREE.MathUtils.lerp(grain(ix, iy), grain((ix + 1) % cells, iy), sx);
  const bottom = THREE.MathUtils.lerp(grain(ix, (iy + 1) % cells), grain((ix + 1) % cells, (iy + 1) % cells), sx);
  return THREE.MathUtils.lerp(top, bottom, sy);
}

function texture(pixels: Uint8Array<ArrayBuffer>, colorSpace: THREE.ColorSpace) {
  const map = new THREE.DataTexture(pixels, size, size);
  map.colorSpace = colorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return map;
}

export function weatheredSurface(color: number, wet: boolean) {
  const diffuse = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(diffuse.length);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const patch = mottling(x / size, y / size, 5);
      const grit = 0.48 * mottling(x / size, y / size, 24) + 0.52 * grain(x, y);
      const damp = wet ? THREE.MathUtils.smoothstep(patch + (grit - 0.5) * 0.22, 0.28, 0.63) : 0;
      const shade = 175 + grit * 48 + patch * 26 - damp * 34;
      const rough = wet ? 189 + grit * 27 - damp * 147 : 193 + grit * 35;
      const offset = (y * size + x) * 4;
      diffuse.set([shade, shade, shade, 255], offset);
      roughness.set([rough, rough, rough, 255], offset);
    }
  }
  return new THREE.MeshStandardMaterial({
    color, roughness: 1, metalness: wet ? 0.17 : 0,
    map: texture(diffuse, THREE.SRGBColorSpace), roughnessMap: texture(roughness, THREE.NoColorSpace),
  });
}

// Give all slab sections a common world-aligned texture scale across the ramp cutout.
export function tileByPosition(geometry: THREE.BufferGeometry, scale: number) {
  const vertices = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < vertices.count; i++) {
    const vertical = Math.abs(normals.getY(i)) > 0.1;
    uv.setXY(i,
      (Math.abs(normals.getX(i)) > 0.9 ? vertices.getZ(i) : vertices.getX(i)) / scale,
      (vertical ? vertices.getZ(i) : vertices.getY(i)) / scale,
    );
  }
}
