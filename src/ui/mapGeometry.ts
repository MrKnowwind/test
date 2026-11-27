import type { Vec3 } from '../contracts/demo.ts';
import { districtBuildings } from '../world/districtSites.ts';
import { dispatchFloor, dispatchOffice, gangways, harborBuildings, harborFloor, shipDeck, shipEnvelope, shipOutline, sunDeck } from '../world/harborPlan.ts';
import { innBuilding, innFloor, innStair } from '../world/innPlan.ts';
import { landOutline } from '../world/landPlan.ts';
import { marketBuildings } from '../world/marketPlan.ts';
import { streetFootprints } from '../world/portBlocks.ts';
import { annexWalk, archiveBuilding, archiveFloor, archiveStackEast, archiveStair, researchAnnexBuildings } from '../world/researchAnnexPlan.ts';
import { isLabLevel, researchBuilding, researchBuildingFloor, researchPad, researchStair } from '../world/researchPlan.ts';
import { footpaths, roads } from '../world/roads.ts';
import { residentialPad, southBuildings } from '../world/southPlan.ts';
import { supplySites } from '../world/supplySites.ts';
import { civicBuildings, observatory, observatoryFloor, terrainSections } from '../world/terrainPlan.ts';
import { freightHalls } from '../world/upperRoutes.ts';
import { controlMain, controlStair, drainChannel, drainCrossings, logisticsOffice, officeStair, repairShop, sortingHall, sortingStair, vehicleCourt, worksiteBuildings, worksitePlace } from '../world/worksitePlan.ts';
import { dock, factory, factoryRamp, lab, mapViewBounds, ramp } from '../world/worldQueries.ts';

export type MapRect = {minX: number; maxX: number; minZ: number; maxZ: number};
export type PlanPoint = readonly [x: number, z: number];
export const floorNames = { ground: '地面', upper: '二层 / 夹层', b1: '地下 B1', cabin: '船舱', deck: '上甲板', sun: '顶层甲板' } as const;
export type MapFloor = keyof typeof floorNames;
const shipFloorIds: Partial<Record<string, MapFloor>> = { 船舱: 'cabin', 上甲板: 'deck', 顶层甲板: 'sun' };
const inRect = (x: number, z: number, r: MapRect) => x>=r.minX && x<=r.maxX && z>=r.minZ && z<=r.maxZ;
const boxAt = (x: number, z: number, w: number, d: number) => ({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});
const hallFootprints = freightHalls.map(([x,z,w,d])=>boxAt(x,z,w,d));
const residential = civicBuildings[2];
const floorBounds = [
  innBuilding, researchBuilding, {...archiveBuilding,maxX:archiveStackEast}, dispatchOffice, observatory,
  residential, sortingHall, logisticsOffice, controlMain, repairShop, factory, ...hallFootprints,
];
const floorAt = [innFloor, researchBuildingFloor, archiveFloor, dispatchFloor, observatoryFloor];
export const mapLandmarks = [
  {label: '北部海关', bounds: civicBuildings[0]},
  {label: '物流分拣', bounds: sortingHall},
  {label: '工业控制', bounds: controlMain},
  {label: '科研主楼', bounds: researchBuilding},
  {label: '海员旅馆', bounds: innBuilding},
  {label: '海湾号邮轮', bounds: shipEnvelope},
] as const;

const supplies = supplySites.map(site=>({
  ...site,
  bounds:boxAt(site.x,site.z+.5,13.6,12.4),
  loft:boxAt(site.x,site.z-8,10,5),
}));

