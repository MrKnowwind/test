import type { MapInteraction, Vec3 } from '../contracts/demo.ts';

export const sortingHall = { minX: -94, maxX: -62, minZ: -17, maxZ: 23 };
export const logisticsOffice = { minX: 2.6, maxX: 21.4, minZ: -25, maxZ: -7 };
export const vehicleCourt = { minX: -57, maxX: -25, minZ: -22.5, maxZ: -1.5 };
export const repairShop = { minX: 74, maxX: 106, minZ: -50, maxZ: -14 };
export const controlMain = { minX: 184, maxX: 204, minZ: -36, maxZ: -16 };
export const controlAnnex = { minX: 204, maxX: 211, minZ: -36, maxZ: -22 };
export const worksiteBuildings = [sortingHall, logisticsOffice, repairShop, controlMain, controlAnnex];

export const sortingStair = { x: -65, footZ: -9.6, topZ: 2, width: 2.2, rise: 3.24 };
export const officeStair = { x: 18.7, footZ: -9.8, topZ: -20.2, width: 2.25, rise: 3.30 };
export const controlStair = { x: 201, footZ: -19.3, topZ: -31.0, width: 2.30, rise: 3.64 };
export const drainChannel = { minX: 157, maxX: 166, minZ: -43, maxZ: -18, height: -1.12 };
export const drainCrossings = [-38, -26].map(z => ({ minX: 156.65, maxX: 166.35, minZ: z - 1.85, maxZ: z + 1.85 }));

const inBounds = (x: number, z: number, bounds: typeof sortingHall) =>
  x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;

export function worksitePlace([x, y, z]: Vec3) {
  if (y < -.1 || y > 7) return undefined;
  if (inBounds(x, z, sortingHall)) return { id: 'sorting', name: '物流分拣中心', floor: y >= sortingStair.rise - .12 ? '夹层' : '1F' };
  if (inBounds(x, z, logisticsOffice)) return { id: 'office', name: '物流办公楼', floor: y >= officeStair.rise - .12 ? '2F' : '1F' };
  if (inBounds(x, z, controlMain) || inBounds(x, z, controlAnnex))
    return { id: 'control', name: '工业控制中心', floor: y >= controlStair.rise - .12 ? '2F' : '1F' };
  if (inBounds(x, z, vehicleCourt)) return { id: 'vehicle', name: '车辆转运场' };
  if (inBounds(x, z, repairShop)) return { id: 'repair', name: '设备维修厂', floor: y >= 3 ? '夹层' : '1F' };
  return undefined;
}

const loot = (id: string, label: string, item: Extract<MapInteraction,{kind:'loot'}>['item'], position: Vec3, quantity = 1): MapInteraction =>
  ({ id, label, item, position, kind: 'loot', quantity });
export const worksiteInteractions: readonly MapInteraction[] = [
  loot('transit-tools', '分拣工具箱', 'salvage', [-84, 1.12, -12.7], 2),
  loot('sort-scanner', '包裹复核台', 'terminal', [-70.9, 1.12, -8.3]),
  loot('sort-dispatch', '发货周转笼', 'sealbag', [-87.2, 1.12, 14.8]),
  loot('freight-loft-1', '分拣夹层签收台', 'manual', [-87, sortingStair.rise + 1.12, 16.8]),
  loot('office-reception', '物流接待台', 'manual', [5.8, 1.12, -10.6]),
  loot('office-archive', '运单档案柜', 'sealbag', [5.3, 1.12, -22.45]),
  loot('office-staff', '值班交接记录', 'terminal', [5.85, officeStair.rise + 1.12, -12.15]),
  loot('duty-card', '值班室文件盒', 'service-card', [8.35, officeStair.rise + 1.12, -22.5]),
  loot('vehicle-dispatch', '发车清单夹', 'manual', [-31.4, 1.12, -18.75]),
  { id: 'vehicle-coil', label: '铜线圈', item: 'coil', kind: 'loose', quantity: 1, position: [-51.15, .25, -19.05] },
  { id: 'vehicle-seals', label: '密封圈套件', item: 'seals', kind: 'loose', quantity: 1, position: [-30.1, .25, -5.35] },
  loot('plant-workshop', '厂区维修箱', 'salvage', [83.6, 1.12, -47.7], 2),
  loot('repair-press', '压装机工装箱', 'wrench', [81, 1.12, -27.0]),
  loot('filter-inspection', '过滤池计量箱', 'gauge', [130.5, 1.12, -5.3]),
  loot('control-test', '检测台仪表箱', 'gauge', [188.9, 1.12, -33.8]),
  loot('control-panel', '控制台模块槽', 'terminal', [197.5, 1.12, -33.0]),
  loot('control-service', '设备间维护柜', 'seals', [208.1, 1.12, -33.2]),
  loot('control-observation', '二层观测记录', 'board', [187.3, controlStair.rise + 1.12, -27.2]),
];
