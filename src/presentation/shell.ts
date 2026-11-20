import * as THREE from 'three';
import { part, type Point } from './modelParts.ts';

// Each ring describes an eight-sided enamel casting: height, half-width, half-depth and Z offset.
type Ring = readonly [number, number, number, number];
export function shell(parent: THREE.Object3D, mat: THREE.MeshStandardMaterial, at: Point, rings: Ring[]) {
  const contour = [[-.58,-1],[.58,-1],[1,-.55],[1,.55],[.58,1],[-.58,1],[-1,.55],[-1,-.55]];
  const positions:number[] = [], indices:number[] = [];
  rings.forEach(([y,w,d,z],row)=>{
    for(const [x,v] of contour) positions.push(x*w,y,z+v*d);
    for(let i=0;i<8;i++) {
      const a=row*8+i,b=row*8+(i+1)%8;
      if(row) indices.push(a-8,a,b,b,b-8,a-8);
      if(i>=1 && i<7 && row===0) indices.push(0,i,i+1);
      if(i>=1 && i<7 && row===rings.length-1) indices.push(row*8,a+1,a);
    }
  });
  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geom.setIndex(indices);
  const flat=geom.toNonIndexed();
  flat.computeVertexNormals();
  flat.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(flat.getAttribute('position').count*2),2));
  geom.dispose();
  return part(parent,flat,mat,at);
}

export function pigment(color:number, glow=0) {
  return new THREE.MeshStandardMaterial({color,roughness:.84,metalness:.04,emissive:glow?color:0,emissiveIntensity:glow});
}