export function mapFloor(position: Vec3): MapFloor {
  if (isLabLevel(position)) return 'b1';
  const maritime = shipFloorIds[harborFloor(position)];
  if (maritime) return maritime;
  if (floorAt.some(query=>query(position)==='2F')) return 'upper';
  const [x,y,z]=position, floor=worksitePlace(position)?.floor;
  if (floor==='2F'||floor==='夹层') return 'upper';
  if (y>=residentialPad.height+3.08 && inRect(x,z,residential)) return 'upper';
  if (y>=3 && hallFootprints.some(rect=>inRect(x,z,rect))) return 'upper';
  if (y>=factory.y-.12 && inRect(x,z,factory)) return 'upper';
  if (supplies.some(site=>y>=site.height-.12 && inRect(x,z,site.loft))) return 'upper';
  return 'ground';
}

export function mapFloorLabel(position: Vec3, floor = mapFloor(position)) {
  if (floor==='upper') return worksitePlace(position)?.floor==='夹层' ? '夹层' : '2F';
  if (floor==='ground') return floorAt.map(query=>query(position)).find(Boolean) ?? worksitePlace(position)?.floor ?? harborFloor(position);
  return floor==='b1'?'B1':floorNames[floor];
}

const richAreas = [researchPad,archiveBuilding,...supplies.filter(site=>site.risk==='高').map(site=>site.bounds)];
const buildings = [...harborBuildings,...civicBuildings,...districtBuildings,researchBuilding,...researchAnnexBuildings,
  ...southBuildings,...marketBuildings,innBuilding,...worksiteBuildings,...hallFootprints];

export const centerOf = (rect: MapRect): PlanPoint => [(rect.minX+rect.maxX)/2,(rect.minZ+rect.maxZ)/2];
export function fitMap(bounds: MapRect, width: number, height: number, margin: number) {
  return Math.min((width-2*margin)/(bounds.maxX-bounds.minX), (height-2*margin)/(bounds.maxZ-bounds.minZ));
}
export function mapProjection(center: PlanPoint, width: number, height: number, scale: number) {
  return {
    scale,
    project: (x: number, z: number): PlanPoint => [width/2+(x-center[0])*scale,height/2+(z-center[1])*scale],
    unproject: (x: number, y: number): PlanPoint => [(x-width/2)/scale+center[0],(y-height/2)/scale+center[1]],
  };
}
export type MapProjection = ReturnType<typeof mapProjection>;
export function layerBounds(floor: MapFloor): MapRect {
  if (floor==='b1') return {...lab,maxZ:ramp.maxZ};
  if (floor==='sun') return sunDeck;
  if (floor==='cabin'||floor==='deck') return shipEnvelope;
  return mapViewBounds;
}

