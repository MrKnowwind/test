import * as THREE from 'three';
import { box, cylinder } from './geometry.ts';
import { enamel, emissive } from './materialLibrary.ts';
import type { CaseKind } from '../../raid/loot.ts';

const dark=enamel(0x293d4c),steel=enamel(0xa7bcc1),white=enamel(0xdceae3),rubber=enamel(0x43525b),wood=enamel(0xb68c61),woodDark=enamel(0x795c49),orange=enamel(0xe0a159),red=enamel(0xca716b),blue=enamel(0x699bb0),green=enamel(0x769b87),glass=enamel(0x79b8ba),light=emissive(0x8affdc,.55),idle=enamel(0x64767a);

/** +Z is the accessible front. Table variants have compact footprints. */
export function makeCaseModel(kind:CaseKind, tabletop:boolean, variant=0){
  const root=new THREE.Group();
  const b=(m:THREE.Material,w:number,h:number,d:number,x=0,y=h/2,z=0,r=.018)=>box(root,m,w,h,d,x,y,z,Math.min(r,w*.2,h*.2,d*.2));
  const handle=(w:number,y:number,z:number,x=0,m=dark)=>{b(m,w,.027,.026,x,y,z,.007);for(const dx of [-w*.4,w*.4])b(m,.019,.044,.032,x+dx,y-.005,z-.008,.005);};
  let w=.51,d=.32,h=.25;
  function shell(color:THREE.Material){b(dark,w,h*.12,d,0,h*.06);b(color,w-.018,h*.87,d-.018,0,h*.55);}
  function top(m:THREE.Material){b(m,w+.018,.033,d+.016,0,h-.006);}
  function clasp(y:number,z:number){for(const x of [-w*.30,w*.30]){b(dark,.035,.052,.018,x,y,z,.004);b(steel,.027,.020,.021,x,y+.004,z+.008,.004);}}
  function cabinet(color:THREE.Material, rows:number){shell(color);for(let i=0;i<rows;i++){const y=.05+(h-.075)*(i+.5)/rows;b(color,w-.046,(h-.075)/rows-.014,.020,0,y,d/2+.004,.006);handle(w*.34,y,d/2+.027);}b(steel,w,.025,d,0,h-.012);}
  switch(kind){
    case 'tin': w=.46;d=.26;h=.20;shell(green);top(green);clasp(h*.72,d/2+.01);handle(.18,h*.49,d/2+.028);for(const x of [-.18,.18])b(dark,.026,h*.81,.031,x,h*.47,d/2+.014);break;
    case 'medical': w=tabletop?.43:.65;d=tabletop?.25:.40;h=tabletop?.25:.78;shell(white);top(white);b(red,w*.88,.14,d+.012,0,h*.62,0,.007);b(white,.08,.024,.008,0,h*.62,d/2+.015);b(white,.024,.08,.008,0,h*.62,d/2+.017);handle(.13,h*.84,d/2+.02);if(!tabletop)handle(.20,h*.3,d/2+.02);else handle(.15,h+.025,0);break;
    case 'tool':w=.53;d=.31;h=.22;shell(variant%2?orange:red);top(dark);handle(.19,h+.030,0,0,steel);clasp(h*.70,d/2+.012);for(const x of [-.215,.215])b(rubber,.025,h*.74,d+.014,x,h*.44,0,.007);break;
    case 'drawers':w=tabletop?.45:.56;d=tabletop?.27:.38;h=tabletop?.27:.72;cabinet(variant%2?wood:blue,tabletop?2:3);break;
    case 'crate':w=tabletop?.49:.73;d=tabletop?.32:.48;h=tabletop?.28:.44;shell(variant%3?wood:green);top(variant%3?wood:green);for(const x of [-w*.36,w*.36]){b(woodDark,.034,h,d+.025,x,h*.50,0,.005);b(woodDark,.034,.024,d+.025,x,h+.013,0,.002);}for(const y of [.04,h*.75])b(woodDark,w+.02,.032,.026,0,y,d/2+.012,.003);break;
    case 'locker':w=tabletop?.42:.55;d=tabletop?.29:.40;h=tabletop?.37:.91;shell(blue);b(blue,w*.86,h*.86,.026,0,h*.53,d/2+.004,.008);for(let i=0;i<3;i++)b(dark,w*.50,.015,.008,0,h*.84-i*.026,d/2+.021,.002);handle(.088,h*.49,d/2+.033,w*.30);for(const x of [-w*.45,w*.45])b(steel,.035,.04,.035,x,.026,d/2-.034);break;
    case 'cold':w=tabletop?.43:.63;d=tabletop?.29:.44;h=tabletop?.27:.80;shell(white);b(white,w*.94,h*.88,.030,0,h*.52,d/2+.006,.014);b(glass,w*.62,h*.42,.015,0,h*.64,d/2+.024,.008);handle(.105,h*.33,d/2+.038,w*.25);for(let i=0;i<4;i++)b(dark,.045,.019,.007,-.075+i*.05,h*.13,d/2+.024,0);break;
    case 'panel':w=tabletop?.44:.60;d=tabletop?.24:.39;h=tabletop?.27:.67;shell(dark);b(steel,w*.91,h*.84,.020,0,h*.53,d/2+.004,.008);b(dark,w*.5,h*.30,.015,-w*.11,h*.69,d/2+.019,.005);b(glass,w*.41,h*.21,.009,-w*.11,h*.69,d/2+.029,.004);for(const x of [-w*.24,0,w*.24])cylinder(root,x===0?orange:green,.017,.019,x,h*.31,d/2+.024,12).rotation.x=Math.PI/2;handle(.075,h*.54,d/2+.024,w*.33);break;
    case 'files':w=tabletop?.46:.64;d=tabletop?.30:.42;h=tabletop?.34:.87;cabinet(steel,tabletop?3:4);for(let i=0;i<(tabletop?3:4);i++)b(white,.095,.038,.008,-w*.28,.05+(h-.075)*(i+.5)/(tabletop?3:4),d/2+.020,.002);break;
    case 'cage':w=tabletop?.52:.76;d=tabletop?.34:.51;h=tabletop?.34:.57;b(wood,w,.06,d,0,.03);b(dark,w-.05,.028,d-.04,0,.077);for(const z of [-d/2,d/2]){for(let i=0;i<6;i++)b(steel,.023,h,.023,-w/2+i*w/5,h/2+.025,z,.002);for(const y of [.085,h*.58,h])b(steel,w+.024,.026,.029,0,y,z,.002);}for(const x of [-w/2,w/2])for(const y of [.085,h])b(steel,.023,.026,d,x,y,0,.002);break;
    case 'carrier':w=.45;d=.35;h=.32;shell(dark);top(steel);for(const x of [-w*.38,w*.38])b(steel,.036,h+.04,d+.026,x,h/2,0,.005);b(glass,w*.62,.098,.019,0,h*.55,d/2+.01,.008);handle(.14,h+.026,0,0,steel);clasp(h*.79,d/2+.018);break;
  }
  const indicator=b(light,.038,.018,.012,w*.35,h*.92,d/2+.035,.003);
  root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(root);
  root.position.y=-bounds.min.y;
  root.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
  return {root,indicator,searched(){indicator.material=idle;}};
}
