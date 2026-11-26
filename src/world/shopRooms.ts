import * as THREE from 'three';
import type { EnemySpawn, MapInteraction, Vec3 } from '../contracts/demo.ts';
import { box, cylinder } from './detail/geometry.ts';
import { emissive, type Materials } from './detail/materialLibrary.ts';
import type { Fixture } from './portLots.ts';

export type Door = { id: string; x: number; z: number; alongX: boolean; label: string };
export type ShopRooms = { doors: Door[]; cases: MapInteraction[]; occupants: EnemySpawn[] };
export type FixtureSite = { x: number; z: number; nx: number; nz: number };
export type BuildSolid = (at: Vec3, size: Vec3, material: THREE.Material, bevel?: number) => THREE.Mesh;
export const doorWidth = 1.9;
export const doorHeight = 2.5;

const caseHeight = 1.10;
const lamp = emissive(0x8ce7d2, .5);
const stores = {
  counter: ['交接抽屉', 'manual'],
  rack: ['货架封签箱', 'sealbag'],
  packing: ['打包耗材箱', 'sealbag'],
  files: ['记录档案屉', 'manual'],
  bench: ['检修工具盘', 'wrench'],
  pump: ['泵座密封件', 'seals'],
  switchboard: ['电气端子柜', 'terminal'],
  wash: ['清洗滤件盒', 'seals'],
  lockers: ['工装储物柜', 'sealbag'],
  break: ['值班储物盒', 'manual'],
  kitchen: ['配餐耗材箱', 'sealbag'],
  bunks: ['铺位行李柜', 'sealbag'],
  laundry: ['布料收纳箱', 'sealbag'],
  testing: ['校验仪器盒', 'gauge'],
  dispatch: ['调度记录盘', 'terminal'],
  seating: ['候车资料夹', 'manual'],
} as const satisfies Record<Fixture, readonly [string, Extract<MapInteraction,{kind:'loot'}>['item']]>;

export function fixturePosition(site: FixtureSite): Vec3 {
  return [site.x - site.nx * .47, caseHeight, site.z - site.nz * .47];
}

