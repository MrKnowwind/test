import * as THREE from 'three';
import type { EnemySpawn, ExitZone, FirstMap, Vec3 } from '../contracts/demo.ts';
import { createEnvironment, mapInteractions } from './environment.ts';
import { createWorldQueries, lab } from './worldQueries.ts';
import { loosePoints } from './loosePoints.ts';
import { createShopDoors } from './shopDoors.ts';
import { roll } from '../raid/loot.ts';
import { supplySites } from './supplySites.ts';
import { coldChainPad, northTerrace } from './terrainPlan.ts';

import { districtPoint, servicePosition } from './layout.ts';
import { regularExits, spawnPoints } from './raidPlan.ts';

const botPosts: readonly Vec3[] = [[20, lab.y, -31.2], [9.7, lab.y, -35.6], [-4, lab.y, -32]];
function placeEnemies(seed: number): EnemySpawn[] {
  const infected: readonly Vec3[] = [
    [-35, -.8, 0], [-52, -.8, -14], [-42, -.8, -28],
    [-21, 0, -13], [3, 0, 11], [-78, 0, -8], [33, 0, 24], [53, 0, -5],
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

export function createFirstMap(seed: number, environment = createEnvironment()): FirstMap & { scene: import('three').Group; doors:ReturnType<typeof createShopDoors>; updateExitLights(state:(exit:ExitZone)=>string):void } {
  const { scene, solids, rooms } = environment;
  const doors=createShopDoors(scene,solids,rooms.doors);
  const queries=createWorldQueries(solids);
  const loose=loosePoints(seed,mapInteractions,p=>queries.blockedDistance(p,[0,-1,0],3));
  // Spread five indoor encounters over the map, away from every insertion point.
  const indoor:EnemySpawn[]=[];
  const candidates=rooms.occupants.filter(e=>spawnPoints.every(s=>Math.hypot(s.position[0]-e.position[0],s.position[2]-e.position[2])>20));
  candidates.sort((a,b)=>roll(seed,a.id,0)-roll(seed,b.id,0));
  for(const e of candidates){
    if(indoor.every(other=>Math.hypot(other.position[0]-e.position[0],other.position[2]-e.position[2])>35))indoor.push(e);
    if(indoor.length===5)break;
  }
  const exits: ExitZone[] = [
      ...regularExits,
      { id: 'service-passage', label: '维修通道', position: servicePosition, radius: 2,
        requirements: [{ kind: 'item', id: 'service-card' }] },
      { id: 'lab-lift', remote: { flag: 'lab-power', seconds: 12 }, label: '实验室货梯', position: districtPoint('research', [-4.6, lab.y, -25]), radius: 1.85,
        requirements: [{ kind: 'flag', id: 'lab-power' }] },
    ];
  const rings = exits.map(exit => {
    const material = new THREE.MeshBasicMaterial({color: 0x67e1b1, polygonOffset: true, polygonOffsetFactor: -2});
    const ring = new THREE.Mesh(new THREE.RingGeometry(exit.radius - .12, exit.radius, 64), material);
    ring.name = 'exit-boundary-' + exit.id;
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(exit.position[0], exit.position[1] + .055, exit.position[2]);
    scene.add(ring);
    return material;
  });
  function updateExitLights(state: (exit: ExitZone) => string) {
    exits.forEach((exit, i) => {
      const status = state(exit);
      rings[i].color.setHex(status === 'active' ? 0xffdf71 : status === 'ready' ? 0x53e4bd : 0xeb825e);
    });
  }
  return {
    ...queries, scene, doors, spawnPoints, exits, updateExitLights,
    regions: [
      { id: 'north-terrace', label: '北部高地 · 海关与气象站', center: [-134,northTerrace.height,-186], radius: 53 },
      { id: 'residential-row', label: '港务家属区', center: [-135,0,134.5], radius: 27 },
      { id: 'lab', label: '地下实验室 · 高风险', center: districtPoint('research', [9, lab.y, -31]), radius: 21 },
      { id: 'plant', label: '03 处理厂区', center: districtPoint('plant', [41, 0, -5]), radius: 45 },
      { id: 'research', label: '04 生化研究设施', center: districtPoint('research', [20.5, 0, -23]), radius: 50 },
      { id: 'wharf', label: '01 货运码头', center: districtPoint('wharf', [-45, -.8, -5]), radius: 50 },
      { id: 'warehouse', label: '02 物流仓储', center: [-4, 0, 8], radius: 50 },
      { id: 'cold-chain', label: '冷链仓库', center: [38, coldChainPad.height, 35], radius: 20 },
      { id: 'switchgear', label: '备件配电仓', center: [120, 0, -76], radius: 20 },
      { id: 'approach', label: '05 南侧公路', center: [-4, 0, 125], radius: 260 },
    ],
    interactions: [...mapInteractions,...loose,...rooms.cases,...doors.targets],
    enemies: [...placeEnemies(seed),...indoor],
  };
}