export function drawMapLayer(ctx: CanvasRenderingContext2D, {project}: MapProjection, floor: MapFloor, overview = false) {
  const {width,height}=ctx.canvas;
  ctx.fillStyle='#11262f';ctx.fillRect(0,0,width,height);
  function rect(r: MapRect, fill: string, stroke?: string) {
    const [x,y]=project(r.minX,r.minZ), [right,bottom]=project(r.maxX,r.maxZ);
    if (right<0||bottom<0||x>width||y>height) return;
    ctx.fillStyle=fill;ctx.fillRect(x,y,right-x,bottom-y);
    if(stroke){ctx.strokeStyle=stroke;ctx.strokeRect(x,y,right-x,bottom-y);}
  }
  function polygon(points: readonly PlanPoint[], fill: string, stroke: string) {
    ctx.beginPath();
    points.forEach(([x,z],i)=>i?ctx.lineTo(...project(x,z)):ctx.moveTo(...project(x,z)));
    ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.stroke();
  }
  const gold = (r: MapRect) => rect(r,'#e5ba6333','#dfba6a');
  ctx.lineWidth=1;
  if(floor==='b1'){
    rect(ramp,'#54676b','#839597');
    rect(lab,'#394652','#748c97');gold(lab);
    return;
  }
  polygon(landOutline,'#2b4449','#64878a');
  const onShip=floor==='cabin'||floor==='deck'||floor==='sun';
  if(floor==='upper'||onShip)ctx.globalAlpha=.32;
  rect(dock,'#326170','#548b90');
  rect(factoryRamp,'#546d6e');rect(factory,'#638189');
  for(const t of terrainSections)rect(t,t.northY===t.southY?'#46615b':'#3a5453');
  for(const r of footpaths)rect({minX:r.x1,maxX:r.x2,minZ:r.z1,maxZ:r.z2},'#496267');
  for(const r of roads)rect({minX:r.x1,maxX:r.x2,minZ:r.z1,maxZ:r.z2},'#718a8b');
  rect(vehicleCourt,'#596b71');rect(drainChannel,'#245862');
  for(const r of drainCrossings)rect(r,'#91b0b7');
  for(const r of streetFootprints)rect(r,r.building?'#688289':'#415e57',r.building?'#91a6a7':undefined);
  for(const r of buildings)rect(r,'#729298','#a8c2c2');
  for(const {bounds} of supplies)rect(bounds,'#638487','#a8c2c2');
  rect(annexWalk,'#81a6ae');
  for(const r of gangways)rect(r,'#7ba6aa');
  polygon(shipOutline,'#659298','#cae0d5');
  ctx.globalAlpha=1;
  if(floor==='ground') {
    for(const r of richAreas)gold(r);
    polygon(shipOutline,'#e5ba632e','#dfba6a');
  } else if(floor==='upper') {
    for(const r of [...floorBounds,...supplies.map(site=>site.loft)])rect(r,'#547882','#aac6c8');
    for(const r of [researchBuilding,{...archiveBuilding,maxX:archiveStackEast},...supplies.filter(site=>site.risk==='高').map(site=>site.loft)])gold(r);
  } else {
    if (floor==='sun') {
      rect(sunDeck,'#587d84','#aac6c8');
      rect({...sunDeck,minX:sunDeck.minX-4,maxX:sunDeck.minX,minZ:25},'#587d84');
      gold(sunDeck);
    } else {
      rect(shipDeck,'#567f85','#b5cbc7');gold(shipDeck);
      if(floor==='cabin')for(const r of gangways)rect(r,'#81a9ad','#bacfc4');
    }
  }
  if(overview) return;
  const stairs = [archiveStair, sortingStair, officeStair, controlStair, researchStair,
    {x:innStair.x,footZ:innStair.bottomZ},
    ...freightHalls.map(([x,z,w,d])=>({x:x+w/2-1.5,footZ:z-d/2+1.2}))];
  const routes: readonly PlanPoint[] = onShip ? shipMapStairs[floor] : [...stairs.map(s=>[s.x,s.footZ] as const),centerOf(factoryRamp),[(ramp.minX+ramp.maxX)/2,ramp.maxZ]];
  ctx.fillStyle='#f5d8a1';
  for(const spot of routes){ const [x,y]=project(...spot);ctx.fillRect(x-3,y-1,6,2); }
}

const shipMapStairs = {
  cabin: [[-202,1],[-188.4,-73]],
  deck: [[-202,-13],[-188.4,-87],[-222,10]],
  sun: [[-222,25]],
} as const;

export function drawMapLabel(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, size: number) {
  ctx.font='650 '+size+'px system-ui,sans-serif';
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.lineWidth=3;ctx.strokeStyle='#1b3038';ctx.strokeText(label,x,y);
  ctx.fillStyle='#eaf3eb';ctx.fillText(label,x,y);
}

export function drawPlayerMark(ctx: CanvasRenderingContext2D, x: number, y: number, yaw: number) {
  ctx.save();ctx.translate(x,y);ctx.rotate(-yaw);
  ctx.fillStyle='#ffe0a4';ctx.strokeStyle='#172429';ctx.lineWidth=2.5;
  ctx.beginPath();ctx.moveTo(0,-11);ctx.lineTo(7,8);ctx.lineTo(0,4);ctx.lineTo(-7,8);ctx.closePath();
  ctx.stroke();ctx.fill();ctx.restore();
}
