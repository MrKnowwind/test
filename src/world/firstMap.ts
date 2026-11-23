import type { EnemySpawn, FirstMap, Vec3 } from '../contracts/demo.ts';
import { createEnvironment, mapInteractions } from './environment.ts';
import { createWorldQueries, lab } from './worldQueries.ts';
import { loosePoints } from './loosePoints.ts';
import { supplySites } from './supplySites.ts';

import { districtPoint, highwayPosition, servicePosition } from './layout.ts';

const botPosts: readonly Vec3[] = [[20, lab.y, -31.2], [9.7, lab.y, -35.6], [-4, lab.y, -32]];
function placeEnemies(seed: number): EnemySpawn[] {
  const infected: readonly Vec3[] = [
    [-35, -.8, 0], [-52, -.8, -14], [-42, -.8, -28],
    [-21, 0, -13], [3, 0, 11], [13, 0, 15], [33, 0, 24], [53, 0, -5],
    [12, 0, -33], [28, 0, -36], [5.5, lab.y, -29], [22.5, lab.y, -34],
  ];
  const mixed = Math.imul((seed >>> 0) ^ 0x74e13ca9, 0x45d9f3b);
  const post = ((mixed ^ mixed >>> 16) >>> 0) % botPosts.length;
  return [
    ...infected.map((position, index): EnemySpawn => ({ id: 'infected-' + (index + 1), position: districtPoint(index < 3 ? 'wharf' : index < 6 ? 'warehouse' : index < 8 ? 'plant' : 'research', position), yaw: Math.PI, kind: 'infected' })),
    ...[[ -78,0,-25],[90,0,-54],[83,0,-175],[7,0,-129]].map((position,index): EnemySpawn => ({id:'district-infected-'+index,position:position as unknown as Vec3,yaw:Math.PI,kind:'infected'})),
    { id: 'lab-security', position: districtPoint('research', botPosts[post]), yaw: Math.PI, kind: 'security-bot' },
    ...supplySites.filter(site => site.risk === '高').flatMap(site => [-1, 1].map((side): EnemySpawn => ({
      id: `${site.id}-guard-${side}`, position: [site.x + side * 6, 0, site.z + 9], yaw: Math.PI, kind: 'infected',
    }))),
  ];
}

export function createFirstMap(seed: number): FirstMap & { scene: import('three').Group } {
  const { scene, solids } = createEnvironment();
  const queries=createWorldQueries(solids);
  const loose=loosePoints(seed,mapInteractions,p=>queries.blockedDistance(p,[0,-1,0],3));
  return {
    ...queries, scene,
    spawnPoints: [
      { id: 'south-loading', position: [-24, 0, 143], yaw: -.35 },
      { id: 'warehouse-alley', position: [149, 0, 83], yaw: .38 },
      { id: 'scrap-shelter', position: [-138, -.8, 24], yaw: .37 },
    ],
    exits: [
      { id: 'highway', label: '公路出口', position: highwayPosition, radius: 2.2, requirements: [] },
      { id: 'service-passage', label: '维修通道', position: servicePosition, radius: 2,
        requirements: [{ kind: 'item', id: 'service-card' }] },
      { id: 'lab-lift', label: '实验室货梯', position: districtPoint('research', [-4.6, lab.y, -25]), radius: 1.85,
        requirements: [{ kind: 'flag', id: 'lab-power' }] },
    ],
    regions: [
      { id: 'lab', label: '地下实验室 · 高风险', center: districtPoint('research', [9, lab.y, -31]), radius: 21 },
      { id: 'plant', label: '03 处理厂区', center: districtPoint('plant', [41, 0, -5]), radius: 45 },
      { id: 'research', label: '04 生化研究设施', center: districtPoint('research', [20.5, 0, -23]), radius: 50 },
      { id: 'wharf', label: '01 货运码头', center: districtPoint('wharf', [-45, -.8, -5]), radius: 50 },
      { id: 'warehouse', label: '02 物流仓储', center: [-4, 0, 8], radius: 50 },
      { id: 'approach', label: '05 南侧公路', center: [-4, 0, 125], radius: 260 },
    ],
    interactions: [...mapInteractions,...loose],
    enemies: placeEnemies(seed),
  };
}
