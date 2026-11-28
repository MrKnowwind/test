// Inspect exposed large axis-aligned surfaces (walls, fascias, soffits, trim and fixtures).
// Expected touching edges and same-pigment joins are not reported as z-fighting.
import * as THREE from 'three';
import { createEnvironment } from '../src/world/environment.ts';
import { createWorldQueries } from '../src/world/worldQueries.ts';

const tolerance=.0025, minimumArea=.012, quantum=.005, grid=4;
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function clip(subject,triangle){
  let p=subject;const sign=Math.sign(cross(...triangle));
  for(let i=0;i<3&&p.length;i++){
    const a=triangle[i],b=triangle[(i+1)%3],out=[];
    for(let j=0;j<p.length;j++){
      const u=p[j],v=p[(j+1)%p.length],d=sign*cross(a,b,u),e=sign*cross(a,b,v);
      if(d>=-1e-8)out.push(u);
      if((d<0)!==(e<0)){const t=d/(d-e);out.push([u[0]+(v[0]-u[0])*t,u[1]+(v[1]-u[1])*t]);}
    }p=out;
  }return p;
}
function area(p){let sum=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];sum+=a[0]*b[1]-a[1]*b[0];}return Math.abs(sum)/2;}
export function auditStructure(environment){
  const {scene,solids}=environment;scene.updateMatrixWorld(true);const queries=createWorldQueries(solids);
  const cells=new Map(),candidates=[],A=new THREE.Vector3(),B=new THREE.Vector3(),C=new THREE.Vector3(),normal=new THREE.Vector3(),delta=new THREE.Vector3();
  let faces=0;
  scene.traverse(o=>{
    if(!o.isMesh||o.isInstancedMesh||!o.visible||Array.isArray(o.material)||o.material.transparent)return;
    const g=o.geometry,p=g.attributes.position,idx=g.index,col=g.attributes.color;
    if(!p)return;
    const n=idx?.count??p.count;
    for(let i=0;i<n;i+=3){
      const ia=idx?idx.getX(i):i,ib=idx?idx.getX(i+1):i+1,ic=idx?idx.getX(i+2):i+2;
      A.fromBufferAttribute(p,ia).applyMatrix4(o.matrixWorld);B.fromBufferAttribute(p,ib).applyMatrix4(o.matrixWorld);C.fromBufferAttribute(p,ic).applyMatrix4(o.matrixWorld);
      normal.subVectors(B,A).cross(delta.subVectors(C,A));
      if(normal.lengthSq()<.018*.018*4)continue;
      const axis=Math.abs(normal.x)>Math.abs(normal.z)?(Math.abs(normal.x)>Math.abs(normal.y)?0:1):(Math.abs(normal.z)>Math.abs(normal.y)?2:1),side=Math.sign(normal.getComponent(axis));
      // Upward walkable finishes have a separate audit and regression suite.
      if(axis===1&&side>0)continue;
      const plane=A.getComponent(axis);if(Math.abs(B.getComponent(axis)-plane)>1e-4||Math.abs(C.getComponent(axis)-plane)>1e-4)continue;
      if([A,B,C].some(v=>v.x< -233||v.x>229||v.z< -220||v.z>180||v.y>24))continue;
      const uv=[0,1,2].filter(k=>k!==axis),points=[A,B,C].map(v=>uv.map(k=>v.getComponent(k)));
      const mins=[0,1].map(k=>Math.min(...points.map(p=>p[k]))),maxs=[0,1].map(k=>Math.max(...points.map(p=>p[k])));
      if(maxs.some((x,k)=>x-mins[k]>60))continue;
      const pigment=col?[col.getX(ia),col.getY(ia),col.getZ(ia)].map(n=>Math.round(n*255)).join(','):o.material.color?.getHexString()??o.material.id;
      const face={points,mins,maxs,plane,pigment,axis,side,uv,serial:faces++};
      const checked=new Set();
      for(let x=Math.floor(mins[0]/grid);x<=Math.floor(maxs[0]/grid);x++)for(let y=Math.floor(mins[1]/grid);y<=Math.floor(maxs[1]/grid);y++){
        for(let bucket=Math.round(plane/quantum)-1;bucket<=Math.round(plane/quantum)+1;bucket++){
          const key=[axis,side,bucket,x,y].join('/');
          for(const other of cells.get(key)??[]){
            if(checked.has(other.serial)||face.pigment===other.pigment||Math.abs(plane-other.plane)>tolerance)continue;
            checked.add(other.serial);
            if(mins.some((a,k)=>Math.min(maxs[k],other.maxs[k])-Math.max(a,other.mins[k])<1e-5))continue;
            const overlap=clip(points,other.points),size=area(overlap);if(size<minimumArea)continue;
            const mid=[0,1].map(k=>overlap.reduce((s,p)=>s+p[k],0)/overlap.length),point=new THREE.Vector3();point.setComponent(axis,(plane+other.plane)/2);uv.forEach((a,k)=>point.setComponent(a,mid[k]));
            // Exclude faces buried inside colliding structure a few centimetres outside.
            const exposed=point.clone().setComponent(axis,point.getComponent(axis)+side*.035).toArray();
            if(solids.some(s=>!s.slope&&exposed.every((p,k)=>p>s.min[k]+.003&&p<s.max[k]-.003)))continue;
            // A downward face below the collision datum is inside the land, not viewable by the player.
            if(axis===1&&side<0&&plane<.12){const ground=queries.groundHeight?.([exposed[0],plane+.04,exposed[2]],.08);if(ground!=null&&ground>exposed[1]+.01)continue;}
            candidates.push({point:point.toArray(),axis,side,area:size,pigments:[face.pigment,other.pigment]});
          }
        }
        const key=[axis,side,Math.round(plane/quantum),x,y].join('/');const list=cells.get(key)??[];list.push(face);cells.set(key,list);
      }
    }
  });
  const ray=new THREE.Raycaster(),distinct=new Set(),visible=[];
  for(const c of candidates.sort((a,b)=>b.area-a.area)){
    const key=[c.axis,c.side,...c.point.map(x=>Math.floor(x))].join('/');if(distinct.has(key))continue;distinct.add(key);
    const p=new THREE.Vector3(...c.point),direction=new THREE.Vector3().setComponent(c.axis,-c.side);
    ray.set(p.clone().addScaledVector(direction,-.045),direction);ray.near=0;ray.far=.055;
    const hits=ray.intersectObject(scene,true);if(hits[0]&&hits[0].distance>.042&&hits.filter(h=>Math.abs(h.distance-.045)<.003).length>=2)visible.push(c);
  }
  return {faces,candidates:candidates.length,visible};
}

if(process.argv[1]?.endsWith('scene-geometry-audit.mjs')){
  const result=auditStructure(createEnvironment());
  console.log(JSON.stringify({...result,visible:result.visible.slice(0,50),visibleCount:result.visible.length},null,2));
}
