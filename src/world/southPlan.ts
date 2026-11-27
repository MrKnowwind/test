import type { MapInteraction, Vec3 } from '../contracts/demo.ts';

// Roads are defined by centre and dimensions. Approaches within the block meet their inner kerbs.
export const southernArterials = {
  north: [20,95,360,10],
  south: [10,155,340,12],
} as const;
export const southernKerb = {
  north: southernArterials.north[1] + southernArterials.north[3] / 2,
  south: southernArterials.south[1] - southernArterials.south[3] / 2,
};

export const residentialPad = { minX:-148, maxX:-121, minZ:119, maxZ:southernKerb.south-.55, height:3.9 };
export const communityPad = { minX:21, maxX:53, minZ:114, maxZ:139, height:3.6 };
export const transitPad = { minX:116, maxX:165, minZ:111, maxZ:132, height:3 };

// The arterials at Z=95 and Z=155 retain their straight, level centrelines.
export const residentialApproach = { minX:-128, maxX:-121, minZ:southernKerb.north, maxZ:119, northY:0, southY:residentialPad.height };
// Set the steps into the outer half of the front court, leaving a flat porch at the houses.
export const residentialSteps = { minX:-123.2, maxX:residentialPad.maxX, minZ:142.4, maxZ:southernKerb.south, northY:residentialPad.height, southY:0, finishInset:.11 };
export const communityApproach = { minX:23, maxX:31, minZ:southernKerb.north, maxZ:114, northY:0, southY:communityPad.height };
export const communitySteps = { minX:23, maxX:31, minZ:139, maxZ:southernKerb.south, northY:communityPad.height, southY:0, finishInset:.11 };
export const transitNorth = { minX:120, maxX:128, minZ:southernKerb.north, maxZ:111, northY:0, southY:transitPad.height };
export const transitSouth = { minX:120, maxX:128, minZ:132, maxZ:southernKerb.south, northY:transitPad.height, southY:0 };
export const southGrades = [
  residentialApproach, residentialSteps, communityApproach, communitySteps, transitNorth, transitSouth,
  ...[
    { ...residentialPad, maxX:residentialSteps.minX },
    { ...residentialPad, minX:residentialSteps.minX, maxZ:residentialSteps.minZ },
    communityPad, transitPad,
  ].map(pad => ({ ...pad, northY:pad.height, southY:pad.height })),
];

export const southBuildings = [
  { minX:33, maxX:51, minZ:118, maxZ:132 },
  { minX:132, maxX:146, minZ:113, maxZ:130 },
  { minX:151, maxX:163, minZ:116, maxZ:129 },
] as const;

export function southernArea([x,y,z]: Vec3) {
  for (const [pad, label, approaches] of [
    [residentialPad, '港务家属区', [residentialApproach, residentialSteps]],
    [communityPad, '社区救护与活动中心', [communityApproach, communitySteps]],
    [transitPad, '交通站与餐饮广场', [transitNorth, transitSouth]],
  ] as const) {
    if (x >= pad.minX && x <= pad.maxX && z >= pad.minZ && z <= pad.maxZ && y >= pad.height - .08) return label;
    if (approaches.some(a => x >= a.minX && x <= a.maxX && z >= a.minZ && z <= a.maxZ)) return label;
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
