import * as THREE from 'three';
import { box, cylinder, mesh } from './detail/geometry.ts';
import type { Materials } from './detail/materialLibrary.ts';

const services = [
  { name: '潮汐泵房', english: 'TIDAL WORKS', dark: '#27586c', accent: '#77e2d5' },
  { name: '港务工坊', english: 'DOCK REPAIR', dark: '#733f43', accent: '#ffae78' },
  { name: '极光药局', english: 'AURORA MED', dark: '#56426e', accent: '#dbb8fb' },
] as const;

function paintedPanel(fallback: string, draw: (ctx: CanvasRenderingContext2D) => void) {
  if (typeof document === 'undefined') return new THREE.MeshBasicMaterial({color: fallback});
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return new THREE.MeshBasicMaterial({map, color: 0xdce7ee});
}

function serviceBillboard(type: number) {
  const service = services[type];
  return paintedPanel(service.dark, ctx => {
    ctx.fillStyle = service.dark;
    ctx.fillRect(0, 0, 640, 256);
    ctx.fillStyle = service.accent;
    ctx.fillRect(0, 0, 11, 256);
    ctx.fillRect(32, 220, 575, 3);
    ctx.save();
    ctx.translate(88, 107);
    ctx.fillStyle = service.accent;
    if (type === 0) {
      ctx.fill(new Path2D('M0 -57Q18 -28 39 -6Q64 26 34 51Q0 75 -31 51Q-60 25 -37 -4Z'));
      ctx.fillStyle = service.dark;
      ctx.fill(new Path2D('M-23 21Q-6 34 21 14Q13 37 -4 38Q-19 38 -23 21Z'));
    } else if (type === 1) {
      ctx.fill(new Path2D('M-47 37L4 -14Q-1 -56 41 -52L22 -30L33 -18L55 -38Q61 4 22 8L-30 60Z'));
    } else {
      ctx.fill(new Path2D('M-15 -47H15V-15H47V15H15V47H-15V15H-47V-15H-15Z'));
    }
    ctx.restore();
    ctx.fillStyle = '#fff5dd';
    ctx.font = 'bold 61px sans-serif';
    ctx.fillText(service.name, 164, 116, 443);
    ctx.fillStyle = service.accent;
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(service.english, 167, 163);
    for (let i = 0; i < 4; i++) ctx.fillRect(552 + i * 12, 185, 5, 19);
  });
}

function litWindow(type: number) {
  return paintedPanel('#546e80', ctx => {
    ctx.fillStyle = '#42617a';
    ctx.fillRect(0, 0, 640, 256);
    for (let bay = 0; bay < 5; bay++) {
      const x = bay * 128, lit = (bay + type) % 3 === 0;
      ctx.fillStyle = lit ? '#a3b9b2' : '#68899c';
      ctx.fillRect(x + 3, 4, 120, 235);
      ctx.fillStyle = lit ? '#dce5cc' : '#92aeb7';
      ctx.fillRect(x + 18, 17, 83, 6);
      ctx.fillStyle = lit ? '#647d82' : '#4d687c';
      ctx.fillRect(x + 16, 134, 91, 5);
      ctx.fillRect(x + 22, 140, 5, 45);
      ctx.fillRect(x + 86, 144, 8, 42);
      ctx.fillRect(x + 33, 100, 27, 31);
      ctx.fillRect(x + 71, 116, 15, 15);
      ctx.fillStyle = '#334e68';
      ctx.fillRect(x, 188, 128, 68);
      ctx.fillRect(x + 119, 0, 9, 256);
    }
    ctx.fillStyle = '#c6e2e123';
    ctx.fill(new Path2D('M190 0H250L113 192H51ZM464 0H486L356 192H334Z'));
  });
}

