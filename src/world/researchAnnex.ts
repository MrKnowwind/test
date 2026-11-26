import * as THREE from 'three';
import type { Vec3 } from '../contracts/demo.ts';
import { box, mesh, strut } from './detail/geometry.ts';
import { emissive, enamel, type Materials } from './detail/materialLibrary.ts';
import {
  annexApproaches, annexWalk, archiveBuilding, archiveDoorX, archivePad,
  observationBuilding, observationDoorX, observationPad, ridgeCrest, ridgeTrail,
} from './researchAnnexPlan.ts';
import type { Solid } from './worldQueries.ts';

type Builder = (at: Vec3, size: Vec3, material: THREE.Material, bevel?: number) => THREE.Mesh;

export function buildResearchAnnex(root: THREE.Group, m: Materials, solids: Solid[], solid: Builder) {
  const jade = enamel(0x4f8985), slate = enamel(0x526484), bronze = enamel(0xb08a61);
  const linoleum = enamel(0xa9c4bc), floor = enamel(0x9c98ac), lamp = emissive(0xc6f6ea, .62);
  const pane = new THREE.MeshStandardMaterial({ color: 0x81d4e4, transparent: true, opacity: .26, roughness: .27, depthWrite: false });
  const y = observationPad.height;

  function wallX(x: number, z1: number, z2: number, base: number, h: number, material: THREE.Material) {
    solid([x, y + base + h / 2, (z1 + z2) / 2], [.22, h, z2 - z1], material);
  }
  function wallZ(z: number, x1: number, x2: number, base: number, h: number, material: THREE.Material) {
    solid([(x1 + x2) / 2, y + base + h / 2, z], [x2 - x1, h, .22], material);
  }
  function portal(z: number, left: number, right: number, x: number, width: number, h: number, material: THREE.Material) {
    wallZ(z, left, x - width / 2, 0, h, material);
    wallZ(z, x + width / 2, right, 0, h, material);
    wallZ(z, x - width / 2, x + width / 2, 2.48, h - 2.48, material);
  }
  function worktop(x: number, z: number, width: number, depth: number, material: THREE.Material) {
    solid([x, y + .51, z], [width, 1.02, depth], material, .06);
    box(root, m.zinc, width + .06, .055, depth + .06, x, y + 1.0275, z, .02);
    for (const dx of [-width / 3, 0, width / 3])
      box(root, m.steel, .26, .066, .064, x + dx, y + .75, z + depth / 2, .02);
  }
  function fixture(x: number, z: number, length: number, height: number, color: number) {
    box(root, m.steel, length + .13, .10, .32, x, y + height, z, .03);
    box(root, lamp, length, .035, .21, x, y + height - .06, z, .02);
    const light = new THREE.PointLight(color, 43, 11, 2);
    light.position.set(x, y + height - .30, z);
    root.add(light);
  }

  for (const [i, pad] of [observationPad, archivePad].entries()) {
    for (const x of [pad.minX + .14, pad.maxX - .14]) {
      const connects = i === 0 ? x > pad.minX + 1 : x < pad.maxX - 1;
      if (connects) wallX(x, pad.minZ, annexWalk.minZ, 0, .72, m.concrete);
      wallX(x, connects ? annexWalk.maxZ : pad.minZ, pad.maxZ, 0, .72, m.concrete);
    }
    const { minX, maxX } = annexApproaches[i];
    wallZ(pad.minZ + .14, pad.minX, minX, 0, .72, m.concrete);
    if (i === 0) wallZ(pad.minZ + .14, maxX, pad.maxX, 0, .72, m.concrete);
    else {
      wallZ(pad.minZ + .14, maxX, ridgeTrail.minX, 0, .72, m.concrete);
      wallZ(pad.minZ + .14, ridgeTrail.maxX, pad.maxX, 0, .72, m.concrete);
    }
    wallZ(pad.maxZ - .14, pad.minX, pad.maxX, 0, .72, m.concrete);
  }
  // Span the lower roads and rooflines on a steel deck supported at three open lots.
  const { minX: wx1, maxX: wx2, minZ: wz1, maxZ: wz2 } = annexWalk;
  const center = (wz1 + wz2) / 2;
  box(root, slate, wx2 - wx1, .26, wz2 - wz1, (wx1 + wx2) / 2, y - .13, center);
  solids.push({ min: [wx1, y - .26, wz1], max: [wx2, y, wz2], floor: true, walkSurface: true, surface: 'metal' });
  for (const x of [103, 134, 166]) solid([x, (y - .26) / 2, center], [.86, y - .26, 1.24], m.concrete, .06);
  for (const z of [wz1 + .13, wz2 - .13]) {
    wallZ(z, wx1, wx2, .78, .16, m.steel);
    for (let x = wx1; x + 3 <= wx2; x += 3) {
      strut(root, slate, new THREE.Vector3(x, y, z), new THREE.Vector3(x + 1.5, y + .80, z), .085);
      strut(root, slate, new THREE.Vector3(x + 1.5, y + .80, z), new THREE.Vector3(x + 3, y, z), .085);
    }
    solids.push({ min: [wx1, y, z - .08], max: [wx2, y + .94, z + .08] });
  }

  // Daylit corridor in front of two separately entered observation rooms.
  const { minX: ox1, maxX: ox2, minZ: oz1, maxZ: oz2 } = observationBuilding;
  box(root, linoleum, ox2 - ox1, .03, oz2 - oz1, 84, y + .018, -139.5);
  wallX(ox1, oz1, oz2, 0, 3.25, m.ceramic);
  wallX(ox2, oz1, oz2, 0, 3.25, m.ceramic);
  wallZ(oz2, ox1, ox2, 0, 3.25, m.ceramic);
  const glazedRuns = [[ox1, observationDoorX - 1.65], [observationDoorX + 1.65, ox2]] as const;
  for (const [left, right] of glazedRuns) {
    wallZ(oz1, left, right, 0, .74, jade);
    wallZ(oz1, left, right, .74, 1.72, pane);
    for (let x = left; x <= right; x += 2.15) wallZ(oz1, x, x + .10, .73, 1.75, m.zinc);
  }
  wallZ(oz1, ox1, ox2, 2.46, .79, jade);
  solid([84, y + 3.29, -139.5], [24.52, .22, 12.45], m.ceramic, .035);
  box(root, jade, 25.8, .18, 2.83, 84, y + 3.15, -145.72, .06);
  for (const x of [73.25, 77.65, 82.35, 95.0])
    solid([x, y + 1.57, -146.73], [.19, 3.14, .23], jade, .012);
  wallX(88.5, -140, oz2, 0, 3.15, m.ceramic);
  portal(-140, ox1, 88.5, 84, 2.55, 3.14, m.ceramic);
  portal(-140, 88.5, ox2, 93, 2.55, 3.14, m.ceramic);
  for (const [x, color] of [[79.4, jade], [89.5, slate]] as const) {
    solid([x, y + .40, -135.6], [1.34, .80, 2.8], color, .07);
    box(root, m.ceramic, 1.20, .15, 2.48, x, y + .85, -135.55, .052);
    box(root, m.zinc, 1.10, .18, .58, x, y + .96, -136.34, .075);
  }
  worktop(75.3, -142.5, 2.50, 1.02, jade);
  worktop(84, -135.4, 2.24, 1.06, jade);
  worktop(93, -135.4, 2.36, 1.10, slate);
  for (const [x, z] of [[77, -142.5], [86.6, -143], [84, -136.5], [93, -136.5]])
    fixture(x, z, 1.65, 3.02, 0xbcebf1);

  // A tall stack room, lower reading room and enclosed plant room form different roof volumes.
  const { minX: ax1, maxX: ax2, minZ: az1, maxZ: az2 } = archiveBuilding;
  box(root, floor, ax2 - ax1, .03, az2 - az1, 203.5, y + .018, -146.25);
  wallX(ax1, az1, -151.75, 0, 5.15, m.ceramic);
  wallX(ax1, -148.45, az2, 0, 5.15, m.ceramic);
  wallX(ax1, -151.75, -148.45, 2.51, 2.64, m.ceramic);
  wallZ(az2, ax1, 200.9, 0, 5.15, m.ceramic);
  wallZ(az2, 200.9, ax2, 0, 3.60, slate);
  portal(az1, ax1, 200.9, archiveDoorX, 3.50, 5.15, m.ceramic);
  wallZ(az1, 200.9, ax2, 0, .93, slate);
  wallZ(az1, 200.9, ax2, .93, 1.68, pane);
  wallZ(az1, 200.9, ax2, 2.61, .99, slate);
  for (const x of [201, 205.1, 209.2, 213.3, 217.4, 221.3])
    wallZ(az1, x, x + .13, .9, 1.75, bronze);
  wallX(ax2, az1, -152.9, 0, 3.60, slate);
  wallX(ax2, -150.1, az2, 0, 3.60, slate);
  wallX(ax2, -152.9, -150.1, 2.51, 1.09, slate);
  wallX(200.9, az1, az2, 3.60, 1.58, slate);
  solid([192.8, y + 5.15, -146.25], [16.2, .27, 18.15], slate, .05);
  solid([211.45, y + 3.62, -146.25], [21.32, .24, 17.99], m.steel, .042);
  box(root, slate, 14.5, .20, 2.2, 192.85, y + 5.72, -145.3, .06);
  for (const z of [-146.41, -144.19])
    box(root, jade, 14.45, .42, .075, 192.85, y + 5.44, z);
  box(root, bronze, 6.6, .20, 2.3, archiveDoorX, y + 2.75, -155.5, .07);
  wallZ(-148, 211.9, 215.95, 0, 3.47, m.steel);
  wallZ(-148, 218.85, ax2, 0, 3.47, m.steel);
  wallZ(-148, 215.95, 218.85, 2.48, .99, m.steel);
  wallX(211.9, -148, az2, 0, 3.47, m.steel);

  for (const [x, z, count] of [[187.4, -147.1, 3], [198.1, -143.3, 2]]) {
    solid([x, y + 1.50, z], [1.48, 3, 4.2], slate, .045);
    for (const dy of [.58, 1.24, 1.93, 2.58]) {
      box(root, m.zinc, 1.56, .08, 4.26, x, y + dy, z, .012);
      for (let i = 0; i < count; i++) {
        const tint = i % 2 ? m.ceramic : bronze;
        box(root, tint, 1.55, .44 + i * .055, .87, x, y + dy + .27, z + (i - 1) * 1.04, .025);
      }
    }
  }
  worktop(193, -140.2, 2.7, 1.19, slate);
  worktop(207, -148.3, 3.30, 1.22, bronze);
  for (const x of [204.1, 209.9])
    solid([x, y + .23, -147.48], [.88, .46, .84], bronze, .075);
  worktop(217.4, -140.8, 2.60, 1.14, m.steel);
  for (const z of [-145.3, -142.1, -139.7]) {
    solid([220.45, y + 1.24, z], [1.42, 2.48, 1.22], m.steel, .035);
    for (const dy of [.53, 1.12, 1.71, 2.23]) box(root, lamp, .035, .048, .42, 219.72, y + dy, z);
  }
  for (const [x, z, h] of [[192.5, -149, 4.94], [192.5, -141, 4.94], [206.5, -150.8, 3.40], [217.5, -143, 3.40]])
    fixture(x, z, 2.05, h, 0xc9d8fb);

  const crestY = ridgeCrest.height;
  const rock = new THREE.DodecahedronGeometry(1, 0);
  const rockFace = enamel(0x70838b);
  const rise = crestY - y;
  const depth = ridgeTrail.maxZ - ridgeTrail.minZ;
  for (const x of [ridgeTrail.minX + .20, ridgeTrail.maxX - .20]) {
    for (let i = 0; i < 12; i++) {
      const z = ridgeTrail.maxZ - i * depth / 12, end = z - depth / 12;
      const bottom = y + rise * i / 12, top = y + rise * (i + 1) / 12;
      strut(root, m.zinc, new THREE.Vector3(x, bottom + .91, z), new THREE.Vector3(x, top + .91, end), .08);
      box(root, m.steel, .12, .97, .14, x, bottom + .485, z);
      solids.push({ min: [x - .09, bottom, end], max: [x + .09, top + .95, z] });
      if (i < 2) continue;
      const stone = mesh(root, rock, i % 3 ? rockFace : slate, x + (i % 2 ? .85 : -.85), bottom * .59, z - 1.72);
      stone.scale.set(1.85 + i % 3 * .54, bottom * .44, 2.25 + i % 4 * .47);
      stone.rotation.y = i * .87;
    }
    solid([x, crestY + .41, -218], [.18, .82, 4], m.steel);
  }
  solid([216, crestY + .44, -219.65], [17.7, .88, .19], slate);
}
