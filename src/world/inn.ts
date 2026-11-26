import * as THREE from 'three';
import type { Vec3 } from '../contracts/demo.ts';
import { box, cylinder, mesh, strut } from './detail/geometry.ts';
import { emissive, enamel, type Materials } from './detail/materialLibrary.ts';
import { innBuilding, innDoorX, innNorth, innPad, innSouth, innStair, innUpperY } from './innPlan.ts';
import type { Solid } from './worldQueries.ts';

type Builder = (at: Vec3, size: Vec3, material: THREE.Material, bevel?: number) => THREE.Mesh;

export function buildInn(root: THREE.Group, m: Materials, solids: Solid[], solid: Builder) {
  const cream=enamel(0xe2d3b9), ochre=enamel(0xc58d61), pine=enamel(0x54786f);
  const red=enamel(0xa86858), blue=enamel(0x4f7284), window=enamel(0x526f7d);
  const carpet=enamel(0x8c695a), timber=enamel(0xa1775d), bulb=emissive(0xffdfae,.64);
  const y=innPad.height, upper=innUpperY, roof=upper+3.10;
  const {minX:x1,maxX:x2,minZ:z1,maxZ:z2}=innBuilding;
  const cx=(x1+x2)/2, cz=(z1+z2)/2;

  function wallX(x:number,z0:number,z1:number,base:number,h:number,mat:THREE.Material) {
    if(z1>z0)solid([x,base+h/2,(z0+z1)/2],[.25,h,z1-z0],mat,.016);
  }
  function wallZ(z:number,x0:number,x1:number,base:number,h:number,mat:THREE.Material) {
    if(x1>x0)solid([(x0+x1)/2,base+h/2,z],[x1-x0,h,.24],mat,.016);
  }
  function floor(x0:number,x1:number,z0:number,z1:number,level:number) {
    box(root,timber,x1-x0,.22,z1-z0,(x0+x1)/2,level-.11,(z0+z1)/2);
    solids.push({min:[x0,level-.22,z0],max:[x1,level,z1],floor:true,walkSurface:true});
  }
  function fixture(x:number,base:number,z:number,span:number,depth:number,mat:THREE.Material) {
    solid([x,base+.51,z],[span,1.02,depth],mat,.055);
    box(root,timber,span+.10,.07,depth+.085,x,base+1.02,z,.035);
    for(const dx of [-span*.29,span*.29])box(root,m.zinc,.26,.065,.056,x+dx,base+.77,z+.51*depth,.025);
  }
  function lamp(x:number,level:number,z:number,intensity:number) {
    box(root,m.steel,1.72,.11,.30,x,level,z,.05);
    box(root,bulb,1.52,.035,.23,x,level-.07,z,.03);
    const point=new THREE.PointLight(0xffdbac,intensity,8.5,2);
    point.position.set(x,level-.23,z);
    root.add(point);
  }

  // The raised forecourts leave a straight, open line between the two street entrances.
  for(const x of [innPad.minX+.14,innPad.maxX-.14])
    wallX(x,innPad.minZ,innPad.maxZ,y,.64,cream);
  for(const [z,approach] of [[innPad.minZ+.14,innNorth],[innPad.maxZ-.14,innSouth]] as const){
    wallZ(z,innPad.minX,approach.minX,y,.64,cream);
    wallZ(z,approach.maxX,innPad.maxX,y,.64,cream);
  }
  box(root,m.concrete,7.8,.030,25.7,innDoorX,y+.016,125);
  const canopyFoliage=new THREE.IcosahedronGeometry(1,1);
  for(const z of [112.85,137.15])for(const x of [91.6,95.2]){
    solid([x,y+.23,z],[1.7,.46,1.08],ochre,.12);
    cylinder(root,timber,.075,.72,x,y+.74,z,10);
    const crown=mesh(root,canopyFoliage,pine,x,y+1.36,z);
    crown.scale.set(.67,.82,.47);
  }

  for(const z of [z1,z2]){
    const face=Math.sign(z-cz), left=innDoorX-1.74, right=innDoorX+1.74;
    wallZ(z,x1,left,y,2.56,cream);
    wallZ(z,right,x2,y,2.56,cream);
    wallZ(z,x1,x2,y+2.56,.69,ochre);
    wallZ(z,x1,x2,upper,3.05,cream);
    const hood=box(root,pine,5.35,.20,2.48,innDoorX,y+2.75,z+face*.68,.095);
    hood.rotation.x=-face*.09;
    box(root,bulb,4.15,.067,.10,innDoorX,y+2.62,z+face*.73);
    for(const x of [88.75,94.25,100.8]){
      box(root,window,2.9,1.21,.06,x,upper+1.65,z+face*.15,.045);
      box(root,ochre,3.08,.16,.32,x,upper+1.04,z+face*.19,.06);
      box(root,cream,.13,1.17,.09,x,upper+1.64,z+face*.195);
    }
  }
  for(const x of [x1,x2]){
    const sign=Math.sign(x-cx);
    for(const base of [y,upper]){
      wallX(x,z1,z2,base,.88,cream);
      wallX(x,z1,z2,base+.88,1.52,window);
      wallX(x,z1,z2,base+2.4,base===y?.85:.65,cream);
      for(const z of [114,120.5,127.75,135.75]){
        box(root,ochre,.39,3.0,.23,x+sign*.12,base+1.5,z,.026);
        box(root,cream,.29,.14,4.15,x+sign*.22,base+.89,z+1.85,.045);
      }
    }
  }
  solid([cx,roof-.11,cz],[22.5,.22,23.5],pine,.025);
  for(const sign of [-1,1]){
    const pitch=box(root,sign<0?ochre:red,11.85,.23,24.0,cx+sign*5.55,roof+.88,cz,.035);
    pitch.rotation.z=-sign*.145;
  }
  box(root,m.steel,.23,.18,24.15,cx,roof+1.76,cz,.035);
  for(const z of [118.5,131.5]) {
    box(root,pine,1.5,1.29,1.03,92.1,roof+1.2,z,.06);
    box(root,cream,1.68,.17,1.22,92.1,roof+1.88,z,.045);
  }

  const split=97.8, innerH=3.04;
  wallX(split,z1,115.58,y,innerH,pine);
  wallX(split,117.82,120.93,y,innerH,pine);
  wallX(split,123.27,125.05,y,innerH,pine);
  for(const z of [116.7,122.1])wallX(split,z-1.12,z+1.12,y+2.34,.70,cream);
  wallZ(119.40,x1,split,y,innerH,cream);
  wallZ(125.05,x1,split,y,innerH,cream);
  box(root,carpet,11.75,.025,9.45,91.45,y+.027,130.65);
  fixture(93.4,y,132.25,3.75,1.30,pine);
  solid([88.2,y+.39,131.5],[2.32,.78,1.18],red,.095);
  solid([88.2,y+.86,132.0],[2.32,.60,.22],red,.11);
  solid([89.65,y+.27,128.7],[1.52,.54,.89],timber,.15);
  box(root,cream,1.10,.07,.50,89.65,y+.57,128.75,.055);
  fixture(88.3,y,116.7,2.44,1.44,ochre);
  for(const z of [114.8,117.9]){
    solid([85.85,y+.45,z],[1.72,.90,.94],blue,.135);
    box(root,m.zinc,1.33,.19,.105,85.85,y+.61,z+.47,.025);
  }
  fixture(87.4,y,122.1,2.70,1.36,pine);
  solid([89.7,y+.98,124.44],[4.57,1.96,.73],m.ceramic,.065);
  for(const x of [88.11,89.7,91.31])for(const dy of [.64,1.18,1.68]){
    box(root,cream,1.31,.29,.13,x,y+dy,124.01,.040);
    box(root,ochre,.47,.20,.081,x+.19,y+dy+.05,123.93,.031);
  }
  for (const z of [117.2,122.4,131.1])lamp(94.3,y+2.91,z,28);

  // Cut the upper floor around the stair and feed three separate rooms from the west hall.
  const stairEdge=102.45;
  floor(x1+.13,stairEdge,z1+.13,z2-.13,upper);
  floor(stairEdge,x2-.13,z1+.13,innStair.topZ,upper);
  floor(stairEdge,x2-.13,innStair.bottomZ,z2-.13,upper);
  const {x:sx,width:sw,topZ,bottomZ}=innStair, rise=upper-y, run=bottomZ-topZ;
  solids.push({min:[sx-sw/2,-.16,topZ],max:[sx+sw/2,0,bottomZ],floor:true,walkSurface:true,
    slope:{axis:2,start:bottomZ,height:y,gradient:-rise/run}});
  const treads=Math.ceil(rise/.18);
  for(let i=0;i<treads;i++){
    const u=(i+.5)/treads;
    box(root,timber,sw,.145,run/treads+.011,sx,y+u*rise-.071,bottomZ-u*run,.025);
    box(root,ochre,sw-.08,.032,.072,sx,y+u*rise+.006,bottomZ-u*run+run/treads*.43,.012);
  }
  for(const x of [sx-sw/2,sx+sw/2]){
    strut(root,pine,new THREE.Vector3(x,y+.93,bottomZ),new THREE.Vector3(x,upper+.93,topZ),.087);
    for(const u of [0,.25,.5,.75,1])solid([x,y+u*rise+.44,bottomZ-u*run],[.071,.88,.071],m.zinc);
  }
  solid([stairEdge,upper+.46,(topZ+bottomZ)/2],[.13,.92,run],pine,.025);
  solid([(stairEdge+x2)/2,upper+.46,bottomZ+.10],[x2-stairEdge,.92,.13],pine,.025);
  for(const z of [120.65,127.90])wallZ(z,x1,96.5,upper,3.0,cream);
  let sectionStart=z1;
  for(const z of [117.1,124.4,132.4]){
    wallX(96.5,sectionStart,z-1.02,upper,3.0,cream);
    wallX(96.5,z-1.02,z+1.02,upper+2.35,.65,cream);
    box(root,bulb,.08,.061,1.72,96.63,upper+2.40,z);
    sectionStart=z+1.02;
  }
  wallX(96.5,sectionStart,z2,upper,3.0,cream);
  box(root,carpet,3.3,.028,22.3,99.3,upper+.015,125.05);

  function bed(x:number,z:number,w:number,cover:THREE.Material) {
    solid([x,upper+.25,z],[w,.5,2.25],pine,.045);
    box(root,cream,w-.075,.13,2.16,x,upper+.56,z,.073);
    box(root,cover,w-.12,.08,1.36,x,upper+.66,z+.36,.058);
    box(root,cream,w-.16,.15,.57,x,upper+.69,z-.68,.075);
  }
  for(const z of [117.1,124.4,132.4]){
    fixture(88.6,upper,z,z===132.4?2.50:1.65,1.38,z===124.4?ochre:pine);
    box(root,carpet,4.2,.024,2.18,91.5,upper+.014,z);
    lamp(92.2,upper+2.85,z,24);
  }
  bed(92.6,115.15,1.14,blue);
  for(const x of [92.02,93.18])for(const z of [114.11,116.16])
    solid([x,upper+.9,z],[.086,1.8,.086],pine);
  solid([92.6,upper+1.43,115.15],[1.12,.27,2.16],pine,.04);
  box(root,blue,1.03,.13,1.62,92.6,upper+1.66,115.40,.06);
  for(const x of [91.87,92.19])solid([x,upper+.74,116.28],[.063,1.49,.10],m.zinc);
  for(const dz of [.41,.69,.97,1.25])box(root,m.zinc,.33,.045,.09,92.03,upper+dz,116.30);
  bed(92.45,122.3,1.18,pine);
  bed(92.45,126.15,1.18,red);
  bed(92.2,130.34,1.83,ochre);
  solid([92.4,upper+.34,134.78],[2.4,.68,.96],blue,.11);
  box(root,blue,2.34,.43,.17,92.4,upper+.82,135.15,.10);
  for(const z of [115,122.8,134.7])lamp(100.35,upper+2.86,z,15);
}
