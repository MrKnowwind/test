import * as THREE from 'three';
import type { Vec3 } from '../contracts/demo.ts';
import { lab, rampHeight } from './worldQueries.ts';

type Part = (center: Vec3, size: Vec3, material: THREE.Material, roll?: number) => void;

export function addIndustrialDetails(scene: THREE.Group, part: Part) {
  const paint = (color: number, roughness = 0.64, metalness = 0.3) => (
    new THREE.MeshStandardMaterial({ color, roughness, metalness })
  );
  const zinc = paint(0x788283, 0.52);
  const frame = paint(0x242b30);
  const ochre = paint(0x80602d);
  const flaked = paint(0x704b39, 0.84, 0.14);
  const teal = paint(0x315d68, 0.54);
  const fadedRed = paint(0x693c34, 0.62);
  const roadPaint = paint(0xb29d61, 0.86, 0);
  const lampShell = paint(0x161f24);
  const amber = new THREE.MeshBasicMaterial({ color: 0xffc481 });
  const cyan = new THREE.MeshBasicMaterial({ color: 0xa9e5ed });

  const dome = new THREE.SphereGeometry(86, 32, 20);
  const horizon = new THREE.Color(0x526169);
  const zenith = new THREE.Color(0x111e2a);
  const tint = new THREE.Color();
  const skyVertices = dome.getAttribute('position');
  const skyColors: number[] = [];
  for (let i = 0; i < skyVertices.count; i++) {
    tint.copy(horizon).lerp(zenith, THREE.MathUtils.smoothstep(skyVertices.getY(i) / 86, 0, 0.64));
    skyColors.push(tint.r, tint.g, tint.b);
  }
  dome.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));
  scene.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({
    vertexColors: true, fog: false, toneMapped: false, side: THREE.BackSide, depthWrite: false,
  })));

  function light(center: Vec3, color: number, power: number, range: number, cool = false) {
    part(center, [0.68, 0.16, 0.34], lampShell);
    part([center[0], center[1] - 0.085, center[2]], [0.56, 0.024, 0.27], cool ? cyan : amber);
    if (power === 0) return;
    const bulb = new THREE.PointLight(color, power, range, 2);
    bulb.position.set(center[0], center[1] - 0.22, center[2]);
    scene.add(bulb);
  }

  function ribs(x: number, y: number, z: number, w: number, h: number, d: number, skin: THREE.Material) {
    for (const side of [-1, 1]) {
      const xFace = x + side * w / 2;
      const zFace = z + side * d / 2;
      for (let offset = -d / 2 + 0.22; offset < d / 2 - 0.1; offset += 0.27) {
        part([xFace, y, z + offset], [0.085, h - 0.25, 0.105], skin);
        if (Math.sin(offset * 8 + x) > 0.55) {
          part([xFace + side * 0.048, y - h * 0.31, z + offset], [0.016, h * 0.27, 0.08], flaked);
        }
      }
      for (let offset = -w / 2 + 0.22; offset < w / 2 - 0.1; offset += 0.28) {
        part([x + offset, y, zFace], [0.12, h - 0.27, 0.08], skin);
      }
      for (const top of [-1, 1]) {
        part([xFace, y + top * (h / 2 - 0.09), z], [0.12, 0.18, d + 0.09], frame);
        part([x, y + top * (h / 2 - 0.09), zFace], [w + 0.09, 0.18, 0.13], frame);
      }
      for (const lock of [-1, 1]) {
        part([x + lock * w * 0.2, y, zFace + side * 0.07], [0.06, h * 0.83, 0.06], zinc);
        part([x + lock * w * 0.2, y - h * 0.14, zFace + side * 0.1], [0.28, 0.06, 0.1], zinc);
      }
    }
  }

  function exitMark(x: number, y: number, z: number, radius: number, color: number) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.04, radius, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.57, depthWrite: false }));
    ring.position.set(x, y + 0.012, z);
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);
  }

  const sky = new THREE.HemisphereLight(0xb2d8f4, 0x554339, 0.82);
  const moon = new THREE.DirectionalLight(0x94b8dc, 0.86);
  moon.position.set(-12, 26, -16);
  scene.add(sky, moon);

  ribs(-17, 1.3, 15, 4, 2.6, 4.6, fadedRed);
  ribs(-16, 1.3, 1.4, 5.6, 2.6, 2.8, teal);
  ribs(19, 1.3, 6, 2.2, 2.6, 2.6, fadedRed);
  ribs(0.2, 1.35, -10.8, 5.8, 2.7, 2.4, fadedRed);

  for (const z of [-17, -10, -3, 4, 11, 18]) {
    part([-24.68, 1.22, z], [0.22, 2.44, 0.16], frame);
    part([24.68, 1.22, z], [0.22, 2.44, 0.16], frame);
    part([-23.5, 0.013, z], [0.10, 0.019, 2.5], roadPaint);
    part([23.5, 0.013, z], [0.10, 0.019, 2.5], roadPaint);
  }
  for (const x of [-23.2, -19.2]) part([x, 0.01, -21.9], [0.14, 0.015, 7.4], roadPaint);
  for (const z of [16, 5, -8, -17.7]) {
    part([-23.7, 2.03, z], [0.17, 4.06, 0.17], frame);
    part([-23.16, 4.02, z], [1.17, 0.14, 0.14], zinc);
    light([-22.6, 3.94, z], 0xffb775, 85, 9);
  }
  light([-21, 3.23, -21.8], 0x9bffc4, 44, 8, true);
  exitMark(-21, 0, -19, 1.8, 0x96e9b2);

  for (let y = 0.18; y < 2.12; y += 0.16) part([24.54, y, -14], [0.28, 0.11, 2.85], zinc);
  light([24.03, 3.14, -14], 0xffbd75, 58, 8);
  exitMark(22.5, 0, -14, 1.55, 0xe6b264);

  light([-10, 2.77, -8.4], 0xffca91, 34, 5.8);
  light([-10, 2.75, -4.43], 0xffb368, 22, 5.8);
  part([-10, 0.89, -10.3], [2.12, 0.075, 0.96], ochre);
  for (const x of [-13.9, -7.1]) part([x, 1.42, -4.8], [0.17, 2.84, 0.25], frame);

  for (const z of [-11.5, -7.3, -3.5, 0.7, 5.3]) {
    part([1, 4.78, z], [15.2, 0.29, 0.21], zinc);
    for (const x of [-4.1, 5.8]) part([x, 4.35, z], [3.5, 0.17, 0.18], frame, x < 0 ? 0.33 : -0.33);
  }
  for (const [x, z] of [[-4.3, -2.5], [3.9, 1.8], [4.6, -9.1]]) light([x, 4.61, z], 0xffc28f, 104, 10);

  for (let x = 11.18; x < 17; x += 0.24) part([x, 2.12, 12.95], [0.10, 4.15, 0.08], teal);
  for (let z = 13.2; z < 21; z += 0.24) part([10.97, 2.12, z], [0.08, 4.15, 0.11], teal);
  for (let y = 0.19; y < 2.7; y += 0.16) part([14.1, y, 12.82], [3.57, 0.11, 0.19], zinc);
  light([14, 4.18, 12.39], 0xffc084, 60, 8);
  for (const x of [-4.5, 3.5, -15]) {
    const [y, z, width] = x === -4.5 ? [1.24, -3.4, 2.1] : x === 3.5 ? [1.8, 1.65, 2.35] : [0.98, 10, 1.55];
    part([x, y, z], [width + 0.08, 0.08, 1.3], ochre);
    for (const side of [-1, 1]) part([x + side * width * 0.4, y - 0.26, z], [0.10, 0.53, 1.42], zinc);
  }

  for (const x of [10, 14]) part([x, 1.2, 1.5], [0.42, 0.08, 11], ochre);
  for (const z of [-2.6, 0.3, 3.2, 6.1]) {
    light([10.17, rampHeight(z) + 1.07, z], 0x88dce8, 7, 4, true);
    light([13.83, rampHeight(z) + 1.07, z], 0x88dce8, 0, 4, true);
    part([12, rampHeight(z), z], [3.76, 0.018, 0.13], roadPaint);
  }
  light([12, 3.72, 7.42], 0x91e9fa, 58, 8, true);

  for (const z of [-6.2, -9.3, -13.9]) {
    part([2.5, -0.59, z], [24.7, 0.17, 0.21], frame);
    light([12, -0.78, z], 0x80cfe7, 40, 6, true);
  }
  for (const [x, z] of [[4.1, -12.7], [-3.8, -12.9], [-5.2, -7]]) light([x, -0.82, z], 0x93d6ed, 64, 7, true);
  for (const [y, material] of [[-1.27, frame], [-1.51, teal], [-3.84, zinc]] as const) {
    part([2.5, y, -15.76], [24.6, 0.08, 0.15], material);
    part([14.76, y, -10], [0.15, 0.08, 11.64], material);
  }
  for (const x of [-9.2, -4.8, -0.7, 5.8, 12.3]) {
    part([x, -2.36, -15.81], [0.27, 3.65, 0.18], frame);
    for (const y of [-1.25, -1.51]) part([x, y, -15.66], [0.12, 0.14, 0.13], zinc);
  }
  for (const z of [-6.65, -10.25]) part([7.72, -2.56, z], [0.42, 3.28, 0.20], ochre);
  part([-1.5, -1.4, -9.5], [0.58, 0.16, 4.06], zinc);
  for (const x of [-1.75, -1.25]) part([x, -3.79, -9.5], [0.028, 0.23, 3.88], ochre);

  part([-7, -3.14, -14.72], [1.43, 1.98, 0.09], ochre);
  part([-7.22, -2.71, -14.65], [0.6, 0.38, 0.1], frame);
  part([-6.54, -3.14, -14.58], [0.1, 0.38, 0.16], zinc);
  part([-7.5, -2.72, -14.585], [0.13, 0.06, 0.04], amber);
  part([-7, -1.33, -15.21], [0.13, 1.55, 0.13], ochre);
  part([-7, -0.63, -10.93], [0.13, 0.13, 8.65], ochre);
  light([-7, -0.97, -14.05], 0xffb471, 35, 5.6);
  part([3.3, -3.12, -14.4], [1.47, 0.08, 0.93], teal);

  for (let y = -4.02; y < -1.18; y += 0.19) part([-9.76, y, -6.6], [0.12, 0.15, 2.55], zinc);
  for (const z of [-8, -5.2]) part([-9.67, -2.52, z], [0.32, 3.36, 0.24], ochre);
  light([-9.15, -0.88, -8.4], 0x8ae7e0, 34, 5.8, true);
  exitMark(-7.7, lab.y, -6.6, 1.55, 0x9de2df);

  // Silhouettes beyond the playable fence.
  for (const [x, z] of [[-6, -33], [23, -43]]) {
    part([x, 4.4, z], [0.46, 9, 0.46], frame);
    part([x + 2.9, 9.6, z], [10, 0.28, 0.37], frame, 0.29);
    part([x + 2.9, 8.65, z], [10, 0.28, 0.37], frame, 0.29);
    for (let i = 0; i < 9; i++) part([x - 0.9 + i, 8.0 + i * 0.29, z], [0.12, 1.24, 0.2], frame, i % 2 === 0 ? 0.6 : -0.6);
    part([x + 6.5, 6.75, z], [0.055, 5.2, 0.055], frame);
    part([x + 6.5, 4.15, z], [0.43, 0.25, 0.36], ochre);
  }
  for (const [x, z, h] of [[-31, 4, 5.1], [-33, -8, 7], [-34, -23, 4.9], [8, -32, 3.9]]) {
    part([x, h / 2, z], [4.2, h, 7.9], frame);
    part([x, h + 0.18, z], [4.4, 0.36, 8.2], zinc);
  }

  // The raid hides each named loot group after pickup. The shelves and desks remain in place.
  const propBox = new THREE.BoxGeometry();
  const ivory = paint(0xe1ddc9, 0.42, 0);
  const medical = paint(0x833c36, 0.64, 0);
  const brass = paint(0xd5a258, 0.32, 0.56);
  const sampleGlow = new THREE.MeshStandardMaterial({ color: 0x73cda2, emissive: 0x367b60, emissiveIntensity: 0.6 });
  function loot(id: string, center: Vec3) {
    const group = new THREE.Group();
    group.name = id;
    group.position.set(...center);
    scene.add(group);
    return (at: Vec3, size: Vec3, material: THREE.Material, geometry: THREE.BufferGeometry = propBox) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...at);
      mesh.scale.set(...size);
      group.add(mesh);
    };
  }

  const card = loot('duty-card', [-10, 0.95, -9.99]);
  card([0, 0, 0], [0.28, 0.023, 0.18], ivory);
  card([0, 0.013, 0.054], [0.27, 0.004, 0.044], ochre);
  card([-0.061, 0.014, -0.025], [0.053, 0.004, 0.048], brass);

  const ammo = loot('yard-ammo', [-4.5, 1.29, -3.06]);
  ammo([0, 0.07, 0], [0.38, 0.14, 0.24], ochre);
  for (let i = -2; i <= 2; i++) ammo([i * 0.063, 0.145, 0], [0.036, 0.013, 0.14], brass);

  const medkit = loot('yard-medkit', [-15, 1.02, 9.72]);
  medkit([0, 0.105, 0], [0.47, 0.21, 0.32], medical);
  medkit([0, 0.214, 0], [0.22, 0.012, 0.057], ivory);
  medkit([0, 0.215, 0], [0.057, 0.012, 0.22], ivory);

  const salvage = loot('yard-salvage', [3.5, 1.85, 1.96]);
  salvage([0, 0.13, 0], [0.58, 0.26, 0.38], teal);
  for (const x of [-0.2, 0.2]) salvage([x, 0.14, 0], [0.055, 0.29, 0.4], zinc);

  const vial = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  const sample = loot('lab-research', [3.3, -3.07, -14.12]);
  sample([0, 0.19, 0], [0.24, 0.38, 0.24], sampleGlow, vial);
  for (const y of [0.035, 0.37]) sample([0, y, 0], [0.27, 0.08, 0.27], zinc, vial);
}
