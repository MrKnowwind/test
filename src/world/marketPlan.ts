import type { MapInteraction, Vec3 } from '../contracts/demo.ts';
import { southernKerb } from './southPlan.ts';

export const marketCourt = { minX:-78, maxX:-56, minZ:101, maxZ:122 };
// The south court and west path meet on one edge and share the same paving height.
export const marketAprons = [
  { minX:marketCourt.minX, maxX:marketCourt.maxX, minZ:117, maxZ:121 },
  { minX:-78.575, maxX:-77.325, minZ:101.15, maxZ:117 },
  { minX:-78.575, maxX:marketCourt.minX, minZ:117, maxZ:118.05 },
];

export const marketShops = [
  { minX:-77, maxX:-71, minZ:105, maxZ:117, entryX:-74, label:'便利店' },
  { minX:-71, maxX:-64, minZ:106, maxZ:117, entryX:-67.2, label:'五金杂货铺' },
  { minX:-64, maxX:-57, minZ:107.5, maxZ:116.5, entryX:-60.2, label:'街角食铺' },
] as const;

export const pharmacyPad = { minX:-77, maxX:-58.5, minZ:130, maxZ:146, height:1.6 };
export const pharmacyNorth = { minX:-70, maxX:-62, minZ:121, maxZ:130, northY:0, southY:pharmacyPad.height };
export const pharmacySouth = { minX:-70, maxX:-62, minZ:146, maxZ:southernKerb.south, northY:pharmacyPad.height, southY:0, finishInset:.09 };
export const pharmacy = { minX:-75.5, maxX:-59.8, minZ:131.1, maxZ:144.5 };

export const parkingPad = { minX:183, maxX:208, minZ:116, maxZ:144, height:2 };
export const parkingNorth = { minX:194, maxX:202, minZ:100, maxZ:116, northY:0, southY:parkingPad.height };
export const parkingSouth = { minX:194, maxX:202, minZ:144, maxZ:154, northY:parkingPad.height, southY:0 };
export const parkingKiosk = { minX:184.5, maxX:189.9, minZ:135.5, maxZ:141.9 };
export const marketBuildings = [...marketShops, pharmacy, parkingKiosk];

export const marketGrades = [
  pharmacyNorth, pharmacySouth, parkingNorth, parkingSouth,
  ...[pharmacyPad,parkingPad].map(pad=>({...pad,northY:pad.height,southY:pad.height})),
];

export function marketArea([x,y,z]:Vec3) {
  const contains=(area:{minX:number;maxX:number;minZ:number;maxZ:number})=>
    x>=area.minX&&x<=area.maxX&&z>=area.minZ&&z<=area.maxZ;
  const shop=marketShops.find(contains);
  if(shop)return '生活商街 · '+shop.label;
  if(contains(marketCourt))return '生活商街';
  if((contains(pharmacyPad)&&y>=pharmacyPad.height-.08)||contains(pharmacyNorth)||contains(pharmacySouth))return '极光药局';
  if((contains(parkingPad)&&y>=parkingPad.height-.08)||contains(parkingNorth)||contains(parkingSouth))return '公共停车场';
  return undefined;
}

const cache=(id:string,label:string,item:Extract<MapInteraction,{kind:'loot'}>['item'],position:Vec3):MapInteraction=>
  ({id,label,item,position,kind:'loot',quantity:1});
const py=pharmacyPad.height, vy=parkingPad.height;
export const marketInteractions:readonly MapInteraction[]=[
  cache('market-convenience','便利店补货箱','sealbag',[-75.3,1.08,111]),
  cache('market-hardware','五金配件屉','wrench',[-69.25,1.08,113.7]),
  cache('market-kitchen','食铺柜台储物箱','manual',[-58.55,1.08,112.7]),
  cache('room-clinic-8','极光药局 · 药品柜','medkit',[-72.8,py+1.08,138.4]),
  cache('pharmacy-cold','药局冷藏柜','healing-injector',[-61.5,py+1.08,133.6]),
  cache('pharmacy-treatment','诊疗室应急箱','medkit',[-61.6,py+1.08,142.2]),
  cache('parking-booth','收费亭抽屉','manual',[186,vy+1.08,138.7]),
  cache('parking-charge','充电设备检修盒','terminal',[205.35,vy+1.08,136]),
];
