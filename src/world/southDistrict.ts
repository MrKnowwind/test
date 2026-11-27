import * as THREE from 'three';
import type { Vec3 } from '../contracts/demo.ts';
import { box, cylinder, mesh, strut } from './detail/geometry.ts';
import { emissive, enamel, type Materials } from './detail/materialLibrary.ts';
import {
  communityApproach, communityPad, communitySteps, residentialApproach, residentialPad, residentialSteps,
  southBuildings, transitNorth, transitPad, transitSouth,
} from './southPlan.ts';
import { pharmacySouth } from './marketPlan.ts';
import type { Solid } from './worldQueries.ts';

export function buildSouthDistrict(root: THREE.Group, m: Materials, solids: Solid[],
  solid: (at: Vec3, size: Vec3, material: THREE.Material, bevel?: number) => THREE.Mesh) {
  const cream=enamel(0xe6dbc4), green=enamel(0x568c77), orange=enamel(0xbd805b);
  const blue=enamel(0x577b94), glass=enamel(0x41687b), lamp=emissive(0xe1f7dc,.48);
  const gravel=enamel(0xb0aa91), paving=enamel(0x94acaa), leaf=enamel(0x679576);
  const foliage = new THREE.IcosahedronGeometry(1,1);
  function wallX(x:number,z1:number,z2:number,y:number,h:number,material:THREE.Material) {
    solid([x,y+h/2,(z1+z2)/2],[.26,h,z2-z1],material,.018);
  }
  function wallZ(z:number,x1:number,x2:number,y:number,h:number,material:THREE.Material) {
    solid([(x1+x2)/2,y+h/2,z],[x2-x1,h,.26],material,.018);
  }
  function entryX(x:number,z1:number,z2:number,y:number,h:number,z:number,width:number,material:THREE.Material) {
    wallX(x,z1,z-width/2,y,h,material);
    wallX(x,z+width/2,z2,y,h,material);
    solid([x,y+(h+2.55)/2,z],[.30,h-2.55,width],material,.018);
    for(const dz of [-width/2,width/2]) box(root,m.zinc,.36,2.55,.12,x,y+1.275,z+dz);
  }
  function desk(x:number,y:number,z:number,w:number,d:number,material:THREE.Material) {
    solid([x,y+.51,z],[w,1.02,d],material,.055);
    box(root,m.timber,w+.10,.05,d+.10,x,y+1.02,z,.025);
  }
  function bench(x:number,y:number,z:number,w:number,material:THREE.Material) {
    solid([x,y+.25,z],[w,.5,.67],material,.08);
    box(root,m.timber,w+.08,.075,.70,x,y+.51,z,.025);
    box(root,material,w,.40,.08,x,y+.72,z+.29,.025);
  }
  function light(x:number,y:number,z:number,color:number) {
    box(root,lamp,2.0,.11,.26,x,y,z,.02);
    const bulb=new THREE.PointLight(color,36,9,2);
    bulb.position.set(x,y-.18,z);root.add(bulb);
  }
  function planter(x:number,y:number,z:number) {
    solid([x,y+.34,z],[1.86,.68,1.62],cream,.12);
    cylinder(root,m.timber,.11,1.85,x,y+1.30,z,9);
    for (const [dx,dy,scale] of [[0,2.75,1.1],[-.61,2.3,.81],[.65,2.48,.87]]) {
      const crown=mesh(root,foliage,leaf,x+dx,y+dy,z);
      crown.scale.set(scale,scale*.87,scale*.88);
    }
  }
  function guard(x1:number,z1:number,x2:number,z2:number,y:number,material:THREE.Material) {
    const w=Math.abs(x2-x1), d=Math.abs(z2-z1);
    if (w+d < .25) return;
    solid([(x1+x2)/2,y+.36,(z1+z2)/2],[Math.max(w,.26),.72,Math.max(d,.26)],material,.035);
    box(root,m.zinc,Math.max(w,.29),.08,Math.max(d,.29),(x1+x2)/2,y+.75,(z1+z2)/2);
  }
  for (const [pad,north,south,tint] of [
    [residentialPad,residentialApproach,residentialSteps,cream],
    [communityPad,communityApproach,communitySteps,cream],
    [transitPad,transitNorth,transitSouth,blue],
  ] as const) {
    const {minX:x1,maxX:x2,minZ:z1,maxZ:z2,height:y}=pad;
    guard(x1+.13,z1,x1+.13,z2,y,tint);
    guard(x2-.13,z1,x2-.13, pad === residentialPad ? residentialSteps.minZ : z2, y,tint);
    for (const [z,cut] of [[z1+.13,north],[z2-.13,south]] as const) {
      guard(x1,z,cut.minX,z,y,tint);
      guard(cut.maxX,z,x2,z,y,tint);
    }
  }
  for (const stairs of [residentialSteps,communitySteps,pharmacySouth]) {
    const width=stairs.maxX-stairs.minX, length=stairs.maxZ-stairs.minZ;
    const count=Math.ceil(stairs.northY/.182), run=length/count, x=(stairs.minX+stairs.maxX)/2;
    for (let i=0;i<count;i++) {
      const u=(i+.5)/count;
      box(root,i%6===0?cream:m.concrete,width-.32,.17,run+.01,x,stairs.northY*(1-u)-.085,stairs.minZ+length*u);
    }
    for (const railX of [stairs.minX+.14,stairs.maxX-.14]) {
      const railLength=length-.5, endLevel=stairs.northY*.5/length;
      for (const h of [.47,.96]) {
        strut(root,green,new THREE.Vector3(railX,stairs.northY+h,stairs.minZ),new THREE.Vector3(railX,endLevel+h,stairs.minZ+railLength),.078);
      }
      const bays=Math.ceil(railLength/1.65);
      for (let i=0;i<bays;i++) {
        const z=stairs.minZ+railLength*i/bays, next=stairs.minZ+railLength*(i+1)/bays;
        const level=stairs.northY*(1-(z-stairs.minZ)/length), lower=stairs.northY*(1-(next-stairs.minZ)/length);
        box(root,m.zinc,.09,.96,.09,railX,level+.48,z);
        solids.push({min:[railX-.046,lower,z],max:[railX+.046,level+.99,next]});
      }
      box(root,m.zinc,.09,.96,.09,railX,endLevel+.48,stairs.minZ+railLength);
    }
  }

  const homes=residentialPad.height;
  box(root,gravel,3.05,.025,26,-146.0,homes+.013,134.1);
  for (const z of [126.6,136.5,144.5]) {
    bench(-146.3,homes,z,1.8,green);
    box(root,cream,1.12,.07,.30,-146.4,homes+.045,z-1.05,.035);
  }
  for (const z of [123.5,140.5,146.75]) planter(-146.35,homes,z);
  box(root,paving,2.65,.026,28.2,-124.58,homes+.014,134.16);

  // S4: a clinic and a separate hall open onto the same public court.
  const c=southBuildings[0], y=communityPad.height, midZ=125;
  box(root,paving,9.5,.028,20.5,27.1,y+.015,126.8);
  for (const z of [117.2,135.5]) planter(30.3,y,z);
  for (const z of [120.6,132.1]) bench(22.5,y,z,2.15,green);
  box(root,cream,6.8,.24,11.6,33.5,y+3.30,125.4,.09);
  for (const z of [120,130.8]) solid([30.45,y+1.64,z],[.21,3.28,.24],green,.025);
  box(root,green,.19,.23,11.46,30.1,y+3.35,125.4,.045);
  box(root,lamp,.08,.045,10.2,30.32,y+3.14,125.4);
  wallX(c.maxX,c.minZ,c.maxZ,y,4.25,cream);
  entryX(c.minX,c.minZ,midZ,y,4.25,121.5,2.65,cream);
  entryX(c.minX,midZ,c.maxZ,y,4.65,128.6,2.9,cream);
  wallZ(c.minZ,c.minX,c.maxX,y,4.25,cream);
  wallZ(c.maxZ,c.minX,c.maxX,y,4.65,cream);
  wallZ(midZ,c.minX,40.9,y,3.85,green);
  wallZ(midZ,43.2,c.maxX,y,3.85,green);
  solid([42.05,y+3.21,midZ],[2.3,1.30,.26],green);
  box(root,green,18.5,.24,7.4,42,y+4.32,121.5,.09);
  const activityRoof=box(root,orange,18.65,.30,7.8,42,y+4.86,128.55,.06);activityRoof.rotation.x=-.08;
  box(root,glass,16.9,.52,.12,42,y+4.37,c.maxZ+.14,.025);
  for (const x of [36,40,44,48]) {
    box(root,glass,2.9,1.05,.04,x,y+2.47,c.minZ-.14,.03);
    box(root,green,3.14,.12,.28,x,y+1.85,c.minZ-.2,.045);
  }
  for (const z of [119.35,123.74,126.15,131.02]) {
    box(root,glass,.07,1.43,1.33,32.85,y+1.65,z,.035);
    box(root,cream,.23,.11,1.46,32.79,y+.84,z,.035);
    box(root,m.zinc,.12,1.40,.075,32.78,y+1.65,z);
  }
  for (const x of [37.3,41.0]) {
    solid([x,y+.40,120],[1.54,.8,2.25],blue,.07);
    box(root,cream,1.49,.16,2.10,x,y+.86,120,.075);
    box(root,green,1.35,.09,1.23,x,y+.95,120+.38,.045);
    box(root,m.zinc,.085,1.65,.09,x+.98,y+.82,119.38);
  }
  desk(47.5,y,121.5,2.8,1.05,green);
  desk(38.2,y,129.5,2.6,.90,blue);
  desk(47.5,y,129.6,2.8,1.05,orange);
  for (const z of [128.25,130.85]) bench(42,y,z,1.9,orange);
  for (const x of [48.3,49.45]) {
    solid([x,y+.92,119.05],[.88,1.84,.71],blue,.04);
    box(root,cream,.68,.24,.10,x,y+1.32,119.42,.02);
  }
  light(42,y+3.85,122.1,0xc9f9ed);light(43,y+4.1,129.6,0xffd9ad);

  // S6: an open-ended waiting room and a smaller kitchen around the transfer court.
  const t=southBuildings[1], cafe=southBuildings[2], ty=transitPad.height;
  box(root,paving,13.7,.034,20.45,123,ty+.018,121.5);
  for (const z of [115.7,127.9]) planter(129.6,ty,z);
  for (const z of [114.2,128.95]) bench(117.85,ty,z,2.2,blue);
  entryX(t.minX,t.minZ,t.maxZ,ty,3.9,122,4.15,blue);
  entryX(t.maxX,t.minZ,t.maxZ,ty,3.9,122,4.15,blue);
  box(root,cream,3.5,.21,7.2,131.1,ty+3.17,122,.07);
  box(root,glass,.14,.32,7.24,129.39,ty+3.12,122,.035);
  box(root,lamp,.12,.055,5.82,129.43,ty+3.0,122);
  for (const z of [115.75,118.33,125.76,128.28]) {
    box(root,glass,.065,1.39,1.92,131.85,ty+1.9,z,.045);
    box(root,cream,.21,.11,2.04,131.77,ty+1.12,z,.045);
    box(root,m.zinc,.11,1.41,.072,131.77,ty+1.91,z);
  }
  for (const z of [119.3,124.7]) {
    box(root,cream,5.7,.024,.12,127.55,ty+.041,z);
    solid([130.5,ty+.42,z],[.23,.84,.23],blue,.045);
    box(root,cream,.26,.09,.26,130.5,ty+.71,z,.03);
  }
  for (const z of [t.minZ,t.maxZ]) {
    wallZ(z,t.minX,t.maxX,ty,1.10,cream);
    wallZ(z,t.minX,t.maxX,ty+1.10,2.79,glass);
    for (const x of [134.2,137.4,140.6,143.8]) box(root,m.zinc,.16,2.83,.31,x,ty+2.48,z);
  }
  const shelter=box(root,blue,15.8,.32,18.45,139,ty+4.06,121.5,.09);
  shelter.rotation.z=.042;
  box(root,cream,16.2,.16,17.2,139,ty+3.96,121.8,.05);
  for (const x of [133,145]) solid([x,ty+1.91,131.2],[.20,3.82,.22],m.zinc);
  box(root,blue,14.4,.19,3.25,139,ty+3.63,130.3,.055);
  for (const x of [136,141.1]) bench(x,ty,124.9,3.05,blue);
  for (const [x,z] of [[134.15,113.8],[144.92,128.64]]) {
    solid([x,ty+.37,z],[.51,.74,.48],m.steel,.055);
    box(root,orange,.55,.10,.52,x,ty+.79,z,.038);
    box(root,m.rubber,.23,.022,.18,x,ty+.85,z,.018);
  }
  box(root,paving,8.67,.025,2.07,139.95,ty+.018,124.92);
  box(root,green,.69,.37,.44,135.45,ty+.74,124.92,.095);
  box(root,m.zinc,.23,.04,.05,135.45,ty+.94,124.90,.014);
  desk(136,ty,116.2,3.25,1.05,blue);
  desk(142,ty,127.3,3.45,.97,cream);
  box(root,m.steel,.49,.045,.39,137.03,ty+1.07,115.96,.022);
  box(root,blue,.54,.33,.078,137.03,ty+1.28,115.87,.027);
  box(root,m.timber,.42,.071,.42,141.17,ty+1.08,127.39,.027);
  for (const x of [140.57,141.16,141.77]) box(root,blue,.37,.39,.59,x,ty+.20,128.61,.048);
  for (const z of [115.65,117.55]) {
    solid([143.9,ty+.82,z],[.8,1.64,.74],m.steel,.065);
    box(root,lamp,.04,.19,.45,143.48,ty+1.30,z,.028);
  }
  light(138.7,ty+3.7,122.4,0xd2f4ff);
  box(root,gravel,4.95,.03,14.8,148.55,ty+.016,122);
  entryX(cafe.minX,cafe.minZ,cafe.maxZ,ty,3.5,122,3.05,cream);
  wallX(cafe.maxX,cafe.minZ,cafe.maxZ,ty,3.5,cream);
  for (const z of [cafe.minZ,cafe.maxZ]) wallZ(z,cafe.minX,cafe.maxX,ty,3.5,cream);
  const cafeCanopy=box(root,orange,14.9,.25,14.0,156.5,ty+3.71,122.5,.06);
  cafeCanopy.rotation.z=.07;
  for (const x of [152.9,156.4,160.3]) {
    box(root,glass,2.55,1.30,.06,x,ty+1.90,cafe.maxZ+.14,.06);
    box(root,orange,2.72,.16,.52,x,ty+1.08,cafe.maxZ+.23,.05);
  }
  desk(160.2,ty,119,2.86,1.05,orange);
  solid([157.8,ty+1.02,117.08],[1.14,2.04,.9],m.zinc,.065);
  desk(155,ty,119,3.35,1.05,blue);
  box(root,m.zinc,3.47,.29,1.24,155,ty+2.80,119,.05);
  box(root,glass,3.23,.08,1.08,155,ty+2.62,119,.03);
  for (const x of [154.32,155.68]) {
    cylinder(root,m.rubber,.25,.055,x,ty+1.07,118.95,16);
    cylinder(root,m.zinc,.14,.033,x,ty+1.11,118.95,16);
  }
  for (const [x,z] of [[148.7,117.3],[149.0,126.7],[155,126.6],[160,125.8]]) {
    solid([x,ty+.79,z],[1.40,.095,1.40],m.timber,.14);
    solid([x,ty+.37,z],[.30,.74,.30],orange);
    for (const side of [-1,1]) solid([x+side*.99,ty+.245,z],[.61,.49,.61],blue,.11);
    box(root,cream,.30,.035,.25,x-.18,ty+.855,z+.13,.035);
    cylinder(root,blue,.081,.106,x+.23,ty+.895,z-.15,10);
  }
  // Open preparation shelves above the counter keep cookware and dry goods together.
  for (const y of [ty+1.54,ty+2.02]) {
    box(root,m.zinc,3.4,.078,.43,160.42,y,116.32,.028);
    for (const [dx,r,h] of [[-.9,.12,.24],[-.45,.13,.23],[.38,.17,.28],[.90,.18,.27]])
      cylinder(root,dx>0?orange:cream,r,h,160.42+dx,y+.04+h/2,116.34,12);
  }
  for (const x of [159.01,161.83]) box(root,m.steel,.075,.49,.067,x,ty+1.78,116.16,.015);
  solid([162.17,ty+.42,123.39],[.67,.84,.62],m.steel,.065);
  box(root,orange,.72,.10,.68,162.17,ty+.86,123.39,.028);
  light(156.6,ty+3.40,122.9,0xffd4a5);
}
