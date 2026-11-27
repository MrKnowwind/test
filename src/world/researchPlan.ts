import type { MapInteraction, Vec3 } from '../contracts/demo.ts';

// The city datum is 2.1 m above sea level. The campus and B1 move together.
export const researchPad = { minX: 9, maxX: 49, minZ: -176, maxZ: -126, height: 9.9 };
export const researchApproach = { minX: 33.5, maxX: 47.5, minZ: -126, maxZ: -72 };
export const researchSteps = { minX: 33, maxX: 39, minZ: -194, maxZ: -176 };
export const labLocalY = -5.4;
export const lab = { minX: 12, maxX: 46, minZ: -172, maxZ: -150, y: researchPad.height + labLocalY };
export const ramp = { minX: 38, maxX: 43, minZ: -150, maxZ: -133 };
export const labCeilingUnder = researchPad.height - .675;
export const labLift: Vec3 = [15.4, lab.y, -155];
type Footprint = { minX: number; maxX: number; minZ: number; maxZ: number };
const contains = (area: Footprint, x: number, z: number) =>
  x >= area.minX && x <= area.maxX && z >= area.minZ && z <= area.maxZ;
const campusGround = [researchPad, { ...researchApproach, maxZ: researchApproach.maxZ + 4 },
  { ...researchSteps, minZ: researchSteps.minZ - 3 }];

export function isResearchCampus([x,,z]: Vec3) {
  return campusGround.some(area => contains(area, x, z));
}

export function isLabLevel([x, y, z]: Vec3) {
  if (y < lab.y - .4 || y >= labCeilingUnder) return false;
  return contains(lab, x, z) || (contains(ramp, x, z) && z <= ramp.maxZ - 4);
}

export const researchBuilding = { minX: 14, maxX: 34, minZ: -172, maxZ: -152 };
export const researchStair = { x: 29.8, footZ: -158.8, topZ: -168 };
export const researchUpperY = researchPad.height + 3.35;

export function researchBuildingFloor([x, y, z]: Vec3) {
  if (!contains(researchBuilding, x, z) || y < researchPad.height - .1) return undefined;
  return y >= researchUpperY - .1 ? '2F' : '1F';
}

export const researchInteractions: readonly MapInteraction[] = [
  { id: 'research-intake', label: '科研登记档案', kind: 'loot', item: 'recorder', quantity: 1,
    position: [18.4, researchPad.height + 1.08, -156.3] },
  { id: 'research-bench', label: '样品接收工作台', kind: 'loot', item: 'calibration', quantity: 1,
    position: [30.7, researchPad.height + 1.08, -154.8] },
  { id: 'research-upper', label: '观测数据终端', kind: 'loot', item: 'terminal', quantity: 1,
    position: [22.4, researchUpperY + 1.08, -165] },
];
