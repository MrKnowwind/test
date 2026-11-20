import * as THREE from 'three';

const bands = new THREE.DataTexture(new Uint8Array([35, 35, 85, 162, 220, 255]), 6, 1, THREE.RedFormat);
bands.minFilter = bands.magFilter = THREE.NearestFilter;
bands.unpackAlignment = 1;
bands.needsUpdate = true;

export function enamel(color: THREE.ColorRepresentation) {
  return new THREE.MeshToonMaterial({ color, gradientMap: bands });
}

// A repeating cast-panel joint and two register marks, drawn in metre-scaled floor UVs.
export function paving(color: number) {
  const material = enamel(color);
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const mark = y === 4 && (x < 11 || x > 116);
    const shade = x === 0 || y === 0 ? 207 : mark ? 226 : 255;
    pixels.set([shade, shade, shade, 255], (y * size + x) * 4);
  }
  const map = new THREE.DataTexture(pixels, size, size);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.magFilter = THREE.LinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  material.map = map;
  return material;
}

export function createMaterialLibrary() {
  return {
    asphalt: enamel(0x465978), concrete: enamel(0xa7bbce), zinc: enamel(0xc3deeb),
    steel: enamel(0x354969), rubber: enamel(0x202946), timber: enamel(0xe9ac72),
    safety: enamel(0xff8357), ceramic: enamel(0xe1e9df),
  };
}

export type Materials = ReturnType<typeof createMaterialLibrary>;

export function emissive(color: number, intensity = 1.5) {
  const material = enamel(color);
  material.emissive.set(color);
  material.emissiveIntensity = intensity;
  return material;
}
