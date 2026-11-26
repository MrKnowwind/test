import * as THREE from 'three';
import type { MapInteraction, Vec3 } from '../contracts/demo.ts';
import { box, cylinder } from './detail/geometry.ts';
import { emissive, enamel, type Materials } from './detail/materialLibrary.ts';
import { coldChainPad } from './terrainPlan.ts';

export const districtBuildings = [
  { minX: 29, maxX: 47, minZ: 23, maxZ: 47 },
  { minX: 107, maxX: 133, minZ: -91, maxZ: -61 },
] as const;

const coldY = coldChainPad.height;
export const districtInteractions: readonly MapInteraction[] = [
  { id: 'cold-chain-intake', label: '冷链签收台', position: [32, coldY + 1.08, 43], kind: 'loot', item: 'manual', quantity: 1 },
  { id: 'cold-chain-medical', label: '低温药品柜', position: [32, coldY + 1.08, 28.5], kind: 'loot', item: 'medkit', quantity: 1 },
  { id: 'cold-chain-calibration', label: '冷机校准箱', position: [44, coldY + 1.08, 32], kind: 'loot', item: 'calibration', quantity: 1 },
  { id: 'switchgear-diagnostics', label: '电气诊断台', position: [110.6, 1.08, -78], kind: 'loot', item: 'gauge', quantity: 1 },
  { id: 'switchgear-spares', label: '绝缘备件架', position: [129.2, 1.08, -67], kind: 'loot', item: 'board', quantity: 1 },
  { id: 'switchgear-tools', label: '检修工具台', position: [127.5, 1.08, -85], kind: 'loot', item: 'wrench', quantity: 1 },
];

