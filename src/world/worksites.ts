import * as THREE from 'three';
import type { Vec3 } from '../contracts/demo.ts';
import { box, cable, cylinder, strut } from './detail/geometry.ts';
import { emissive, enamel, type Materials } from './detail/materialLibrary.ts';
import { portHauler } from './detail/portHauler.ts';
import { servicePosition } from './layout.ts';
import type { Solid } from './worldQueries.ts';
import {
  controlAnnex, controlMain, controlStair, drainChannel, drainCrossings, logisticsOffice,
  officeStair, repairShop, sortingHall, sortingStair, vehicleCourt,
} from './worksitePlan.ts';

type Builder = (at: Vec3, size: Vec3, material: THREE.Material, bevel?: number) => THREE.Mesh;

export function buildWorksites(root: THREE.Group, m: Materials, solids: Solid[], solid: Builder) {
  const teal = enamel(0x3f7f7b), blue = enamel(0x4d6385), slate = enamel(0x526078);
  const amber = enamel(0xa97551), cream = enamel(0xe0d8c1), dark = m.rubber;
  const glass = new THREE.MeshStandardMaterial({ color: 0x8ad0df, transparent: true, opacity: .24, depthWrite: false, roughness: .29 });
  const indicator = emissive(0xa4eed7, .55);
  const liquid = new THREE.MeshStandardMaterial({ color: 0x3b8886, roughness: .23, metalness: .26 });
  const railPosts = new Set<string>();

  function wallX(x: number, z1: number, z2: number, bottom: number, top: number, material: THREE.Material) {
    solid([x, (bottom + top) / 2, (z1 + z2) / 2], [.24, top - bottom, z2 - z1], material, .014);
  }
  function wallZ(z: number, x1: number, x2: number, bottom: number, top: number, material: THREE.Material) {
    solid([(x1 + x2) / 2, (bottom + top) / 2, z], [x2 - x1, top - bottom, .24], material, .014);
  }
  function portalX(x: number, north: number, south: number, middle: number, width: number, height: number, head: number, material: THREE.Material) {
    const left = middle - width / 2, right = middle + width / 2;
    wallX(x, north, left, 0, height, material);
    wallX(x, right, south, 0, height, material);
    wallX(x, left, right, head, height, material);
  }
  function portalZ(z: number, west: number, east: number, middle: number, width: number, height: number, head: number, material: THREE.Material) {
    const left = middle - width / 2, right = middle + width / 2;
    wallZ(z, west, left, 0, height, material);
    wallZ(z, right, east, 0, height, material);
    wallZ(z, left, right, head, height, material);
  }
  function deck(x1: number, x2: number, z1: number, z2: number, top: number, material = m.steel) {
    box(root, material, x2 - x1, .24, z2 - z1, (x1 + x2) / 2, top - .12, (z1 + z2) / 2);
    solids.push({ min: [x1, top - .24, z1], max: [x2, top, z2], floor: true, walkSurface: true, surface: 'metal' });
  }
  function handrail(x1: number, z1: number, x2: number, z2: number, base: number) {
    const length = Math.hypot(x2 - x1, z2 - z1);
    if (length <= .05) return;
    const lines = Math.ceil(length / 2.2);
    solid([(x1 + x2) / 2, base + .53, (z1 + z2) / 2],
      [Math.abs(x2 - x1) + .07, 1.06, Math.abs(z2 - z1) + .07], glass, .009);
    box(root, m.zinc, Math.abs(x2 - x1) + .13, .09, Math.abs(z2 - z1) + .13, (x1 + x2) / 2, base + 1.08, (z1 + z2) / 2);
    for (let i = 0; i <= lines; i++) {
      const x=x1+(x2-x1)*i/lines, z=z1+(z2-z1)*i/lines;
      const key=[x,base,z].map(n=>n.toFixed(4)).join('/');
      if(railPosts.has(key))continue;
      railPosts.add(key);
      box(root,m.steel,.10,1.04,.10,x,base+.54,z);
    }
  }
  function stair({ x, footZ, topZ, width, rise }: typeof officeStair, finish = m.zinc) {
    const run = topZ - footZ;
    solids.push({ min: [x - width / 2, -.16, Math.min(footZ, topZ)], max: [x + width / 2, 0, Math.max(footZ, topZ)],
      floor: true, walkSurface: true, surface: 'metal', slope: { axis: 2, start: footZ, height: 0, gradient: rise / run } });
    const steps = Math.ceil(rise / .176);
    for (let i = 0; i < steps; i++) {
      const t = (i + .5) / steps;
      box(root, finish, width, .14, Math.abs(run) / steps + .01, x, rise * t - .07, footZ + run * t);
      box(root, m.safety, width - .10, .022, .05, x, rise * t + .013, footZ + run * t);
    }
    for (const px of [x - width / 2, x + width / 2]) {
      strut(root, m.steel, new THREE.Vector3(px, .92, footZ), new THREE.Vector3(px, rise + .92, topZ), .076);
      for (const t of [0, .25, .5, .75, 1]) solid([px, rise * t + .46, footZ + run * t], [.08, .92, .08], m.zinc);
    }
  }
  function table(x: number, z: number, width: number, depth: number, y: number, material: THREE.Material) {
    solid([x, y + .51, z], [width, 1.02, depth], material, .05);
    box(root, m.zinc, width + .09, .065, depth + .08, x, y + 1.047, z, .02);
    for (const dx of [-.32, .32]) box(root, m.steel, .26, .063, .055, x + dx * width, y + .74, z + depth / 2);
  }
  function screen(x: number, y: number, z: number, width: number) {
    box(root, dark, width, .65, .12, x, y, z, .037);
    box(root, indicator, width - .15, .32, .024, x, y + .057, z + .074, .018);
    for (const dx of [-.19, 0, .19]) box(root, m.zinc, .055, .031, .021, x + width * dx, y - .238, z + .08);
  }
  function luminaire(x: number, y: number, z: number, color: number, intensity = 48) {
    box(root, m.steel, 2.34, .12, .23, x, y, z);
    box(root, indicator, 2.12, .047, .16, x, y - .07, z);
    const light = new THREE.PointLight(color, intensity, 12.6, 2);
    light.position.set(x, y - .24, z);
    root.add(light);
  }

  // C3: parcel intake feeds two process lanes beside a clear cross-dock aisle.
  {
    const { minX: west, maxX: east, minZ: north, maxZ: south } = sortingHall;
    for (const x of [west, east]) {
      wallX(x, north, south, 0, 2.30, m.concrete);
      wallX(x, north, south, 2.30, 4.55, glass);
      wallX(x, north, south, 4.55, 6.18, teal);
      for (const z of [-15, -9, -3, 3, 9, 15, 21]) solid([x, 3.1, z], [.36, 6.2, .23], m.steel);
    }
    for (const z of [north, south]) {
      portalZ(z, west, east, -78, 7.8, 6.35, 4.45, teal);
      box(root, amber, 9.3, .23, 2.52, -78, 4.64, z + Math.sign(z - 3) * .78, .048);
    }
    solid([-78,6.45,1.7],[32.55,.26,41.16],m.steel,.027);
    for (const z of [-12, 1.7, 15.4]) {
      const roof = box(root, teal, 33, .18, 14.2, -78, 7.45, z, .024);
      roof.rotation.x = -.12;
      box(root, glass, 31.5, 1.25, .24, -78, 7.06, z + 6.82, .022);
      luminaire(-78, 5.96, z, 0xc3f8dc, 75);
    }
    for (const x of [-81.85, -74.15]) box(root, m.safety, .13, .021, 39, x, .029, 3);
    table(-84, -12.7, 3.25, 1.14, 0, teal);
    table(-70.9, -8.3, 2.15, 1.05, 0, blue);
    screen(-70.9, 1.35, -8.68, 1.26);
    table(-87.2, 14.8, 2.18, 1.24, 0, amber);
    for (const z of [13.7, 16.1, 19]) {
      solid([-91.4, .76, z], [2.25, 1.52, 1.68], m.steel, .044);
      for (const h of [.35, .72, 1.22]) box(root, amber, .075, .08, 1.56, -90.26, h, z);
    }
    for (const [x, z, length] of [[-87.8, -1.1, 10.1], [-70.9, 5.7, 13.2]]) {
      solid([x, .59, z], [1.85, .22, length], blue, .055);
      for (const dz of [-length * .36, length * .36]) solid([x, .27, z + dz], [1.69, .54, .21], m.steel);
      for (let dz = -length / 2 + .21; dz < length / 2 - .12; dz += .31) {
        const roller = cylinder(root, m.zinc, .084, 1.72, x, .76, z + dz, 12);
        roller.rotation.z = Math.PI / 2;
      }
      for (const dx of [-.98, .98]) solid([x + dx, 1.11, z], [.18, 2.22, .54], teal, .065);
      box(root, teal, 2.26, .36, .52, x, 2.14, z, .04);
      box(root, indicator, 1.53, .07, .19, x, 1.93, z);
    }
    const loft = sortingStair.rise;
    stair(sortingStair);
    deck(-66.35, -63.65, sortingStair.topZ, 18.55, loft);
    deck(-91, -66.35, 15.2, 18.55, loft);
    handrail(-66.35, 2, -66.35, 15.2, loft);
    handrail(-91, 15.25, -66.35, 15.25, loft);
    handrail(-91, 18.48, -63.72, 18.48, loft);
    handrail(-90.95, 15.25, -90.95, 18.48, loft);
    table(-87, 16.8, 1.94, .76, loft, teal);
    const supportHeight = loft - .24;
    for (const x of [-90.4, -81.6, -71.7, -64]) for (const z of [15.45, 18.35])
      solid([x, supportHeight / 2, z], [.19, supportHeight, .22], m.steel);
  }

  // C4: street-level reception and records flank a straight public lobby.
  // Staff use a separate internal stair to the duty desk and break room.
  {
    const { minX: west, maxX: east, minZ: north, maxZ: south } = logisticsOffice;
    const upper = officeStair.rise;
    for (const x of [west, east]) {
      wallX(x, north, south, 0, upper, cream);
      wallX(x, north, south, upper, upper + .75, blue);
      wallX(x, north, south, upper + .75, upper + 2.40, glass);
      wallX(x, north, south, upper + 2.40, 6.60, cream);
      for (const z of [-23.3, -19.6, -15.9, -12.2, -8.5]) box(root, slate, .17, 1.74, .16, x, upper + 1.59, z);
    }
    for (const z of [north, south]) {
      portalZ(z, west, east, 12.3, 3.2, upper, 2.52, cream);
      wallZ(z, west, east, upper, upper + 2.77, z === south ? glass : blue);
      box(root, blue, 6.1, .23, 2.02, 12.3, 2.73, z + Math.sign(z + 16) * .61, .05);
    }
    solid([12.0, 6.52, -16], [19.63, .37, 18.85], blue, .05);
    box(root, slate, 8.2, .43, 11.8, 8.4, 6.91, -19.2, .09);
    box(root, teal, 7.95, .04, 17.8, 12.1, .035, -16);

    wallZ(-16.1, west, 9.8, 0, 3.06, cream);
    for (const [north, south, door] of [[-25, -16.1, -20.9], [-16.1, -7, -11.3]]) {
      portalX(9.8, north, south, door, 2.22, 3.06, 2.42, cream);
    }
    table(5.8, -10.6, 3.1, 1.10, 0, teal);
    table(5.3, -22.45, 2.6, 1.02, 0, blue);
    box(root,slate,.46,.34,.14,6.91,1.25,-10.89,.035);
    box(root,indicator,.34,.17,.018,6.91,1.27,-10.811,.013);
    for (const [x,z] of [[4.31,-10.83],[4.64,-22.73],[4.98,-22.8]]) {
      box(root,cream,.24,.037,.19,x,1.098,z,.015);
      box(root,blue,.19,.024,.15,x,1.128,z,.011);
    }
    solid([20.65,.42,-15.9],[.67,.84,2.88],m.timber,.047);
    for (const z of [-16.98,-15.91,-14.86]) {
      box(root,cream,.42,.24,.53,20.65,.965,z,.045);
      box(root,teal,.26,.061,.032,20.65,1.011,z+.271,.01);
    }
    for (const z of [-23.5, -19.1]) {
      solid([3.46, 1.12, z], [1.05, 2.24, 1.9], blue, .045);
      for (const y of [.42, 1.03, 1.70]) box(root, cream, .06, .20, 1.65, 4.01, y, z);
    }
    solid([15.18, .45, -22.15], [2.06, .90, 3.16], m.timber, .085);
    for (const z of [-23.4, -21.05]) solid([13.62, .25, z], [.68, .50, .72], slate, .05);
    wallX(13.17, -24.75, -20.42, 0, 2.93, glass);
    wallX(17.15, -24.75, -20.42, 0, 2.93, cream);
    box(root, glass, 2.88, .092, .77, 15.15, .948, -22.15);
    box(root, slate, 2.78, 1.17, .11, 15.12, 1.93, -24.73);

    deck(west + .13, 17.10, north + .13, south - .13, upper, m.timber);
    deck(17.10, east - .13, north + .13, officeStair.topZ, upper, m.timber);
    deck(17.10, east - .13, officeStair.footZ, south - .13, upper, m.timber);
    stair(officeStair);
    handrail(17.15, officeStair.topZ, 17.15, officeStair.footZ, upper);
    handrail(17.15, officeStair.footZ + .02, east - .13, officeStair.footZ + .02, upper);
    table(8.35, -22.5, 2.78, 1.21, upper, blue);
    screen(8.35, upper + 1.45, -22.94, 1.43);
    table(5.85, -12.15, 2.62, 1.02, upper, teal);
    box(root,slate,.55,.21,.29,6.69,upper+1.184,-12.38,.048);
    cylinder(root,cream,.087,.13,5.11,upper+1.15,-12.24,12);
    for (const z of [-17.83,-18.65,-19.47])
      box(root,blue,.64,.16,.67,4.13,upper+.795,z,.044);
    wallZ(-16.30, west + .13, 7.17, upper, 6.28, cream);
    wallZ(-16.30, 9.53, 17.10, upper, upper + .79, blue);
    wallZ(-16.30, 9.53, 17.10, upper + .79, upper + 2.45, glass);
    wallZ(-16.30, 7.17, 9.53, upper + 2.37, 6.28, blue);
    solid([4.1, upper + .38, -18.65], [1.25, .76, 2.6], cream, .10);
    solid([7.1, upper + .27, -17.85], [1.57, .54, 1.11], m.timber, .06);
    for (const [x, y, z] of [[6.9, 2.92, -11.4], [6.9, 2.92, -22.0], [7.5, 6.1, -21.5], [7.5, 6.1, -12.3], [13, 6.1, -17.4]])
      luminaire(x, y, z, 0xffdfb8);
  }

  // C5: two different lay-bys and a dispatch canopy leave the through lane open.
  {
    const { minX, maxX, minZ, maxZ } = vehicleCourt;
    box(root, slate, maxX - minX, .038, maxZ - minZ, -41, .028, -12);
    for (const z of [-14.4, -8.65]) box(root, cream, 31.7, .019, .13, -41, .056, z);
    for (const x of [-53, -47, -41, -35, -29]) box(root, m.safety, 3.2, .024, .12, x, .058, -11.55);
    for (const [x, z, load] of [[-48.7, -5.15, 'freight'], [-36.25, -5.45, 'cells']] as const) {
      const vehicle = portHauler(m, load);
      vehicle.position.set(x, 0, z);
      root.add(vehicle);
      solids.push({ min: [x - 3.11, 0, z - 1.14], max: [x + 3.11, 1.08, z + 1.14] });
      solids.push({ min: [x + .82, 1.08, z - .98], max: [x + 3.07, 2.43, z + .98] });
      for (const dz of [-1.62, 1.62]) box(root, cream, 8.5, .021, .085, x, .057, z + dz);
    }
    for (const x of [-34.1, -28.8]) for (const z of [-21.35, -16.40]) solid([x, 1.64, z], [.21, 3.28, .23], m.steel);
    const roof = box(root, teal, 6.36, .20, 5.75, -31.45, 3.41, -18.85, .057);
    roof.rotation.x = .13;
    table(-31.4, -18.75, 2.55, 1.12, 0, blue);
    for (const [x, z] of [[-51.15, -19.05], [-30.1, -5.35]]) {
      solid([x, .08, z], [1.62, .16, 1.09], m.timber, .032);
      for (const dx of [-.55, .55]) box(root, m.steel, .07, .041, .95, x + dx, .17, z);
    }
    luminaire(-31.45, 3.16, -18.85, 0xffdfb8);
  }

  // E1: wide repair bays, a crane rail and service cages replace the general-goods interior.
  {
    const { minX: west, maxX: east, minZ: north, maxZ: south } = repairShop;
    for (const x of [west, east]) wallX(x, north, south, 0, 6.57, x < 90 ? blue : cream);
    for (const z of [north, south]) portalZ(z, west, east, 90, 8.25, 6.57, 4.45, blue);
    solid([90, 6.54, -32], [32.45, .25, 36.45], slate, .03);
    const roof = box(root, amber, 32.7, .24, 37.0, 90, 7.02, -32, .045);
    roof.rotation.z = -.065;
    box(root, glass, .23, 1.32, 35.8, 74.24, 6.87, -32, .025);
    table(83.6, -47.7, 2.55, 1.17, 0, blue);
    table(81, -27.0, 2.14, 1.1, 0, amber);
    for (const x of [78.2, 82.5]) solid([x, 1.46, -29.5], [.48, 2.92, .54], amber);
    solid([80.35, 2.81, -29.5], [4.9, .51, .90], amber, .08);
    cylinder(root, m.zinc, .34, .99, 80.35, 2.08, -29.5, 16);
    solid([80.35, .33, -29.5], [3.7, .66, 2.1], m.steel, .05);
    for (const z of [-34.50, -18.9]) {
      solid([77.3, 1.04, z], [2.02, 2.08, 2.52], blue, .05);
      for (const i of [.48, .95, 1.50]) box(root, m.zinc, .13, .085, 2.44, 78.33, i, z);
    }
    for (const z of [-41.5,-28,-21]) luminaire(89.5,5.88,z,0xffd3ab,65);
  }

  // E2: recessed containment with two supported crossings feeds the separate filter court.
  {
    const { minX: west, maxX: east, minZ: north, maxZ: south, height } = drainChannel;
    box(root, liquid, east - west - .24, .037, south - north - .21, (west + east) / 2, height + .29, (north + south) / 2);
    for (const [z, material] of [[north, m.steel], [south, m.concrete]] as const) wallZ(z, west, east, height, -.04, material);
    for (const x of [west, east]) {
      wallX(x, north, south, height, -.04, m.concrete);
      handrail(x, north, x, drainCrossings[0].minZ, 0);
      handrail(x, drainCrossings[0].maxZ, x, drainCrossings[1].minZ, 0);
      handrail(x, drainCrossings[1].maxZ, x, south, 0);
    }
    for (const {minX,maxX,minZ,maxZ} of drainCrossings) {
      deck(minX, maxX, minZ, maxZ, 0, m.zinc);
      handrail(minX, minZ + .05, maxX, minZ + .05, 0);
      handrail(minX, maxZ - .05, maxX, maxZ - .05, 0);
    }
    wallZ(-8.35, 121.1, 128.3, 0, .73, m.concrete);
    wallZ(-2.45, 121.1, 128.3, 0, .73, m.concrete);
    for (const x of [121.12, 128.26]) wallX(x, -8.35, -2.45, 0, .73, m.concrete);
    box(root, liquid, 6.9, .055, 5.64, 124.7, .087, -5.4);
    for (const z of [-7.0, -5.5, -4.0]) {
      box(root, m.zinc, 6.53, .09, .16, 124.7, .74, z);
      cylinder(root, m.steel, .39, .60, 125, .63, z, 12);
    }
    table(130.5, -5.3, 2.32, 1.23, 0, teal);
    for (const z of [-39, -37.7]) cable(root, amber, [[143,4.14,z],[154,4.14,z],[154,-.38,z],[156.8,-.38,z]], .14);
  }

  // E4: a glazed observation wing overlooks the treatment plant, with a lower equipment annex.
  {
    const { minX: west, maxX: join, minZ: north, maxZ: south } = controlMain;
    const east = controlAnnex.maxX;
    const upper = controlStair.rise;
    portalX(west, north, south, -26, 3.6, upper, 2.74, cream);
    portalX(east, north, controlAnnex.maxZ, -26, 3.2, 3.55, 2.63, blue);
    wallZ(north, west, join, 0, 6.94, slate);
    wallZ(north, join, east, 0, 3.55, blue);
    wallZ(south, west, join, 0, 6.94, cream);
    wallZ(controlAnnex.maxZ, join, east, 0, 3.55, blue);
    wallX(join, controlAnnex.maxZ, south, 0, upper, slate);
    wallX(join, north, south, upper, 6.94, slate);
    wallX(west, north, south, upper, upper + .72, slate);
    wallX(west, north, south, upper + .72, upper + 2.68, glass);
    wallX(west, north, south, upper + 2.68, 6.94, cream);
    for (const z of [-34.6, -31.1, -27.6, -24.1, -20.6, -17.1])
      box(root, slate, .39, 2.04, .19, west, upper + 1.69, z);
    solid([193.95, 7.03, -26], [20.76, .28, 20.64], slate, .045);
    solid([207.6, 3.65, -29], [7.55, .25, 14.65], blue, .046);
    box(root, amber, 2.54, .24, 7.58, 183.65, 2.99, -26, .075);
    box(root, cream, 8.35, .17, 12.8, 188.60, 7.40, -28, .059);
    for (const z of [-32.7, -29.85, -26.95, -24.05])
      box(root, blue, 6.55, .14, .32, 188.86, 7.57, z, .037);

    wallX(193.0, north, -30.25, 0, 3.43, glass);
    wallX(193.0, -22.05, south, 0, 3.43, slate);
    wallZ(-30.05, 204.11, 206.17, 0, 3.47, blue);
    wallZ(-30.05, 209.20, east, 0, 3.47, blue);
    wallZ(-30.05, 206.17, 209.20, 2.58, 3.47, blue);
    table(188.9, -33.8, 2.62, 1.18, 0, blue);
    table(197.5, -33, 3.58, 1.15, 0, teal);
    for (const x of [196.43, 197.5, 198.57]) screen(x, 1.43, -33.31, .87);
    table(208.1, -33.2, 2.76, 1.15, 0, slate);
    for (const z of [-34.4, -31.9]) {
      solid([209.92, 1.10, z], [1.15, 2.20, 1.52], m.steel, .055);
      for (const y of [.42, .71, 1.02, 1.34, 1.66]) box(root, indicator, .08, .045, .79, 209.33, y, z);
    }
    for (const x of [186.2, 189.8]) solid([x, .42, -19.45], [2.15, .84, 1.25], teal, .095);
    wallZ(-22.4, west, 188.6, 0, 2.88, glass);
    table(191.30, -21.10, 1.85, .92, 0, amber);
    screen(191.3, 1.35, -21.43, .81);

    deck(west + .13, 199.55, north + .13, south - .13, upper, slate);
    deck(199.55, join - .13, north + .13, controlStair.topZ, upper, slate);
    deck(199.55, join - .13, controlStair.footZ, south - .13, upper, slate);
    stair(controlStair, slate);
    handrail(199.59, controlStair.topZ, 199.59, controlStair.footZ, upper);
    handrail(199.59, controlStair.footZ + .05, join - .13, controlStair.footZ + .05, upper);
    table(187.3, -27.2, 1.68, 2.47, upper, teal);
    for (const z of [-28.05, -26.35]) box(root, blue, .19, .55, 1.19, 186.75, upper + 1.32, z, .04);
    solid([190.8, upper + .44, -30.9], [3.08, .88, 1.02], blue, .09);
    solid([189.6, upper + .27, -22.2], [2.03, .54, 1.14], m.timber, .06);
    for (const [x,y,z] of [[188.3,3.16,-33],[197.5,3.18,-33],[208.0,3.22,-32],[189.5,6.52,-27],[195,6.52,-20.3]])
      luminaire(x, y, z, 0xc9eaf9, 57);
  }

  // The conditional exit is a recessed inspection bay, with its original ring between the bollards.
  {
    const [x,,z] = servicePosition;
    for (const dz of [-3.18, 3.18]) {
      for (const dx of [-2.10, 2.10]) solid([x + dx, 1.55, z + dz], [.31, 3.10, .32], m.steel);
      solid([x + .34, .31, z + dz], [5.52, .62, .51], m.concrete, .07);
    }
    solid([x, 3.24, z], [6.35, .26, 7.18], amber, .07);
    solid([x + 2.99, 1.40, z], [.28, 2.8, 5.45], slate, .055);
    for (const dz of [-1.8, 0, 1.8]) box(root, m.zinc, .095, 2.02, 1.25, x + 2.81, 1.34, z + dz);
    for (const dz of [-2.27, 2.27]) box(root, m.safety, 4.90, .022, .11, x - .09, .031, z + dz);
    luminaire(x - .15, 2.99, z, 0xffd6a4);
  }
}
