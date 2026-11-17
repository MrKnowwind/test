import type { Vec3 } from '../contracts/demo.ts';

export const districtOffsets = {
  wharf: [-95, 0], warehouse: [0, 0], plant: [95, -35], research: [20, -130],
} as const;
export type District = keyof typeof districtOffsets;
export function districtPoint(district: District, point: Vec3): Vec3 {
  const [x, z] = districtOffsets[district];
  return [point[0] + x, point[1], point[2] + z];
}
export function districtRect(district: District, rect: { minX: number; maxX: number; minZ: number; maxZ: number }) {
  const [x, z] = districtOffsets[district];
  return { minX: rect.minX + x, maxX: rect.maxX + x, minZ: rect.minZ + z, maxZ: rect.maxZ + z };
}
export const districtForInteraction = (id: string): District => id.startsWith('lab-') ? 'research'
  : id.startsWith('factory-') ? 'plant' : ['yard-medkit', 'yard-salvage'].includes(id) ? 'wharf' : 'warehouse';
export const highwayPosition: Vec3 = [-151, 0, 145];
export const servicePosition: Vec3 = [189, 0, -90];
