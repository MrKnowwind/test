import * as THREE from 'three';
import { createFrontage } from './portFrontage.ts';
import type { Vec3 } from '../contracts/demo.ts';
import { roads, footpaths } from './roads.ts';
import type { Solid } from './worldQueries.ts';
import { box, cylinder, mesh, strut } from './detail/geometry.ts';
import { enamel, emissive, type Materials } from './detail/materialLibrary.ts';

import { hasGallery, galleryHeight, type upperRoutes } from './upperRoutes.ts';
import { buildShopRoom, type ShopRooms } from './shopRooms.ts';

export const shopSide=(index:number)=>index%2?1:-1;
type Lot = readonly [number,number,number,number,number];
// Surveyed build envelopes in metres. Their centres have clearance from service roads,
// existing structures, encounter spawns and the complete approach to each supply point.
export const portBlocks: readonly Lot[] = [
  [-18,82,12,11,3],[-38,80,16,10,4],[-18,61,14,14,2],[-22,41,19,11,5],
  [18,74,12,10,3],[38,78,16,14,3],[37,113,14,11,4],[43,132,19,10,2],
  [-65,134,12,14,5],[-87,132,16,11,3],[-132,72,14,10,3],[-142,45,19,14,4],
  [-135,-60,12,11,2],[-131,-81,16,10,5],[-71,-67,14,14,3],[-77,-87,19,11,3],
  [-44,-82,12,10,4],[-40,-105,16,14,2],[0,-80,14,11,5],[17,-63,19,10,3],
  [19,-40,12,14,3],[40,-18,16,11,4],[75,31,14,10,2],[80,62,19,14,5],
  [103,59,12,11,3],[115,77,16,10,3],[124,56,14,14,4],[113,31,19,11,2],
  [101,12,12,10,5],[127,11,16,14,3],[201,-56,14,11,3],[195,-107,19,10,4],
  [161,-122,12,14,2],[141,-127,16,11,5],[120,-143,14,10,3],[121,-162,19,14,3],
  [100,-183,12,11,4],[68,-180,16,10,2],[47,-184,14,14,5],[22,-188,19,11,3],
  [-6,-150,12,10,3],[-17,-173,16,14,4],[-75,-148,14,11,2],[-83,-127,19,10,5],
  [14,170,12,14,3],[-42,170,16,11,3],[128,131,14,10,4],[151,133,19,14,2],
  [188,82,12,11,5],[202,40,16,10,3],[201,13,14,14,3],
];

export function arcadeWidth(index: number) {
  return index % 3 === 2 ? 4.8 : 4;
}

