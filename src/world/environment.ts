import * as THREE from 'three';
import { siteInteractions, supplySites } from './supplySites.ts';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { MapInteraction, Vec3 } from '../contracts/demo.ts';
import { box, cable, cylinder, label, mesh, strut } from './detail/geometry.ts';
import { createMaterialLibrary, enamel, paving, emissive } from './detail/materialLibrary.ts';
import { createShippingContainer, foldedSheet } from './detail/createShippingContainer.ts';
import { buildPortBlocks } from './portBlocks.ts';
import { addArcology } from './arcology.ts';
import { portHauler } from './detail/portHauler.ts';
import { buildRoads } from './roads.ts';
import {
  dock, dockRamp, dockSlope, factory, factoryRamp, factorySlope, lab,
  ramp, rampSlope, slopeHeight, type Slope, type Solid,
} from './worldQueries.ts';

import { addDistrictDetails, addPortHorizon } from './districtDetails.ts';
import { districtOffsets, districtPoint, districtForInteraction, highwayPosition, servicePosition, type District } from './layout.ts';

const v = (p: Vec3) => new THREE.Vector3(...p);

const localInteractions: readonly MapInteraction[] = [
  { id: 'duty-card', label: '值班室文件盒', position: [-9, 1.12, 13.0], kind: 'loot', item: 'service-card', quantity: 1 },
  { id: 'yard-ammo', label: '储备物资箱', position: [-21, 1.13, 28.2], kind: 'loot', item: 'pistol-ammo', quantity: 6 },
  { id: 'yard-medkit', label: '应急储物箱', position: [-42.8, .32, 21], kind: 'loot', item: 'medkit', quantity: 1 },
  { id: 'yard-salvage', label: '装卸维修箱', position: [-37, .25, -9], kind: 'loot', item: 'salvage', quantity: 2 },
  { id: 'factory-salvage', label: '平台维修箱', position: [37, 4.33, -9], kind: 'loot', item: 'salvage', quantity: 3 },
  { id: 'lab-power-panel', label: '实验室配电柜', position: [-4, -4.05, -38.7], kind: 'switch', flag: 'lab-power' },
  { id: 'lab-research', label: '低温保存柜', position: [7.2, -4.25, -38.4], kind: 'loot', item: 'research-sample', quantity: 3 },
  { id: 'factory-ammo', label: '储备物资箱', position: [35, 1.13, 21], kind: 'loot', item: 'pistol-ammo', quantity: 12 },
  { id: 'lab-medkit', label: '应急储物箱', position: [22, -4.25, -24], kind: 'loot', item: 'medkit', quantity: 1 },
];

export const mapInteractions: readonly MapInteraction[] = [
  ...siteInteractions,
  ...localInteractions.map(target => ({ ...target, position: districtPoint(districtForInteraction(target.id), target.position) })),
  { id: 'plant-workshop', label: '厂区维修箱', kind: 'loot', item: 'salvage', quantity: 2, position: [83.6,1.12,-47.7] },
  { id: 'research-office', label: '研究后勤箱', kind: 'loot', item: 'medkit', quantity: 1, position: [1,1.12,-122.7] },
  { id: 'quarantine-samples', label: '隔离保存柜', kind: 'loot', item: 'research-sample', quantity: 1, position: [78.2,1.12,-167.7] },
  { id: 'transit-tools', label: '转运仓工具箱', kind: 'loot', item: 'salvage', quantity: 2, position: [-84,1.12,-12.7] },
  { id: 'workshop-supplies', label: '工棚应急箱', kind: 'loot', item: 'medkit', quantity: 1, position: [-42,1.12,2.3] },
];

