import { supplySites } from '../world/supplySites.ts';
import { mapBounds } from '../world/worldQueries.ts';
import type { ExitZone, FirstMap, Vec3 } from '../contracts/demo.ts';

import { arcadeWidth, portBlocks, shopSide } from '../world/portBlocks.ts';
import { freightHalls, hasGallery } from '../world/upperRoutes.ts';
import { roads, footpaths } from '../world/roads.ts';

export function createTacticalMap() {
  const panel = document.querySelector<HTMLElement>('#tactical-map')!;
  const canvas = document.querySelector<HTMLCanvasElement>('#map-canvas')!;
  const ctx = canvas.getContext('2d')!;
  const project = (x: number, z: number) => [80 + (x - mapBounds.minX) / 400 * 740, 85 + (z - mapBounds.minZ) / 400 * 580];
  let lastDraw = 0;
  const compass = document.querySelector<HTMLElement>('#bearing')!;
  const heading = document.querySelector<HTMLElement>('#heading')!;

  return {
    toggle() { panel.hidden = !panel.hidden; lastDraw = 0; },
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
      ctx.fillStyle = '#253e59';
      ctx.fillRect(0, 0, 900, 64);
      ctx.fillStyle = '#83dacd';
      ctx.fillRect(0, 63, 900, 4);
      ctx.strokeStyle = '#7795a04d';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) {
        ctx.beginPath(); ctx.moveTo(80 + i * 74, 85); ctx.lineTo(80 + i * 74, 665); ctx.stroke();
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
        ctx.fillText(String.fromCharCode(65 + i), 114 + i * 74, 81);
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
      for(const [index,[x,z,w,d]] of portBlocks.entries()) {
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
      for (const region of map.regions ?? []) {
        const [x, z] = project(region.center[0], region.center[2]);
        ctx.fillStyle = region.center[1] < -2 ? '#8e68a022' : '#65879410';
        ctx.strokeStyle = region.center[1] < -2 ? '#8b689f' : '#8aa2ad';
        const r = region.id === 'approach' ? 74 : Math.max(30, region.radius / 400 * 740);
        const left = Math.max(80, x - r), top = Math.max(85, z - r * .6);
        const right = Math.min(820, x + r), bottom = Math.min(665, z + r * .6);
        ctx.beginPath(); ctx.roundRect(left, top, right - left, bottom - top, 8); ctx.fill(); ctx.stroke();
        ctx.font = `${region.center[1] < -2 ? 13 : 17}px "Microsoft YaHei",sans-serif`;
        ctx.fillStyle = '#2c495f';
        ctx.fillText(region.center[1] < -2 ? 'B1 实验室' : region.label, left + 12,
          region.center[1] < -2 ? z + 24 : top + 25);
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
