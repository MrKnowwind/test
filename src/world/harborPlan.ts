import type { MapInteraction, Vec3 } from '../contracts/demo.ts';

// Stage B integrates the new harbor with the existing land map. C will raise
// the surrounding terrain; all harbor heights here are current world metres.
// The hull is 167×44 m; the envelope also includes outboard rescue craft.
export const shipEnvelope={minX:-232,maxX:-186,minZ:-112,maxZ:55};
export const shipOutline=[[-208,-112],[-195,-105],[-186,-93],[-186,42],[-190,50],[-199,55],[-217,55],[-226,50],[-230,42],[-230,-93],[-221,-105]] as const;
export const shipDeck={minX:-229,maxX:-186,minZ:-92,maxZ:42};
export const shipLevels={cabin:.7,upper:4.1,sun:7.65,sea:-2.1};
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
  loot('ship-galley','配餐间冷藏柜','medkit',[-225,1.77,-84]),
  loot('ship-dining','餐厅服务台','manual',[-225,1.77,-67]),
  loot('ship-cabin-d','家庭客房储物箱','sealbag',[-225,1.77,-51]),
  loot('ship-cabin-e','双床客房旅行包','manual',[-225,1.77,-34]),
  loot('ship-theater','影音厅设备柜','terminal',[-225,1.77,-16]),
  loot('ship-laundry','洗衣房物料柜','salvage',[-225,1.77,7]),
  loot('ship-crew','船员休息区储物柜','manual',[-225,1.77,25]),
  loot('ship-bulk-storage','物料库备件箱','salvage',[-225,1.77,37]),
  loot('ship-forward-lounge','前厅休息台','manual',[-202,1.77,-83]),
  loot('ship-aft-office','船尾办公室','board',[-201,1.77,23]),
  loot('ship-aft-quarters','船员住宿储物柜','sealbag',[-201,1.77,36]),
  loot('ship-upper-library','阅览室资料柜','manual',[-224,5.17,-64]),
  loot('ship-upper-cafe','咖啡区储物台','medkit',[-224,5.17,-33]),
  loot('ship-upper-ballroom','多功能厅服务台','terminal',[-216,5.17,22]),
  loot('ship-upper-fitness','活动室器材柜','salvage',[-216,5.17,34]),
  loot('ship-sun-service','顶层甲板储物柜','manual',[-211,8.72,33]),
];

export const isShip=(p:Vec3)=>p[0]>=shipDeck.minX-.1&&p[0]<=shipDeck.maxX+.1&&p[2]>=shipDeck.minZ&&p[2]<=shipDeck.maxZ;
export const harborFloor=(p:Vec3)=>isShip(p)?p[1]>=shipLevels.sun-.25?'顶层甲板':p[1]>=shipLevels.upper-.25?'上甲板':'船舱':p[0]<-172?'登船连桥':'地面';