export function buildDistrictSites(root: THREE.Group, m: Materials,
  solid: (at: Vec3, size: Vec3, material: THREE.Material, bevel?: number) => THREE.Mesh) {
  const ice = enamel(0x81baca), ink = enamel(0x35576a), slate = enamel(0x4d6370);
  const rust = enamel(0xa66b49), mint = emissive(0x91f0ea, .43), amber = emissive(0xf5ad6a, .36);
  function upstand(x: number, z: number, width: number, depth: number, base: number, height: number, mat: THREE.Material) {
    solid([x, base + height / 2, z], [width, height, depth], mat, .025);
  }
  function roof(x: number, z: number, y: number, width: number, depth: number, material: THREE.Material) {
    solid([x, y, z], [width, .24, depth], material, .035);
  }

  // The cold chain has a heated intake, an insulated medical chamber and a separate cooling plant.
  const cold = districtBuildings[0];
  const coldHeight = 5.3;
  box(root, slate, 18, .025, 24, 38, coldY + .013, 35);
  for (const x of [cold.minX, cold.maxX]) {
    upstand(x, 35, .30, 24, coldY, coldHeight, m.ceramic);
    for (const z of [26, 30, 34, 38, 42, 46]) {
      box(root, ice, .12, 4.6, .16, x + Math.sign(x - 38) * .17, coldY + 2.4, z);
    }
  }
  for (const z of [cold.minZ, cold.maxZ]) {
    for (const x of [32.3, 43.7]) upstand(x, z, 6.6, .30, coldY, coldHeight, m.ceramic);
    upstand(38, z, 4.8, .31, coldY + 3.65, 1.65, ink);
    for (const x of [35.6, 40.4]) upstand(x, z, .23, .49, coldY, 3.7, m.rubber);
    box(root, mint, 4, .09, .09, 38, coldY + 3.54, z + Math.sign(z - 35) * .18);
    roof(38, z + Math.sign(z - 35) * .65, coldY + 3.96, 7, 2.5, ink);
  }
  roof(38, 35, coldY + coldHeight, 18.7, 24.8, ice);
  roof(38, 33, coldY + 5.98, 12, 13, ink);
  upstand(38, 33, 11.6, 12.6, coldY + 5.42, .44, slate);
  for (const x of [33.9, 42.1]) {
    for (const z of [27, 35.2, 40.25]) {
      const depth = z === 27 ? 7.6 : z === 35.2 ? 4 : 3.2;
      upstand(x, z, .23, depth, coldY, 3.6, m.ceramic);
    }
    for (const z of [31.2, 37.5]) {
      upstand(x, z, .28, 1.85, coldY + 2.38, 1.24, ice);
      box(root, mint, .3, .07, 1.65, x, coldY + 2.31, z);
    }
    upstand(x, 38.8, 3.7, .23, coldY, 3.6, ink);
  }
  for (const [x, z, material] of [[32, 28.5, ice], [32, 43, m.steel], [44, 32, ink]] as const) {
    solid([x, coldY + .52, z], [1.45, 1.04, 1.39], material, .08);
    box(root, slate, 1.49, .04, 1.44, x, coldY + 1.05, z);
  }
  for (const z of [25, 26.4]) {
    solid([30.4, coldY + 1.06, z], [1.72, 2.12, 1.27], m.ceramic, .07);
    box(root, ice, .10, 1.68, 1.07, 31.3, coldY + 1.17, z);
    box(root, mint, .12, .12, .67, 31.36, coldY + 1.73, z);
  }
  for (const z of [25.5, 27.8]) {
    solid([44.1, coldY + .75, z], [2.1, 1.50, 1.57], slate, .10);
    box(root, ink, 2.02, .1, 1.63, 44.1, coldY + 1.52, z);
    for (const dx of [-.57, 0, .57]) cylinder(root, ice, .11, .26, 44.1 + dx, coldY + 1.69, z, 12);
  }
  for (const z of [25.5, 34.3, 41.9]) {
    box(root, mint, 2.8, .08, .22, 38, coldY + 4.57, z);
    const light = new THREE.PointLight(0xa7dcff, 42, 12, 1.7);
    light.position.set(38, coldY + 4.45, z);
    root.add(light);
  }
  for (const z of [28, 35.5, 43]) {
    solid([49.4, coldY + .96, z], [2.65, 1.92, 2.9], ink, .09);
    for (const dz of [-.69, .69]) cylinder(root, m.rubber, .61, .045, 49.4, coldY + 1.94, z + dz, 18);
    for (let i = 0; i < 5; i++) box(root, ice, .12, .075, 2.35, 50.77, coldY + .55 + i * .19, z);
  }

  // Switchgear is laid out around a straight service aisle with test bays on either side.
  const plant = districtBuildings[1];
  box(root, m.concrete, 26, .025, 30, 120, .013, -76);
  for (const x of [plant.minX, plant.maxX]) {
    upstand(x, -76, .32, 30, 0, 3.05, m.concrete);
    for (const z of [-87, -80, -73, -66]) upstand(x, z, .36, .27, 3.05, 1.48, rust);
    box(root, slate, .22, 1.33, 29.8, x, 3.77, -76);
    box(root, rust, .34, .1, 30, x, 4.38, -76);
  }
  for (const z of [plant.minZ, plant.maxZ]) {
    for (const x of [111.9, 128.1]) upstand(x, z, 9.8, .30, 0, 4.6, m.concrete);
    upstand(120, z, 6.4, .30, 3.55, 1.05, rust);
    box(root, amber, 6.15, .11, .06, 120, 3.47, z + Math.sign(z + 76) * .19);
  }
  roof(112.65, -76, 4.6, 12.1, 30.8, rust);
  roof(125.65, -76, 5.12, 16.0, 30.8, slate);
  upstand(118.15, -76, .24, 30, 4.62, .45, ink);
  for (const z of [-88, -80, -72, -64]) {
    box(root, amber, 3.7, .09, .22, 120, 4.2, z);
    for (const x of [117, 123]) box(root, m.safety, .11, .022, 4.9, x, .029, z);
  }
  for (const z of [-87, -84.5, -70.5, -65.5]) {
    solid([111.1, 1.2, z], [2.6, 2.4, 1.7], slate, .065);
    box(root, rust, .08, 1.79, 1.49, 112.43, 1.22, z);
    box(root, amber, .087, .14, .57, 112.49, 1.83, z);
  }
  for (const [x, z] of [[110.6, -78], [129.2, -67], [127.5, -85]]) {
    solid([x, .52, z], [2.28, 1.04, 1.06], m.steel, .055);
    box(root, m.zinc, 2.33, .04, 1.12, x, 1.05, z);
    box(root, ink, 1.95, .32, .14, x, 1.23, z - .51, .04);
  }
  for (const z of [-79.1, -75.9]) {
    solid([129.15, .48, z], [4.8, .96, 2.35], slate, .10);
    for (const x of [127.7, 129.15, 130.6]) {
      solid([x, 1.36, z], [.96, .80, 1.12], rust, .075);
      for (const y of [1.23, 1.43, 1.63]) cylinder(root, m.ceramic, .55, .08, x, y, z, 16);
    }
  }
}
