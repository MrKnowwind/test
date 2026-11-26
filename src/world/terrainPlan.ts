import type { MapInteraction, Vec3 } from '../contracts/demo.ts';

// 3.5C first constructed terrace. World Y=0 is the surviving legacy city,
// not the sea; other district platforms are migrated in subsequent slices.
export const northTerrace={minX:-160,maxX:-103,minZ:-218,maxZ:-111,crestZ:-166,height:8};
export function terrainHeight(x:number,z:number):number|null{
  const p=northTerrace;
  if(x<p.minX||x>p.maxX||z<p.minZ||z>p.maxZ)return null;
  return p.height*Math.min(1,(p.maxZ-z)/(p.maxZ-p.crestZ));
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
    found(`residential-${i}-ground`,['客厅置物柜','家庭厨房储物柜','工作间抽屉'][i],(['manual','medkit','salvage'] as const)[i],[-136,1.07,h.z]),
    found(`residential-${i}-upper`,['主卧行李柜','儿童房书桌','阁楼数据盒'][i],(['sealbag','manual','terminal'] as const)[i],[-137,4.27,h.z]),
  ]),
];