export function createEnvironment() {
  const scene = new THREE.Group();
  scene.name = '盐港隔离区';
  const solids: Solid[] = [];
  const m = createMaterialLibrary();
  const painted = enamel(0x357c97);
  const offwhite = enamel(0xe2ebeb);
  const rust = enamel(0xf46e5c);
  const groundMaterial = paving(0x96a6bf);
  const yellow = m.safety;
  const dark = m.rubber;
  const allStatic = new THREE.Group();
  scene.add(allStatic);
  let staticRoot = allStatic;
  let offset: readonly [number, number] = [0, 0];
  function district(id?: District) {
    offset = id ? districtOffsets[id] : [0, 0];
    staticRoot = new THREE.Group();
    staticRoot.position.set(offset[0], 0, offset[1]);
    allStatic.add(staticRoot);
  }

  function obstacle(x: number, y: number, z: number, w: number, h: number, d: number) {
    solids.push({ min: [x + offset[0] - w / 2, y - h / 2, z + offset[1] - d / 2], max: [x + offset[0] + w / 2, y + h / 2, z + offset[1] + d / 2] });
  }

  function solid(at: Vec3, size: Vec3, material: THREE.Material, bevel = .025) {
    const piece = box(staticRoot, material, ...size, ...at, bevel);
    piece.geometry = piece.geometry.clone();
    tileByPosition(piece.geometry, material === m.concrete ? 2.5 : 3.5);
    piece.castShadow = true;
    obstacle(...at, ...size);
    return piece;
  }

  function slab(x1: number, x2: number, z1: number, z2: number, y: number, material = m.asphalt) {
    const geometry = new THREE.BoxGeometry(x2 - x1, .36, z2 - z1);
    geometry.translate((x1 + x2) / 2, y - .18, (z1 + z2) / 2);
    tileByPosition(geometry, material === m.asphalt ? 5 : 3);
    const floor = mesh(staticRoot, geometry, material);
    floor.castShadow = true;
    solids.push({ min: [x1, y - .36, z1], max: [x2, y, z2], floor: true });
  }

  function slope(rect: { minX: number; maxX: number; minZ: number; maxZ: number }, profile: Slope, material = m.concrete) {
    const geometry = new THREE.BoxGeometry(rect.maxX - rect.minX, .32, rect.maxZ - rect.minZ);
    geometry.translate((rect.maxX + rect.minX) / 2, -.16, (rect.maxZ + rect.minZ) / 2);
    const p = geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + slopeHeight(profile, p.getX(i), p.getZ(i)));
    geometry.computeVertexNormals();
    tileByPosition(geometry, 3);
    mesh(staticRoot, geometry, material);
    solids.push({ min: [rect.minX, -.32, rect.minZ], max: [rect.maxX, 0, rect.maxZ], floor: true, slope: profile });
  }

  function sign(at: Vec3, width: number, yaw: number, title: string, note: string, accent = '#a8f7e3') {
    const object = label(staticRoot, width, width * .24, (ctx, w, h) => {
      ctx.fillStyle = '#23344e'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#7296b1'; ctx.lineWidth = 4; ctx.strokeRect(5, 5, w - 10, h - 10);
      ctx.fillStyle = accent; ctx.fillRect(12, 12, 6, h - 24);
      ctx.font = 'bold 51px Microsoft YaHei UI, sans-serif'; ctx.fillText(title, 29, 61, w - 45);
      ctx.fillStyle = '#c4dbe6'; ctx.font = '20px Microsoft YaHei UI, sans-serif'; ctx.fillText(note, 30, 96, w - 42);
    }, .12);
    object.position.set(...at); object.rotation.y = yaw;
    return object;
  }

  function beam(a: Vec3, b: Vec3, width = .14, depth = width, material = m.steel) {
    const object = strut(staticRoot, material, v(a), v(b), width, depth);
    object.castShadow = true;
    return object;
  }

  function post(x: number, y: number, z: number, h: number) {
    solid([x, y + h / 2, z], [.18, h, .22], m.steel, .009);
    box(staticRoot, m.zinc, .29, .055, .36, x, y + .028, z, .007);
    for (const dx of [-.095, .095]) for (const dz of [-.12, .12]) cylinder(staticRoot, m.zinc, .019, .039, x + dx, y + .07, z + dz, 6);
    for (const dx of [-.09, .09]) box(staticRoot, m.zinc, .046, h - .12, .24, x + dx, y + h / 2, z, .005);
  }

  function rail(a: Vec3, b: Vec3, color = m.safety, collision = true) {
    const length = v(a).distanceTo(v(b));
    const segments = Math.ceil(length / 2.8);
    for (let i = 0; i <= segments; i++) {
      const p = v(a).lerp(v(b), i / segments);
      cylinder(staticRoot, color, .038, 1.0, p.x, p.y + .5, p.z, 12);
    }
    for (const h of [.49, .98]) {
      const start = v(a).add(new THREE.Vector3(0, h, 0));
      const end = v(b).add(new THREE.Vector3(0, h, 0));
      beam(start.toArray() as unknown as Vec3, end.toArray() as unknown as Vec3, .045, .045, color);
    }
    if (collision) {
      const mid = v(a).lerp(v(b), .5);
      obstacle(mid.x, mid.y + .5, mid.z, Math.max(.1, Math.abs(a[0] - b[0])), 1, Math.max(.1, Math.abs(a[2] - b[2])));
    }
  }

  function lamp(at: Vec3, color = 0xffc38b, power = 80, target?: Vec3) {
    const group = new THREE.Group(); group.position.set(...at); staticRoot.add(group);
    if (target) group.lookAt(v(target));
    else group.rotation.x = Math.PI / 2;
    box(group, m.steel, .58, .28, .23, 0, 0, -.04, .026);
    box(group, m.zinc, .58, .28, .035, 0, 0, .092, .012);
    box(group, emissive(color, 2.4), .49, .21, .014, 0, 0, .117, .007);
    for (const x of [-.2, -.1, 0, .1, .2]) box(group, m.steel, .022, .23, .07, x, 0, -.19, .003);
    if (power === 0) return;
    const light = new THREE.PointLight(color, power, 17, 2);
    light.position.set(at[0] + offset[0], at[1], at[2] + offset[1]);
    light.position.y -= .2;
    scene.add(light);
  }

  function crate(x: number, y: number, z: number, w = 1.25, h = .92, d = 1.03) {
    const timber = solid([x, y + .14 + h / 2, z], [w, h, d], m.timber, .012);
    for (const dx of [-w * .36, 0, w * .36]) box(staticRoot, m.timber, .11, .11, d + .11, x + dx, y + .055, z, .003);
    for (const side of [-1, 1]) {
      for (const dy of [.20, h + .08]) box(staticRoot, m.timber, w + .065, .11, .06, x, y + dy, z + side * (d / 2 + .025), .003);
      beam([x - w * .4, y + .24, z + side * (d / 2 + .035)], [x + w * .4, y + h, z + side * (d / 2 + .035)], .08, .065, m.timber);
      for (const dx of [-w * .37, w * .37]) box(staticRoot, m.steel, .025, h + .11, .02, x + dx, y + .14 + h / 2, z + side * (d / 2 + .057));
    }
    return timber;
  }

  function drum(x: number, y: number, z: number, skin = rust) {
    const profile = [[0,.02],[.25,.02],[.267,.049],[.25,.073],[.245,.27],[.259,.282],[.259,.31],
      [.245,.325],[.245,.56],[.259,.58],[.259,.602],[.245,.62],[.25,.81],[.267,.827],[.267,.85],[0,.85]];
    mesh(staticRoot, new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 24), skin, x, y, z).castShadow = true;
    cylinder(staticRoot, m.zinc, .225, .012, x, y + .853, z, 24);
    cylinder(staticRoot, m.steel, .044, .022, x + .11, y + .867, z + .03, 12);
    obstacle(x, y + .43, z, .54, .86, .54);
  }

  function pipe(points: Vec3[], radius = .11, material = m.zinc) {
    cable(staticRoot, material, points as [number, number, number][], radius).castShadow = true;
    for (let i = 1; i < points.length - 1; i++) {
      const [x, y, z] = points[i];
      cylinder(staticRoot, m.steel, radius * 1.35, .085, x, y, z, 16).rotation.z = Math.PI / 2;
    }
  }

  const guideLamp=emissive(0x76e9dd,.5);
  function truck(x: number, z: number, base: number, load: Parameters<typeof portHauler>[1]) {
    const vehicle = portHauler(m, load);
    vehicle.position.set(x,base,z);
    for (const side of [-1,1]) {
      box(staticRoot,m.zinc,7.95,.012,.09,x,base+.043,z+side*1.42);
      for(const end of [-1,1]) box(staticRoot,m.zinc,.09,.012,.62,x+end*3.93,base+.043,z+side*1.07);
    }
    solid([x-3.68,base+.76,z],[.34,1.52,.64],m.steel,.07);
    box(staticRoot,offwhite,.47,.52,.7,x-3.68,base+1.38,z,.07);
    box(staticRoot,guideLamp,.49,.10,.71,x-3.68,base+1.47,z,.045);
    staticRoot.add(vehicle);
    obstacle(x,base+.51,z,6.25,1.02,2.28);
    obstacle(x+2.02,base+1.76,z,2.22,1.48,2.08);
    const height=load==='cells'?.99:1.34;
    obstacle(x-1.08,base+1.02+height/2,z,3.67,height,1.93);
  }

  // Subtract the lower quay and descent apertures from the continuous ground slab.
  let ground = [{ minX: -172, maxX: 228, minZ: -220, maxZ: 180 }];
  for (const cut of [dock, dockRamp, ramp]) {
    ground = ground.flatMap(r => {
      const x1 = Math.max(r.minX, cut.minX), x2 = Math.min(r.maxX, cut.maxX);
      const z1 = Math.max(r.minZ, cut.minZ), z2 = Math.min(r.maxZ, cut.maxZ);
      if (x1 >= x2 || z1 >= z2) return [r];
      return [
        { ...r, maxX: x1 }, { ...r, minX: x2 },
        { minX: x1, maxX: x2, minZ: r.minZ, maxZ: z1 },
        { minX: x1, maxX: x2, minZ: z2, maxZ: r.maxZ },
      ].filter(p => p.maxX > p.minX && p.maxZ > p.minZ);
    });
  }
  for (const r of ground) slab(r.minX, r.maxX, r.minZ, r.maxZ, 0, groundMaterial);
  slab(dock.minX, dock.maxX, dock.minZ, dock.maxZ, dock.y, m.concrete);
  for (const z of [dock.minZ,dock.maxZ]) {
    solid([(dock.minX+dock.maxX)/2,dock.y/2,z],[dock.maxX-dock.minX,-dock.y,.08],m.concrete,0);
  }
  solid([dock.minX,dock.y/2,(dock.minZ+dock.maxZ)/2],[.08,-dock.y,dock.maxZ-dock.minZ],m.concrete,0);
  slope(dockRamp, dockSlope);
  slope(ramp, rampSlope);
  slab(lab.minX, lab.maxX, lab.minZ, lab.maxZ, lab.y, m.concrete);
  slab(factory.minX, factory.maxX, factory.minZ, factory.maxZ, factory.y, m.concrete);
  slope(factoryRamp, factorySlope);

  // West wharf: a repeatable set of actual folded containers with shared textures.
  const layouts = [
    [-48, dock.y, 15, 0, 0], [-40, dock.y, 15, 0, 1], [-48, dock.y, 4, 0, 2],
    [-40, dock.y, -1, 0, 3], [-48, dock.y, -10, 0, 1], [-40, dock.y, -17, 0, 0],
    [-48, dock.y, -23, 0, 3], [-40, dock.y, -31, 0, 2],
    [-48, dock.y + 2.59, -10, 0, 2], [-40, dock.y + 2.59, -17, 0, 1],
    [-48, dock.y + 2.59, -23, 0, 0],
    [-23, 0, 23, Math.PI / 2, 0], [-23, 0, 9, Math.PI / 2, 2],
    [-23, 2.59, 9, Math.PI / 2, 3], [-18, 0, -28, 0, 1],
    [3, 0, 26, Math.PI / 2, 2], [12, 0, 26, Math.PI / 2, 1],
  ];
  const colors: [number, number, number][] = [[49, 166, 177], [247, 107, 85], [125, 114, 203], [250, 179, 73]];
  for (const [index, [x, y, z, yaw, variant]] of layouts.entries()) {
    district(x < -32 ? 'wharf' : 'warehouse');
    const asset = createShippingContainer(m, { code: 'SLT ' + String(74 + index * 13).padStart(3, '0'), seed: 114 + variant * 39, tint: colors[variant] });
    asset.root.position.set(x, y, z); asset.root.rotation.y = yaw;
    staticRoot.add(asset.root);
    obstacle(x, y + 1.295, z, yaw ? 6.06 : 2.44, 2.59, yaw ? 2.44 : 6.06);
  }
  district('wharf');
  for (const z of [-35, -22, -9, 4, 17, 26]) {
    cylinder(staticRoot, m.steel, .26, 1.1, -58.8, -.25, z, 16);
    rail([-59.2, dock.y, z - 3], [-59.2, dock.y, z + 3]);
  }
  for (const [x,z] of [[-56,-24],[-56,3]]) {
    for (const sx of [-1,1]) {
      beam([x + sx * 2.1, -.7, z], [x + sx * .95, 11, z], .22);
      beam([x + sx * 2.1, -.7, z + 2.5], [x + sx * .95, 11, z], .20);
    }
    box(staticRoot, painted, 3.0, 1.1, 2.5, x, 10.8, z, .05);
    beam([x - 4, 11.4, z], [x + 8.6, 16.3, z], .25);
    beam([x - 4, 12.2, z], [x + 8.6, 17.1, z], .17);
    for (let i=0; i<12; i++) {
      const a = [x - 4 + i * 1.05, 11.4 + i * .408, z] as const;
      const b = [a[0] + 1.05, a[1] + 1.208, z] as const;
      beam(a, b, .075);
    }
    pipe([[x+7.4,15.9,z],[x+7.4,11,z],[x+7.4,5.3,z]], .026, dark);
    box(staticRoot, yellow, 1.8, .25, .55, x+7.4,5.2,z,.03);
  }
  sign([-34, 2.3, 21.6], 3.3, Math.PI / 2, '01 货运码头', 'WHARF / CONTAINER YARD');
  sign([-50.5, 1.75, 27.2], 2.6, 0, '盐港南泊位', '保持通道畅通');

  district('warehouse');
  // Central warehouse: a roofed, open-span interior with two cross routes.
  const wx = -4, wz = 8, ww = 24, wd = 26;
  for (const x of [wx - ww/2, wx + ww/2]) {
    for (const z of [wz - wd/2, wz - 4, wz + 5, wz + wd/2]) post(x, 0, z, 6.2);
    solid([x, 1.0, wz], [.23, 2, wd], m.concrete, .015);
    mesh(staticRoot, foldedSheet(wd, .76, 74, .045), painted, x, 2.48, wz).rotation.y = x < wx ? -Math.PI/2 : Math.PI/2;
    mesh(staticRoot, foldedSheet(wd, 1.18, 74, .045), painted, x, 5.09, wz).rotation.y = x < wx ? -Math.PI/2 : Math.PI/2;
    // A continuous clerestory band breaks the shed's mass and admits visible cold fill.
    const glass = new THREE.MeshStandardMaterial({ color: 0x476367, roughness: .22, metalness: .25, emissive: 0x22383c, emissiveIntensity: .18 });
    for (let z = wz - wd / 2 + .94; z < wz + wd / 2; z += 1.85) {
      box(staticRoot, glass, .035, 1.52, 1.65, x, 3.69, z, .004);
      box(staticRoot, m.steel, .13, 1.64, .065, x, 3.69, z - .87, .004);
      box(staticRoot, m.zinc, .16, .065, 1.84, x, 3.69, z, .004);
    }
    for (const y of [2.88, 4.49]) box(staticRoot, m.zinc, .18, .09, wd, x, y, wz, .005);
    box(staticRoot, m.concrete, .38, .16, wd + .35, x, .12, wz, .012);
    // Sheet skin itself participates in world collision.
    obstacle(x, 3.9, wz, .18, 3.8, wd);
  }
  for (const z of [wz - wd/2, wz + wd/2]) {
    for (const x of [wx - 8, wx + 8]) solid([x, 3.0, z], [8, 6, .24], painted, .02);
    solid([wx, 5.35, z], [8.1, 1.7, .24], painted, .02);
    box(staticRoot, m.zinc, ww+.5, .17, .45, wx, 6.3,z,.012);
    for (const side of [-1, 1]) {
      box(staticRoot, m.zinc, .21, 4.73, .38, wx + side * 4.13, 2.36, z, .015);
      for (let y = .25; y < 4.6; y += .7) box(staticRoot, m.steel, .3, .07, .45, wx + side * 4.14, y, z, .006);
    }
    box(staticRoot, m.zinc, 8.6, .18, .46, wx, 4.63, z, .012);
    box(staticRoot, m.concrete, ww + .25, .15, .5, wx, .1, z, .01);
  }
  for (const z of [-5, 1.5, 8, 14.5, 21]) {
    beam([-16.1, 6.07, z], [-4, 7.75, z], .17, .22);
    beam([-4, 7.75, z], [8.1, 6.07, z], .17, .22);
    beam([-16, 5.98,z],[8,5.98,z],.15,.21);
    for(let i=0;i<8;i++) {
      const x=-16+i*3;
      beam([x,6.02,z],[x+1.5,6.32+Math.max(0,1-Math.abs(x+2.5)/12)*1.34,z],.055);
    }
  }
  for (const side of [-1,1]) {
    const roof=box(staticRoot,m.steel,12.5,.14,26.9,wx+side*6.1,6.93,wz,.015);
    roof.rotation.z=-side*.138;
  }
  for(const x of [-12,4]) {
    solid([x,3.0,21.29],[6,4.8,.35],offwhite,.16);
    for(const dx of [-1.8,0,1.8]) {
      box(staticRoot,painted,1.46,2.2,.14,x+dx,3.36,21.5,.07);
      box(staticRoot,m.steel,1.46,.20,.15,x+dx,1.94,21.5,.025);
    }
    box(staticRoot,yellow,6,.34,.48,x,5.51,21.29,.05);
  }
  sign([-4,4.98,21.17],4.8,0,'02 物流仓储','SALTLINE FREIGHT / 仓内有补给');
  sign([-4,4.96,-5.2],4.8,Math.PI,'02 物流仓储','北门 → 研究设施');
  for(const [x,z,w,h,d] of [[-12,3,2,1.4,1.5],[-12,8,2,1.4,1.5],[-13.4,16,1.5,1.4,1.3]]) {
    crate(x,0,z,w,h,d); crate(x,.14+h,z,w*.88,.7,d*.9);
  }
  // Workbench and rifle rack are inside the east aisle, not on a blocked pedestal.
  solid([-6,.48,5.9],[4.1,.96,.85],m.steel,.025);
  box(staticRoot,m.timber,4.22,.07,.96,-6,1.01,5.9,.009);
  solid([-21,.48,27.9],[1.8,.96,.9],painted,.025);
  district('wharf');
  crate(-37,dock.y,-9,1.4,.7,1.0);
  solid([-43,.48+dock.y,20.8],[1.8,.96,.9],painted,.025);
  district('warehouse');
  // Duty office is approached from the south, behind warehouse west-front corner.
  const ox=-10,oz=14.4;
  solid([ox-2.4,1.5,oz],[.22,3,4.2],offwhite,.02);
  solid([ox+2.4,1.5,oz],[.22,3,4.2],offwhite,.02);
  solid([ox,1.5,oz-2.1],[4.8,3,.22],offwhite,.02);
  for(const dx of [-1.7,1.7]) solid([ox+dx,1.5,oz+2.1],[1.4,3,.22],offwhite,.02);
  box(staticRoot,m.zinc,5.1,.16,4.7,ox,3.13,oz,.016);
  solid([-9,.48,12.75],[1.75,.96,.8],m.steel,.02);
  sign([-10,2.7,16.65],2.6,0,'值班室','维修卡 / SERVICE ACCESS');
  sign([-6,2.02,5.44],2.9,Math.PI,'仓储检修台','工具与维修零件');
  lamp([-10,2.75,14.6],0xffbd84,28);
  lamp([-4,5.8,8],0xffd5a3,120);
  lamp([-4,5.8,19],0xffc28b,90);
  lamp([-4,5.8,-2],0xffc28b,90);

  district('plant');
  // East plant: elevated maintenance deck, tanks, horizontal pipes and open ground bypass.
  solid([30,1.55,-6],[.28,3.1,20],m.concrete,.03);
  solid([50.9,1.55,-6],[.28,3.1,20],m.concrete,.03);
  solid([40.5,1.55,-16],[21,3.1,.28],m.concrete,.03);
  solid([36.5,1.55,3.95],[13,3.1,.28],m.concrete,.03);
  solid([49.5,1.55,3.95],[3,3.1,.28],m.concrete,.03);
  rail([30.2,3.2,3.9],[42.7,3.2,3.9]);
  rail([48.3,3.2,3.9],[50.8,3.2,3.9]);
  rail([30.2,3.2,3.9],[30.2,3.2,-15.7]);
  rail([50.8,3.2,3.9],[50.8,3.2,-15.7]);
  for(const x of [42.88,48.12]) {
    const a = [x,0,18] as const, b=[x,3.2,4] as const;
    rail(a,b,yellow,false);
    obstacle(x,1.5,11,.17,5,14);
  }
  for(const z of [-8,-2]) {
    for(const x of [33.5,39.7,46]) {
      cylinder(staticRoot,painted,1.85,6.1,x,6.25,z,32).castShadow=true;
      for(const y of [3.6,8.8]) cylinder(staticRoot,m.zinc,1.91,.14,x,y,z,32);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1.84,24,12,0,Math.PI*2,0,Math.PI/2),m.zinc);
      dome.position.set(x,9.27,z); staticRoot.add(dome);
      cylinder(staticRoot,m.steel,.16,1.1,x,10.55,z,16);
      obstacle(x,6.15,z,3.8,6.0,3.8);
      for(const dy of [4.6,5.3,6,6.7,7.4,8.1]) beam([x-1.4,dy,z+1.3],[x-1.4,dy+.01,z+1.7],.035);
    }
  }
  for(const z of [-14,1]) {
    for(const x of [29,52]) post(x,0,z,7.7);
    beam([29,7.7,z],[52,7.7,z],.19,.23);
    for(const dy of [0,.46,.92]) pipe([[28,7.8+dy,z],[34,7.8+dy,z],[41,7.8+dy,z],[54,7.8+dy,z]],.12+dy*.025,m.zinc);
  }
  solid([37,3.68,-12.7],[3.3,.96,.85],painted,.02);
  // Loot on the walkable platform in front of its bench.
  solid([37,3.68,-9.1],[1.9,.96,.8],painted,.02);
  solid([35,.48,20.7],[2.1,.96,.9],m.steel,.02);
  for (const x of [42.56,48.44]) solid([x,2.1,18.45],[.26,4.2,.36],m.steel);
  solid([45.5,3.78,18.45],[6.1,1.0,.22],painted);
  sign([45.5,3.7,18.6],3.5,0,'03 处理厂区','坡道通往 +3.2 m 维护平台');
  lamp([35,10.1,-5],0xffca8c,170);
  lamp([51,5.6,18.4],0xffb973,105,[44,1,12]);

  district('research');
  // Research headhouse conceals the larger underground wing and marks the descent.
  for(const x of [16.7,24.3]) {
    solid([x,2.6,-11.7],[.32,5.2,19.3],offwhite,.025);
    for(const z of [-19,-12,-4]) post(x,0,z,5.6);
  }
  box(staticRoot,m.steel,8.4,.19,19.7,20.5,5.35,-11.5,.02);
  // Scanner threshold and recessed ceiling ribs give the descent a distinct silhouette.
  const iris = enamel(0x8368bd);
  for (const z of [-2.95,-8.8,-14.8,-20.5]) {
    for(const side of [-1,1]) {
      const x=20.5+side*3.47;
      solid([x,2.25,z],[.66,4.5,.85],iris,.11);
      beam([x,3.75,z],[x-side*.9,5.15,z],.52,.8,m.ceramic);
      box(staticRoot,emissive(0x65e1de,.45),.14,1.86,.09,x,2.5,z+.44);
    }
    solid([20.5,5.14,z],[6.15,.44,.85],m.steel,.08);
    box(staticRoot,offwhite,4.6,.045,.47,20.5,4.9,z);
  }
  solid([20.5,4.35,-2.85],[6.1,1.39,.40],iris,.14);
  sign([20.5,4.38,-2.635],5.1,0,'04 生化研究设施','地下 -5.4 m / 高风险区域','#91c6c0');
  for(const x of [17.9,23.1]) {
    // Ramp side walls are tall enough to prevent stepping into the opening from the yard.
    solid([x,-1.6,-11.5],[.2,8.4,17.0],m.concrete,.018);
    rail([x,rampHeightLocal(-3),-3],[x,rampHeightLocal(-20),-20],m.zinc,false);
  }
  for(const z of [-5,-10,-15,-19]) {
    const y = slopeHeight(rampSlope,40.5,z - 130);
    box(staticRoot,yellow,4.75,.017,.12,20.5,y+.015,z);
    lamp([18.14,y+1.45,z],0x87cee1,2);
  }
  solid([9,-2.8,-42.18],[34.5,5.3,.36],m.concrete,.02);
  solid([-8.18,-2.8,-31],[.36,5.3,22.4],m.concrete,.02);
  solid([26.18,-2.8,-31],[.36,5.3,22.4],m.concrete,.02);
  solid([4.9,-2.8,-19.82],[25.8,5.3,.36],m.concrete,.02);
  solid([24.7,-2.8,-19.82],[2.6,5.3,.36],m.concrete,.02);
  // Dry ceiling is a different material from the wet exterior slab.
  const ceilingGeometry = new THREE.BoxGeometry(34, .15, 22);
  ceilingGeometry.translate(9, -.6, -31);
  tileByPosition(ceilingGeometry, 2.5);
  mesh(staticRoot, ceilingGeometry, m.concrete);
  solids.push({ min: [lab.minX, -.675, lab.minZ], max: [lab.maxX, -.525, lab.maxZ], floor: true });
  // Two parallel lab corridors link isolation cells, sample chamber and the freight lift.
  for(const x of [1.5,14.8]) {
    solid([x,-2.9,-37.2],[.24,4.9,9.5],offwhite,.014);
    solid([x,-2.9,-22.5],[.24,4.9,4.8],offwhite,.014);
    box(staticRoot,painted,.13,.65,4.3,x,-.96,-29.45,.01);
    for(const z of [-40.5,-32.7,-26.5,-20.8]) post(x,lab.y,z,4.8);
    // Doorway reveals and kick plates make the isolation partitions read as built walls.
    for (const z of [-32.38, -25.0]) {
      box(staticRoot, m.zinc, .38, 4.3, .13, x, -3.14, z, .013);
      box(staticRoot, yellow, .40, .15, .16, x, -4.95, z, .009);
    }
    for (const face of [-1, 1]) {
      for (const z of [-38.2, -35.9, -23.3, -21.1]) {
        box(staticRoot, m.zinc, .04, 1.16, 1.79, x + face * .143, -2.72, z, .008);
        box(staticRoot, painted, .025, 1.05, 1.66, x + face * .171, -2.72, z, .006);
        box(staticRoot, m.rubber, .029, .012, 1.48, x + face * .189, -2.56, z);
        box(staticRoot, m.rubber, .029, .012, 1.48, x + face * .189, -2.88, z);
      }
      for (const y of [-1.6, -4.66]) {
        for (const [z, length] of [[-37.2, 9.45], [-22.5, 4.75]]) {
          box(staticRoot, m.zinc, .028, .037, length, x + face * .142, y, z, .003);
        }
      }
      for (const z of [-40.1, -38.4, -36.7, -35, -33.3, -24.2, -22.5, -20.8]) {
        box(staticRoot, m.steel, .026, 3.0, .018, x + face * .141, -3.12, z, .002);
      }
    }
  }
  // Wall panels, skirting and segmented overhead conduits use actual thickness.
  for(const z of [-41.7,-20.3]) {
    for(let x=-7.3;x<26;x+=2.35) {
      if (z > -21 && x + 1.12 > 18 && x - 1.12 < 23) continue;
      box(staticRoot,offwhite,2.24,2.24,.09,x,-3.21,z,.018);
      box(staticRoot,m.steel,2.24,.055,.11,x,-4.48,z,.005);
    }
    if (z < -21) pipe([[-7,-.98,z],[0,-.98,z],[8,-.98,z],[16,-.98,z],[25,-.98,z]],.085,m.zinc);
  }
  for(const x of [-7.7,25.7]) pipe([[x,-1.4,-40.7],[x,-1.4,-34],[x,-1.4,-27],[x,-1.4,-20.5]],.14,painted);
  for(const x of [-4,7.2,20.3]) {
    lamp([x,-.98,-27.2],0xa0d5d2,55);
    lamp([x,-.98,-37],0x90c2c9,65);
  }
  solid([-4,-4.24,-39.2],[1.4,2.32,.74],yellow,.045);
  box(staticRoot,m.steel,.94,1.7,.055,-4,-4.2,-38.79,.022);
  box(staticRoot,emissive(0xe4a957,.8),.2,.085,.028,-4,-3.45,-38.75,.004);
  sign([-4,-2.67,-38.77],1.7,0,'货梯配电','E 接通供电','#e4c48b');
  for(const [x,z,w] of [[7.2,-38.7,3.1],[20.5,-37.4,4.3],[22,-24.2,1.8]]) {
    solid([x,-4.91,z],[w,.98,.85],m.steel,.018);
    solid([x,-4.38,z],[w+.08,.08,.96],offwhite,.012);
  }
  const screen = emissive(0x5e9186, .38);
  for (const x of [6.35, 20.9]) {
    const z = x < 10 ? -39.02 : -37.63;
    box(staticRoot, m.steel, .46, .32, .065, x, -3.93, z, .018);
    box(staticRoot, screen, .39, .24, .01, x, -3.92, z + .039, .008);
    box(staticRoot, m.zinc, .06, .18, .07, x, -4.17, z, .004);
    box(staticRoot, m.steel, .29, .035, .21, x, -4.32, z, .007);
    box(staticRoot, dark, .49, .028, .17, x + .2, -4.32, z + .25, .008);
    cable(staticRoot, dark, [[x,-4.15,z],[x-.1,-4.35,z-.11],[x-.3,-4.72,z-.07]], .014);
  }
  const chamberGlass = new THREE.MeshStandardMaterial({
    color: 0x668b83, roughness: .16, metalness: .15, transparent: true, opacity: .28, depthWrite: false,
  });
  for (const x of [10.6, 12.7]) {
    cylinder(staticRoot, m.steel, .63, .21, x, lab.y + .105, -40.75, 32);
    cylinder(staticRoot, m.zinc, .58, .11, x, lab.y + .28, -40.75, 32);
    cylinder(staticRoot, chamberGlass, .53, 2.58, x, lab.y + 1.62, -40.75, 32);
    cylinder(staticRoot, m.zinc, .6, .17, x, lab.y + 2.98, -40.75, 32);
    cylinder(staticRoot, painted, .58, .16, x, lab.y + 3.13, -40.75, 32);
    pipe([[x,lab.y+3.25,-40.75],[x,lab.y+3.7,-40.75],[x,lab.y+3.7,-41.8]], .055, m.zinc);
    for (const dx of [-.49, .49]) box(staticRoot, m.steel, .045, 2.6, .055, x + dx, lab.y + 1.62, -40.57, .007);
    for (let i = 0; i < 3; i++) box(staticRoot, emissive(0x759f83,.32), .042, .025, .012, x + .38, lab.y + .36 + i * .065, -40.22, .003);
    obstacle(x,lab.y+1.6,-40.75,1.24,3.2,1.24);
  }
  sign([7.4,-2.6,-41.76],3.3,0,'样本保管室','RESTRICTED / BIOHAZARD','#a1c9b6');
  sign([20.5,-2.4,-41.77],3.8,0,'隔离安保区','SECURITY / 武器回收','#d7a37f');
  sign([16,-2.7,-29.4],2.2,Math.PI/2,'隔离走廊','← 样本 / 货梯','#a0c9bd');
  for(let y=lab.y+.2;y<-1.2;y+=.16) box(staticRoot,m.zinc,.07,.1,3.8,-7.82,y,-25);
  for(const z of [-27,-23]) post(-7.7,lab.y,z,4.65);
  sign([-7.63,-1.37,-25],3.5,Math.PI/2,'实验室货梯','需配电柜通电','#a5d5c2');

  district();
  // Concrete aprons belong to workplaces; open ground remains earth and aggregate.
  district();
  for(const [x,z,w,d] of [[-78,3,40,48],[-41,7,21,20],[-4,8,31,33],[136,-40,30,32]])
    box(staticRoot,m.concrete,w,.015,d,x,.008,z);
  // Main road and two parallel approaches; roads stay clear for navigation and AI.
  district();
  buildRoads(staticRoot, m.asphalt);
  for(const [x,z,title,note] of [
    [-24,130,'南侧公路','仓储 ↑ / 公路撤离 ←'],[-110,85,'货运码头','沿西路北行 / 泊位双向入口'],
    [60,80,'地区联络路','研究设施 ↑ / 厂区 →'],[174,-83,'维修出口','前方需维修卡'],
    [40.5,-124,'研究设施','前方坡道 / 地下高风险'],[-151,145,'公路出口','E 撤离 / 常开'],
  ] as const) {
    post(x-6,0,z,3.4); sign([x-6,2.9,z+.14],4.8,0,title,note);
  }
  for(const x of [-154,-148]) post(x,0,144.7,4);
  beam([-154,4,144.7],[-148,4,144.7],.2);
  sign([highwayPosition[0],3.24,144.86],4.6,0,'公路出口','撤离 E / 常开','#9ac79f');
  sign([servicePosition[0]+2.91,2.8,servicePosition[2]],3.5,-Math.PI/2,'维修通道','需维修卡 / 值班室领取');
  truck(-8.2,138,0,'medical'); truck(140,77,0,'cells');
  for(const [x,z] of [[-19,31],[7,29],[128,-20],[27,-126]]) drum(x,0,z);
  district('wharf'); truck(-48.2,22,dock.y,'freight'); district();
  // Local barricades explain finite roads without encircling the world in a wall.
  for (const z of [-211,173]) for(const x of [-115,60,175]) {
    for(const dx of [-6,-2,2,6]) solid([x+dx,.55,z],[3.2,1.1,.8],m.concrete,.09);
    sign([x,2.1,z],4,0,'道路封锁','隔离区边界 / 禁止通行');
  }
  for(const [x,z] of [[-110,65],[-110,5],[-110,-55],[65,45],[65,-35],[65,-115],[180,55],[180,-25],[-40,150],[70,150]]) {
    post(x,0,z,7.5); beam([x,7.3,z],[x+1.1,7.3,z],.11);
    lamp([x+1,7.16,z],0xffc18b,110);
  }

  // A quiet port skyline extends past the fence without extra navigable acreage.
  for(const [x,z,h,w] of [[-210,-10,11,9],[-212,-138,16,11],[140,-263,18,13],[112,-267,10,16],[-116,-263,14,12],[269,10,15,10]]) {
    box(staticRoot,painted,w,h,12,x,h/2,z,.1);
    box(staticRoot,m.zinc,w+.3,.22,12.3,x,h,z,.03);
    for(let y=3;y<h;y+=3.5) box(staticRoot,m.steel,w+.08,.12,12.1,x,y,z,.01);
  }
  for(const x of [33,43,51]) {
    solid([x,.75,-60],[3.3,1.5,3.3],m.steel);
    obstacle(x,10.5,-60,2.6,18,2.6);
    cylinder(staticRoot,painted,1.3,18,x,10.5,-60,20);
    for(const y of [7,12,17]) cylinder(staticRoot,m.zinc,1.35,.18,x,y,-60,20);
    box(staticRoot,m.steel,2.9,.3,2.9,x,19.5,-60,.04);
  }
  const modules = addDistrictDetails(allStatic, m, solid);
  // Apply the same built-space vocabulary to the process and research districts.
  for(const [x,z,w,d] of [[90,-32,32,36],[120,-76,26,30],[7,-113,30,24],[83,-156,24,28],[-45,63,22,16],[38,35,18,24]]) {
    modules.shed(x,z,w,d);
    modules.rack(x-w*.3,z,Math.round(x));
    modules.bench(x-w*.2,z-d*.5+2);
    modules.cabinet(x+w*.4,z-d*.4);
    modules.pallet(x+w*.3,0,z+d*.3);
    lamp([x,5.5,z],x>60?0xc7d7cf:0xffc18b,75);
    sign([x,4.6,z+d*.5+.2],4.5,0,x>60?'处理与隔离车间':'维修与后勤设施','双向通道 / 物资容器在工作台');
  }
  // Laboratory cabinetry and hanging services use the existing underground floor.
  // Bonded floor inlays and alternating bulkheads frame the B1 circulation aisles.
  const violet = enamel(0x9380ca);
  const guide = emissive(0x65eadd,.42);
  for (const x of [18.5,29.5,40.5]) {
    for (const side of [-1,1]) {
      box(staticRoot,painted,.23,.012,19.8,x+side*1.7,lab.y+.009,-161);
      for (const z of [-168,-163,-158,-153]) box(staticRoot,guide,.09,.014,1.5,x+side*1.7,lab.y+.025,z);
    }
  }
  for(const z of [-169,-164,-159,-154]) {
    for(const x of [12.5,45.5]) {
      solid([x,-3.05,z],[.54,4.7,.72],violet,.12);
      box(staticRoot,guide,.565,2.1,.18,x,-2.8,z);
    }
    box(staticRoot,m.steel,33.5,.34,.72,29,-.86,z,.07);
    box(staticRoot,guide,26,.04,.19,29,-1.05,z);
  }
  for(const x of [18.5,23.7,43.5]) {
    solid([x,-4.4,-171.5],[1.1,2,.6],painted,.03);
    for(const y of [-4.9,-4.4,-3.9]) box(staticRoot,m.zinc,.65,.03,.04,x,y,-171.17,.005);
  }
  pipe([[13,-1.3,-166],[19,-1.3,-166],[26,-1.3,-166],[31,-1.3,-166]],.17,offwhite);
  for (const site of supplySites) {
    const { x, z } = site;
    const taxonomy = {
      'medkit': ['MED',0x3aafb0], 'salvage': ['MRO',0xda7c41],
      'pistol-ammo': ['LOG',0xed6854], 'research-sample': ['BIO',0x8973c2],
    } as const;
    const [code,tint]=taxonomy[site.item];
    const fascia=enamel(tint);
    // The front lintel carries both the sign and the canopy. Keep the approach between its feet open.
    for (const side of [-1,1]) {
      const px=x+side*2.85;
      solid([px,.3,z+6.86],[.54,.6,.72],m.steel,.09);
      solid([px,1.88,z+6.86],[.28,2.58,.42],offwhite,.035);
      beam([px,2.74,z+6.86],[px+side*.58,3.51,z+6.86],.25,.35,fascia);
      beam([px,3.08,z+6.86],[px,3.74,z+5.25],.16,.23,m.steel);
    }
    solid([x,3.50,z+6.86],[7.65,1,.42],fascia,.12);
    sign([x+.53,3.51,z+7.08],4.65,0,site.label,code+'  /  风险'+site.risk+'  /  高台储备');
    // A backlit category pictogram stays legible before the lettering resolves.
    const markX=x-2.74, markY=3.5, markZ=z+7.09;
    box(staticRoot,m.steel,1.0,.83,.06,markX,markY,markZ,.07);
    if(code==='MED') {
      box(staticRoot,guide,.59,.17,.04,markX,markY,markZ+.05);
      box(staticRoot,guide,.17,.58,.04,markX,markY,markZ+.06);
    } else if(code==='BIO') {
      for(const dx of [-.19,0,.19]) {
        cylinder(staticRoot,guide,.071,.32,markX+dx,markY,markZ+.08,10);
        box(staticRoot,m.zinc,.15,.06,.10,markX+dx,markY+.19,markZ+.08);
      }
    } else {
      for (const dx of [-.24,0,.24]) {
        const bar=box(staticRoot,guide,.11,code==='LOG'?.39:.25,.05,markX+dx,markY,markZ+.05);
        bar.rotation.z=code==='LOG'?-.30:.55;
      }
    }
    for (const side of [-1, 1]) {
      solid([x + side * 7, 1.1, z], [.4, 2.2, 12], m.concrete);
      const benchX=x+side*3, benchZ=z+2;
      if(code==='MRO') {
        modules.bench(benchX,benchZ);
      } else {
        solid([benchX,.46,benchZ],[2.96,.92,.90],offwhite,.09);
        solid([benchX,.97,benchZ],[3.3,.10,1.0],m.steel,.045);
        for (const dx of [-.91,0,.91]) {
          box(staticRoot,fascia,.83,.49,.045,benchX+dx,.52,benchZ+.46,.025);
          box(staticRoot,m.zinc,.27,.045,.065,benchX+dx,.68,benchZ+.49,.015);
        }
        solid([benchX,1.48,benchZ-.45],[3.18,.92,.12],fascia,.06);
        if(code==='MED') {
          box(staticRoot,m.steel,.96,.54,.085,benchX-.82,1.49,benchZ-.35,.045);
          box(staticRoot,guide,.39,.085,.04,benchX-.82,1.49,benchZ-.29);
          box(staticRoot,guide,.085,.39,.044,benchX-.82,1.49,benchZ-.29);
        } else {
          box(staticRoot,m.steel,1.04,.12,.54,benchX-.82,1.08,benchZ-.08,.04);
          for(const dx of [-.29,0,.29]) {
            if(code==='BIO') {
              cylinder(staticRoot,guide,.09,.39,benchX-.82+dx,1.33,benchZ-.08,12);
              cylinder(staticRoot,m.zinc,.103,.08,benchX-.82+dx,1.56,benchZ-.08,12);
            } else box(staticRoot,m.ceramic,.19,.29,.34,benchX-.82+dx,1.28,benchZ-.08,.035);
          }
        }
      }

      if (side < 0) modules.pallet(x - 9, 0, z + 3);
      for (const dz of [-5, 0, 5]) solid([x + side * 7, 1.1, z + dz], [.24, 2.2, .24], m.steel);
    }
    modules.rack(x - 3.8, z - 3, Math.round(x));
    solid([x, site.height - .2, z - 8], [10, .4, 5], m.steel);
    for (const dx of [-4.6, 4.6]) {
      solid([x + dx, site.height / 2, z - 8], [.3, site.height, .3], m.steel);
      if (dx < 0) rail([x + dx, site.height, z - 10.4], [x + dx, site.height, z - 5.6]);
    }
    rail([x - 4.6, site.height, z - 10.4], [x + 4.6, site.height, z - 10.4]);
    solid([x, site.height + .25, z - 8], [1.8, .5, .8], painted);
    const count = Math.round(site.height / 1.6);
    for (let i = 0; i < count; i++) {
      const top = (i + 1) * 1.6;
      const stepZ = z + 3 - i * 2.6;
      solid([x + 10, top / 2, stepZ], [3.4, top, 2.6], painted);
      box(staticRoot, m.safety, 3.42, .06, .14, x + 10, top + .025, stepZ + 1.25);
    }
    const topZ = z + 3 - (count - 1) * 2.6;
    solid([x + 6.7, site.height - .15, topZ], [3.4, .3, 2.6], m.steel);
    solid([x + 4.3, site.height - .15, (topZ + z - 8) / 2], [1.4, .3, Math.abs(topZ - (z - 8)) + 2.6], m.steel);
    box(staticRoot,m.steel,4.8,.15,.42,x,3.62,z+2,.04);
    lamp([x, 3.47, z + 2], 0x85efed, 6);
  }
  addArcology(staticRoot, m, solid);
  buildPortBlocks(staticRoot, m, solids, solid);
  addPortHorizon(allStatic, m);
  for(const interaction of mapInteractions) addPickup(interaction);

  // Merge only static meshes per 20m cell and material. Named pickup groups remain independent.
  batchStatic(allStatic);
  return { scene, solids };

  function rampHeightLocal(z:number) { return slopeHeight(rampSlope,40.5,z - 130); }

  function addPickup(target: MapInteraction) {
    if(target.kind==='switch') return;
    const group=new THREE.Group();
    group.name=target.id; group.position.set(...target.position); scene.add(group);
    if(target.item==='research-sample') {
      cylinder(group,m.steel,.14,.05,0,-.07,0,24);
      cylinder(group,emissive(0x77bd9b,.5),.095,.24,0,.065,0,24);
      cylinder(group,m.zinc,.12,.04,0,.205,0,24);
      cylinder(group,m.zinc,.12,.04,0,-.065,0,24);
    } else if(target.item==='medkit') {
      box(group,rust,.4,.19,.28,0,.02,0,.035);
      box(group,offwhite,.19,.01,.045,0,.124,0,.004);
      box(group,offwhite,.045,.01,.19,0,.125,0,.004);
    } else if(target.item==='service-card') {
      box(group,offwhite,.22,.018,.14,0,0,0,.012);
      box(group,yellow,.045,.005,.105,-.07,.013,0,.003);
    } else {
      box(group,target.item==='salvage'?painted:yellow,.34,.15,.23,0,.02,0,.015);
      for(let i=-2;i<=2;i++) box(group,m.zinc,.022,.012,.09,i*.053,.102,0,.003);
    }
    const beacon = box(group,emissive(0xb8d6b3,.26),.032,.006,.032,.1,.108,.07,.002);
    beacon.receiveShadow=false;
  }
}

