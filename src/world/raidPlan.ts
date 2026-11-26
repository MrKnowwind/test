import type { ExitZone, SpawnPoint } from '../contracts/demo.ts';
import { northGatePad, northTerrace } from './terrainPlan.ts';

export const spawnPoints = [
  { id: 'N-A', label: '西北港区入口', side: 'north', position: [-115, northTerrace.height, -203], yaw: Math.PI },
  { id: 'N-B', label: '北部服务道路', side: 'north', position: [-65, 0, -203], yaw: Math.PI },
  { id: 'N-C', label: '科研园侧路', side: 'north', position: [141, 0, -203], yaw: Math.PI },
  { id: 'N-D', label: '东北外环', side: 'north', position: [211, 0, -135], yaw: Math.PI / 2 },
  { id: 'S-A', label: '西南接驳路', side: 'south', position: [-151, 0, 82], yaw: -Math.PI / 2 },
  { id: 'S-B', label: '住宅区外侧', side: 'south', position: [-83, 0, 158], yaw: 0 },
  { id: 'S-C', label: '交通站外侧', side: 'south', position: [123, 0, 158], yaw: 0 },
  { id: 'S-D', label: '东南公路', side: 'south', position: [204, 0, 82], yaw: Math.PI / 2 },
] as const satisfies readonly SpawnPoint[];

export const regularExits: readonly ExitZone[] = [
  { id: 'highway', label: '南部公路出口', position: [26, 0, 171], radius: 2.2, requirements: [], openForSpawnSide: 'north' },
  { id: 'north-gate', label: '北部检查口', position: [26, northGatePad.height, -212], radius: 2.2, requirements: [], openForSpawnSide: 'south' },
];
