import { supplySites } from '../world/supplySites.ts';
import { lab, mapBounds, mapViewBounds, ramp } from '../world/worldQueries.ts';
import {gangways,harborBuildings,harborFloor,shipEnvelope,shipOutline,isShip} from '../world/harborPlan.ts';
import { civicBuildings,terrainSections } from '../world/terrainPlan.ts';
import { districtBuildings } from '../world/districtSites.ts';
import { isLabLevel, researchBuilding, researchBuildingFloor } from '../world/researchPlan.ts';
import { southBuildings } from '../world/southPlan.ts';
import { marketBuildings } from '../world/marketPlan.ts';
import type { ExitZone, FirstMap, Vec3 } from '../contracts/demo.ts';

import { arcadeWidth, portBlocks, shopSide } from '../world/portBlocks.ts';
import { freightHalls, hasGallery } from '../world/upperRoutes.ts';
import { roads, footpaths } from '../world/roads.ts';

export function createTacticalMap() {
  const panel = document.querySelector<HTMLElement>('#tactical-map')!;
  const canvas = document.querySelector<HTMLCanvasElement>('#map-canvas')!;
  const ctx = canvas.getContext('2d')!;
  const mini = document.querySelector<HTMLCanvasElement>('#minimap-canvas')!;
  const radar = mini.getContext('2d')!;
  const miniFloor = document.querySelector<HTMLElement>('#minimap-floor')!;
  let lastRadar = -Infinity;
  const scale=580/400, mapLeft=(900-(mapViewBounds.maxX-mapViewBounds.minX)*scale)/2;
  const project = (x: number, z: number) => [mapLeft + (x - mapViewBounds.minX)*scale, 85 + (z - mapBounds.minZ)*scale];
  let lastDraw = 0;
  const compass = document.querySelector<HTMLElement>('#bearing')!;
  const heading = document.querySelector<HTMLElement>('#heading')!;

  return {
    reset() { panel.hidden = true; lastDraw = 0; lastRadar = -Infinity; },
    toggle() { panel.hidden = !panel.hidden; lastDraw = 0; },
    updateMini(map: FirstMap, feet: Vec3, yaw: number, now: number, discovered: ReadonlySet<string>,
      consumed: ReadonlySet<string>, statusFor: (exit: ExitZone) => {kind: string}) {
      if (now - lastRadar < 90) return;
      lastRadar = now;
      const underground = isLabLevel(feet);
      const floor = underground ? 'B1' : researchBuildingFloor(feet) ?? harborFloor(feet);
      if (miniFloor.textContent !== floor) miniFloor.textContent = floor;
      const half = mini.width / 2, scale = half / (underground ? 25 : 45);
      const point = (x: number, z: number) => [half + (x - feet[0]) * scale, half + (z - feet[2]) * scale];
      function rect(x1: number, z1: number, x2: number, z2: number, color: string, stroke?: string) {
        const [x, y] = point(x1, z1);
        const w = (x2 - x1) * scale, h = (z2 - z1) * scale;
        radar.fillStyle = color; radar.fillRect(x, y, w, h);
        if (stroke) { radar.strokeStyle = stroke; radar.strokeRect(x, y, w, h); }
      }
      radar.fillStyle = underground ? '#141e2a' : '#1d2b30';
      radar.fillRect(0, 0, mini.width, mini.height);
      if (underground) {
        rect(lab.minX, lab.minZ, lab.maxX, lab.maxZ, '#304457', '#709497');
        rect(ramp.minX, ramp.minZ, ramp.maxX, ramp.maxZ, '#53666b');
      } else {
        rect(mapViewBounds.minX-200,mapBounds.minZ,mapBounds.minX,mapBounds.maxZ,'#1a4255');
        for(const t of terrainSections)rect(t.minX,t.minZ,t.maxX,t.maxZ,t.northY===t.southY?'#405b5a':'#344b4a');
        for (const road of roads) rect(road.x1, road.z1, road.x2, road.z2, '#4b5d5e');
        for (const path of footpaths) rect(path.x1, path.z1, path.x2, path.z2, '#394b4d');
        for (const [x, z, w, d] of portBlocks)
          rect(x - w / 2, z - d / 2, x + w / 2, z + d / 2, '#2c3e43', '#708386');
        for (const [x, z, w, d] of freightHalls)
          rect(x - w / 2, z - d / 2, x + w / 2, z + d / 2, '#2c3e43', '#708386');
        for(const r of harborBuildings)rect(r.minX,r.minZ,r.maxX,r.maxZ,'#387174','#91beb9');
        for(const r of [...civicBuildings,...districtBuildings,researchBuilding,...southBuildings,...marketBuildings])rect(r.minX,r.minZ,r.maxX,r.maxZ,'#445669','#a1bcbb');
        for(const r of gangways)rect(r.minX,r.minZ,r.maxX,r.maxZ,'#6a9d9b');
        radar.beginPath();shipOutline.forEach(([x,z],i)=>{const p=point(x,z);i?radar.lineTo(p[0],p[1]):radar.moveTo(p[0],p[1]);});radar.closePath();radar.fillStyle='#5f8587';radar.fill();radar.strokeStyle='#c9e5d9';radar.stroke();
      }
      radar.fillStyle = '#a2cfc5';
      for (const target of map.interactions) {
        if (!discovered.has(target.id) || consumed.has(target.id) || isLabLevel(target.position) !== underground) continue;
        if ((researchBuildingFloor(target.position) === '2F' || floor === '2F') &&
            researchBuildingFloor(target.position) !== floor) continue;
        if(isShip(target.position)&&isShip(feet)&&harborFloor(target.position)!==floor)continue;
        const [x, z] = point(target.position[0], target.position[2]);
        radar.fillRect(x - 2, z - 2, 4, 4);
      }
      for (const exit of map.exits) {
        if (isLabLevel(exit.position) !== underground) continue;
        const [x, z] = point(exit.position[0], exit.position[2]);
        const state = statusFor(exit);
        radar.strokeStyle = state.kind === 'locked' ? '#d2a188' : state.kind === 'active' ? '#ffe3a1' : '#9fe8be';
        radar.lineWidth = 2; radar.strokeRect(x - 5, z - 5, 10, 10);
      }
      radar.save(); radar.translate(half, half); radar.rotate(-yaw);
      radar.fillStyle = '#ffe0a4'; radar.strokeStyle = '#172429'; radar.lineWidth = 3;
      radar.beginPath(); radar.moveTo(0, -12); radar.lineTo(7, 8); radar.lineTo(0, 4);
      radar.lineTo(-7, 8); radar.closePath(); radar.stroke(); radar.fill(); radar.restore();
      radar.fillStyle = '#f3e9d2'; radar.font = '700 14px monospace'; radar.textAlign = 'center';
      radar.fillText('N', half, 19);
    },
    update(map: FirstMap, feet: Vec3, yaw: number, now: number,discovered:ReadonlySet<string>,consumed:ReadonlySet<string>,statusFor:(exit:ExitZone)=>{kind:string;label:string}) {
      const degrees = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
      compass.textContent = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8];
      heading.textContent = `${Math.round(degrees).toString().padStart(3, '0')}°`;
      if (panel.hidden || now - lastDraw < 90) return;
      lastDraw = now;
      ctx.fillStyle = '#e8efe8';
      ctx.fillRect(0, 0, 900, 750);
      ctx.fillStyle = '#d3e0de';
      ctx.fillRect(80, 85, 740, 580);
      const [seaLeft,seaTop]=project(mapViewBounds.minX,mapBounds.minZ),[shore,seaBottom]=project(mapBounds.minX,mapBounds.maxZ);
      ctx.fillStyle='#a0c7d0';ctx.fillRect(seaLeft,seaTop,shore-seaLeft,seaBottom-seaTop);
      for(const t of terrainSections){
        const [tx,tz]=project(t.minX,t.minZ),[ex,end]=project(t.maxX,t.maxZ);
        const grade=ctx.createLinearGradient(tx,tz,tx,end);
        grade.addColorStop(0,t.northY?'#b1c8b4':'#d3e0de');
        grade.addColorStop(1,t.southY?'#b1c8b4':'#d3e0de');
        ctx.fillStyle=grade;ctx.fillRect(tx,tz,ex-tx,end-tz);
      }
      ctx.fillStyle = '#253e59';
      ctx.fillRect(0, 0, 900, 64);
      ctx.fillStyle = '#83dacd';
      ctx.fillRect(0, 63, 900, 4);
      ctx.strokeStyle = '#7795a04d';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) {
        const [x]=project(mapBounds.minX+i*40,mapBounds.minZ);ctx.beginPath();ctx.moveTo(x,85);ctx.lineTo(x,665);ctx.stroke();
      }
      for (let i = 0; i <= 10; i++) {
        ctx.beginPath(); ctx.moveTo(80, 85 + i * 58); ctx.lineTo(820, 85 + i * 58); ctx.stroke();
      }
      ctx.font = 'bold 25px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = '#e4e8d8';
      ctx.fillText('盐港隔离区', 80, 48);
      ctx.font = '13px monospace';
      ctx.fillStyle = '#a2b9bb';
      ctx.fillText('N ↑   /   SECTOR MAP', 605, 48);
      ctx.fillStyle = '#486174';
      ctx.font = '12px monospace';
      for (let i = 0; i < 10; i++) {
        const [x]=project(mapBounds.minX+i*40+20,mapBounds.minZ);ctx.fillText(String.fromCharCode(65 + i),x,81);
        ctx.fillText(String(i + 1).padStart(2, '0'), 52, 118 + i * 58);
      }
      for (const road of [...roads,...footpaths]) {
        ctx.fillStyle = footpaths.includes(road) ? '#88aaab' : '#55838e';
        const [left, top] = project(road.x1, road.z1);
        const [right, bottom] = project(road.x2, road.z2);
        ctx.fillRect(left, top, right - left, bottom - top);
      }
      ctx.fillStyle='#8390aa';
      const stairMark=(x:number,z:number)=>{
        const [sx,sz]=project(x,z);
        ctx.fillStyle='#b34f2e';
        ctx.fillRect(sx-3,sz-1.5,6,3);
      };
      for(const [x,z,w,d,,index] of portBlocks) {
        const [left,top]=project(x-w/2,z-d/2),[right,bottom]=project(x+w/2,z+d/2);
        const gap=(right-left)*arcadeWidth(index)/w;
        ctx.fillStyle='#8390aa';
        ctx.fillRect(left,top,(right-left-gap)/2,bottom-top);
        ctx.fillRect((left+right+gap)/2,top,(right-left-gap)/2,bottom-top);
        ctx.fillStyle='#b1d8d0';
        const wing=(right-left-gap)/2;
        ctx.fillRect((shopSide(index)<0?left:right-wing)+1,top+1,wing-2,bottom-top-2);
        if(hasGallery(w,d))stairMark(x-shopSide(index)*(w/2-(w-arcadeWidth(index))/4),z+d/2);
      }
      for(const [x,z,w,d] of freightHalls)stairMark(x+w/2-1.5,z-d/2+1.2);
      for(const r of [...harborBuildings,...gangways,...civicBuildings,...districtBuildings,researchBuilding,...southBuildings,...marketBuildings]){const [x,z]=project(r.minX,r.minZ),[a,b]=project(r.maxX,r.maxZ);ctx.fillStyle='#6ca7aa';ctx.fillRect(x,z,a-x,b-z);ctx.strokeStyle='#39777e';ctx.strokeRect(x,z,a-x,b-z);}
      ctx.beginPath();shipOutline.forEach(([x,z],i)=>{const p=project(x,z);i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]);});ctx.closePath();ctx.fillStyle='#6ca7aa';ctx.fill();ctx.strokeStyle='#39777e';ctx.stroke();
      const [shipX,shipZ]=project((shipEnvelope.minX+shipEnvelope.maxX)/2,(shipEnvelope.minZ+shipEnvelope.maxZ)/2);
      ctx.save();ctx.translate(shipX,shipZ);ctx.rotate(-Math.PI/2);ctx.fillStyle='#244958';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.fillText('海湾号邮轮',0,4);ctx.restore();
      for (const region of map.regions ?? []) {
        const [x, z] = project(region.center[0], region.center[2]);
        const underground = isLabLevel(region.center);
        ctx.fillStyle = underground ? '#8e68a022' : '#65879410';
        ctx.strokeStyle = underground ? '#8b689f' : '#8aa2ad';
        const r = region.id === 'approach' ? 74 : Math.max(30, region.radius / 400 * 740);
        const left = Math.max(80, x - r), top = Math.max(85, z - r * .6);
        const right = Math.min(820, x + r), bottom = Math.min(665, z + r * .6);
        ctx.beginPath(); ctx.roundRect(left, top, right - left, bottom - top, 8); ctx.fill(); ctx.stroke();
        ctx.font = `${underground ? 13 : 17}px "Microsoft YaHei",sans-serif`;
        ctx.fillStyle = '#2c495f';
        ctx.fillText(underground ? 'B1 实验室' : region.label, left + 12,
          underground ? z + 24 : top + 25);
      }
      for (const site of supplySites) {
        const [sx, sz] = project(site.x, site.z);
        const caption = site.label + ' · ' + site.risk;
        ctx.font = 'bold 13px "Microsoft YaHei",sans-serif';
        const width = ctx.measureText(caption).width + 10;
        const left = Math.min(sx + 6, 820 - width);
        ctx.fillStyle = '#263e57';
        ctx.fillRect(left, sz - 10, width, 19);
        ctx.fillStyle = site.risk === '高' ? '#dc7859' : '#287c78';
        ctx.fillRect(sx - 4, sz - 4, 8, 8);
        ctx.fillStyle = '#f3f4e7';
        ctx.fillText(caption, left + 5, sz + 4);
      }
      for (const target of map.interactions) {
        if (target.kind !== 'loot'||!discovered.has(target.id)) continue;
        if(isShip(target.position)&&isShip(feet)&&harborFloor(target.position)!==harborFloor(feet))continue;
        const [sx, sz] = project(target.position[0], target.position[2]);
        ctx.fillStyle=ctx.strokeStyle='#347c78';
        ctx.beginPath(); ctx.arc(sx, sz, 2.8, 0, Math.PI * 2); if(consumed.has(target.id))ctx.stroke();else ctx.fill();
      }
      for (const exit of map.exits) {
        const [x, z] = project(exit.position[0], exit.position[2]);
        const state = statusFor(exit);
        ctx.strokeStyle = state.kind === 'locked' ? '#924529' : state.kind === 'active' ? '#886100' : '#117063';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 7, z - 7, 14, 14);
        ctx.fillStyle = '#854423';
        ctx.font = '15px "Microsoft YaHei",sans-serif';
        const text = (exit.remote ? 'B1 ' : '') + exit.label + ' · ' + state.label;
        ctx.fillText(text, Math.min(x + 13, 891 - ctx.measureText(text).width), z - 10);
      }
      const [x, z] = project(feet[0], feet[2]);
      ctx.save();
      ctx.translate(x, z);
      ctx.rotate(-yaw);
      ctx.fillStyle = '#ff9563';
      ctx.strokeStyle = '#273d56'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#345267';
      ctx.font = '14px "Microsoft YaHei",sans-serif';
      ctx.fillText('▲ 当前位置   □ 撤离点   ■ 补给据点   • 已发现容器（空心为取尽）   浅绿 可进街屋   橙线 楼梯入口', 80, 710);
    },
  };
}
