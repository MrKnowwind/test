import { supplySites } from '../world/supplySites.ts';
import { mapBounds } from '../world/worldQueries.ts';
import type { FirstMap, Vec3 } from '../contracts/demo.ts';

import { roads } from '../world/roads.ts';

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
    update(map: FirstMap, feet: Vec3, yaw: number, now: number) {
      const degrees = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
      compass.textContent = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8];
      heading.textContent = `${Math.round(degrees).toString().padStart(3, '0')}°`;
      if (panel.hidden || now - lastDraw < 90) return;
      lastDraw = now;
      ctx.fillStyle = '#101c22';
      ctx.fillRect(0, 0, 900, 750);
      ctx.strokeStyle = '#73939b20';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 12; i++) {
        ctx.beginPath(); ctx.moveTo(80 + i * 61.7, 85); ctx.lineTo(80 + i * 61.7, 665); ctx.stroke();
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
      ctx.fillStyle = '#477382';
      for (const road of roads) {
        const [left, top] = project(road.x1, road.z1);
        const [right, bottom] = project(road.x2, road.z2);
        ctx.fillRect(left, top, right - left, bottom - top);
      }
      for (const region of map.regions ?? []) {
        const [x, z] = project(region.center[0], region.center[2]);
        ctx.fillStyle = region.center[1] < -2 ? '#71d6d01c' : '#9eaaa91b';
        ctx.strokeStyle = region.center[1] < -2 ? '#71d6d059' : '#9eaaa94f';
        const r = region.id === 'approach' ? 74 : Math.max(30, region.radius / 400 * 740);
        const left = Math.max(80, x - r), top = Math.max(85, z - r * .6);
        const right = Math.min(820, x + r), bottom = Math.min(665, z + r * .6);
        ctx.beginPath(); ctx.roundRect(left, top, right - left, bottom - top, 8); ctx.fill(); ctx.stroke();
        ctx.font = `${region.center[1] < -2 ? 13 : 17}px "Microsoft YaHei",sans-serif`;
        ctx.fillStyle = '#bdcece';
        ctx.fillText(region.center[1] < -2 ? 'B1 实验室' : region.label, left + 12,
          region.center[1] < -2 ? z + 24 : top + 25);
      }
      for (const site of supplySites) {
        const [sx, sz] = project(site.x, site.z);
        ctx.fillStyle = site.risk === '高' ? '#f09a7b' : '#a9d4b9';
        ctx.fillRect(sx - 4, sz - 4, 8, 8);
        ctx.font = '15px "Microsoft YaHei",sans-serif';
        ctx.fillText(site.label + ' · ' + site.risk, sx + 8, sz + 4);
      }
      for (const target of map.interactions) {
        if (target.kind !== 'loot') continue;
        const [sx, sz] = project(target.position[0], target.position[2]);
        ctx.fillStyle = target.item === 'research-sample' ? '#f09a7b' : '#a9d4b9';
        ctx.beginPath(); ctx.arc(sx, sz, 2, 0, Math.PI * 2); ctx.fill();
      }
      for (const exit of map.exits) {
        const [x, z] = project(exit.position[0], exit.position[2]);
        ctx.strokeStyle = '#e5c17b';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 7, z - 7, 14, 14);
        ctx.fillStyle = '#e5c17b';
        ctx.font = '15px "Microsoft YaHei",sans-serif';
        ctx.fillText(exit.label, Math.min(x + 13, 760), z - 10);
      }
      const [x, z] = project(feet[0], feet[2]);
      ctx.save();
      ctx.translate(x, z);
      ctx.rotate(-yaw);
      ctx.fillStyle = '#e6eead';
      ctx.shadowColor = '#e6eead'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#a2b9bb';
      ctx.font = '14px "Microsoft YaHei",sans-serif';
      ctx.fillText('▲ 当前位置   □ 撤离点   ■ 补给据点   • 可搜索容器   维修通道需卡 · 货梯需供电', 80, 710);
    },
  };
}
