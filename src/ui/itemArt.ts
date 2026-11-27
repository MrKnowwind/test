import { drawFieldGear } from './fieldGearArt.ts';
import type { ItemId } from '../contracts/demo.ts';
import { itemSpecs } from '../raid/catalog.ts';
import { drawLootGoods } from './lootArt.ts';

type Icon = ItemId | 'pistol' | 'knife';
const cache = new Map<Icon, HTMLCanvasElement>();
export function setModelIcon(id:Icon,canvas:HTMLCanvasElement){cache.set(id,canvas);}

function shade(hex:string, factor:number) {
  const value=parseInt(hex.slice(1),16);
  return 'rgb('+[16,8,0].map(shift=>Math.round(((value>>shift)&255)*factor)).join(',')+')';
}

// Hand-authored silhouette, shadow and highlight layers in the same 64-unit icon box.
export function itemIcon(id: Icon) {
  const canvas=document.createElement('canvas');
  canvas.className='item-icon';
  canvas.width=canvas.height=128;
  canvas.setAttribute('aria-hidden','true');
  const c=canvas.getContext('2d')!;
  const saved=cache.get(id);
  if(saved) { c.drawImage(saved,0,0,canvas.width,canvas.height); return canvas; }
  c.scale(2,2);
  c.lineJoin='round';c.lineCap='round';
  const ink='#1e304a', light='#ecfff7';
  function shape(d:string,fill:string,outline=false) {
    const path=new Path2D(d);
    const pigment=c.createLinearGradient(12,9,46,55);
    pigment.addColorStop(0,fill);pigment.addColorStop(.53,fill);pigment.addColorStop(1,shade(fill,.73));
    c.fillStyle=pigment;c.fill(path);
    if(outline) {c.strokeStyle=ink;c.lineWidth=2.6;c.stroke(path);}
  }
  const spec = itemSpecs[id];
  if ('art' in spec) {
    drawLootGoods(shape,id,spec.art);
  } else if(id==='medkit') {
    shape('M20 20V14Q20 9 26 9H38Q45 9 45 14V20H39V16H26V20Z','#8fd8d0',true);
    shape('M7 23L14 18H52L58 23V47L51 54H13L7 48Z','#ff8b77',true);
    shape('M9 39L18 43H48L56 38V46L50 51H14L9 47Z','#b7485d');
    shape('M14 22H51L46 27H12Z','#ffcab0');
    shape('M27 27H35V33H41V40H35V46H27V40H21V33H27Z',light,true);
    shape('M10 31H15V37H10ZM50 30H55V36H50Z','#384c69');
  } else if(id==='pistol-ammo') {
    for(const [x,y] of [[6,6],[22,1],[38,5]]) {
      c.save();c.translate(x,y);
      shape('M1 39V20L7 9L11 7L16 19V40Z','#ffc562',true);
      shape('M2 24H15V31H2Z','#e98244');
      shape('M5 18L9 12L9 21H5Z','#fff4bd');c.restore();
    }
    shape('M6 35L49 31L58 37V49L53 54L10 57L6 52Z','#d88a49',true);
    shape('M9 38L49 35L54 38L12 42Z','#ffdd84');
    shape('M13 44L50 41V47L13 50Z','#425373');
    shape('M19 44L25 43L23 48L17 49ZM31 43L37 42L35 47L29 48Z','#ffe6a1');
  } else if(id==='research-sample') {
    c.translate(32,32);c.rotate(.29);c.translate(-32,-32);
    shape('M20 15H44V47L39 55H25L20 48Z','#b1f2f1',true);
    shape('M24 28Q29 25 33 30T41 28V46L37 51H27L24 46Z','#9359ce');
    shape('M30 34L36 29L38 38L32 46L28 41Z','#ffb5f6');
    shape('M23 20H26V35H23Z',light);
    shape('M17 8L21 5H43L47 9V17L43 20H21L17 17Z','#565789',true);
    shape('M21 9H42V13H21Z','#bdb8ff');
    shape('M22 49H42L39 56H25Z','#656499',true);
  } else if(id==='service-card') {
    c.translate(32,32);c.rotate(-.18);c.translate(-32,-32);
    shape('M6 19L11 13H50L58 19V46L54 50H10L6 46Z','#89cfeb',true);
    shape('M8 20H56V26H8Z','#334c75');
    shape('M12 31L15 28H26V40H12Z','#ffe39a',true);
    shape('M15 32H22V34H18V38H16V34H13V32Z','#c48b51');
    shape('M31 32H51V35H31ZM31 39H46V42H31Z','#335c84');
    shape('M10 45H25L22 48H10Z',light);
  } else if(id==='salvage') {
    c.translate(32,32);c.rotate(-.32);c.translate(-32,-32);
    shape('M18 14L23 8H43L49 14V46L42 54H23L17 48Z','#789aae',true);
    shape('M18 25L48 20V39L18 44Z','#354969',true);
    for(let y=23;y<44;y+=6) shape('M15 '+y+'L47 '+(y-6)+'L50 '+(y-3)+'L19 '+(y+4)+'Z','#ffa85e',true);
    shape('M17 12L24 7H43L50 13L44 19H21Z','#bce4e3',true);
    shape('M25 12L29 10H40L42 13L38 15H27Z','#354969');
    shape('M24 52H41V57H24Z','#bce4e3',true);
  } else if(id==='healing-injector'){
    shape('M9 46L18 36L15 33L35 12L43 20L23 41L20 39L11 49Z','#baeae4',true);
    shape('M22 31L34 19L39 24L27 36Z','#54b99f');shape('M34 11L38 7L49 18L45 22Z','#415675',true);
  } else if(id==='pistol') {
    shape('M7 18L12 13H48L57 19L51 29H32L27 47L18 51L13 47L19 28H9Z','#d7e4eb',true);
    shape('M12 18H40L36 23H10ZM20 32H28L24 45L17 47Z','#459aaa');
    shape('M43 16H50L54 19L50 23H40Z','#ff9176');
  } else if(id==='knife') {
    shape('M9 50L23 35L19 31L24 26L29 29L42 13L57 6L52 25L35 36L38 40L33 45L28 41L15 56Z','#8bf6e4',true);
    shape('M27 34L56 8L47 23L34 35Z','#dffefb');
    shape('M10 50L23 36L29 41L16 55Z','#ea8a66',true);
  } else {
    drawFieldGear(id,c,shape);
  }
  if(id==='medkit') {
    shape('M10 25h7v21h-5ZM47 24h6v22h-6Z','#545c70');
    shape('M10 32h8v5h-8ZM46 32h8v5h-8Z','#f7cf8b',true);
  } else if(id==='service-card') {
    shape('M10 16h13v4H10Z',ink);shape('M12 17h9v1H12Z',light);
    shape('M46 30h6v5l-3 3 -3 -3Z','#ffe0a0');
  } else if(id==='research-sample') {
    shape('M36 25l4 -2v4l-4 2ZM24 38l4 2v3l-4 -2Z',light);
    for(const x of [23,30,37])shape('M'+x+' 12h3v5h-3Z','#8884ad');
  } else if(id==='salvage') {
    shape('M15 20l7 -2v6l-7 2ZM42 40l7 -2v6l-7 2Z','#c7d8cf',true);
  } else if(id==='pistol-ammo') {
    shape('M40 41l11 -1v6l-11 2Z','#da5844');
    shape('M43 42l2 0 -1 4 -2 0Z',light);
  } else if(id==='pistol') {
    shape('M24 28H39L35 36H28L29 33H33L35 29H24Z',ink);
    for(const x of [14,18,22])shape('M'+x+' 17l2 -1 -2 6 -2 1Z','#567486');
  } else if(id==='knife') {
    shape('M12 49l8 4 2 -3 -8 -4ZM17 44l8 4 2 -3 -8 -4Z',ink);
  } else if(id==='healing-injector') {
    shape('M40 12L46 6L51 11L45 17Z','#9aa9bc',true);
    shape('M43 7L48 2L58 12L53 17Z','#56bcad',true);
    shape('M9 47L12 50L5 57Z','#697e94');
    shape('M24 28l4 4 2 -2 -4 -4ZM29 23l4 4 2 -2 -4 -4Z','#fff5db');
  }
  cache.set(id,canvas);
  return canvas;
}
