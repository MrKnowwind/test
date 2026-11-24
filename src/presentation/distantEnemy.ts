import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { EnemyKind } from '../contracts/demo.ts';

// At street-block distances the head, shoulder and leg silhouettes read before individual armour plates.
const cache = new Map<EnemyKind,THREE.BufferGeometry>();
const paint = new THREE.MeshLambertMaterial({vertexColors:true});
export function distantEnemy(kind:EnemyKind){
  let geometry=cache.get(kind);
  if(!geometry){
    const pieces:THREE.BufferGeometry[]=[];
    function lobe(x:number,y:number,z:number,w:number,h:number,d:number,color:number,tilt=0){
      const g=new THREE.SphereGeometry(1,7,5);
      g.scale(w,h,d);g.rotateZ(tilt);g.translate(x,y,z);
      const c=new THREE.Color(color),rgb=new Float32Array(g.attributes.position.count*3);
      for(let i=0;i<rgb.length;i+=3){rgb[i]=c.r;rgb[i+1]=c.g;rgb[i+2]=c.b;}
      g.setAttribute('color',new THREE.BufferAttribute(rgb,3));pieces.push(g);
    }
    if(kind==='infected'){
      for(const side of [-1,1]){
        lobe(side*.13,.45,0,.105,.45,.10,0x344456,side*.045);
        lobe(side*.24,1.23,-.04,side>0?.14:.075,.31,.095,side>0?0xafab99:0x566975,side*.14);
      }
      lobe(0,1.19,.01,.23,.38,.14,0x475967);
      lobe(.19,1.48,-.012,.19,.105,.14,0xbdbca8,.32);
      lobe(0,1.65,-.10,.13,.145,.13,0x596578);
      lobe(-.04,1.66,-.22,.045,.048,.022,0xf4b26e);
    }else{
      for(const x of [-.31,.31])for(const z of [-.29,.29])lobe(x,.40,z,.095,.40,.11,0x475875,x*.42);
      lobe(0,.79,0,.36,.20,.36,0x819eb0);
      lobe(0,1.05,-.045,.29,.185,.25,0xb9d7da);
      lobe(0,1.07,-.28,.075,.055,.035,0x83eadb);
    }
    geometry=mergeGeometries(pieces)!;
    pieces.forEach(p=>p.dispose());cache.set(kind,geometry);
  }
  return new THREE.Mesh(geometry,paint);
}
