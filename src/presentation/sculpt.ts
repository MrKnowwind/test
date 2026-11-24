import * as THREE from 'three';
import { part, type Point } from './modelParts.ts';

type Section=readonly [x:number,y:number,z:number,halfWidth:number,depth:number];
type Ring=readonly [y:number,rx:number,rz:number,z:number];
// A closed, lenticular section swept along a centreline. Its ridge follows the outward face.
export function sweptPlate(parent:THREE.Object3D,material:THREE.MeshStandardMaterial,sections:readonly Section[],outward:Point=[0,0,1]){
  const spine=new THREE.CatmullRomCurve3(sections.map(([x,y,z])=>new THREE.Vector3(x,y,z)),false,'catmullrom',.40);
  const profile=[[-1,0],[-.70,.60],[-.22,1],[.42,.77],[.85,.32],[1,0],[.55,-.47],[-.52,-.45]];
  const verts:number[]=[],idx:number[]=[],uv:number[]=[],steps=(sections.length-1)*4;
  const normal=new THREE.Vector3(...outward),cross=new THREE.Vector3(),front=new THREE.Vector3();
  for(let i=0;i<=steps;i++){
    const t=i/steps,k=Math.min(sections.length-2,Math.floor(t*(sections.length-1))),f=t*(sections.length-1)-k;
    const p=spine.getPoint(t),axis=spine.getTangent(t);
    cross.crossVectors(axis,normal).normalize();front.crossVectors(cross,axis).normalize();
    const w=THREE.MathUtils.lerp(sections[k][3],sections[k+1][3],f);
    const d=THREE.MathUtils.lerp(sections[k][4],sections[k+1][4],f);
    profile.forEach(([a,b],j)=>{
      const v=p.clone().addScaledVector(cross,a*w).addScaledVector(front,b*d);verts.push(v.x,v.y,v.z);uv.push(j/8,t);
      const n=i*8+j,next=i*8+(j+1)%8;
      if(i)idx.push(n-8,next-8,n,next-8,next,n);
      if(j>0&&j<7&&(i===0||i===steps)){if(i)idx.push(i*8,n,n+1);else idx.push(0,n+1,n);}
    });
  }
  return shape(parent,material,verts,idx,uv,[0,0,0]);
}

export function tailoring(parent:THREE.Object3D,mat:THREE.MeshStandardMaterial,at:Point,rings:readonly Ring[]){
  const verts:number[]=[],idx:number[]=[],uv:number[]=[],count=28;
  rings.forEach(([y,w,d,z],row)=>{
    for(let j=0;j<=count;j++){
      const a=j/count*Math.PI*2,s=Math.sin(a),c=Math.cos(a);
      verts.push(w*Math.sign(s)*Math.pow(Math.abs(s),.85),y,z+d*Math.sign(c)*Math.pow(Math.abs(c),.82));uv.push(j/count,row/(rings.length-1));
      if(row&&j){const i=row*(count+1)+j;idx.push(i-count-2,i-count-1,i,i-count-2,i,i-1);}
    }
  });
  for(const row of [0,rings.length-1]){
    const index=verts.length/3,[y,,,z]=rings[row];verts.push(0,y,z);uv.push(.5,.5);
    for(let j=0;j<count;j++){const k=row*(count+1)+j;if(row)idx.push(index,k,k+1);else idx.push(index,k+1,k);}
  }
  return shape(parent,mat,verts,idx,uv,at);
}
function shape(parent:THREE.Object3D,mat:THREE.MeshStandardMaterial,v:number[],i:number[],uv:number[],at:Point){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setIndex(i);geometry.computeVertexNormals();return part(parent,geometry,mat,at);
}
