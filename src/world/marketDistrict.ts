import * as THREE from 'three';
import type { Vec3 } from '../contracts/demo.ts';
import { box, cylinder } from './detail/geometry.ts';
import { emissive, enamel, type Materials } from './detail/materialLibrary.ts';
import {
  marketCourt, marketShops, parkingKiosk, parkingNorth, parkingPad, parkingSouth,
  pharmacy, pharmacyNorth, pharmacyPad, pharmacySouth,
} from './marketPlan.ts';

type Builder=(at:Vec3,size:Vec3,material:THREE.Material,bevel?:number)=>THREE.Mesh;
type Footprint={minX:number;maxX:number;minZ:number;maxZ:number};

export function buildMarketDistrict(root:THREE.Group,m:Materials,solid:Builder) {
  const cream=enamel(0xdfd7c1), blue=enamel(0x527e9e), orange=enamel(0xc78056);
  const green=enamel(0x578678), orchid=enamel(0x807598), glass=enamel(0x456677);
  const mint=emissive(0xc0ffe7,.6), amber=emissive(0xffdfa1,.52);
  const counterTop=enamel(0xb0bdaf);

  function wallZ(z:number,x1:number,x2:number,y:number,h:number,mat:THREE.Material) {
    solid([(x1+x2)/2,y+h/2,z],[x2-x1,h,.24],mat,.022);
  }
  function wallX(x:number,z1:number,z2:number,y:number,h:number,mat:THREE.Material) {
    solid([x,y+h/2,(z1+z2)/2],[.24,h,z2-z1],mat,.022);
  }
  function doorZ(z:number,x1:number,x2:number,y:number,h:number,x:number,w:number,mat:THREE.Material) {
    wallZ(z,x1,x-w/2,y,h,mat);
    wallZ(z,x+w/2,x2,y,h,mat);
    wallZ(z,x-w/2,x+w/2,y+2.45,h-2.45,mat);
    for(const side of [-1,1])box(root,m.zinc,.14,2.45,.32,x+side*w/2,y+1.225,z);
  }
  function counter(x:number,y:number,z:number,w:number,d:number,tint:THREE.Material) {
    solid([x,y+.515,z],[w,1.03,d],tint,.055);
    box(root,counterTop,w+.085,.065,d+.075,x,y+1.018,z,.03);
  }
  function light(x:number,y:number,z:number,color:number) {
    box(root,color===0xffd6a3?amber:mint,2.15,.075,.23,x,y,z,.025);
    const bulb=new THREE.PointLight(color,28,8,2);
    bulb.position.set(x,y-.15,z);root.add(bulb);
  }
  const sidewalk=enamel(0xb6b39c);
  box(root,sidewalk,marketCourt.maxX-marketCourt.minX,.035,5,-67,.019,119.5);
  box(root,sidewalk,1.25,.034,16.9,-77.95,.019,109.6);
  for(const [i,shop] of marketShops.entries()){
    const {minX,maxX,minZ,maxZ,entryX}=shop, tint=[green,blue,orange][i], h=[3.65,4.35,3.40][i];
    const width=maxX-minX, depth=maxZ-minZ, x=(minX+maxX)/2,z=(minZ+maxZ)/2;
    wallX(minX,minZ,maxZ,0,h,cream);
    // Setbacks also need their own walls where adjacent shops have different depths.
    const neighbor=marketShops[i+1];
    if(neighbor){
      wallX(maxX,minZ,neighbor.minZ,0,h,cream);
      if(neighbor.maxZ<maxZ)wallX(maxX,neighbor.maxZ,maxZ,0,h,cream);
    }
    if(i===2)wallX(maxX,minZ,maxZ,0,h,cream);
    wallZ(minZ,minX,maxX,0,h,cream);
    doorZ(maxZ,minX,maxX,0,h,entryX,2.4,tint);
    for(const bx of [minX+.65,maxX-.65]){
      box(root,glass,1.05,1.10,.065,bx,1.55,maxZ+.15,.035);
      box(root,cream,1.23,.12,.29,bx,.98,maxZ+.23,.035);
    }
    const roof=box(root,i===1?m.steel:tint,width+.32,.23,depth+.4,x,h+.1,z,.05);
    roof.rotation.x=i===1?.045:0;
    const awning=box(root,tint,width+.32,.18,i===2?2.65:1.78,x,h-.54,maxZ+.77,.05);
    awning.rotation.x=i===2?.13:0;
    box(root,i===2?amber:mint,width-.8,.055,.19,x,h-.68,maxZ+.42);
    box(root,i===1?m.concrete:sidewalk,width-.3,.025,depth-.3,x,.015,z);
    light(x,h-.22,z,i===2?0xffd6a3:0xb7e7f8);
  }
  // Grocery, hardware and kitchen use different fixtures and keep a direct route to their cases.
  counter(-75.3,0,111,1.65,1.57,green);
  for(const z of [107.65,109.2]){
    solid([-72.05,.88,z],[.96,1.76,1.23],blue,.055);
    box(root,glass,.07,1.47,1.01,-72.58,.94,z,.035);
  }
  for(const z of [112.6,114.1])counter(-72.15,0,z,1.10,1.00,cream);
  counter(-69.25,0,113.7,1.75,1.65,blue);
  solid([-65.05,1.04,110.1],[1.06,2.08,3.19],m.steel,.04);
  for(const h of [.52,1.04,1.56]){
    box(root,blue,.17,.096,3.02,-65.62,h,110.1);
    for(let i=0;i<4;i++)box(root,cream,.20,.23,.40,-65.61,h+.17,109+i*.72,.04);
  }
  solid([-68.2,1.13,106.42],[4.78,2.25,.48],green,.025);
  for(let i=0;i<6;i++)box(root,m.zinc,.24,.65+(i%2)*.14,.09,-70.1+i*.75,1.43,106.73,.02);
  counter(-58.55,0,112.7,1.76,1.43,orange);
  counter(-61,0,108.55,4.75,1.22,green);
  for(const x of [-62,-61,-60])cylinder(root,m.rubber,.22,.047,x,1.075,108.6,16);
  for(const x of [-61.9,-58.55]){
    solid([x,.39,114.95],[.46,.78,.44],orange,.09);
    box(root,cream,.61,.085,.58,x,.8,114.95,.12);
  }

  function parapets(pad:Footprint & {height:number},north:Footprint,south:Footprint,mat:THREE.Material) {
    const {minX:x1,maxX:x2,minZ:z1,maxZ:z2,height:y}=pad;
    for(const x of [x1+.12,x2-.12])wallX(x,z1+.04,z2-.04,y,.70,mat);
    for(const [z,access] of [[z1+.12,north],[z2-.12,south]] as const) {
      wallZ(z,x1,access.minX,y,.70,mat);
      wallZ(z,access.maxX,x2,y,.70,mat);
    }
  }

  const py=pharmacyPad.height, p=pharmacy;
  parapets(pharmacyPad,pharmacyNorth,pharmacySouth,cream);
  box(root,sidewalk,7.8,.03,16,-66,py+.017,138);
  wallX(p.minX,p.minZ,p.maxZ,py,4.0,cream);
  wallX(p.maxX,p.minZ,p.maxZ,py,4.0,cream);
  for(const z of [p.minZ,p.maxZ]){
    doorZ(z,p.minX,p.maxX,py,4.0,-66,3.1,orchid);
    for(const x of [-72,-61.6]){
      box(root,glass,2.63,1.4,.06,x,py+1.89,z+Math.sign(z-138)*.15,.045);
      box(root,cream,2.81,.16,.41,x,py+1.09,z+Math.sign(z-138)*.19,.045);
    }
  }
  box(root,orchid,16.55,.30,14.13,-67.65,py+4.14,137.8,.09);
  box(root,green,7.4,.20,3.24,-66,py+2.88,144.75,.10);
  box(root,mint,4.9,.06,.18,-66,py+2.753,145.65);
  box(root,glass,6.9,.42,4.95,-69.5,py+4.43,138.0,.045);
  for(const x of [-72.1,-70.3,-68.5,-66.7])box(root,m.zinc,.17,.11,4.99,x,py+4.65,138);
  counter(-72.8,py,138.4,2.60,1.20,green);
  counter(-61.5,py,133.6,2.32,1.24,blue);
  counter(-61.6,py,142.2,2.38,1.26,orchid);
  wallX(-63.8,139.0,140.0,py,3.35,glass);
  wallX(-63.8,142.3,p.maxZ,py,3.35,glass);
  wallZ(139.12,-63.8,p.maxX,py,3.35,glass);
  for(const z of [132.45,134.95,141.9]){
    solid([-74.60,py+1.04,z],[.78,2.08,1.62],green,.056);
    for(const h of [.53,1.05,1.58])box(root,cream,.14,.086,1.40,-74.12,py+h,z);
  }
  solid([-60.9,py+1.13,136.12],[1.09,2.26,2.50],blue,.065);
  for(const z of [135.54,136.68]){
    box(root,glass,.07,1.80,1.04,-61.47,py+1.19,z,.035);
    box(root,mint,.06,.10,.73,-61.51,py+1.91,z);
  }
  solid([-60.85,py+.45,140.48],[1.22,.9,1.9],cream,.07);
  box(root,orchid,1.10,.16,1.79,-60.85,py+.94,140.48,.06);
  light(-70.7,py+3.86,135.25,0xb7e7f8);
  light(-66,py+3.86,141.25,0xb7e7f8);

  const vy=parkingPad.height, k=parkingKiosk;
  parapets(parkingPad,parkingNorth,parkingSouth,blue);
  box(root,m.asphalt,24.26,.030,27.35,195.5,vy+.016,130,.04);
  for(const x of [193.75,202.25])box(root,cream,.09,.022,27,x,vy+.043,130);
  for(const z of [118,122.1,126.2,130.3,134.4,138.5,142.6]){
    for(const x of [188.6,204.9])box(root,cream,x<195?7.8:4.35,.022,.095,x,vy+.044,z);
  }
  for(const [x,z,w,d,tint] of [[188.2,120.05,2.10,3.72,cream],[189.1,127.95,2.38,4.0,green],[205.05,122.1,2.12,3.6,orange]] as const) {
    for(const side of [-1,1])for(const dz of [-d*.29,d*.29]){
      const wheel=cylinder(root,m.rubber,.31,.23,x+side*w*.47,vy+.31,z+dz,14);wheel.rotation.z=Math.PI/2;
      const hub=cylinder(root,m.zinc,.145,.031,x+side*(w*.47+.13),vy+.31,z+dz,10);hub.rotation.z=Math.PI/2;
    }
    solid([x,vy+.61,z],[w,.64,d],tint,.18);
    solid([x,vy+1.05,z-.14],[w*.87,.50,d*.62],glass,.13);
    box(root,tint,w*.86,.13,d*.57,x,vy+1.34,z-.17,.075);
    for(const side of [-1,1])box(root,side<0?amber:mint,w*.65,.11,.07,x,vy+.66,z+side*d*.503,.025);
  }
  wallZ(k.minZ,k.minX,k.maxX,vy,3.1,cream);
  doorZ(k.maxZ,k.minX,k.maxX,vy,3.1,187.8,2.3,blue);
  for(const x of [k.minX,k.maxX])wallX(x,k.minZ,k.maxZ,vy,3.1,cream);
  box(root,blue,6.15,.25,7.1,187.2,vy+3.18,138.7,.08);
  box(root,glass,.07,1.36,3.82,k.maxX+.15,vy+1.75,138.1,.05);
  counter(186,vy,138.7,1.50,2.0,blue);
  light(187.3,vy+2.97,138.4,0xb7e7f8);
  counter(205.35,vy,136,1.76,1.15,green);
  for(const z of [131.7,140.2]){
    solid([205.95,vy+1.05,z],[.82,2.10,.79],blue,.055);
    box(root,glass,.08,.60,.52,205.51,vy+1.56,z,.03);
    box(root,mint,.09,.09,.42,205.50,vy+1.64,z);
  }
  for(const z of [114.55,145.25]){
    for(const x of [194.44,201.56]){
      const approach=z<120?parkingNorth:parkingSouth;
      const y=approach.northY+(approach.southY-approach.northY)*(z-approach.minZ)/(approach.maxZ-approach.minZ);
      solid([x,y+.47,z],[.25,.94,.25],blue,.045);
      box(root,cream,.27,.13,.27,x,y+.68,z,.025);
    }
  }
}