export function buildPortBlocks(root:THREE.Group,m:Materials,occupied:readonly Solid[],
  solid:(at:Vec3,size:Vec3,mat:THREE.Material,bevel?:number)=>THREE.Mesh, upper:ReturnType<typeof upperRoutes>) {
  const rooms:ShopRooms={doors:[],cases:[],occupants:[]};
  const blue=enamel(0x5989a2), violet=enamel(0x9389bd), warm=enamel(0xf5a479);
  const glazing=enamel(0x334f71), sill=enamel(0xbbd4dc), panel=enamel(0xdae1da);
  const light=emissive(0xa6f3e6,.25);
  const reserved=[...roads,...footpaths];
  const canopyGeometry=new THREE.IcosahedronGeometry(1,0);
  const foliage=enamel(0x438e83), newGrowth=enamel(0x87c39b);
  const frontage=createFrontage(root,m);
  portBlocks.forEach(([x,z,w,d,levels],index)=>{
    const type=index%3, accent=z < -75?violet:type===1?warm:blue;
    const arcade=4.1, height=levels*2.95, roof=arcade+height;
    // One occupied shop and one service core flank the covered lane.
    const opening=arcadeWidth(index), sideWidth=(w-opening)/2;
    const accessible=hasGallery(w,d);
    for(const side of [-1,1]) {
      const px=x+side*(w/2-sideWidth/2);
      if(side===shopSide(index)){
        buildShopRoom(rooms,root,solid,m,index,px,z,sideWidth,d,side,accent,light,frontage.consoles[type]);
        continue;
      }
      if(accessible)continue;
      solid([px,arcade/2,z],[sideWidth,arcade,d],m.steel,.12);
      for(const front of [-1,1]) {
        const fz=z+front*(d/2+.015);
        box(root,accent,sideWidth-.24,3.34,.12,px,2.06,fz,.055);
        box(root,glazing,sideWidth*.74,2.61,.10,px,1.78,fz+front*.095,.045);
        for(const y of [1,1.45,1.9,2.35])
          box(root,sill,sideWidth*.65,.045,.10,px,y,fz+front*.16);
        box(root,light,sideWidth*.66,.12,.13,px,3.37,fz+front*.09);
      }
      box(root,m.zinc,.22,.06,d*.93,x+side*(opening/2-.31),.04,z);
    }
    frontage.shop(type,x,z,w,d,accent);
    // Keep the passage mouths, public footpaths and adjacent service yards clear.
    // Each small cluster belongs against a sealed shop wall.
    for(const side of [1,-1]) {
      const px=x+side*(w/2+1.26), pz=z+d*(index%2 ? .17 : -.17);
      const x1=px-.84,x2=px+.84,z1=pz-2.5,z2=pz+2.5;
      if(reserved.some(r=>x1<r.x2 && x2>r.x1 && z1<r.z2 && z2>r.z1)) continue;
      if(occupied.some(s=>!s.floor && s.min[1]<3.8 && s.max[1]>.12 &&
        x1<s.max[0] && x2>s.min[0] && z1<s.max[2] && z2>s.min[2])) continue;
      if(type===0) {
        solid([px,.31,pz],[1.40,.62,4.12],sill,.12);
        box(root,m.steel,1.24,.13,3.91,px,.66,pz,.04);
        for(const dz of [-1.12,1.1]) {
          const treeZ=pz+dz;
          cylinder(root,m.timber,.065,1.24,px,1.33,treeZ,7);
          const crown=mesh(root,canopyGeometry,foliage,px,2.02,treeZ);
          crown.scale.set(.75,.93,.92);
          const top=mesh(root,canopyGeometry,newGrowth,px+.12*side,2.54,treeZ+.1);
          top.scale.set(.51,.56,.59);
        }
      } else if(type===1) {
        // Sealed delivery lockers, with a flush pickup console facing the street.
        solid([px,1.02,pz],[.77,2.04,3.6],m.steel,.09);
        for(let i=0;i<4;i++) for(let j=0;j<2;j++) {
          const cz=pz+(i-1.5)*.86,cy=.54+j*.92;
          box(root,i===1?warm:sill,.08,.85,.79,px+side*.397,cy,cz,.028);
          box(root,m.steel,.09,.055,.24,px+side*.443,cy+.17,cz+.15);
        }
        box(root,warm,.97,.14,3.82,px,2.07,pz,.06);
      } else {
        // Low waiting bench at the dispensary with a short light at one end.
        for(const dz of [-.99,.99]) solid([px,.21,pz+dz],[.62,.42,.26],m.steel,.04);
        solid([px,.49,pz],[.84,.14,2.69],m.timber,.045);
        solid([px-side*.34,.84,pz],[.13,.64,2.70],sill,.045);
        solid([px,.81,pz+1.9],[.40,1.62,.42],m.steel,.08);
        box(root,light,.32,.44,.34,px,1.84,pz+1.9,.055);
        box(root,violet,.43,.09,.45,px,2.10,pz+1.9,.04);
      }
      break;
    }
    if(accessible)upper.gallery(x,z,w,d,shopSide(index),opening,index,rooms.cases);
    else solid([x,arcade+.26,z],[w+.65,.52,d+.64],m.steel,.12);
    const aw=type===1?w-.84:w, ad=type===2?d-1:d;
    if(accessible){
      const ceiling=galleryHeight+2.84;
      solid([x,(ceiling+roof)/2,z],[aw,roof-ceiling,ad],panel,.11);
      solid([x,ceiling+.04,z],[w+.34,.18,d+.65],accent,.05);
    }else solid([x,arcade+height/2+.28,z],[aw,height-.45,ad],panel,.22);
    for(let floor=accessible?1:0;floor<levels;floor++) {
      const y=arcade+1.85+floor*2.95;
      for(const side of [-1,1]) {
        const fz=z+side*(ad/2+.035),fx=x+side*(aw/2+.035);
        // Window bays sit inside deep reveals with a projecting sill/solar shade.
        box(root,glazing,aw-1.2,1.45,.16,x,y,fz);
        box(root,glazing,.16,1.45,ad-1.2,fx,y,z);
        frontage.panel(frontage.glass[(floor+type)%3],x,y,fz+side*.09,aw-1.42,1.34,side>0?0:Math.PI);
        frontage.panel(frontage.glass[type],fx+side*.09,y,z,ad-1.42,1.34,side*Math.PI/2);
        if(type===1 && floor%2===0) {
          box(root,warm,aw*.47,.23,1.07,x-aw*.18,y-.59,fz+side*.25,.05);
          box(root,sill,aw*.47,.35,.10,x-aw*.18,y-.36,fz+side*.73);
        }
        for(let n=1;n<4;n++) box(root,sill,.19,1.52,.21,x+(n/4-.5)*(aw-1.0),y,fz);
        box(root,type===0?blue:sill,aw-.46,.18,.65,x,y-.74,fz);
        box(root,accent,.23,1.53,.34,fx,y,z+ad*.17);
      }
    }
    solid([x,roof,z],[aw+.48,.34,ad+.48],accent,.1);
    if(type===0) {
      // Insulated roof plant with external coolant collars, readable from the next street.
      for(const side of [-1,1]) {
        const px=x+side*w*.23;
        cylinder(root,panel,w*.155,2.8,px,roof+1.57,z,12);
        for(const y of [.32,2.54,2.98]) cylinder(root,m.steel,w*.16,.19,px,roof+y,z,12);
        cylinder(root,light,w*.13,.12,px,roof+3.09,z,12);
      }
    } else if(type===1) {
      const px=x-w*.14,pz=z+d*.08;
      solid([px,roof+1.45,pz],[w*.61,2.65,d*.62],blue,.22);
      box(root,glazing,w*.51,1.0,.14,px,roof+1.6,pz+d*.31,.06);
      solid([px,roof+2.89,pz],[w*.65,.29,d*.66],sill,.07);
    } else {
      for(const side of [-1,1]) {
        const px=x+side*w*.31;
        strut(root,accent,new THREE.Vector3(px,roof+.1,z-d*.35),
          new THREE.Vector3(px,roof+3.16,z+d*.28),.4,.4);
      }
      const collector=box(root,blue,w*.68,.19,d*.67,x,roof+1.74,z-.03*d,.045);
      collector.rotation.x=-Math.atan2(3.06,d*.63);
    }
  });
  return rooms;
}
