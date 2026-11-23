import * as THREE from 'three';
import type { EnemySpawn, MapInteraction, Vec3 } from '../contracts/demo.ts';
import { box, cylinder, mesh } from './detail/geometry.ts';
import type { Materials } from './detail/materialLibrary.ts';

export type Door = { id: string; x: number; z: number; alongX: boolean; label: string };
export type ShopRooms = { doors: Door[]; cases: MapInteraction[]; occupants: EnemySpawn[] };
type BuildSolid = (at: Vec3, size: Vec3, material: THREE.Material, bevel?: number) => THREE.Mesh;
const screenPlane = new THREE.PlaneGeometry(1, 1);
export const doorWidth = 1.9;
export const doorHeight = 2.5;
const themes = [
  { name: '潮汐泵房', case: '仪表接线箱', item: 'terminal', id: 'pump' },
  { name: '港务工坊', case: '维修工具屉', item: 'wrench', id: 'workshop' },
  { name: '极光药局', case: '急救药品箱', item: 'medkit', id: 'clinic' },
] as const;

export function buildShopRoom(
  rooms: ShopRooms,
  root: THREE.Group,
  solid: BuildSolid,
  m: Materials,
  index: number,
  x: number,
  z: number,
  width: number,
  depth: number,
  side: number,
  accent: THREE.Material,
  light: THREE.Material,
  screenMaterial: THREE.Material,
) {
  const theme = themes[index % 3],
    front = index % 4 < 2 ? 1 : -1;
  const wall = 0.22,
    height = 4.1;
  const innerX = x - (side * (width - wall)) / 2,
    outerX = x + (side * (width - wall)) / 2;
  const frontZ = z + (front * (depth - wall)) / 2,
    backZ = z - (front * (depth - wall)) / 2;
  const passageZ = z + front * depth * 0.16;
  const id = 'room-' + theme.id + '-' + index;

  // The street and arcade entries share an unobstructed aisle to the service counter.
  function entrance(cx: number, cz: number, alongX: boolean, length: number, offset: number, end: string) {
    const point = (u: number, y: number): Vec3 => [cx + (alongX ? u : 0), y, cz + (alongX ? 0 : u)];
    const size = (span: number, h: number, thickness: number): Vec3 =>
      alongX ? [span, h, thickness] : [thickness, h, span];
    for (const sign of [-1, 1]) {
      const span = (length - doorWidth) / 2 - sign * offset;
      solid(point(offset + (sign * (doorWidth + span)) / 2, height / 2), size(span, height, wall), m.ceramic);
      box(
        root,
        accent,
        ...size(0.105, doorHeight, 0.29),
        ...point(offset + sign * (doorWidth / 2 + 0.05), doorHeight / 2),
      );
    }
    solid(point(offset, (height + doorHeight) / 2), size(doorWidth, height - doorHeight, 0.35), m.steel);
    box(root, light, ...size(doorWidth - 0.24, 0.1, 0.38), ...point(offset, doorHeight + 0.22));
    const [dx, , dz] = point(offset, 0);
    rooms.doors.push({
      id: id + '-' + end,
      x: dx,
      z: dz,
      alongX,
      label: theme.name + ' · ' + (end === 'street' ? '临街门' : '骑楼门'),
    });
  }
  entrance(x, frontZ, true, width, 0, 'street');
  entrance(innerX, z, false, depth, passageZ - z, 'arcade');
  solid([outerX, height / 2, z], [wall, height, depth], m.ceramic);
  solid([x, height / 2, backZ], [width, height, wall], m.ceramic);
  // Thin floor finish and ceiling strips have no raised threshold.
  box(root, m.zinc, width - wall, 0.018, depth - wall, x, 0.016, z);
  box(root, m.zinc, width-wall, .06, depth-wall, x, 4.06, z);
  box(root, light, 0.21, 0.07, depth * 0.59, x, 3.99, z);
  const counterZ = backZ + front * 0.76,
    counterW = Math.min(width - 0.8, 3.45);
  solid([x, 0.43, counterZ], [counterW, 0.86, 1.08], m.steel, 0.05);
  box(root, accent, counterW + 0.04, 0.065, 1.11, x, 0.85, counterZ, 0.025);
  const consoleWidth = Math.min(2.48, width - 0.86);
  box(root, m.steel, consoleWidth + 0.1, 1.03, 0.15, x, 2.0, backZ + front * 0.16, 0.045);
  const display = mesh(root, screenPlane, screenMaterial, x, 2.0, backZ + front * 0.243);
  display.rotation.y = front > 0 ? 0 : Math.PI;
  display.scale.set(consoleWidth, 0.94, 1);
  const workX = x + side * counterW * 0.29;
  if (index % 3 === 0) {
    // Manifold and two handwheels beside the removable electrical case.
    box(root, m.rubber, 0.76, 0.09, 0.26, workX, 0.94, counterZ);
    for (const dx of [-0.21, 0.21]) {
      cylinder(root, m.zinc, 0.086, 0.18, workX + dx, 1.05, counterZ, 12);
      cylinder(root, m.safety, 0.134, 0.05, workX + dx, 1.16, counterZ, 8);
    }
  } else if (index % 3 === 1) {
    box(root, m.zinc, 0.66, 0.09, 0.38, workX, 0.94, counterZ);
    for (const dx of [-0.19, 0.19]) box(root, accent, 0.13, 0.22, 0.31, workX + dx, 1.07, counterZ, 0.025);
    box(root, m.steel, 0.46, 0.07, 0.07, workX, 1.04, counterZ);
  } else {
    box(root, m.zinc, 0.7, 0.04, 0.4, workX, 0.92, counterZ);
    for (const dx of [-0.18, 0, 0.18]) {
      cylinder(root, m.ceramic, 0.058, 0.19, workX + dx, 1.03, counterZ, 10);
      cylinder(root, accent, 0.061, 0.052, workX + dx, 1.15, counterZ, 10);
    }
  }
  const caseX = x - side * counterW * 0.18;
  rooms.cases.push({
    id,
    label: theme.name + ' · ' + theme.case,
    kind: 'loot',
    item: theme.item,
    quantity: 1,
    position: [caseX, 1.12, counterZ],
  });
  const rackX = outerX - side * 0.38,
    rackZ = z - front * 0.42;
  if (index % 3 === 0) {
    // Two pressure vessels on a common plinth with capped gauges.
    solid([rackX, 0.16, rackZ], [0.63, 0.32, 2.4], m.steel);
    for (const dz of [-0.6, 0.6]) {
      solid([rackX,1.1,rackZ+dz],[.36,1.56,.36],m.steel);
      cylinder(root, accent, 0.27, 1.59, rackX, 1.1, rackZ + dz, 12);
      cylinder(root, m.steel, 0.285, 0.12, rackX, 1.7, rackZ + dz, 12);
      cylinder(root, light, 0.15, 0.11, rackX, 1.95, rackZ + dz, 12);
    }
    box(root,m.zinc,.12,.14,1.52,outerX-side*.20,1.3,rackZ);
  } else if (index % 3 === 1) {
    solid([rackX, 0.59, rackZ], [0.64, 1.18, 2.65], m.steel, 0.05);
    box(root, m.timber, 0.73, 0.1, 2.77, rackX, 1.2, rackZ, 0.035);
    box(root, accent, 0.1, 0.89, 2.38, outerX - side * 0.17, 2.12, rackZ);
    for (const dz of [-0.72, -0.24, 0.24, 0.72])
      box(root, m.zinc, 0.12, 0.42, 0.08, outerX - side * 0.25, 2.1, rackZ + dz);
  } else {
    solid([rackX, 1.03, rackZ], [0.63, 2.06, 2.18], m.steel, 0.055);
    for (const dz of [-0.52, 0.52]) {
      box(root, m.ceramic, 0.07, 1.72, 0.93, rackX - side * 0.34, 1.1, rackZ + dz, 0.025);
      box(root, accent, 0.085, 0.15, 0.54, rackX - side * 0.38, 1.37, rackZ + dz);
      box(root, accent, 0.086, 0.54, 0.15, rackX - side * 0.38, 1.37, rackZ + dz);
    }
  }
  box(root, accent, counterW, 0.31, 0.1, x, 2.63, backZ + front * 0.15);
  rooms.occupants.push({
    id: id + '-infected',
    kind: 'infected',
    position: [x, 0, z - front * depth * 0.19],
    yaw: front > 0 ? Math.PI : 0,
  });
}
