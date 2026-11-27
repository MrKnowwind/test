import * as THREE from 'three';
import type { Vec3 } from '../contracts/demo.ts';
import { box, strut } from './detail/geometry.ts';
import { emissive, enamel, type Materials } from './detail/materialLibrary.ts';
import { researchApproach, researchBuilding, researchPad, researchSteps, researchStair, researchUpperY } from './researchPlan.ts';
import type { Solid } from './worldQueries.ts';

export function buildResearchBuilding(root: THREE.Group, m: Materials, solids: Solid[],
  solid: (at: Vec3, size: Vec3, material: THREE.Material, bevel?: number) => THREE.Mesh) {
  const y = researchPad.height, upper = researchUpperY;
  const purple = enamel(0x746a9f), glass = enamel(0x36546b), trim = enamel(0x88a8b6);
  const light = emissive(0xb3e6e3, .6);
  const { minX, maxX, minZ, maxZ } = researchBuilding;
  const centerX = (minX + maxX) / 2, centerZ = (minZ + maxZ) / 2;
  const length = maxZ - minZ;

  for (const x of [minX, maxX]) {
    solid([x,y+1.38,centerZ],[.30,2.76,length],m.ceramic);
    solid([x,y+3.28,centerZ],[.25,1.04,length],purple);
    solid([x,y+5.48,centerZ],[.23,3.36,length],glass,.015);
    for (const z of [-170,-166,-162,-158,-154]) {
      solid([x,y+3.63,z],[.39,7.26,.18],trim,.02);
      box(root,m.zinc,.43,.11,3.7,x,y+5.05,z);
    }
  }
  for (const z of [minZ, maxZ]) {
    for (const x of [18, 30]) solid([x,y+1.9,z],[8,3.8,.30],m.ceramic);
    solid([centerX,y+3.45,z],[4,1.15,.30],purple);
    solid([centerX,y+5.45,z],[20,3.1,.27],glass,.015);
    for (const x of [22,26]) solid([x,y+1.6,z],[.28,3.2,.46],trim);
    box(root,light,3.6,.08,.22,centerX,y+2.84,z);
    box(root,purple,8.4,.28,2.4,centerX,y+3.27,z + Math.sign(z-centerZ)*.72,.04);
  }
  solid([centerX,y+7.16,centerZ],[20.8,.32,20.8],m.steel,.04);
  box(root,glass,9.1,.58,13.2,23.8,y+7.56,centerZ,.09);
  for (const z of [-167,-162,-157]) box(root,trim,9.24,.13,.23,23.8,y+7.85,z);
  for (const x of [20.1,27.6]) box(root,trim,.29,.15,13.26,x,y+7.86,centerZ);

  function mezzanine(x1: number, x2: number, z1: number, z2: number) {
    box(root,trim,x2-x1,.22,z2-z1,(x1+x2)/2,upper-.11,(z1+z2)/2);
    solids.push({min:[x1,upper-.22,z1],max:[x2,upper,z2],floor:true,walkSurface:true,surface:'metal'});
  }
  mezzanine(14.15,27.5,-171.85,-152.15);
  mezzanine(27.5,33.85,-171.85,-168);
  solid([27.5,upper+.52,-160.1],[.12,1.04,15.65],glass);
  for (const x of [28.1,31.5]) solid([x,upper+.51,-168],[1.2,1.02,.09],glass);
  // The visible steel treads have the same endpoints as the continuous walk surface.
  const {x:stairX,footZ:bottom,topZ:top} = researchStair, rise = upper - y;
  solids.push({min:[stairX-1.23,-.16,top],max:[stairX+1.23,0,bottom],floor:true,walkSurface:true,surface:'metal',
    slope:{axis:2,start:bottom,height:y,gradient:rise/(top-bottom)}});
  const treads = 20;
  for (let i = 0; i < treads; i++) {
    const u = (i+.5)/treads;
    box(root,trim,2.46,.14,(bottom-top)/treads+.01,stairX,y+u*rise-.07,bottom+(top-bottom)*u);
  }
  for (const x of [stairX-1.22,stairX+1.22]) {
    strut(root,purple,new THREE.Vector3(x,y+.95,bottom),new THREE.Vector3(x,upper+.95,top),.10);
    for (const u of [0,.25,.5,.75,1]) solid([x,y+u*rise+.48,bottom+(top-bottom)*u],[.075,.96,.075],m.zinc);
  }

  function workstation(x: number, level: number, z: number, width: number, tint: THREE.Material) {
    solid([x,level+.53,z],[width,1.06,.96],tint,.065);
    box(root,m.zinc,width+.12,.04,1.03,x,level+1.04,z,.02);
    box(root,glass,width*.67,.35,.13,x,level+1.21,z-.39,.025);
    box(root,light,width*.55,.08,.018,x,level+1.24,z-.31);
  }
  workstation(18.4,y,-156.3,2.6,purple);
  workstation(30.7,y,-154.8,2.7,glass);
  workstation(22.4,upper,-165,3.1,purple);
  for (const z of [-168,-164,-160]) {
    solid([15,upper+1.10,z],[1.12,2.2,2.08],m.ceramic,.05);
    for (const h of [.5,1.12,1.77]) box(root,purple,.052,.12,1.75,15.59,upper+h,z);
  }
  for (const z of [-167.2,-161.7]) {
    solid([17.1,y+.45,z],[3.15,.9,1.55],glass,.075);
    box(root,trim,3.24,.095,1.62,17.1,y+.9,z,.03);
    for (const x of [16.35,17.85]) {
      box(root,purple,.58,.38,.64,x,y+1.1,z,.07);
      box(root,light,.39,.07,.03,x,y+1.16,z+.34);
    }
  }
  for (const [x, level, z] of [[23,y,-168],[23,y,-158],[22.5,upper,-167],[22.5,upper,-157],[31.8,y,-161]]) {
    box(root,light,2.75,.095,.26,x,level+2.96,z);
    const fixture = new THREE.PointLight(0xc3ebf6,52,13,2);
    fixture.position.set(x,level+2.82,z);
    root.add(fixture);
  }

  const { minX: west, maxX: east, minZ: north, maxZ: south } = researchPad;
  for (const x of [west+.16,east-.16]) solid([x,y+.51,(north+south)/2],[.32,1.02,south-north],m.concrete);
  for (const [z, left, right] of [
    [north+.16, researchSteps.minX, researchSteps.maxX],
    [south-.16, researchApproach.minX, researchApproach.maxX],
  ]) {
    solid([(west+left)/2,y+.51,z],[left-west,1.02,.32],m.concrete);
    solid([(right+east)/2,y+.51,z],[east-right,1.02,.32],m.concrete);
  }

  const stepCount = 60, stepRun = (researchSteps.maxZ - researchSteps.minZ) / stepCount;
  for (let i = 0; i < stepCount; i++) {
    const z = researchSteps.minZ + (i+.5)*stepRun;
    box(root,i%10===0?trim:m.concrete,5.64,.16,stepRun+.009,36,y*(i+.5)/stepCount-.08,z);
  }
  for (const x of [33.17,38.83]) {
    for (const h of [.50,.95]) {
      strut(root,purple,new THREE.Vector3(x,h,researchSteps.minZ),new THREE.Vector3(x,y+h,researchSteps.maxZ),.105);
    }
    for (let i = 0; i <= 10; i++) {
      box(root,m.zinc,.11,.96,.11,x,y*i/10+.48,researchSteps.minZ+i*stepRun*6);
    }
    for (let i = 0; i < 10; i++) {
      const z = researchSteps.minZ+i*stepRun*6;
      solids.push({ min:[x-.065,y*i/10,z],max:[x+.065,y*(i+1)/10+.99,z+stepRun*6] });
    }
  }
}
