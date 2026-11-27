import * as THREE from 'three';
import type { Vec3 } from '../contracts/demo.ts';
import { box, cylinder, mesh, strut } from './detail/geometry.ts';
import { emissive, enamel, type Materials } from './detail/materialLibrary.ts';
import {
  annexApproaches, annexWalk, archiveBuilding, archiveDoorX, archivePad, archiveStackEast, archiveStackRoof, archiveStair, archiveUpperY,
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
  function worktop(x: number, z: number, width: number, depth: number, material: THREE.Material, base = y) {
    solid([x, base + .51, z], [width, 1.02, depth], material, .06);
    box(root, m.zinc, width + .06, .055, depth + .06, x, base + 1.0275, z, .02);
    for (const dx of [-width / 3, 0, width / 3])
      box(root, m.steel, .26, .066, .064, x + dx, base + .75, z + depth / 2, .02);
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

  // A two-storey stack block and lower reading and equipment wing have separate rooflines.
  const { minX: ax1, maxX: ax2, minZ: az1, maxZ: az2 } = archiveBuilding;
  const upper = archiveUpperY - y;
  const roof = archiveStackRoof;
  box(root, floor, ax2 - ax1, .03, az2 - az1, 203.5, y + .018, -146.25);
  wallX(ax1, az1, -151.75, 0, upper, m.ceramic);
  wallX(ax1, -148.45, az2, 0, upper, m.ceramic);
  wallX(ax1, -151.75, -148.45, 2.51, upper - 2.51, m.ceramic);
  wallX(ax1, az1, az2, upper, .92, slate);
  wallX(ax1, az1, az2, upper + .92, 1.62, pane);
  wallX(ax1, az1, az2, upper + 2.54, roof - upper - 2.54, m.ceramic);
  for (const z of [-153.8, -150.5, -147.1, -143.8, -140.4])
    box(root, bronze, .28, 1.72, .13, ax1, archiveUpperY + 1.71, z);
  wallZ(az2, ax1, archiveStackEast, 0, upper + .88, m.ceramic);
  wallZ(az2, ax1, archiveStackEast, upper + .88, 1.65, pane);
  wallZ(az2, ax1, archiveStackEast, upper + 2.53, roof - upper - 2.53, slate);
  wallZ(az2, archiveStackEast, ax2, 0, 3.60, slate);
  portal(az1, ax1, archiveStackEast, archiveDoorX, 3.50, roof, m.ceramic);
  wallZ(az1, archiveStackEast, ax2, 0, .93, slate);
  wallZ(az1, archiveStackEast, ax2, .93, 1.68, pane);
  wallZ(az1, archiveStackEast, ax2, 2.61, .99, slate);
  for (const x of [201, 205.1, 209.2, 213.3, 217.4, 221.3])
    box(root,bronze,.13,1.75,.28,x+.065,y+1.775,az1);
  wallX(ax2, az1, -152.9, 0, 3.60, slate);
  wallX(ax2, -150.1, az2, 0, 3.60, slate);
  wallX(ax2, -152.9, -150.1, 2.51, 1.09, slate);
  wallX(archiveStackEast, az1, az2, 3.60, roof - 3.60, slate);
  solid([192.8, y + roof, -146.25], [16.2, .27, 18.15], slate, .05);
  const roofWest = archiveStackEast + .025, roofEast = ax2 + .11;
  solid([(roofWest+roofEast)/2, y + 3.62, -146.25], [roofEast-roofWest, .24, 17.99], m.steel, .042);
  box(root, slate, 14.5, .20, 2.2, 192.85, y + roof + .57, -145.3, .06);
  for (const z of [-146.41, -144.19])
    box(root, jade, 14.45, .42, .075, 192.85, y + roof + .29, z);
  box(root, bronze, 6.6, .20, 2.3, archiveDoorX, y + 2.75, -155.5, .07);
  wallZ(-148, 211.9, 215.95, 0, 3.47, m.steel);
  wallZ(-148, 218.85, ax2, 0, 3.47, m.steel);
  wallZ(-148, 215.95, 218.85, 2.48, .99, m.steel);
  wallX(211.9, -148, az2, 0, 3.47, m.steel);

  for (const [x, z, count] of [[187.4, -147.1, 3], [196.9, -145, 2]]) {
    solid([x, y + 1.44, z], [1.48, 2.88, 4.2], slate, .045);
    for (const dy of [.58, 1.24, 1.93, 2.39]) {
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
  for (const [x, z, h] of [[192.5, -149, 2.79], [192.5, -141, 2.79], [206.5, -150.8, 3.40], [217.5, -143, 3.40]])
    fixture(x, z, 2.05, h, 0xc9d8fb);

  // The separate review room and drawing room open off the upstairs landing.
  const { x: stairX, width, topZ, footZ } = archiveStair;
  const wellEdge = 197.87;
  function upperDeck(x1: number, x2: number, z1: number, z2: number) {
    box(root, slate, x2 - x1, .24, z2 - z1, (x1 + x2) / 2, archiveUpperY - .12, (z1 + z2) / 2);
    solids.push({ min: [x1, archiveUpperY - .24, z1], max: [x2, archiveUpperY, z2], floor: true, walkSurface: true, surface: 'metal' });
  }
  upperDeck(ax1 + .12, wellEdge, az1 + .12, az2 - .12);
  upperDeck(wellEdge, archiveStackEast - .12, az1 + .12, topZ);
  upperDeck(wellEdge, archiveStackEast - .12, footZ, az2 - .12);
  const run = topZ - footZ;
  solids.push({
    min: [stairX - width / 2, -.145, topZ], max: [stairX + width / 2, 0, footZ],
    floor: true, walkSurface: true, surface: 'metal',
    slope: { axis: 2, start: footZ, height: y, gradient: upper / run },
  });
  const treads = Math.ceil(upper / .176);
  for (let i = 0; i < treads; i++) {
    const t = (i + .5) / treads;
    box(root, m.zinc, width, .14, -run / treads + .01, stairX, y + upper * t - .07, footZ + run * t);
    box(root, jade, width - .13, .019, .09, stairX, y + upper * t + .009, footZ + run * t + .14);
  }
  for (const px of [stairX - width / 2, stairX + width / 2]) {
    strut(root, jade, new THREE.Vector3(px, y + .94, footZ), new THREE.Vector3(px, archiveUpperY + .94, topZ), .08);
    for (const t of [0, .25, .5, .75, 1])
      solid([px, y + upper * t + .45, footZ + run * t], [.08, .90, .08], m.steel);
  }
  wallX(wellEdge, topZ, footZ, upper, 1.02, pane);
  wallZ(footZ, wellEdge, archiveStackEast, upper, 1.02, pane);
  box(root, bronze, .265, .075, -run, wellEdge, archiveUpperY + 1.03, (footZ + topZ) / 2);
  wallZ(-148.35, ax1, 193.18, upper, 2.98, m.ceramic);
  wallZ(-148.35, 195.63, wellEdge, upper, 2.98, m.ceramic);
  wallZ(-148.35, 193.18, 195.63, upper + 2.42, .56, slate);
  worktop(190.35, -152.8, 3.65, .88, jade, archiveUpperY);
  for (const x of [189.17, 191.53]) {
    box(root, m.rubber, .81, .46, .13, x, archiveUpperY + 1.34, -153.04, .028);
    box(root, lamp, .68, .26, .021, x, archiveUpperY + 1.37, -152.969);
  }
  worktop(187.9, -141.6, 2.55, 1.08, slate, archiveUpperY);
  solid([193.1, archiveUpperY + .43, -140.2], [3.74, .86, 1.62], bronze, .055);
  box(root, m.ceramic, 2.26, .036, .99, 193.4, archiveUpperY + .88, -140.24, .012);
  for (const dx of [-.55, .12, .56])
    box(root, jade, .073, .018, .74, 193.4 + dx, archiveUpperY + .905, -140.24);
  // Staged review files and the separate drawing-room flat-file cabinet occupy the perimeter.
  for (const [x,z,width,depth] of [[186.05,-151.59,1.19,2.07],[196.64,-139.29,1.23,1.12]]) {
    solid([x,archiveUpperY+.98,z],[width,1.96,depth],slate,.045);
    for (const level of [.41,.99,1.56]) {
      box(root,m.zinc,.079,.10,depth-.16,x+width/2+.021,archiveUpperY+level,z,.018);
      box(root,bronze,.039,.075,.35,x+width/2+.077,archiveUpperY+level+.018,z,.012);
    }
  }
  for (const z of [-140.56,-140.26,-139.97]) {
    const roll=cylinder(root,m.ceramic,.065,.51,192.52,archiveUpperY+.99,z,10);
    roll.rotation.z=Math.PI/2;
    const band=cylinder(root,bronze,.071,.038,192.60,archiveUpperY+.99,z,10);
    band.rotation.z=Math.PI/2;
  }
  for (const [x, z] of [[190.7, -152.1], [191.1, -144.2], [196.1, -151.5]])
    fixture(x, z, 2.35, upper + 2.85, 0xd2eff3);

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
