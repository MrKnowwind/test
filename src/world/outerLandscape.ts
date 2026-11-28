import * as THREE from 'three';
import { box, cylinder, mesh } from './detail/geometry.ts';
import { enamel, type Materials } from './detail/materialLibrary.ts';
import { landOutline, isLandAt } from './landPlan.ts';
import { terrainHeight } from './terrainPlan.ts';

const distanceBands=[0,10,25,48,78,120,180,260,370];

/** Render-only land connects to the actual boundary on N/E/S; the western quay remains ocean-facing. */
export function addOuterLandscape(root:THREE.Group,m:Materials){
  const landscape=new THREE.Group();landscape.name='saltport-outer-landscape';root.add(landscape);
  const border=landOutline.slice(0,15),samples:{x:number;z:number;nx:number;nz:number;edgeY:number}[]=[];
  // Cardinal directions avoid folding the far terrain at small irregular shoreline vertices.
  const outward=(i:number)=>i===0?[0,-1]:i===1?[1,-1]:i<12?[1,0]:i===12?[1,1]:[0,1];
  for(let i=0;i<border.length-1;i++){
    const a=border[i],b=border[i+1],before=outward(i),after=outward(i+1);
    const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/5);
    for(let j=0;j<=n;j++){
      if(i>0&&j===0)continue;
      const t=j/n,x=THREE.MathUtils.lerp(a[0],b[0],t),z=THREE.MathUtils.lerp(a[1],b[1],t);
      samples.push({x,z,nx:THREE.MathUtils.lerp(before[0],after[0],t),nz:THREE.MathUtils.lerp(before[1],after[1],t),edgeY:terrainHeight(x,z)??0});
    }
  }
  const verts:number[]=[],colors:number[]=[],indices:number[]=[];
  const city=new THREE.Color(0x98a9b7),ground=new THREE.Color(0x7e9c91),hill=new THREE.Color(0x738ea2);
  const pcolor=new THREE.Color();
  for(const s of samples){
    for(const d of distanceBands){
      const x=s.x+s.nx*d,z=s.z+s.nz*d;
      const swell=(Math.sin(x*.021)+Math.sin(z*.027+x*.008)*.74+Math.cos(x*.011-z*.021)*.55+2.4)*.45;
      const blend=THREE.MathUtils.smoothstep(d,13,110),rise=THREE.MathUtils.smoothstep(d,48,260)*(16+swell*24);
      const y=THREE.MathUtils.lerp(s.edgeY,2+swell*7,blend)+rise;
      verts.push(x,y-.015,z);
      pcolor.copy(city).lerp(ground,THREE.MathUtils.smoothstep(d,8,40)).lerp(hill,THREE.MathUtils.smoothstep(d,125,360));
      pcolor.multiplyScalar(.9+swell*.10);colors.push(pcolor.r,pcolor.g,pcolor.b);
    }
  }
  const stride=distanceBands.length;
  for(let i=0;i<samples.length-1;i++)for(let j=0;j<stride-1;j++){
    const a=i*stride+j,b=a+1,c=a+stride,d=c+1;indices.push(a,c,b,b,c,d);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
  const terrain=mesh(landscape,geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}));
  terrain.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
  function height(x:number,z:number){ray.set(new THREE.Vector3(x,150,z),down);return ray.intersectObject(terrain,false)[0]?.point.y;}
  const asphalt=enamel(0x617585),line=enamel(0xb9c9cc);
  function road(x:number,z:number,dx:number,dz:number,length=100){
    const width=4.5,positions:number[]=[],idx:number[]=[];
    for(let s=0;s<=length;s+=4){const xx=x+dx*s,zz=z+dz*s;
      const a=height(xx-dz*width,zz+dx*width),b=height(xx+dz*width,zz-dx*width);
      if(a===undefined||b===undefined||isLandAt(xx,zz))continue;
      positions.push(xx-dz*width,a+.045,zz+dx*width,xx+dz*width,b+.045,zz-dx*width);
      if(s%12===0){const y=height(xx,zz);if(y!==undefined)box(landscape,line,dx!==0?2.4:.13,.016,dz!==0?2.4:.13,xx,y+.1,zz);}
    }
    for(let i=0;i<positions.length/3-2;i+=2)idx.push(i,i+2,i+1,i+2,i+3,i+1);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(idx);g.computeVertexNormals();mesh(landscape,g,asphalt);
  }
  for(const x of [-115,26,175])road(x,-221,0,-1,116);
  for(const x of [-115,26,175])road(x,181,0,1,100);
  road(229,-100,1,0,100);road(229,125,1,0,112);
  const wall=[enamel(0x8fa6ad),enamel(0xa4b4b3),enamel(0x8da3b8),enamel(0xb1aaa0)],roof=enamel(0x536f83),window=enamel(0x435d76);
  function building(x:number,z:number,w:number,d:number,h:number,variant:number){
    const corners=[[-w/2,-d/2],[w/2,-d/2],[-w/2,d/2],[w/2,d/2],[0,0]].map(([a,b])=>height(x+a,z+b));
    if(corners.some(y=>y===undefined)||isLandAt(x,z))return;
    const low=Math.min(...corners as number[]),high=Math.max(...corners as number[]),base=high+.02;
    box(landscape,m.concrete,w+.6,base-low+.55,d+.6,x,(base+low-.55)/2,z,.04);
    box(landscape,wall[variant%wall.length],w,h,d,x,base+h/2,z,.10);
    box(landscape,roof,w+.45,.32,d+.45,x,base+h+.16,z,.035);
    if(variant%3===0)box(landscape,roof,w*.35,1.9,d*.44,x+.22*w,base+h+1.1,z,.08);
    for(let y=2.4;y<h-1;y+=3.1){for(const side of [-1,1])box(landscape,window,w*.72,.64,.055,x,base+y,z+side*(d/2+.035));}
  }
  const buildings:readonly [number,number,number,number,number][]=[[-138,-247,19,15,8],[-92,-256,21,14,14],[-45,-251,25,15,10],[-8,-276,19,16,16],[68,-262,28,14,12],[119,-251,23,17,11],[201,-269,28,20,12],[260,-160,23,17,14],[270,-68,35,23,10],[258,20,22,14,15],[295,61,31,23,8],[264,150,24,16,11],[-130,215,18,13,6],[-77,211,24,15,8],[-22,231,17,12,12],[59,215,23,12,8],[121,236,21,17,12],[201,222,22,15,8]];
  buildings.forEach(([x,z,w,d,h],i)=>building(x,z,w,d,h,i));
  const green=enamel(0x647d69),bark=enamel(0x6d716a),crown=new THREE.ConeGeometry(1,1,7);
  for(let i=0;i<90;i++){
    const side=i%3,t=(i*73)%360,off=18+(i*37)%63;
    const x=side===0?-150+t:side===1?237+off:-142+t,z=side===0?-226-off:side===1?-205+t:183+off;
    if(buildings.some(([a,b,w,d])=>Math.abs(x-a)<w/2+3&&Math.abs(z-b)<d/2+3)||isLandAt(x,z))continue;
    if((side===0||side===2)&&[-115,26,175].some(a=>Math.abs(x-a)<8))continue;
    const y=height(x,z);if(y===undefined)continue;
    const h=3+(i%5)*.49;cylinder(landscape,bark,.12,h*.55,x,y+h*.275,z,7);
    const tree=mesh(landscape,crown,green,x,y+h*.77,z);tree.scale.set(1.0+(i%3)*.24,h*.82,1.0+(i%3)*.24);
  }
  // Far shore across the western bay: connected land mass, not floating skyline boxes.
  const coast=new THREE.Shape();const coastPoints=[[-620,-460],[-455,-460],[-425,-320],[-452,-196],[-405,-102],[-441,19],[-420,126],[-470,255],[-615,400],[-740,340],[-740,-420]];
  coastPoints.forEach(([x,z],i)=>i?coast.lineTo(x,-z):coast.moveTo(x,-z));coast.closePath();
  const island=new THREE.ExtrudeGeometry(coast,{depth:4,bevelEnabled:false});island.rotateX(-Math.PI/2);mesh(landscape,island,groundMaterial(),0,-3.4,0);
  for(let i=0;i<7;i++){const x=-483-(i%3)*21,z=-275+i*85,h=10+(i%4)*6;box(landscape,wall[i%4],23,h,18,x,.6+h/2,z,.06);box(landscape,roof,24,.5,19,x,.6+h+.25,z);}
  function groundMaterial(){return enamel(0x829c9e);}
  return terrain;
}
