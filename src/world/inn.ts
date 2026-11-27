import * as THREE from 'three';
import type { Vec3 } from '../contracts/demo.ts';
import { box, cylinder, gableRoof, mesh, strut } from './detail/geometry.ts';
import { emissive, enamel, type Materials } from './detail/materialLibrary.ts';
import { innBuilding, innDoorX, innNorth, innPad, innSouth, innStair, innUpperY } from './innPlan.ts';
import { gradeHeight } from './terrainPlan.ts';
import type { Solid } from './worldQueries.ts';

type Builder = (at: Vec3, size: Vec3, material: THREE.Material, bevel?: number) => THREE.Mesh;

export function buildInn(root: THREE.Group, m: Materials, solids: Solid[], solid: Builder) {
  const cream=enamel(0xe2d3b9), ochre=enamel(0xc58d61), pine=enamel(0x54786f);
  const red=enamel(0xa86858), blue=enamel(0x4f7284);
  const window = new THREE.MeshStandardMaterial({
    color: 0xaac9cc, transparent: true, opacity: .28, roughness: .19, depthWrite: false,
  });
  const carpet=enamel(0x8c695a), timber=enamel(0xa1775d), bulb=emissive(0xffdfae,.64);
  const y=innPad.height, upper=innUpperY, roof=upper+3.10;
  const {minX:x1,maxX:x2,minZ:z1,maxZ:z2}=innBuilding;
  const cx=(x1+x2)/2, cz=(z1+z2)/2;

  function wallX(x:number,z0:number,z1:number,base:number,h:number,mat:THREE.Material) {
    if(z1>z0)solid([x,base+h/2,(z0+z1)/2],[.25,h,z1-z0],mat,0);
  }
  function wallZ(z:number,x0:number,x1:number,base:number,h:number,mat:THREE.Material) {
    if(x1>x0)solid([(x0+x1)/2,base+h/2,z],[x1-x0,h,.24],mat,0);
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
  function bench(x:number,base:number,z:number,width:number) {
    solid([x,base+.46,z],[width,.11,.56],timber,.035);
    for (const side of [-1,1]) solid([x+side*(width/2-.16),base+.23,z],[.12,.46,.49],m.steel,.019);
    box(root,pine,width,.29,.11,x,base+.79,z-.24,.025);
    for (const side of [-1,1]) box(root,m.steel,.07,.36,.07,x+side*(width/2-.15),base+.66,z-.26);
  }
  function suitcase(x:number,base:number,z:number,width:number,mat:THREE.Material) {
    box(root,mat,width,.32,.58,x,base+.16,z,.065);
    for (const dx of [-.29,.29]) box(root,m.rubber,.042,.329,.59,x+width*dx,base+.17,z,.012);
    box(root,m.zinc,.20,.064,.079,x,base+.16,z+.298,.018);
  }
  function rack(x:number,base:number,z:number,width:number,mat:THREE.Material) {
    for (const side of [-1,1]) solid([x+side*(width/2-.06),base+.91,z],[.12,1.82,.65],mat,.018);
    for (const dy of [.18,.72,1.26]) solid([x,base+dy,z],[width,.09,.65],mat,.022);
  }
  function tableLamp(x:number,base:number,z:number) {
    cylinder(root,pine,.15,.042,x,base+.021,z,12);
    cylinder(root,m.zinc,.024,.31,x,base+.18,z,10);
    cylinder(root,bulb,.142,.16,x,base+.37,z,12);
  }
  function fabric(x:number,base:number,z:number,w:number,depth:number,mat:THREE.Material) {
    box(root,mat,w,.021,depth,x,base+.011,z,.008);
    for (const side of [-1,1]) box(root,cream,w-.14,.006,.035,x,base+.024,z+side*(depth/2-.10));
  }

  // The raised forecourts leave a straight, open line between the two street entrances.
  for(const x of [innPad.minX+.14,innPad.maxX-.14])
    wallX(x,innPad.minZ,innPad.maxZ,y,.64,cream);
  for(const [z,approach] of [[innPad.minZ+.14,innNorth],[innPad.maxZ-.14,innSouth]] as const){
    wallZ(z,innPad.minX,approach.minX,y,.64,cream);
    wallZ(z,approach.maxX,innPad.maxX,y,.64,cream);
  }
  box(root,m.concrete,innNorth.maxX-innNorth.minX,.030,25.7,innDoorX,y+.016,125);
  const canopyFoliage=new THREE.IcosahedronGeometry(1,1);
  for(const z of [112.85,137.15])for(const x of [91.6,95.2]){
    solid([x,y+.23,z],[1.7,.46,1.08],ochre,.12);
    cylinder(root,timber,.075,.72,x,y+.74,z,10);
    const crown=mesh(root,canopyFoliage,pine,x,y+1.36,z);
    crown.scale.set(.67,.82,.47);
  }
  for (const approach of [innNorth, innSouth]) {
    const high = approach.northY > approach.southY ? approach.minZ : approach.maxZ;
    const low = high === approach.minZ ? approach.maxZ : approach.minZ;
    const end = high + (low - high) * .73;
    for (const x of [approach.minX+.12,approach.maxX-.12]) {
      const at = (z:number, rail:number) => new THREE.Vector3(x,gradeHeight(approach,z)+rail,z);
      strut(root,m.zinc,at(high,.86),at(end,.86),.077);
      strut(root,pine,at(high,.18),at(end,.18),.095);
      for (const t of [0,.25,.5,.75,1]) {
        const z=high+(end-high)*t;
        solid([x,gradeHeight(approach,z)+.43,z],[.10,.86,.10],m.steel,.018);
      }
    }
  }
  for (const [z,face] of [[112.78,-1],[137.25,1]] as const) {
    bench(87.6,y,z,3.13);
    suitcase(88.43,y+.52,z,.65,blue);
    solid([84.05,y+.37,z],[.56,.74,.49],m.steel,.055);
    box(root,pine,.61,.11,.53,84.05,y+.76,z,.035);
    box(root,m.rubber,3.3,.025,.69,innDoorX,y+.036,z,.016);
    for (const x of [98.45,103.15]) {
      box(root,blue,.24,.58,.15,x,y+1.93,face<0?z1-.19:z2+.19,.04);
      box(root,bulb,.145,.40,.072,x,y+1.94,face<0?z1-.26:z2+.26,.025);
    }
  }
  for (const z of [114.65,135.15]) {
    cylinder(root,m.zinc,.078,4.75,x2+.25,y+2.375,z,12);
    cylinder(root,m.steel,.095,.11,x2+.25,y+.29,z,12);
    box(root,m.concrete,.59,.095,.71,x2+.40,y+.047,z,.04);
    for (const dz of [-.19,0,.19]) box(root,m.steel,.44,.02,.035,x2+.4,y+.105,z+dz);
  }
  // The two levels of frontage share drainage, with low planting beside the approach.
  for (const [x,z] of [[94.3,139.08],[106.37,139.08],[94.3,110.93],[106.37,110.93]]) {
    solid([x,.18,z],[2.2,.36,.75],cream,.085);
    box(root,m.timber,2.08,.048,.64,x,.372,z,.02);
    for (const [dx,h] of [[-.72,.46],[-.35,.54],[.10,.47],[.50,.56],[.78,.46]]) {
      const shrub=mesh(root,canopyFoliage,pine,x+dx,h,z);
      shrub.scale.set(.24,.30,.25);
    }
  }

  const frontWindows = [88.75,94.25,100.8];
  for(const z of [z1,z2]){
    const face=Math.sign(z-cz), left=innDoorX-1.74, right=innDoorX+1.74;
    wallZ(z,x1,left,y,2.56,cream);
    wallZ(z,right,x2,y,2.56,cream);
    wallZ(z,x1,x2,y+2.56,.69,ochre);
    wallZ(z,x1,x2,upper,.97,cream);
    wallZ(z,x1,x2,upper+2.29,.76,cream);
    const hood=box(root,pine,5.35,.20,2.48,innDoorX,y+2.75,z+face*.68,.095);
    hood.rotation.x=-face*.09;
    box(root,bulb,4.15,.067,.10,innDoorX,y+2.62,z+face*.73);
    let jamb=x1;
    for(const x of frontWindows){
      wallZ(z,jamb,x-1.45,upper+.97,1.32,cream);
      wallZ(z,x-1.45,x+1.45,upper+.97,1.32,window);
      box(root,ochre,3.065,.12,.34,x,upper+.97,z+face*.14,.025);
      box(root,pine,.095,1.32,.29,x,upper+1.63,z,.012);
      jamb=x+1.45;
    }
    wallZ(z,jamb,x2,upper+.97,1.32,cream);
  }
  for(const x of [x1,x2]){
    const sign=Math.sign(x-cx);
    for(const base of [y,upper]){
      const openings = x === x1 ? (base===y?[116.7,122.2,130.7]:[116.7,124.35,132.2]) : [117.2,132.3];
      wallX(x,z1,z2,base,.98,cream);
      wallX(x,z1,z2,base+2.23,base===y?1.02:.82,cream);
      let jamb=z1;
      for(const z of openings){
        const width=base===y&&z===130.7?3.65:2.92;
        wallX(x,jamb,z-width/2,base+.98,1.25,cream);
        wallX(x,z-width/2,z+width/2,base+.98,1.25,window);
        box(root,ochre,.34,.12,width+.17,x+sign*.14,base+.98,z,.025);
        box(root,pine,.30,1.25,.096,x,base+1.605,z,.01);
        jamb=z+width/2;
      }
      wallX(x,jamb,z2,base+.98,1.25,cream);
    }
  }
  solid([cx,roof-.11,cz],[22.5,.22,23.5],pine,.025);
  gableRoof(root,red,23.4,24,1.72,.19,cx,roof+.055,cz).castShadow=true;
  box(root,m.steel,.23,.18,24.15,cx,roof+1.76,cz,.035);
  const gable = new THREE.Shape();
  gable.moveTo(x1,roof-.08);
  gable.lineTo(x2,roof-.08);
  gable.lineTo(cx,roof+1.66);
  gable.closePath();
  const infill = new THREE.ExtrudeGeometry(gable,{depth:.22,bevelEnabled:false});
  for (const z of [z1,z2]) mesh(root,infill,cream,0,0,z-.11).castShadow=true;
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
  fabric(89.8,y+.024,130.8,9.8,9.7,carpet);
  fixture(93.4,y,132.25,3.75,1.30,pine);
  tableLamp(92.1,y+1.06,132.55);
  box(root,m.steel,.48,.036,.37,94.67,y+1.068,132.52,.028);
  box(root,blue,.53,.33,.11,94.67,y+1.29,132.71,.029);
  for (const [x,z] of [[93.92,132.67],[92.7,132.61]]) box(root,cream,.24,.025,.19,x,y+1.07,z,.01);
  rack(93.4,y,135.42,2.64,pine);
  for (const dx of [-.74,0,.74]) box(root,ochre,.43,.28,.38,93.4+dx,y+1.44,135.43,.035);
  // Seating faces the coffee table and stays out of the line between entry and reception.
  solid([86.62,y+.32,130.72],[1.16,.64,3.19],red,.11);
  box(root,red,.25,.62,3.19,86.17,y+.83,130.72,.09);
  for (const z of [129.72,130.71,131.70]) box(root,cream,.91,.17,.87,86.79,y+.67,z,.065);
  solid([88.54,y+.27,130.72],[1.12,.54,1.54],timber,.11);
  box(root,pine,.43,.026,.31,88.56,y+.56,130.45,.017);
  cylinder(root,cream,.085,.108,88.32,y+.599,131.12,12);
  solid([89.58,y+.32,133.28],[1.17,.64,1.18],blue,.12);
  box(root,blue,1.17,.56,.26,89.58,y+.80,133.76,.09);
  box(root,cream,.78,.16,.69,89.58,y+.69,133.23,.055);
  box(root,pine,1.06,.045,.94,87.0,y+.024,135.27,.07);
  solid([86.99,y+.27,135.26],[.76,.54,.72],ochre,.12);
  const leaf=enamel(0x688f72);
  for (const [dx,dz,h] of [[0,0,.93],[-.24,.13,.73],[.22,-.17,.77]] as const) {
    const stem=mesh(root,canopyFoliage,leaf,86.99+dx,y+h,135.26+dz);
    stem.scale.set(.31,.48,.26);
  }
  const artwork = new THREE.IcosahedronGeometry(1,0);
  for (const [x,z,w] of [[90.60,136.33,1.35],[92.14,136.33,1.03]]) {
    box(root,timber,w,1.01,.08,x,y+1.86,z,.02);
    box(root,cream,w-.13,.87,.022,x,y+1.86,z-.048,.012);
    const motif=mesh(root,artwork,blue,x-.07,y+1.79,z-.067);
    motif.scale.set(w*.31,.29,.02);
    const glaze=mesh(root,artwork,ochre,x+.20,y+2.02,z-.074);
    glaze.scale.set(.133,.12,.016);
  }
  cylinder(root,pine,.22,.075,85.44,y+.038,128.28,13);
  cylinder(root,m.zinc,.029,1.58,85.44,y+.82,128.28,10);
  cylinder(root,bulb,.22,.30,85.44,y+1.61,128.28,12);
  // A self-service tea cabinet belongs beside the lounge seating.
  solid([85.50,y+.43,126.36],[.74,.86,1.76],pine,.045);
  box(root,timber,.81,.072,1.84,85.50,y+.881,126.36,.029);
  cylinder(root,blue,.139,.27,85.42,y+1.05,126.01,12);
  cylinder(root,m.zinc,.143,.044,85.42,y+1.198,126.01,12);
  for (const z of [126.37,126.63,126.90]) cylinder(root,cream,.076,.118,85.68,y+.979,z,10);
  fixture(88.3,y,116.7,2.44,1.44,ochre);
  for(const z of [114.8,117.9]){
    solid([85.85,y+.45,z],[1.72,.90,.94],blue,.135);
    suitcase(85.85,y+.90,z,1.24,ochre);
  }
  rack(93.76,y,114.31,3.06,blue);
  for (const [dx,dy,mat] of [[-.84,.23,blue],[.55,.77,red],[-.62,1.31,pine]] as const)
    suitcase(93.76+dx,y+dy,114.31,.74,mat);
  solid([94.78,y+.22,118.40],[1.54,.16,.74],m.steel,.045);
  for (const x of [94.24,95.32]) {
    cylinder(root,m.rubber,.14,.12,x,y+.14,118.40,12).rotation.x=Math.PI/2;
    box(root,m.zinc,.065,.94,.069,x,y+.67,118.68,.015);
  }
  box(root,m.zinc,1.12,.066,.072,94.78,y+1.11,118.68,.018);
  suitcase(94.78,y+.30,118.36,.98,blue);
  fixture(87.4,y,122.1,2.70,1.36,pine);
  solid([89.7,y+.98,124.44],[4.57,1.96,.73],m.ceramic,.065);
  for(const x of [88.11,89.7,91.31])for(const dy of [.64,1.18,1.68]){
    box(root,cream,1.31,.29,.13,x,y+dy,124.01,.040);
    box(root,ochre,.47,.20,.081,x+.19,y+dy+.05,123.93,.031);
  }
  solid([94.21,y+.37,123.92],[1.27,.70,.85],blue,.067);
  for (const [dx,dy,w] of [[-.29,.75,.43],[.29,.76,.44],[.26,.87,.42]] as const)
    box(root,cream,w,.10,.61,94.21+dx,y+dy,123.92,.03);
  for (const [x,z] of [[101.45,113.92],[105.35,131.28]]) {
    solid([x,y+.31,z],[.44,.62,.42],blue,.055);
    box(root,m.rubber,.47,.075,.45,x,y+.65,z,.027);
  }
  // A wall bench and coat rail turn the south vestibule into a useful waiting nook.
  solid([105.95,y+.43,133.78],[.71,.14,2.42],timber,.035);
  for (const z of [132.74,134.83]) solid([105.95,y+.18,z],[.38,.36,.13],pine,.02);
  box(root,pine,.11,.29,2.49,106.31,y+.78,133.78,.026);
  box(root,timber,.105,.13,2.49,106.30,y+1.54,133.78,.028);
  for (const z of [132.83,133.45,134.07,134.69]) {
    box(root,m.zinc,.19,.045,.049,106.25,y+1.54,z,.014);
    box(root,m.zinc,.043,.091,.049,106.16,y+1.57,z,.015);
  }
  suitcase(105.92,y+.50,134.52,.60,ochre);
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

  function bed(x:number,z:number,w:number,cover:THREE.Material,alongX=false) {
    solid([x,upper+.25,z],alongX?[2.25,.5,w]:[w,.5,2.25],pine,.045);
    const layer=(span:number,h:number,length:number,level:number,offset:number,mat:THREE.Material) => {
      box(root,mat,alongX?length:span,h,alongX?span:length,
        x+(alongX?offset:0),upper+level,z+(alongX?0:offset),.05);
    };
    layer(w-.075,.13,2.16,.56,0,cream);
    layer(w-.12,.08,1.36,.66,.36,cover);
    layer(w-.16,.15,.57,.69,-.68,cream);
    layer(w,.54,.10,.58,-1.09,timber);
  }
  for(const z of [117.1,124.4,132.4]){
    fabric(92.85,upper+.012,z,4.2,2.18,carpet);
    lamp(92.2,upper+2.85,z,24);
  }
  fixture(88.6,upper,117.1,1.70,1.15,pine);
  for(const x of [87.98,89.21]) box(root,m.zinc,.10,.088,1.06,x,upper+.98,117.1,.018);
  for(const z of [114.73,116.03,117.33]) {
    solid([85.40,upper+1.02,z],[1.11,2.04,1.18],blue,.04);
    box(root,m.zinc,.08,.33,.067,85.99,upper+1.20,z+.39,.01);
  }
  bench(94.25,upper,114.60,2.3);
  suitcase(94.67,upper+.518,114.61,.64,ochre);
  bed(92.6,115.15,1.14,blue);
  for(const x of [92.02,93.18])for(const z of [114.11,116.16])
    solid([x,upper+.9,z],[.086,1.8,.086],pine);
  solid([92.6,upper+1.43,115.15],[1.12,.27,2.16],pine,.04);
  box(root,blue,1.03,.13,1.62,92.6,upper+1.66,115.40,.06);
  for(const x of [91.87,92.19])solid([x,upper+.74,116.28],[.063,1.49,.10],m.zinc);
  for(const dz of [.41,.69,.97,1.25])box(root,m.zinc,.33,.045,.09,92.03,upper+dz,116.30);
  fixture(88.6,upper,124.4,1.30,1.08,ochre);
  tableLamp(88.22,upper+1.06,124.08);
  bed(87.0,122.35,1.22,pine,true);
  bed(87.0,126.15,1.22,red,true);
  fabric(87.58,upper+.704,126.14,.47,.98,cream);
  bench(93.72,upper,121.27,2.61);
  suitcase(93.29,upper+.52,121.27,.87,red);
  box(root,ochre,1.43,.06,.104,94.54,upper+1.43,127.69,.013);
  for (const x of [94.04,94.54,95.04]) box(root,m.zinc,.075,.175,.15,x,upper+1.36,127.61,.024);

  // The corner work surface leaves space under the desk and faces the west window.
  solid([88.6,upper+.986,132.4],[2.50,.09,1.22],timber,.025);
  for (const z of [131.91,132.89]) for (const x of [87.55,89.65])
    solid([x,upper+.49,z],[.09,.98,.09],m.steel,.012);
  tableLamp(88.08,upper+1.034,132.76);
  box(root,cream,.38,.025,.27,88.86,upper+1.05,132.78,.012);
  solid([86.62,upper+.29,132.42],[.71,.54,.68],blue,.065);
  box(root,blue,.14,.41,.66,86.29,upper+.74,132.42,.07);
  solid([94.80,upper+.94,135.36],[1.41,1.88,.84],pine,.058);
  for (const x of [94.52,95.08]) box(root,m.zinc,.085,.30,.067,x,upper+1.07,134.913,.018);
  suitcase(94.69,upper+1.88,135.34,.72,ochre);
  bed(92.2,130.34,1.83,ochre);
  solid([92.4,upper+.34,134.78],[2.4,.68,.96],blue,.11);
  box(root,blue,2.34,.43,.17,92.4,upper+.82,135.15,.10);
  for(const z of [115,122.8,134.7])lamp(100.35,upper+2.86,z,15);
}
