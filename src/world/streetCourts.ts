import * as THREE from 'three';
import type { Vec3 } from '../contracts/demo.ts';
import { box, cylinder, mesh, strut } from './detail/geometry.ts';
import { enamel, emissive, type Materials } from './detail/materialLibrary.ts';

// Surveyed spaces beside the arterials and between shop streets. Each occupies at most 10 × 8 metres.
const courts = [
  [10,144],[-50,143],[-102,140],[-130,114],[-93,85],[-54,85],[-7,105],[71,114],[79,85],
  [123,105],[157,105],[191,110],[-92,42],[-92,-32],[-97,-107],[-91,-150],[-44,-122],[-27,-31],
  [4,-51],[43,-72],[122,-110],[146,-110],[187,-119],[198,-42],[163,35],[138,46],[72,47],
  [42,13],[9,43],
] as const;
type Builder=(at:Vec3,size:Vec3,material:THREE.Material,bevel?:number)=>THREE.Mesh;
export function buildStreetCourts(root:THREE.Group,m:Materials,solid:Builder){
  const mint=enamel(0x4ea9a1),blue=enamel(0x657ca6),leaf=enamel(0x458e79),tip=enamel(0x8cc194);
  const lamp=emissive(0xbcfff1,.45), canopy=new THREE.IcosahedronGeometry(1,1);
  function beam(a:Vec3,b:Vec3,w:number,mat:THREE.Material){strut(root,mat,new THREE.Vector3(...a),new THREE.Vector3(...b),w,w);}
  courts.forEach(([x,z],i)=>{
    const flip=i%2?1:-1, type=i%3;
    box(root,m.concrete,9.8,.035,7.8,x,.024,z);
    for(const dx of [-3.9,3.9])box(root,m.safety,.15,.016,2.15,x+dx,.054,z+2.36);
    if(type===0){
      // Covered dispatch halt with a folded roof, timetable and seats oriented to the road.
      for(const dx of [-3.45,3.45]){
        solid([x+dx,1.65,z-1.14],[.22,3.30,.25],m.steel,0);
        beam([x+dx,2.65,z-1.14],[x+dx,3.39,z+.70],.17,mint);
      }
      for(const side of [-1,1]){
        const roof=box(root,side>0?mint:m.ceramic,7.8,.16,1.68,x,3.43,z+side*.80-.33);
        roof.rotation.x=side*.13;
      }
      box(root,lamp,6.5,.075,.12,x,3.32,z-.35);
      for(const dx of [-1.73,1.73]){
        solid([x+dx,.24,z-.74],[2.13,.48,.60],m.steel,.08);
        box(root,m.timber,2.24,.12,.73,x+dx,.52,z-.74,.04);
        solid([x+dx,.85,z-1.01],[2.24,.62,.12],mint,.04);
      }
      solid([x+3.47,1.39,z+.78],[.91,2.78,.38],blue,.08);
      box(root,m.rubber,.73,1.58,.05,x+3.47,1.61,z+1.0);
      for(let row=0;row<4;row++)box(root,row===0?lamp:m.zinc,.52-row*.065,.052,.05,x+3.43,2.13-row*.22,z+1.035);
    }else if(type===1){
      // Cable drums on a low carrier; cheek plates, hub bores, a yoke and two guard bollards.
      const cart=x+flip*.85;
      solid([cart,.43,z],[5.3,.53,2.2],blue,.12);
      for(const dx of [-1.68,1.68]){
        const drumX=cart+dx*.8, r=dx<0?1.12:.94;
        solid([drumX,.99,z],[r*1.55,.80,1.06],m.rubber,.06);
        const spool=cylinder(root,m.timber,r*.82,1.20,drumX,.68+r,z,18);spool.rotation.x=Math.PI/2;
        for(const dz of [-.62,.62]){
          const disc=cylinder(root,m.safety,r,.12,drumX,.68+r,z+dz,18);disc.rotation.x=Math.PI/2;
          const hub=cylinder(root,m.steel,r*.38,.15,drumX,.68+r,z+dz*1.10,12);hub.rotation.x=Math.PI/2;
        }
      }
      for(const dx of [-3.8,3.8])solid([x+dx,.50,z+2.15],[.39,1,.39],m.safety,.08);
    }else{
      // Two offset wind-shaped crowns cast distinct silhouettes against the industrial street wall.
      for(const [dx,dz,h] of [[-2.1,-.9,3.8],[2.38,.74,3.05]]){
        const tx=x+dx*flip,tz=z+dz;
        solid([tx,.36,tz],[2.55,.72,2.23],m.ceramic,.14);
        box(root,m.steel,2.30,.055,2.01,tx,.74,tz);
        solid([tx,(h+.72)/2,tz],[.27,h-.72,.28],m.timber,.08);
        for(const [bx,by,bz,r] of [[-.57,-.18,.15,.99],[.50,.22,-.17,1.10],[.04,.77,.05,.85]]){
          beam([tx,h-.94,tz],[tx+bx,h+by,tz+bz],.14,m.timber);
          const crown=mesh(root,canopy,by>.5?tip:leaf,tx+bx,h+by,tz+bz);crown.scale.set(r*1.21,r*.81,r);
        }
      }
      solid([x,.26,z+2.31],[2.9,.52,.73],m.steel,.07);
      box(root,m.timber,3.05,.11,.79,x,.55,z+2.31,.035);
    }
  });
}
