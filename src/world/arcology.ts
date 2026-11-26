import * as THREE from 'three';
import type { Vec3 } from '../contracts/demo.ts';
import type { Materials } from './detail/materialLibrary.ts';
import { enamel, emissive } from './detail/materialLibrary.ts';
import { box, cylinder, mesh, strut, label } from './detail/geometry.ts';
import { supplySites } from './supplySites.ts';

type Solid = (at: Vec3,size: Vec3,material: THREE.Material, bevel?:number)=>THREE.Mesh;

// All street furniture is built in surveyed lots with an open frontage.
// Raised elements clear the route below. Major masses use the same placement for collision.
export function addArcology(root: THREE.Group,m: Materials,solid: Solid) {
  const mint=emissive(0x69ffec,.45), iris=enamel(0x826ac0), cyan=enamel(0x319cae);
  const coral=enamel(0xf97e62), porcelain=m.ceramic, navy=m.steel;
  const glass=enamel(0x284a70);
  const rail=(a:Vec3,b:Vec3,w:number,d:number,mat:THREE.Material)=>
    strut(root,mat,new THREE.Vector3(...a),new THREE.Vector3(...b),w,d);
  // Chamfered station body, panoramic visor, overhanging lid and recessed service bay.
  function station(x:number,z:number,w:number,d:number,h:number,accent:THREE.Material,_code:string,_sub:string) {
    solid([x,.32,z],[w+.42,.64,d+.42],navy,.22);
    solid([x,h/2+.5,z],[w,h-.28,d],porcelain,.28);
    solid([x,h+.55,z],[w+.48,.46,d+.5],accent,.21);
    const front=z+d/2;
    box(root,glass,w-.65,h*.36,.16,x,h*.68,front,.065);
    for(const side of [-1,1]) {
      const fin=box(root,accent,.5,h*.72,.3,x+side*(w/2-.55),h*.56,front+.1,.09);
      fin.rotation.z=-side*.09;
      box(root,navy,.14,h*.32,d-.6,x+side*(w/2-.02),h*.68,z,.04);
    }
    box(root,mint,w*.54,.09,.06,x,h*.83,front+.105);
    box(root,navy,w*.54,h*.26,.08,x,h*.245,front+.055,.035);
    for(let i=-2;i<=2;i++) box(root,m.zinc,.12,h*.19,.09,x+i*w*.08,h*.24,front+.1);
    solid([x-w*.19,h+1.11,z],[w*.46,.72,d*.63],navy,.14);
    for(let i=0;i<4;i++) box(root,m.zinc,w*.4,.12,.19,x-w*.19,h+1.5,z+(i-1.5)*d*.13,.03);
  }
  // Walk-through platforms have a level sill and a clear view between their two portals.
  function concourse(x:number,z:number,w:number,d:number,h:number,accent:THREE.Material,_code:string,_sub:string) {
    const roof=h+.2, sideX=w/2-.2;
    box(root,m.concrete,w,.04,d,x,.02,z);
    solid([x,roof,z],[w+.56,.38,d+1.3],navy,.18);
    solid([x,roof+.24,z],[w+.42,.16,d+1.16],porcelain,.08);
    for(const side of [-1,1]) {
      const sx=x+side*sideX;
      solid([sx,.58,z],[.4,1.16,d],porcelain,.08);
      solid([sx,1.82,z],[.18,1.32,d-.28],glass,.055);
      for(const end of [-1,1]) {
        const ez=z+end*(d/2-.16);
        solid([sx,h/2,ez],[.44,h,.46],accent,.08);
        rail([sx,h-1.36,ez],[sx-side*.92,roof-.17,ez],.32,.4,porcelain);
      }
      for(const dz of [-d*.25,0,d*.25]) {
        box(root,navy,.45,.10,.24,sx,1.12,z+dz);
        solid([sx,h/2,z+dz],[.22,h,.13],navy,.025);
      }
      solid([sx-side*.58,.45,z],[1.04,.90,d*.48],m.steel,.09);
      box(root,accent,1.15,.10,d*.5,sx-side*.58,.94,z,.047);
      box(root,mint,.12,.045,d*.66,sx-side*.62,roof-.22,z);
      if(side<0) {
        const tx=sx-side*.53;
        solid([tx,1.24,z],[.17,.52,.19],navy,.03);
        solid([tx,1.66,z],[.23,.67,1.5],porcelain,.075);
        const screen=label(root,1.32,.51,(ctx,width,height)=>{
          ctx.fillStyle='#172f4c';ctx.fillRect(0,0,width,height);
          ctx.fillStyle='#79b7d2';ctx.fillRect(15,12,width-32,4);
          ctx.fillStyle='#a8f5e4';for(let i=0;i<6;i++){ctx.fillRect(18+i*72,40,42,22+(i%3)*13);ctx.fillRect(18+i*72,112,42,8);}
        },.23);
        screen.position.set(tx+.12,1.66,z);screen.rotation.y=Math.PI/2;
      }
    }
    for(const end of [-1,1]) {
      const fz=z+end*(d/2+.17);
      solid([x,roof-.49,fz],[w-.35,.73,.32],accent,.10);
      for(const side of [-1,1])
        box(root,accent,.52,.018,.78,x+side*1.48,.052,z+end*(d/2-.58));
    }
  }
  const lots = [
    [-15,130,8,9,4.2,coral,'A-01','SOUTH ARRIVALS'],
    [-37,135,8,6,3.7,cyan,'S-02','MED TRANSIT'],
    [12,113,15,10,6,cyan,'T-04','CARGO CONTROL'],
    [-89,112,10,9,5.1,cyan,'Q-07','BONDED STORAGE'],
    [95,114,17,10,5.4,coral,'E-02','POWER SERVICE'],
    [139,70,9,7,4.7,iris,'E-08','EAST TERMINAL'],
    [-102,12,8,12,5.2,cyan,'C-03','QUAY CONTROL'],
    [18,53,12,9,4.5,cyan,'H-12','DISTRIBUTION'],
    [76,8,12,9,5.1,coral,'P-06','COOLANT'],
    [24,-84,12,8,4.2,iris,'L-02','BIO TRANSFER'],
    [-40,-140,12,9,5.2,iris,'L-04','TELEMETRY'],
    [102,-108,12,7,4.3,iris,'B-11','CONTAINMENT'],
  ] as const;
  for(const [x,z,w,d,h,color,code,sub] of lots) {
    const build = ['A-01','T-04','L-02'].includes(code) ? concourse : station;
    build(x,z,w,d,h,color,code,sub);
  }

  // Palletized return pods face the pedestrian spine through the freight sorting court.
  // Split the stacks into short bays so players can cross between, or skirt the court entirely.
  for(const [cx,cz,levels] of [[-82,81,2],[-82,87,1],[-64,81,1],[-64,72,2]]) {
    solid([cx,.16,cz],[4.1,.32,2.16],navy,.10);
    for(let level=0;level<levels;level++) {
      const bottom=.32+level*1.43;
      solid([cx,bottom+.68,cz],[3.86,1.36,1.96],level?cyan:porcelain,.21);
      solid([cx,bottom+1.395,cz],[3.72,.07,1.86],navy,.03);
      for(const side of [-1,1]) {
        box(root,glass,2.7,.49,.08,cx,bottom+.84,cz+side*.98,.038);
        for(const dx of [-1.43,1.43]) {
          box(root,coral,.16,1.1,.12,cx+dx,bottom+.68,cz+side*.96,.035);
        }
        box(root,mint,.68,.065,.035,cx,bottom+.90,cz+side*1.03);
      }
    }
  }
  // Elevated twin freight guideway. Paired bearings rest on the pier cap.
  const x=2;
  const stops=[143,120,97,74,51,32];
  for(const z of stops) {
    // Span the east-west carriageway at z=95 without a column on the road.
    if(z===97) continue;
    solid([x,.36,z],[3.4,.72,2.8],navy,.18);
    solid([x,5.3,z],[1.35,9.9,1.6],porcelain,.16);
    for(const side of [-1,1]) rail([x+side*.45,7.8,z],[x+side*2.1,10.3,z],.62,1.15,cyan);
    solid([x,10.42,z],[5.2,.52,1.9],navy,.13);
    box(root,mint,.16,5,.07,x,5.8,z+.83);
  }
  for(const side of [-1,1]) {
    solid([x+side*1.9,11,85.5],[.78,.65,117],navy,.08);
    box(root,mint,.81,.095,117,x+side*1.9,11.07,85.5);
  }
  for(let z=29;z<144;z+=4) box(root,m.zinc,3.75,.18,.42,x,10.86,z);
  // Parked shuttle faces the southern arrival. Underframe rests on the tracks.
  for(const z of [119,130]) {
    solid([x,11.65,z],[4.6,.65,10.6],navy,.3);
    solid([x,13.13,z],[4.7,2.4,10.7],porcelain,.54);
    box(root,glass,4.74,1.04,10.71,x,13.38,z,.4);
    box(root,coral,4.55,.35,10.48,x,14.3,z,.15);
    for(const side of [-1,1]) for(const dz of [-3,0,3])
      box(root,porcelain,.08,1.05,.16,x+side*2.35,13.37,z+dz);
  }
  // Distinct skyline markers: the plant's concentric induction coils and research antenna.
  for(const [cx,cz,h,accent,research] of [[153,-44,20,coral,false],[49,-145,15,iris,true]] as const) {
    solid([cx,1,cz],[6,2,6],navy,.32);
    solid([cx,h/2+1,cz],[2.4,h,2.4],accent,.36);
    for(const level of [.32,.62,.92]) {
      const radius=research?2.6:3.5;
      cylinder(root,navy,radius,.65,cx,h*level,cz,8);
      cylinder(root,mint,radius+.03,.16,cx,h*level+.19,cz,8);
      for(const side of [-1,1])
        rail([cx+side*1.05,h*level-1.7,cz],[cx+side*radius*.87,h*level-.32,cz],.28,.48,porcelain);
    }
    if(research) {
      const dish=mesh(root,new THREE.SphereGeometry(3.1,16,5,0,Math.PI*2,0,.95),porcelain,cx,h+2.1,cz);
      dish.rotation.x=2.52;
      rail([cx,h+.7,cz],[cx,h+4.3,cz+1.6],.18,.18,navy);
    }
  }
  // Planted street islands break the long ground plane. Each crown grows from a
  // fork, and every island has a continuous raised planter at player height.
  const bark=enamel(0x475878), leaf=enamel(0x57abb4), tip=enamel(0x8bcdbf);
  const lilac=enamel(0xad93cf), blush=enamel(0xd1add7);
  const crown=new THREE.IcosahedronGeometry(1,0);
  for (const [px,pz,length,purple] of [
    [-31,118,8,0],[-36,146,9,0],[-8,115,10,0],[24,130,13,0],[-71,100,10,0],
    [96,84,12,0],[133,89,12,0],[-99,48,9,0],[-38,45,8,0],
    [28,-126,9,1],[52,-130,8,1],[22,-135,12,1],[76,-130,9,1],
    [-62,-157,9,1],[99,-22,10,0],[110,-56,8,0],[-23,-102,9,1],
  ]) {
    solid([px,.29,pz],[length,.58,2.45],navy,.22);
    box(root,m.zinc,length-.14,.135,2.38,px,.6,pz,.06);
    box(root,cyan,length-.45,.07,2.08,px,.69,pz,.04);
    for (const side of [-1,1]) {
      const tx=px+side*length*.26;
      const h=3.9+.7*Math.sin(tx);
      cylinder(root,bark,.19,h,tx,.7+h/2,pz,7);
      for (const fork of [-1,1]) {
        const endX=tx+fork*1.05, endY=.7+h+fork*.3;
        rail([tx,h*.67,pz],[endX,endY,pz+fork*.2],.24,.24,bark);
        const foliage=mesh(root,crown,purple?lilac:leaf,endX,endY+.45,pz+fork*.2);
        foliage.scale.set(1.84,1.3,1.45);foliage.rotation.y=tx;foliage.castShadow=true;
      }
      const top=mesh(root,crown,purple?blush:tip,tx,.7+h+1.28,pz);
      top.scale.set(1.95,1.44,1.55);top.rotation.y=pz;top.castShadow=true;
    }
  }
  for(const site of supplySites) {
    const color=site.item==='medkit'?cyan:site.item==='research-sample'?iris:coral;
    // Painted apron and embedded landing markers frame the interaction aisle.
    box(root,m.concrete,13.6,.02,12.4,site.x,.014,site.z+.5);
    for(const side of [-1,1]) for(const dz of [4,5,6])
      box(root,color,.68,.014,.21,site.x+side*4.7,.034,site.z+dz);
    // Service awning sits above both workbenches; the rear racks and climbing lane stay open.
    for(const side of [-1,1]) {
      solid([site.x-1.6+side*5.0,1.85,site.z+4.9],[.26,3.7,.38],navy,.035);
      solid([site.x-1.6+side*5.0,1.85,site.z-.7],[.26,3.7,.38],navy,.035);
    }
    solid([site.x-1.6,3.82,site.z+2.1],[10.5,.27,6.6],porcelain,.12);
    box(root,color,10.55,.48,.28,site.x-1.6,3.78,site.z+5.38,.08);
    box(root,mint,7,.075,.06,site.x-1.6,3.77,site.z+5.54);
  }
}