export function buildRoomFixture(root: THREE.Group, m: Materials, solid: BuildSolid, role: Fixture,
  site: FixtureSite, accent: THREE.Material): void {
  const [x,,z] = fixturePosition(site);
  const { nx, nz } = site;
  const alongX = nx === 0;
  const at = (u: number, y: number, v: number): Vec3 => [x + u * nz - v * nx, y, z - u * nx - v * nz];
  const size = (w: number, h: number, d: number): Vec3 => alongX ? [w,h,d] : [d,h,w];
  const block = (u: number, y: number, v: number, w: number, h: number, d: number, tint: THREE.Material) =>
    box(root, tint, ...size(w,h,d), ...at(u,y,v), .024);
  const body = (u: number, y: number, v: number, w: number, h: number, d: number, tint: THREE.Material) =>
    solid(at(u,y,v),size(w,h,d),tint,.042);
  function counter(w: number, d: number, material: THREE.Material) {
    body(0,.52,0,w,1.04,d,material);
    block(0,1.047,0,w+.04,.035,d+.04,m.zinc);
  }
  function console(u: number, y: number, width: number) {
    block(u,y,-.30,width,.42,.11,m.rubber);
    block(u,y+.031,-.23,width*.81,.19,.028,lamp);
    for(const du of [-.15,0,.15]) block(u+du,y-.14,-.223,.058,.042,.027,accent);
  }
  switch (role) {
    case 'rack':
    case 'files':
    case 'lockers': {
      const tall = role === 'files' ? 1.83 : role === 'lockers' ? 2.09 : 2.28;
      counter(1.63,.78,role === 'files' ? m.timber : accent);
      for(const side of [-1,1]) body(side*.86,tall/2,0,.08,tall,.75,m.steel);
      if (role === 'rack') for (const level of [1.66,2.22]) {
        block(0,level,-.10,1.62,.10,.54,m.steel);
        for(const side of [-1,1]) block(side*.42,level+.19,-.12,.61,.28,.41,side<0?m.timber:m.ceramic);
      }
      if (role === 'files') for(const level of [.21,.45,.70,1.54]) {
        block(0,level,.398,1.53,.20,.045,m.ceramic);
        block(0,level,.425,.25,.048,.045,m.steel);
      }
      if (role === 'lockers') for(const side of [-1,1]) {
        body(side*.50,1.57,-.15,.54,1.04,.47,m.steel);
        block(side*.50,1.73,.095,.27,.12,.055,m.zinc);
      }
      return;
    }
    case 'pump':
    case 'wash':
    case 'laundry': {
      counter(1.8,.82,role === 'pump' ? m.steel : m.ceramic);
      if (role === 'pump') {
        const [px,py,pz] = at(-.63,1.28,-.02);
        const motor = cylinder(root, accent,.24,.55,px,py,pz,12);
        motor.rotation.z=Math.PI/2;
        block(-.61,1.46,-.19,.38,.16,.22,m.zinc);
      }
      if (role === 'wash') {
        block(-.58,1.091,-.12,.51,.04,.33,m.rubber);
        block(-.58,1.32,-.27,.06,.44,.08,m.zinc);
        block(-.58,1.51,-.16,.063,.065,.25,m.zinc);
      }
      if (role === 'laundry') for (const side of [-1,1]) {
        block(side*.52,.60,.42,.54,.55,.06,m.rubber);
        block(side*.52,.60,.46,.42,.42,.037,accent);
      }
      return;
    }
    case 'switchboard':
    case 'testing':
    case 'dispatch': {
      counter(1.58,.74,role === 'dispatch' ? m.timber : m.steel);
      console(0,role==='switchboard'?1.80:1.47,1.37);
      if (role === 'switchboard') for(const u of [-.56,-.28,0,.28,.56])
        block(u,.42,.39,.093,.46,.085,m.zinc);
      if (role === 'testing') {
        block(-.56,1.20,.07,.23,.27,.33,accent);
        block(.56,1.20,.07,.23,.27,.33,accent);
      }
      if (role === 'dispatch') block(0,2.02,-.35,1.61,.23,.055,m.zinc);
      return;
    }
    case 'packing':
    case 'bench':
    case 'counter': {
      counter(role==='packing'?1.96:1.65,.71,role==='bench'?m.steel:m.timber);
      if (role === 'packing') {
        for (const u of [-.71,.71]) block(u,1.23,-.12,.36,.36,.47,m.ceramic);
        block(0,1.55,-.27,1.45,.10,.23,accent);
      }
      if (role === 'bench') {
        block(0,1.67,-.33,1.54,.63,.08,accent);
        for(const u of [-.58,-.29,.26,.55]) block(u,1.69,-.26,.08,.37,.10,m.zinc);
      }
      if (role === 'counter') console(-.50,1.27,.44);
      return;
    }
    case 'kitchen':
    case 'break':
    case 'bunks':
    case 'seating': {
      counter(1.60,.71,role==='kitchen'?m.ceramic:m.timber);
      if (role === 'kitchen') {
        for(const u of [-.58,.58]) {
          const [cx,cy,cz]=at(u,1.081,.12);
          cylinder(root,m.rubber,.17,.035,cx,cy,cz,16);
        }
        block(0,1.84,-.30,1.57,.16,.23,m.steel);
      }
      if (role === 'break' || role === 'seating') {
        body(0,.23,.58,1.68,.45,.37,accent);
        block(0,.54,.64,1.56,.17,.34,m.ceramic);
      }
      if (role === 'bunks') {
        block(0,1.65,-.22,1.58,.19,.45,accent);
        block(-.53,1.79,-.19,.32,.12,.36,m.ceramic);
      }
    }
  }
}

export function roomCase(id: string, role: Fixture, site: FixtureSite): MapInteraction {
  const [label,item] = stores[role];
  return { id, label, item, position: fixturePosition(site), kind: 'loot', quantity: 1 };
}
