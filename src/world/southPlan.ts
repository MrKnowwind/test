import type { MapInteraction, Vec3 } from '../contracts/demo.ts';

export const residentialPad = { minX:-148, maxX:-121, minZ:119, maxZ:149, height:3.9 };
export const communityPad = { minX:21, maxX:53, minZ:114, maxZ:139, height:3.6 };
export const transitPad = { minX:116, maxX:165, minZ:111, maxZ:132, height:3 };

// The arterials at Z=95 and Z=155 retain their straight, level centrelines.
export const residentialApproach = { minX:-128, maxX:-121, minZ:96, maxZ:119, northY:0, southY:residentialPad.height };
export const residentialSteps = { minX:-127, maxX:-121, minZ:149, maxZ:154.5, northY:residentialPad.height, southY:0, finishInset:.11 };
export const communityApproach = { minX:23, maxX:31, minZ:96, maxZ:114, northY:0, southY:communityPad.height };
export const communitySteps = { minX:23, maxX:31, minZ:139, maxZ:149, northY:communityPad.height, southY:0, finishInset:.11 };
export const transitNorth = { minX:120, maxX:128, minZ:96, maxZ:111, northY:0, southY:transitPad.height };
export const transitSouth = { minX:120, maxX:128, minZ:132, maxZ:150, northY:transitPad.height, southY:0 };
export const southPads = [residentialPad, communityPad, transitPad] as const;
export const southGrades = [
  residentialApproach, residentialSteps, communityApproach, communitySteps, transitNorth, transitSouth,
  ...southPads.map(pad => ({ ...pad, northY:pad.height, southY:pad.height })),
];

export const southBuildings = [
  { minX:33, maxX:51, minZ:118, maxZ:132 },
  { minX:132, maxX:146, minZ:113, maxZ:130 },
  { minX:151, maxX:163, minZ:116, maxZ:129 },
] as const;

export function southernArea([x,y,z]: Vec3) {
  for (const [pad, label, approaches, minZ, maxZ] of [
    [residentialPad, '港务家属区', [residentialApproach, residentialSteps], 94.9, 155.2],
    [communityPad, '社区救护与活动中心', [communityApproach, communitySteps], 95, 150],
    [transitPad, '交通站与餐饮广场', [transitNorth, transitSouth], 95, 159],
  ] as const) {
    if (x >= pad.minX && x <= pad.maxX && z >= pad.minZ && z <= pad.maxZ && y >= pad.height - .08) return label;
    if (z >= minZ && z <= maxZ &&
        approaches.some(a => x >= a.minX && x <= a.maxX && (z < pad.minZ || z > pad.maxZ))) return label;
  }
  return undefined;
}

const supplies = (id: string, label: string, item: Extract<MapInteraction,{kind:'loot'}>['item'], position: Vec3): MapInteraction =>
  ({id,label,item,position,kind:'loot',quantity:1});
export const southInteractions: readonly MapInteraction[] = [
  supplies('community-medical','救护用品柜','medkit',[47.5,communityPad.height+1.08,121.5]),
  supplies('community-reception','社区服务台抽屉','manual',[38.2,communityPad.height+1.08,129.5]),
  supplies('community-activity','活动室器材箱','sealbag',[47.5,communityPad.height+1.08,129.6]),
  supplies('transit-dispatch','发车调度台','terminal',[136,transitPad.height+1.08,116.2]),
  supplies('transit-luggage','候车行李柜','sealbag',[142,transitPad.height+1.08,127.3]),
  supplies('transit-catering','餐饮备餐柜','medkit',[160.2,transitPad.height+1.08,119]),
];