const plane = new THREE.PlaneGeometry();
// The signs and workstations share each tenant's visual identity.
function serviceConsole(type:number){
  const service=services[type];
  return paintedPanel(service.dark,ctx=>{
    ctx.fillStyle='#1b344a';ctx.fillRect(0,0,640,256);
    ctx.fillStyle=service.accent;ctx.fillRect(0,0,640,8);
    ctx.fillStyle='#e9f3ea';ctx.font='bold 29px sans-serif';
    ctx.fillText(['泵组压力监测','港务维修工单','冷藏药品监测'][type],22,50);
    ctx.fillStyle=service.accent;ctx.font='18px monospace';ctx.fillText(service.english,440,47);
    ctx.strokeStyle='#3e6170';ctx.lineWidth=2;
    for(let i=0;i<12;i++){ctx.beginPath();ctx.moveTo(24+i*53,69);ctx.lineTo(24+i*53,232);ctx.stroke();}
    for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(20,75+i*37);ctx.lineTo(620,75+i*37);ctx.stroke();}
    ctx.strokeStyle=ctx.fillStyle=service.accent;ctx.lineWidth=5;ctx.lineCap='round';
    if(type===0){
      for(let i=0;i<3;i++){
        const x=108+i*204;
        ctx.beginPath();ctx.arc(x,186,59,Math.PI,2*Math.PI);ctx.stroke();
        ctx.beginPath();ctx.moveTo(x,186);ctx.lineTo(x-31+i*28,143);ctx.stroke();
        ctx.font='15px monospace';ctx.fillText(['INTAKE','FILTER','OUTLET'][i],x-28,219);
      }
    }else if(type===1){
      for(let i=0;i<3;i++){
        const y=98+i*45;
        ctx.strokeRect(30,y-10,19,19);
        ctx.fillRect(72,y-4,240-i*35,6);ctx.fillRect(343,y-4,45+i*28,6);
        ctx.font='17px monospace';ctx.fillText(['C-12','M-04','H-21'][i],515,y+5);
      }
    }else{
      ctx.beginPath();ctx.moveTo(26,154);
      for(let x=26;x<454;x+=6)ctx.lineTo(x,150+Math.sin(x*.037)*10+(x%130>96?-26:0));
      ctx.stroke();ctx.font='bold 39px monospace';ctx.fillText('04°C',477,165);
    }
  });
}

export function createFrontage(root: THREE.Group, m: Materials) {
  const boards = services.map((_, type) => serviceBillboard(type));
  const glass = services.map((_, type) => litWindow(type));
  function panel(material: THREE.Material, x: number, y: number, z: number,
    width: number, height: number, yaw: number) {
    const sign = mesh(root, plane, material, x, y, z);
    sign.rotation.y = yaw;
    sign.scale.set(width, height, 1);
  }
  return {
    glass, panel, consoles:services.map((_,type)=>serviceConsole(type)),
    shop(type: number, x: number, z: number, width: number, depth: number, accent: THREE.Material) {
      // Both long elevations address the street. Furniture stays against the sealed service core.
      for (const side of [-1, 1]) {
        const wall = x + side * width / 2;
        const yaw = side * Math.PI / 2;
        const lip = wall + side * .15;
        box(root, m.ceramic, .17, 3.05, depth - .65, wall, 1.57, z);
        // Preserve the painted emblem's aspect ratio on short and long shopfronts.
        box(root, m.steel, .12, 1.06, depth * .83, lip, 2.51, z);
        panel(boards[type], lip + side * .067, 2.51, z, 2.6, 1.04, yaw);
        for (const end of [-1, 1])
          box(root, accent, .07, .12, depth * .16, lip + side * .08, 2.51, z + end * depth * .29);
        box(root, accent, .55, .17, depth - .3, lip, 3.16, z, .035);
        if (type === 0) {
          for (const fraction of [-.28, .02, .29]) {
            const pz = z + fraction * depth;
            cylinder(root, accent, .28, 1.58, lip, 1.03, pz, 12);
            for (const h of [.35, .98, 1.70]) cylinder(root, m.zinc, .30, .10, lip, h, pz, 12);
          }
        } else if (type === 1) {
          box(root, m.steel, .10, 1.6, depth * .75, lip, 1.02, z);
          for (const height of [.45, .69, .93, 1.17, 1.41, 1.65])
            box(root, m.zinc, .08, .075, depth * .71, lip + side * .07, height, z);
          box(root, accent, .24, .43, .38, lip + side * .04, 1.21, z + depth * .43, .036);
        } else {
          panel(glass[type], lip, 1.20, z, depth * .69, 1.23, yaw);
          box(root, accent, .53, .15, depth * .73, lip, .55, z, .045);
          for (const dz of [-.37, .37])
            box(root, m.zinc, .22, 1.38, .18, lip, 1.24, z + depth * dz);
        }
      }
    }
  };
}