function tileByPosition(geometry: THREE.BufferGeometry, scale: number) {
  const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
  for(let i=0;i<p.count;i++) {
    uv.setXY(i,(Math.abs(n.getX(i))>.8?p.getZ(i):p.getX(i))/scale,
      (Math.abs(n.getY(i))>.2?p.getZ(i):p.getY(i))/scale);
  }
}

function batchStatic(root: THREE.Group) {
  root.updateMatrixWorld(true);
  const batches=new Map<string,{material:THREE.Material;geometries:THREE.BufferGeometry[];cast:boolean;receive:boolean}>();
  const sources:THREE.Mesh[]=[];
  root.traverse(object=>{
    if(!(object instanceof THREE.Mesh)||Array.isArray(object.material)||object.material.transparent)return;
    const material=object.material;
    const p=object.getWorldPosition(new THREE.Vector3());
    const key=[material.id,Math.floor(p.x/20),Math.floor(p.z/20),object.castShadow,object.receiveShadow].join('/');
    const batch=batches.get(key)??{material,geometries:[] as THREE.BufferGeometry[],cast:object.castShadow,receive:object.receiveShadow};
    const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
    for(const attr of Object.keys(geometry.attributes))if(!['position','normal','uv'].includes(attr))geometry.deleteAttribute(attr);
    geometry.applyMatrix4(object.matrixWorld);
    batch.geometries.push(geometry);batches.set(key,batch);sources.push(object);
  });
  for(const object of sources)object.removeFromParent();
  for(const batch of batches.values()) {
    const geometry=mergeGeometries(batch.geometries);
    batch.geometries.forEach(g=>g.dispose());
    if(!geometry)continue;
    const object=mesh(root,geometry,batch.material);
    object.castShadow=batch.cast;object.receiveShadow=batch.receive;
  }
}

