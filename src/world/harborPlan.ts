import type { MapInteraction, Vec3 } from '../contracts/demo.ts';

// Stage B integrates the new harbor with the existing land map. C will raise
// the surrounding terrain; all harbor heights here are current world metres.
export const shipEnvelope={minX:-207,maxX:-186,minZ:-77,maxZ:12};
export const shipDeck={minX:-206,maxX:-186,minZ:-69,maxZ:5};
export const shipLevels={cabin:.7,upper:4.1,sea:-2.1};
export const gangways=[-48,0].map(z=>({minX:-186.2,maxX:-164.8,minZ:z-1.6,maxZ:z+1.6,z}));
export const offshoreWalkAreas=[shipDeck,...gangways];
export const harborBuildings=[
  {id:'terminal',label:'客运候船厅',minX:-153,maxX:-122,minZ:-96,maxZ:-73},
  {id:'repair',label:'装卸维修工棚',minX:-169,maxX:-158,minZ:19,maxZ:35},
  {id:'dispatch',label:'港务调度办公室',minX:-154,maxX:-130,minZ:37,maxZ:54},
] as const;

export const openContainerPlans=[
  {id:'cargo-luggage',x:-143,z:15,style:'luggage',tint:[49,166,177]},
  {id:'cargo-tools',x:-143,z:4,style:'tools',tint:[125,114,203]},
  {id:'cargo-cold',x:-135,z:-1,style:'cold',tint:[250,179,73]},
  {id:'cargo-spares',x:-135,z:-31,style:'spares',tint:[49,166,177]},
] as const;
const loot=(id:string,label:string,item:Extract<MapInteraction,{kind:'loot'}>['item'],position:Vec3):MapInteraction=>({id,label,item,position,kind:'loot',quantity:1});
export const harborInteractions:readonly MapInteraction[]=[
  ...openContainerPlans.map((c,i)=>loot('harbor-'+c.id,['装卸行李箱','机修工具箱','冷链储物箱','备件收纳箱'][i],(['manual','salvage','medkit','terminal'] as const)[i],[c.x,-.8+.87,c.z-2.05])),
  loot('harbor-terminal-luggage','候船厅行李存放处','manual',[-149,1.07,-83]),
  loot('harbor-terminal-desk','客运登记台','terminal',[-128,1.07,-90]),
  loot('harbor-repair-tools','工棚备件台','salvage',[-166,1.07,31.4]),
  loot('harbor-dispatch-records','调度一层文件柜','manual',[-150,1.07,49.5]),
  loot('harbor-dispatch-office','调度二层设备','board',[-137,4.55,49.8]),
  loot('ship-reception','邮轮接待登记箱','manual',[-202,1.77,-62]),
  loot('ship-cabin-a','客房 A 行李箱','sealbag',[-203.6,1.57,-51]),
  loot('ship-cabin-b','客房 B 储物箱','manual',[-203.6,1.57,-43]),
  loot('ship-cabin-c','客房 C 旅行包','medkit',[-203.6,1.57,-35]),
  loot('ship-lounge','休息厅服务台','manual',[-203,1.77,-24]),
  loot('ship-medical','船舱医务柜','medkit',[-198,1.77,-9]),
  loot('ship-luggage','船员储物处','salvage',[-197.8,1.77,1.6]),
  loot('ship-upper-service','上甲板服务室','terminal',[-199,5.17,-59]),
  loot('ship-upper-locker','观景甲板储藏柜','manual',[-192.8,5.17,-19]),
];

export const isShip=(p:Vec3)=>p[0]>=shipDeck.minX-.1&&p[0]<=shipDeck.maxX+.1&&p[2]>=shipDeck.minZ&&p[2]<=shipDeck.maxZ;
export const harborFloor=(p:Vec3)=>isShip(p)?p[1]>=shipLevels.upper-.25?'上甲板':'船舱':p[0]<-172?'登船连桥':'地面';
