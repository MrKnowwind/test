import type { MapInteraction, Vec3 } from '../contracts/demo.ts';

export const innPad = { minX:82, maxX:109, minZ:112, maxZ:138, height:3.1 };
export const innNorth = { minX:97, maxX:105, minZ:96, maxZ:112, northY:0, southY:innPad.height };
export const innSouth = { minX:97, maxX:105, minZ:138, maxZ:154, northY:innPad.height, southY:0 };
export const innBuilding = { minX:84.5, maxX:106.5, minZ:113.5, maxZ:136.5 };
export const innUpperY = innPad.height + 3.25;
export const innDoorX = 100.8;
export const innStair = { x:104.1, width:2.50, bottomZ:127.3, topZ:117.3 };
export const innGrades = [innNorth, {...innPad,northY:innPad.height,southY:innPad.height}, innSouth];

type Footprint = { minX:number; maxX:number; minZ:number; maxZ:number };
const inside=(area:Footprint,x:number,z:number)=>x>=area.minX&&x<=area.maxX&&z>=area.minZ&&z<=area.maxZ;

export function innFloor([x,y,z]:Vec3) {
  if(!inside(innBuilding,x,z)||y<innPad.height-.1)return undefined;
  return y>=innUpperY-.1?'2F':'1F';
}

export function innArea(feet:Vec3) {
  const [x,y,z]=feet;
  const floor=innFloor(feet);
  if(floor)return '海员旅馆 · '+floor;
  if((inside(innPad,x,z)&&y>=innPad.height-.1)||inside(innNorth,x,z)||inside(innSouth,x,z))return '海员旅馆';
  return undefined;
}

function cache(id:string,label:string,item:Extract<MapInteraction,{kind:'loot'}>['item'],x:number,z:number,level:number):MapInteraction {
  return {id:'inn-'+id,label,item,position:[x,level+1.08,z],kind:'loot',quantity:1};
}

export const innInteractions:readonly MapInteraction[]=[
  cache('reception','旅馆登记台','recorder',93.4,132.25,innPad.height),
  cache('luggage','寄存行李箱','sealbag',88.3,116.7,innPad.height),
  cache('linen','布草间储备柜','medkit',87.4,122.1,innPad.height),
  cache('crew','船员宿舍行李','sealbag',88.6,117.1,innUpperY),
  cache('twin','双床房床头柜','manual',88.6,124.4,innUpperY),
  cache('corner','转角客房书桌','terminal',88.6,132.4,innUpperY),
];
