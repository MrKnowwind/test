import * as THREE from 'three';
import { siteInteractions, supplySites } from './supplySites.ts';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { MapInteraction, Vec3 } from '../contracts/demo.ts';
import { box, cable, cylinder, mesh, strut } from './detail/geometry.ts';
import { createMaterialLibrary, enamel, paving, emissive } from './detail/materialLibrary.ts';
import { createShippingContainer, foldedSheet } from './detail/createShippingContainer.ts';
import { buildStreetCourts } from './streetCourts.ts';
import { freightHalls, upperRoutes } from './upperRoutes.ts';
import { buildPortBlocks } from './portBlocks.ts';
import { addArcology } from './arcology.ts';
import { portHauler } from './detail/portHauler.ts';
import { buildRoads } from './roads.ts';
import {
  dock, dockRamp, dockSlope, factory, factoryRamp, factorySlope, lab,
  ramp, rampSlope, slopeHeight, type Slope, type Solid,
} from './worldQueries.ts';

import { addDistrictDetails, addPortHorizon } from './districtDetails.ts';
import { buildOutdoorLoot } from './outdoorLoot.ts';
import { buildHarbor } from './harbor.ts';
import { harborInteractions,openContainerPlans } from './harborPlan.ts';
import { northTerrace,terrainHeight,civicInteractions,gradeHeight,newTerrainSections,tidalWalk } from './terrainPlan.ts';
import { buildCivicDistrict,buildNorthTerrace } from './civicDistrict.ts';
import { districtOffsets, districtPoint, districtForInteraction, type District } from './layout.ts';
import { buildDistrictSites, districtInteractions } from './districtSites.ts';
import { regularExits } from './raidPlan.ts';
import { labCeilingUnder, labLocalY, researchInteractions, researchPad } from './researchPlan.ts';
import { buildResearchBuilding } from './researchBuilding.ts';
import { southInteractions } from './southPlan.ts';
import { buildSouthDistrict } from './southDistrict.ts';
import { marketInteractions } from './marketPlan.ts';
import { buildMarketDistrict } from './marketDistrict.ts';
import { innInteractions } from './innPlan.ts';
import { buildInn } from './inn.ts';
import { researchAnnexInteractions } from './researchAnnexPlan.ts';
import { buildResearchAnnex } from './researchAnnex.ts';
import { landBounds } from './landPlan.ts';
import { landBank, landSurface } from './landSurface.ts';
import { buildWorksites } from './worksites.ts';
import { drainCrossings, worksiteInteractions } from './worksitePlan.ts';

const v = (p: Vec3) => new THREE.Vector3(...p);

const localInteractions: readonly MapInteraction[] = [
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
  ...harborInteractions,
  ...civicInteractions,
  ...districtInteractions,
  ...researchInteractions,
  ...researchAnnexInteractions,
  ...southInteractions,
  ...marketInteractions,
  ...innInteractions,
  ...worksiteInteractions,
  ...siteInteractions,
  ...localInteractions.map(target => ({ ...target, position: districtPoint(districtForInteraction(target.id), target.position) })),
  { id: 'research-office', label: '研究后勤箱', kind: 'loot', item: 'medkit', quantity: 1, position: [1,1.12,-122.7] },
  { id: 'workshop-supplies', label: '工棚应急箱', kind: 'loot', item: 'medkit', quantity: 1, position: [-42,1.12,2.3] },
  { id: 'evac-daypack', label: '基础小包', kind: 'loose', item: 'daypack', quantity: 1, position: [-24, .18, 140.75] },
];

