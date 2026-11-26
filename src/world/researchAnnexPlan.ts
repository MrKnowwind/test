import type { MapInteraction, Vec3 } from '../contracts/demo.ts';

const level = 8.1;
export const observationPad = { minX: 68, maxX: 99, minZ: -154, maxZ: -131, height: level };
export const archivePad = { minX: 184, maxX: 226, minZ: -157, maxZ: -136, height: level };
export const annexWalk = { minX: observationPad.maxX, maxX: archivePad.minX, minZ: -152.2, maxZ: -148 };
export const observationDoorX = 80;
export const archiveDoorX = 195;
export const annexApproaches = [
  { minX: 75.5, maxX: 84.5, minZ: -196, maxZ: observationPad.minZ },
  { minX: 190.5, maxX: 199.5, minZ: -198, maxZ: archivePad.minZ },
];
export const annexGrades = [
  ...annexApproaches.map(approach => ({ ...approach, northY: 0, southY: level })),
  ...[observationPad, archivePad].map(pad => ({ ...pad, northY: level, southY: level })),
];

export const ridgeTrail = { minX: 207, maxX: 225, minZ: -216, maxZ: archivePad.minZ };
export const ridgeCrest = { ...ridgeTrail, minZ: -220, maxZ: ridgeTrail.minZ, height: 20.9 };

export const observationBuilding = { minX: 72, maxX: 96, minZ: -145.5, maxZ: -133.5 };
export const archiveBuilding = { minX: 185, maxX: 222, minZ: -155, maxZ: -137.5 };
export const researchAnnexBuildings = [observationBuilding, archiveBuilding];

export function researchAnnexArea([x, y, z]: Vec3) {
  if (y < level - .16) return undefined;
  if (x >= ridgeTrail.minX && x <= ridgeTrail.maxX && z >= ridgeCrest.minZ && z < ridgeTrail.maxZ)
    return '东北山脊';
  if (x >= observationPad.minX && x <= observationPad.maxX && z >= observationPad.minZ && z <= observationPad.maxZ)
    return '隔离观察设施';
  if (x >= archivePad.minX && x <= archivePad.maxX && z >= archivePad.minZ && z <= archivePad.maxZ)
    return '科研档案中心';
  return undefined;
}

export const researchAnnexInteractions: readonly MapInteraction[] = [
  { id: 'observation-intake', label: '观察接收台', item: 'recorder', kind: 'loot', quantity: 1, position: [75.3, level + 1.08, -142.5] },
  { id: 'observation-medical', label: '观察室应急柜', item: 'medkit', kind: 'loot', quantity: 1, position: [84, level + 1.08, -135.4] },
  { id: 'quarantine-samples', label: '隔离保存柜', item: 'research-sample', kind: 'loot', quantity: 1, position: [93, level + 1.08, -135.4] },
  { id: 'annex-archive-files', label: '档案分拣台', item: 'archive', kind: 'loot', quantity: 1, position: [193, level + 1.08, -140.2] },
  { id: 'annex-archive-reading', label: '阅览室登记簿', item: 'manual', kind: 'loot', quantity: 1, position: [207, level + 1.08, -148.3] },
  { id: 'annex-archive-server', label: '机房维护终端', item: 'terminal', kind: 'loot', quantity: 1, position: [217.4, level + 1.08, -140.8] },
];
