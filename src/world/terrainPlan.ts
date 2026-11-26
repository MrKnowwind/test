import type { MapInteraction, Vec3 } from '../contracts/demo.ts';
import { researchApproach, researchPad, researchSteps } from './researchPlan.ts';
import { residentialPad, southGrades } from './southPlan.ts';
import { marketGrades } from './marketPlan.ts';
import { innGrades } from './innPlan.ts';

// World Y=0 is the original city datum, 2.1 m above the sea.
export const northTerrace={minX:-160,maxX:-103,minZ:-218,maxZ:-111,crestZ:-166,height:8};
export const coldChainPad = { minX: 26, maxX: 54, minZ: 0, maxZ: 70, height: 3.6 };
export const northGatePad = { minX: 22, maxX: 44, minZ: -220, maxZ: -198, height: 1.8 };

type Grade = {
  minX: number; maxX: number; minZ: number; maxZ: number;
  northY: number; southY: number;
  finishInset?: number;
};

export const newTerrainSections: readonly Grade[] = [
  { ...coldChainPad, maxZ: 22, northY: 0, southY: coldChainPad.height },
  { ...coldChainPad, minZ: 22, maxZ: 48, northY: coldChainPad.height, southY: coldChainPad.height },
  { ...coldChainPad, minZ: 48, northY: coldChainPad.height, southY: 0 },
  { ...northGatePad, maxZ: -209, northY: northGatePad.height, southY: northGatePad.height },
  { ...northGatePad, minZ: -209, northY: northGatePad.height, southY: 0 },
  { ...researchApproach, northY: researchPad.height, southY: 0 },
  { ...researchSteps, northY: 0, southY: researchPad.height, finishInset: .10 },
  ...southGrades,
  ...marketGrades,
  ...innGrades,
];

export const terrainSections: readonly Grade[] = [
  { ...northTerrace, maxZ: northTerrace.crestZ, northY: northTerrace.height, southY: northTerrace.height },
  { ...northTerrace, minZ: northTerrace.crestZ, northY: northTerrace.height, southY: 0 },
  { ...researchPad, northY: researchPad.height, southY: researchPad.height },
  ...newTerrainSections,
];

export function terrainSectionAt(x: number, z: number) {
  return terrainSections.find(p => x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ);
}

export function gradeHeight(p: Grade, z: number) {
  return p.northY + (p.southY - p.northY) * (z - p.minZ) / (p.maxZ - p.minZ);
}

export function terrainHeight(x: number, z: number) {
  const section = terrainSectionAt(x, z);
  return section ? gradeHeight(section, z) : null;
}
export const civicBuildings=[
  {id:'north-customs',label:'北部海关检查厅',minX:-153,maxX:-127,minZ:-190,maxZ:-168},
  {id:'north-observatory',label:'海岸气象观察站',minX:-153,maxX:-129,minZ:-213,maxZ:-196},
  {id:'residential-row',label:'港务联排住宅',minX:-144,maxX:-126,minZ:121,maxZ:148},
] as const;
export const houses=[{z:125.5,style:'living'},{z:134.5,style:'family'},{z:143.5,style:'studio'}] as const;
const found=(id:string,label:string,item:Extract<MapInteraction,{kind:'loot'}>['item'],position:Vec3):MapInteraction=>({id,label,item,position,kind:'loot',quantity:1});
export const civicInteractions:readonly MapInteraction[]=[
  found('north-customs-desk','海关登记台','manual',[-149,9.07,-179]),
  found('north-customs-locker','旅客检验柜','sealbag',[-136,9.07,-185]),
  found('north-observatory-console','气象记录终端','terminal',[-141,9.07,-204]),
  found('north-observatory-upper','观测平台设备柜','board',[-141,12.47,-204]),
  ...houses.flatMap((h,i)=>[
    found(`residential-${i}-ground`,['客厅置物柜','家庭厨房储物柜','工作间抽屉'][i],(['manual','medkit','salvage'] as const)[i],[-136,residentialPad.height+1.07,h.z]),
    found(`residential-${i}-upper`,['主卧行李柜','儿童房书桌','阁楼数据盒'][i],(['sealbag','manual','terminal'] as const)[i],[-137,residentialPad.height+4.27,h.z]),
  ]),
];