function* environmentSteps() {
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
  let offset: Vec3 = [0, 0, 0];
  function district(id?: District) {
    offset = id ? districtPoint(id, [0, 0, 0]) : [0, 0, 0];
    staticRoot = new THREE.Group();
    staticRoot.position.set(...offset);
    allStatic.add(staticRoot);
  }

  function obstacle(x: number, y: number, z: number, w: number, h: number, d: number) {
    solids.push({ min: [x + offset[0] - w / 2, y + offset[1] - h / 2, z + offset[2] - d / 2],
      max: [x + offset[0] + w / 2, y + offset[1] + h / 2, z + offset[2] + d / 2] });
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
    solids.push({ min: [x1, y - .36, z1], max: [x2, y, z2], surface: material === m.concrete ? 'concrete' : undefined, floor: true, walkSurface: true });
  }

  function slope(rect: { minX: number; maxX: number; minZ: number; maxZ: number }, profile: Slope, material = m.concrete) {
    const geometry = new THREE.BoxGeometry(rect.maxX - rect.minX, .32, rect.maxZ - rect.minZ);
    geometry.translate((rect.maxX + rect.minX) / 2, -.16, (rect.maxZ + rect.minZ) / 2);
    const p = geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + slopeHeight(profile, p.getX(i), p.getZ(i)));
    geometry.computeVertexNormals();
    tileByPosition(geometry, 3);
    mesh(staticRoot, geometry, material);
    solids.push({ min: [rect.minX, -.32, rect.minZ], max: [rect.maxX, 0, rect.maxZ], floor: true, walkSurface: true, surface: 'concrete', slope: profile });
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
    light.position.set(at[0] + offset[0], at[1] + offset[1], at[2] + offset[2]);
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

  // Open the terrain around the quay, terraced foundations and the B1 entrance.
  type Footprint = {minX: number; maxX: number; minZ: number; maxZ: number};
  function cutOut(areas: readonly Footprint[], cut: Footprint) {
    return areas.flatMap(r => {
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
  const ground = [dock, dockRamp, northTerrace, researchPad, ...newTerrainSections, ...drainCrossings]
    .reduce(cutOut, [landBounds] as readonly Footprint[]);
  const terrain = landSurface(ground);
  tileByPosition(terrain, 3);
  mesh(allStatic, terrain, groundMaterial).castShadow = true;
  const bank = landBank();
  tileByPosition(bank, 3);
  mesh(allStatic, bank, enamel(0x617a87));
  for (const r of ground)
    solids.push({ min: [r.minX, -.36, r.minZ], max: [r.maxX, 0, r.maxZ], floor: true, walkSurface: true, landFloor: true });
  buildNorthTerrace(allStatic,m,solids);
  const fill = enamel(0x89988c);
  const ridgeFill = paving(0x82958c), tideFill = paving(0x9aa89b);
  for (const section of newTerrainSections) {
    const { minX, maxX, minZ, maxZ, northY, southY } = section;
    const finishOffset = section.finishInset ?? 0;
    const baseY = Math.min(-.36, northY - .36, southY - .36);
    const geometry = new THREE.BoxGeometry(maxX - minX, 1, maxZ - minZ);
    geometry.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    const positions = geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      positions.setY(i, positions.getY(i) > 0 ? gradeHeight(section, positions.getZ(i)) - finishOffset : baseY);
    }
    geometry.computeVertexNormals();
    tileByPosition(geometry, 3);
    mesh(allStatic, geometry, section.finish === 'ridge' ? ridgeFill : section.finish === 'tidal' ? tideFill : fill).castShadow = true;
    if (northY === southY) {
      solids.push({ min: [minX, baseY, minZ], max: [maxX, northY, maxZ],
        floor: true, walkSurface: true, surface: 'concrete' });
    } else {
      solids.push({ min: [minX, baseY - Math.max(northY, southY), minZ], max: [maxX, 0, maxZ],
        floor: true, walkSurface: true, surface: 'concrete',
        slope: { axis: 2, start: minZ, height: northY, gradient: (southY - northY) / (maxZ - minZ) } });
    }
  }
  for (const x of [tidalWalk.minX, tidalWalk.maxX]) {
    const center = (tidalWalk.minZ + tidalWalk.maxZ) / 2;
    solid([x, tidalWalk.height / 2, center], [.24, -tidalWalk.height, tidalWalk.maxZ - tidalWalk.minZ-.08], m.concrete);
    box(allStatic, m.zinc, .36, .08, tidalWalk.maxZ - tidalWalk.minZ-.08, x, .04, center);
  }
  const foundation = cutOut(cutOut([researchPad], lab), ramp);
  for (const r of foundation) {
    const h = researchPad.height + .36;
    const x = (r.minX + r.maxX) / 2, z = (r.minZ + r.maxZ) / 2;
    const w = r.maxX - r.minX, d = r.maxZ - r.minZ;
    // Register the top as a flat walk surface so the capsule can meet it from either incline.
    box(allStatic, m.concrete, w, h, d, x, (researchPad.height - .36) / 2, z).castShadow = true;
    solids.push({ min: [r.minX, -.36, r.minZ], max: [r.maxX, researchPad.height, r.maxZ], floor: true, walkSurface: true });
  }
  slab(lab.minX, lab.maxX, lab.minZ, lab.maxZ, researchPad.height, m.concrete);
  buildResearchBuilding(allStatic, m, solids, solid);
  slab(dock.minX, dock.maxX, dock.minZ, dock.maxZ, dock.y, m.concrete);
  const dockLip=.08;
  for (const z of [dock.minZ+dockLip/2,dock.maxZ-dockLip/2]) {
    solid([(dock.minX+dock.maxX)/2,dock.y/2,z],[dock.maxX-dock.minX,-dock.y,dockLip],m.concrete,0);
  }
  solid([dock.minX+dockLip/2,dock.y/2,(dock.minZ+dock.maxZ)/2],[dockLip,-dock.y,dock.maxZ-dock.minZ-2*dockLip],m.concrete,0);
  slope(dockRamp, dockSlope);
  slope(ramp, rampSlope);
  slab(lab.minX, lab.maxX, lab.minZ, lab.maxZ, lab.y, m.concrete);
  slab(factory.minX, factory.maxX, factory.minZ, factory.maxZ, factory.y, m.concrete);
  slope(factoryRamp, factorySlope);
  yield .1;

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
    const open=x<-32&&y===dock.y?openContainerPlans.find(p=>p.x===x+districtOffsets.wharf[0]&&p.z===z):undefined;
    const asset = createShippingContainer(m, { code: 'SLT ' + String(74 + index * 13).padStart(3, '0'), seed: 114 + variant * 39, tint: colors[variant],open:!!open });
    asset.root.position.set(x, y, z); asset.root.rotation.y = yaw;
    staticRoot.add(asset.root);
    if(open){
      // Floor, side panels, rear wall and ceiling instead of a closed volume.
      solids.push({min:[x+offset[0]-1.13,y,z+offset[2]-2.95],max:[x+offset[0]+1.13,y+.09,z+offset[2]+2.95],floor:true,walkSurface:true,surface:'metal'});
      for(const s of [-1,1])obstacle(x+s*1.14,y+1.29,z,.17,2.58,6.06);
      obstacle(x,y+1.29,z-2.96,2.44,2.58,.14);obstacle(x,y+2.53,z,2.44,.12,6.06);
      solid([x,y+.45,z-2.05],[1.65,.70,1.0],open.style==='cold'?offwhite:painted,.045);
      const dec= open.style==='luggage'?m.timber:open.style==='tools'?m.zinc:open.style==='cold'?offwhite:yellow;
      for(const dz of [-.35,.35])box(staticRoot,dec,.40,.25,.32,x+.53,y+.53,z-2.05+dz,.035);
      if(open.style==='cold'){for(const dx of [-.7,.7])box(staticRoot,offwhite,.08,.09,3.1,x+dx,y+1.95,z-.25);}
      else if(open.style==='tools'){for(const dx of [-.50,-.15,.2])box(staticRoot,m.zinc,.06,.26,.035,x+dx,y+1.16,z-2.88);}
      else if(open.style==='luggage'){box(staticRoot,rust,.55,.29,.43,x-.60,y+.60,z-2.05,.06);}
      box(staticRoot,yellow,2.0,.026,.14,x,y+.103,z+2.85);
    }else obstacle(x, y + 1.295, z, yaw ? 6.06 : 2.44, 2.59, yaw ? 2.44 : 6.06);
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

  // Crane bogies, flush rail heads and a travelling spreader share the dock's long axis.
  // Crossing the tracks is level. Only the bogies and the raised gantry occupy body space.
  for (const x of [-58.1,-53.9]) {
    box(staticRoot, dark, .34,.024,62, x,dock.y+.015,-5);
    box(staticRoot, m.zinc, .115,.031,62, x,dock.y+.037,-5);
    for (const z of [-24,3]) {
      solid([x,dock.y+.22,z+1.25],[.65,.44,3.8],yellow,.10);
      for (const dz of [-.2,2.7]) box(staticRoot,dark,.69,.34,.45,x,dock.y+.18,z+dz,.06);
    }
  }
  for (const x of [-57.1,-54.9]) {
    solid([x,11.7,-10.5],[.30,.42,27.8],painted,.035);
    for (let z=-23;z<2;z+=4.5) beam([x,10.94,z],[x,11.75,z+4.25],.12,.14,yellow);
  }
  solid([-48.6,5.0,3],[2.6,.32,5.3],yellow,.09);
  for (const side of [-1,1]) {
    beam([-48.6,10.1,3],[-48.6+side,5.1,3+side*1.9],.045,.045,dark);
    box(staticRoot,rust,.30,.46,.42,-48.6+side,4.87,3+side*2.2);
  }
  buildHarbor(allStatic,m,solids);

  yield .2;
  district('warehouse');
  // Central warehouse: a roofed, open-span interior with two cross routes.
  const wx = -4, wz = 8, ww = 24, wd = 26;
  for (const x of [wx - ww/2, wx + ww/2]) {
    const columns=[wz - wd/2, wz - 4, wz + 5, wz + wd/2];
    for (const z of columns) post(x, 0, z, 6.2);
    for(let i=1;i<columns.length;i++){
      const a=columns[i-1]+.12,b=columns[i]-.12;
      solid([x,1,(a+b)/2],[.23,2,b-a],m.concrete,.015);
    }
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
    for (const s of [-1,1]) solid([wx+s*7.94,3,z],[7.88,6,.24],painted,.02);
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
  // High north-light monitors break up the ridge. Open trusses below still read from both loading doors.
  for (const z of [-.9,7.5,15.9]) {
    solid([wx,7.93,z],[5.6,.58,3.15],painted,.08);
    solid([wx,8.47,z-.96],[5.48,1.02,.22],m.zinc,.02);
    box(staticRoot,dark,5.12,.73,.10,wx,8.46,z-1.12);
    for(const offset of [-1.75,0,1.75]) box(staticRoot,offwhite,.14,.79,.15,wx+offset,8.46,z-1.18);
    const cap=box(staticRoot,offwhite,5.92,.15,3.42,wx,8.52,z,.03);
    cap.rotation.x=.27;
  }
  // Roller transfer table: a short crouch-through lane beside the full-height centre aisle.
  solid([-11.1,1.38,-.55],[3.18,.18,1.92],painted,.05);
  for (const side of [-1,1]) for(const dz of [-.78,.78]) {
    const x=-11.1+side*1.47, z=-.55+dz;
    solid([x,.65,z],[.20,1.30,.23],yellow,.025);
    box(staticRoot,dark,.31,.10,.31,x,.05,z);
  }
  for(let i=0;i<9;i++) {
    const roller=cylinder(staticRoot,m.zinc,.085,1.79,-12.42+i*.33,1.50,-.55,10);
    roller.rotation.x=Math.PI/2;
  }
  for(const x of [-6.82,-1.18]) {
    box(staticRoot,yellow,.10,.012,20,x,.026,8);
    for(const z of [0,8,16])box(staticRoot,offwhite,.60,.014,.15,x,.029,z);
  }
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
  solid([-10.55,.55,14.4],[3.6,1.1,1.15],painted,.07);
  for (const x of [-11.65, -10.55, -9.45]) box(staticRoot, m.zinc, .48, .10, .84, x, 1.12, 14.4);
  lamp([-4,5.8,8],0xffd5a3,120);
  lamp([-4,5.8,19],0xffc28b,90);
  lamp([-4,5.8,-2],0xffc28b,90);

  yield .3;
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
  // The intake header and filter cups physically terminate at two process tanks.
  for (const x of [33.5,39.7]) {
    pipe([[x,8.1,-2],[x,10.2,-2],[x,10.2,1],[x,8.7,1]],.23,painted);
    cylinder(staticRoot,yellow,.37,.18,x,9.37,1,12);
    cylinder(staticRoot,m.steel,.29,.72,x,8.95,1,12);
  }
  lamp([35,10.1,-5],0xffca8c,170);
  lamp([51,5.6,18.4],0xffb973,105,[44,1,12]);

  yield .4;
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
  // Paired wash nozzles and a recessed drain distinguish the entry; the opening follows the clear ramp width.
  for (const x of [17.37,23.63]) {
    pipe([[x,4.7,-3.3],[x,4.7,-7.8],[x,4.05,-7.8]],.11,m.zinc);
    for (const z of [-4.45,-6.25,-7.8]) {
      cylinder(staticRoot,m.steel,.19,.16,x,4.52,z,10);
      cylinder(staticRoot,offwhite,.15,.07,x,4.42,z,10);
    }
  }
  for(const z of [-2.3,-1.95]) box(staticRoot,m.steel,4.2,.015,.09,20.5,.012,z);
  for(const x of [17.9,23.1]) {
    // Ramp side walls are tall enough to prevent stepping into the opening from the yard.
    solid([x,-1.6,-11.5],[.2,8.4,17.0],m.concrete,.018);
    rail([x,rampHeightLocal(-3),-3],[x,rampHeightLocal(-20),-20],m.zinc,false);
  }
  for(const z of [-5,-10,-15,-19]) {
    const y = rampHeightLocal(z);
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
  solids.push({ min: [lab.minX, labCeilingUnder, lab.minZ], max: [lab.maxX, labCeilingUnder + .15, lab.maxZ], floor: true });
  // Two parallel lab corridors link isolation cells, sample chamber and the freight lift.
  for(const x of [1.5,14.8]) {
    solid([x,-2.9,-37.2],[.24,4.9,9.5],offwhite,.014);
    solid([x,-2.9,-22.5],[.24,4.9,4.8],offwhite,.014);
    box(staticRoot,painted,.13,.65,4.3,x,-.96,-29.45,.01);
    for(const z of [-40.5,-32.7,-26.5,-20.8]) post(x,labLocalY,z,4.8);
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
    cylinder(staticRoot, m.steel, .63, .21, x, labLocalY + .105, -40.75, 32);
    cylinder(staticRoot, m.zinc, .58, .11, x, labLocalY + .28, -40.75, 32);
    cylinder(staticRoot, chamberGlass, .53, 2.58, x, labLocalY + 1.62, -40.75, 32);
    cylinder(staticRoot, m.zinc, .6, .17, x, labLocalY + 2.98, -40.75, 32);
    cylinder(staticRoot, painted, .58, .16, x, labLocalY + 3.13, -40.75, 32);
    pipe([[x,labLocalY+3.25,-40.75],[x,labLocalY+3.7,-40.75],[x,labLocalY+3.7,-41.8]], .055, m.zinc);
    for (const dx of [-.49, .49]) box(staticRoot, m.steel, .045, 2.6, .055, x + dx, labLocalY + 1.62, -40.57, .007);
    for (let i = 0; i < 3; i++) box(staticRoot, emissive(0x759f83,.32), .042, .025, .012, x + .38, labLocalY + .36 + i * .065, -40.22, .003);
    obstacle(x,labLocalY+1.6,-40.75,1.24,3.2,1.24);
  }
  for(let y=labLocalY+.2;y<-1.2;y+=.16) box(staticRoot,m.zinc,.07,.1,3.8,-7.82,y,-25);
  for(const z of [-27,-23]) post(-7.7,labLocalY,z,4.65);

  district();
  yield .51;
  // Concrete aprons belong to workplaces; open ground remains earth and aggregate.
  district();
  for(const [x,z,w,d] of [[-78,3,40,48],[-41,7,21,20],[-4,8,31,33],[136,-40,30,32]])
    box(staticRoot,m.concrete,w,.015,d,x,.008,z);
  // Main road and two parallel approaches; roads stay clear for navigation and AI.
  district();
  buildRoads(staticRoot, m.asphalt);
  // Terminal lay-bys lead into the extraction rings from the public road.
  // Canopies, lane paint and crash barriers identify the spaces without nameboards.
  for (const exit of regularExits) {
    const [x, y, z] = exit.position;
    const north = exit.id === 'north-gate';
    const direction = north ? -1 : 1;
    const roofZ = z + direction * 1.2;
    const tint = north ? enamel(0x68849a) : enamel(0xca9162);
    for (const side of [-1, 1]) {
      const px = x + side * 3.35;
      for (const dz of [-1.15, 1.15]) {
        solid([px, y + .3, roofZ + dz], [.79, .6, .81], m.concrete, .08);
        post(px, y + .3, roofZ + dz, 3.28);
      }
      box(staticRoot, tint, .64, .37, 3.28, px, y + 3.43, roofZ, .04);
      box(staticRoot, yellow, .12, .018, 2.5, x + side * 2.74, y + .042, z);
    }
    solid([x, y + 3.68, roofZ], [7.6, .28, north ? 3.6 : 2.9], tint, .035);
    box(staticRoot, emissive(0xc8efdf,.38), 4.9, .072, .18, x, y + 3.502, roofZ);
    solid([x, y + .5, z + direction * 4.5], [8.6, 1, .52], m.concrete, .07);
    for (const dx of [-3, -1.5, 0, 1.5, 3])
      box(staticRoot, yellow, .61, .14, .06, x + dx, y + .76, z + direction * 4.21);
  }
  truck(-8.2,138,0,'medical'); truck(140,77,0,'cells');
  for(const [x,z] of [[-19,31],[7,29],[128,-20]]) drum(x,0,z);
  drum(27,researchPad.height,-130);
  district('wharf'); truck(-48.2,22,dock.y,'freight'); district();
  // Local barricades explain finite roads without encircling the world in a wall.
  for (const z of [-211,173]) for(const x of [-115,60,175]) {
    for(const dx of [-6,-2,2,6]) solid([x+dx,(terrainHeight(x+dx,z)??0)+.55,z],[3.2,1.1,.8],m.concrete,.09);
  }
  for(const [x,z] of [[-110,65],[-110,5],[-110,-55],[65,45],[65,-35],[65,-115],[180,55],[180,-25],[-40,150],[70,150]]) {
    post(x,0,z,7.5); beam([x,7.3,z],[x+1.1,7.3,z],.11);
    lamp([x+1,7.16,z],0xffc18b,110);
  }

  for(const x of [33,43,51]) {
    solid([x,.75,-60],[3.3,1.5,3.3],m.steel);
    obstacle(x,10.5,-60,2.6,18,2.6);
    cylinder(staticRoot,painted,1.3,18,x,10.5,-60,20);
    for(const y of [7,12,17]) cylinder(staticRoot,m.zinc,1.35,.18,x,y,-60,20);
    box(staticRoot,m.steel,2.9,.3,2.9,x,19.5,-60,.04);
  }
  const modules = addDistrictDetails(allStatic, m, solid);
  buildDistrictSites(staticRoot, m, solid);
  for(const [x,z,w,d,index] of freightHalls) {
    if (index < 4) continue;
    modules.shed(x,z,w,d);
    modules.rack(x-w*.3,z,Math.round(x));
    modules.bench(x-w*.2,z-d*.5+2);
    modules.cabinet(x+w*.4,z+d*.14);
    modules.pallet(x+w*.3,0,z+d*.3);
    lamp([x,5.5,z],x>60?0xc7d7cf:0xffc18b,75);
  }
  // Laboratory cabinetry and hanging services use the existing underground floor.
  // Bonded floor inlays and alternating bulkheads frame the B1 circulation aisles.
  const violet = enamel(0x9380ca);
  const guide = emissive(0x65eadd,.42);
  district('research');
  for (const x of [-1.5,9.5,20.5]) {
    for (const side of [-1,1]) {
      box(staticRoot,painted,.23,.012,19.8,x+side*1.7,labLocalY+.009,-31);
      for (const z of [-38,-33,-28,-23]) box(staticRoot,guide,.09,.014,1.5,x+side*1.7,labLocalY+.025,z);
    }
  }
  for(const z of [-39,-34,-29,-24]) {
    for(const x of [-7.5,25.5]) {
      solid([x,-3.215,z],[.54,4.37,.72],violet,.12);
      box(staticRoot,guide,.565,2.1,.18,x,-2.8,z);
    }
    box(staticRoot,m.steel,33.5,.34,.72,9,-.86,z,.07);
    box(staticRoot,guide,26,.04,.19,9,-1.05,z);
  }
  for(const x of [-1.5,3.7,23.5]) {
    solid([x,-4.4,-41.5],[1.1,2,.6],painted,.03);
    for(const y of [-4.9,-4.4,-3.9]) box(staticRoot,m.zinc,.65,.03,.04,x,y,-41.17,.005);
  }
  pipe([[-7,-1.3,-36],[-1,-1.3,-36],[6,-1.3,-36],[11,-1.3,-36]],.17,offwhite);
  district();
  for (const site of supplySites) {
    const { x, z } = site;
    const taxonomy = {
      'medkit': ['MED',0x3aafb0], 'salvage': ['MRO',0xda7c41],
      'pistol-ammo': ['LOG',0xed6854], 'research-sample': ['BIO',0x8973c2],
    } as const;
    const [code,tint]=taxonomy[site.item];
    const fascia=enamel(tint);
    // The front lintel supports the canopy. Keep the approach between its feet open.
    for (const side of [-1,1]) {
      const px=x+side*2.85;
      solid([px,.3,z+6.86],[.54,.6,.72],m.steel,.09);
      solid([px,1.88,z+6.86],[.28,2.58,.42],offwhite,.035);
      beam([px,2.74,z+6.86],[px+side*.58,3.51,z+6.86],.25,.35,fascia);
      beam([px,3.08,z+6.86],[px,3.74,z+5.25],.16,.23,m.steel);
    }
    solid([x,3.70,z+6.86],[6.04,.24,.36],fascia,.06);
    // A backlit category pictogram stays legible before the lettering resolves.
    const markX=x-2.85, markY=2.24, markZ=z+7.095;
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
    solid([x + 6.65, site.height - .15, topZ], [3.3, .3, 2.6], m.steel);
    solid([x + 4.3, site.height - .15, (topZ + z - 8) / 2], [1.4, .3, Math.abs(topZ - (z - 8)) + 2.6], m.steel);
    box(staticRoot,m.steel,4.8,.15,.42,x,3.62,z+2,.04);
    lamp([x, 3.47, z + 2], 0x85efed, 6);
  }
  addArcology(staticRoot, m, solid);
  yield .59;
  const upper=upperRoutes(staticRoot,m,solid,solids);
  const blocks=buildPortBlocks(staticRoot, m, solid);
  let block=blocks.next();
  while (!block.done) {
    yield .59 + block.value * .23;
    block=blocks.next();
  }
  const rooms=block.value;
  buildWorksites(staticRoot,m,solids,solid);
  for (const [x,z,w,d,index] of freightHalls) upper.warehouse(x,z,w,d,index,rooms.cases);
  buildStreetCourts(staticRoot,m,solid);
  buildCivicDistrict(allStatic,m,solids);
  buildSouthDistrict(staticRoot,m,solids,solid);
  buildMarketDistrict(staticRoot,m,solid);
  buildInn(staticRoot,m,solids,solid);
  buildResearchAnnex(staticRoot,m,solids,solid);
  const outdoorLoot=buildOutdoorLoot(allStatic,m,solids,[...mapInteractions,...rooms.cases]);
  addPortHorizon(allStatic, m);
  for(const interaction of mapInteractions) addPickup(interaction);

  // Batch static streets by cell and shading. Pickups and doors remain independently interactive.
  yield .85;
  for(const progress of batchStatic(allStatic)) yield .85 + progress * .15;
  return { scene, solids, rooms, outdoorLoot };

  function rampHeightLocal(z:number) { return slopeHeight(rampSlope,40.5,z - 130) - researchPad.height; }

  function addPickup(target: MapInteraction) {
    if(target.kind!=='loot') return;
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

export function createEnvironment() {
  const steps=environmentSteps();
  let step=steps.next();
  while (!step.done) step=steps.next();
  return step.value;
}

export async function createEnvironmentAsync(progress: (value:number) => Promise<void>) {
  const steps=environmentSteps();
  let step=steps.next();
  while (!step.done) {
    await progress(step.value);
    step=steps.next();
  }
  return step.value;
}

function tileByPosition(geometry: THREE.BufferGeometry, scale: number) {
  const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
  for(let i=0;i<p.count;i++) {
    uv.setXY(i,(Math.abs(n.getX(i))>.8?p.getZ(i):p.getX(i))/scale,
      (Math.abs(n.getY(i))>.2?p.getZ(i):p.getY(i))/scale);
  }
}

function* batchStatic(root: THREE.Group) {
  root.updateMatrixWorld(true);
  const batches=new Map<string,{material:THREE.Material;geometries:THREE.BufferGeometry[];cast:boolean;receive:boolean}>();
  const sources:THREE.Mesh[]=[];
  const palettes=new Map<string,THREE.MeshToonMaterial>();
  const sphere=new THREE.Sphere();
  const detailBatches=new Set<string>();
  const meshes:THREE.Mesh[]=[];
  root.traverse(object=>{if(object instanceof THREE.Mesh && !Array.isArray(object.material) && !object.material.transparent)meshes.push(object);});
  for (const [index,object] of meshes.entries()) {
    const original=object.material as THREE.Material;
    let material=original;
    const tint=original instanceof THREE.MeshToonMaterial && !original.map && !original.normalMap &&
      !original.alphaMap && !original.vertexColors && original.emissive.getHex()===0;
    if(tint){
      const signature=[original.gradientMap?.id,original.side,original.opacity,original.depthWrite].join('/');
      let palette=palettes.get(signature);
      if(!palette){
        palette=original.clone() as THREE.MeshToonMaterial;palette.color.setHex(0xffffff);palette.vertexColors=true;
        palettes.set(signature,palette);
      }
      material=palette;
    }
    if(!object.geometry.boundingSphere)object.geometry.computeBoundingSphere();
    sphere.copy(object.geometry.boundingSphere!).applyMatrix4(object.matrixWorld);
    const p=sphere.center,detail=sphere.radius<1.45;
    const key=[material.id,Math.floor(p.x/24),Math.floor(p.z/24),detail,object.castShadow,object.receiveShadow].join('/');
    if(detail)detailBatches.add(key);
    const batch=batches.get(key)??{material,geometries:[] as THREE.BufferGeometry[],cast:object.castShadow,receive:object.receiveShadow};
    const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
    for(const attr of Object.keys(geometry.attributes))if(!['position','normal','uv','color'].includes(attr))geometry.deleteAttribute(attr);
    if(!geometry.hasAttribute('uv'))geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count*2),2));
    geometry.applyMatrix4(object.matrixWorld);
    if(tint){
      const c=original.color, colors=new Uint8Array(geometry.getAttribute('position').count*3);
      const r=Math.round(255*c.r),g=Math.round(255*c.g),b=Math.round(255*c.b);
      for(let i=0;i<colors.length;i+=3){colors[i]=r;colors[i+1]=g;colors[i+2]=b;}
      geometry.setAttribute('color',new THREE.BufferAttribute(colors,3,true));
    }
    batch.geometries.push(geometry);batches.set(key,batch);sources.push(object);
    if((index+1)%500===0) yield .65*(index+1)/meshes.length;
  }
  for(const object of sources)object.removeFromParent();
  let completed=0;
  for(const [key,batch] of batches) {
    const geometry=mergeGeometries(batch.geometries);
    batch.geometries.forEach(g=>g.dispose());
    if(!geometry)continue;
    const object=mesh(root,geometry,batch.material);
    object.castShadow=batch.cast;object.receiveShadow=batch.receive;
    if(detailBatches.has(key)){
      geometry.computeBoundingSphere();
      object.userData.detailCenter=geometry.boundingSphere!.center;
      object.userData.detailRadius=geometry.boundingSphere!.radius;
    }
    if(++completed%35===0)yield .65 + .35*completed/batches.size;
  }
}

