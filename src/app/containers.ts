import * as THREE from 'three';
import type { FirstMap, MapInteraction, Vec3 } from '../contracts/demo.ts';
import { caseProfile } from '../raid/loot.ts';
import { makeLootModel } from '../presentation/lootModels.ts';
import { makeCaseModel } from '../world/detail/caseModels.ts';

const silhouetteVertex = `
  uniform vec2 viewport;
  uniform float width;
  void main(){
    vec4 clip=projectionMatrix*modelViewMatrix*vec4(position,1.0);
    vec3 n=normalize(normalMatrix*normal);
    vec2 projected=(projectionMatrix*vec4(n,0.0)).xy;
    vec2 dir=projected/max(length(projected),0.0001);
    clip.xy+=dir*width*2.0/viewport*clip.w;
    gl_Position=clip;
  }`;
const silhouetteFragment=`void main(){gl_FragColor=vec4(1.0);}`;

export function addSearchContainers(map: FirstMap & { scene:THREE.Group }) {
  const visuals=new Map<string,{root:THREE.Group;halo?:THREE.Group;center:THREE.Vector3;searched?:()=>void}>();
  const active=new Set<string>();
  const edge=(width:number)=>new THREE.ShaderMaterial({vertexShader:silhouetteVertex,fragmentShader:silhouetteFragment,
    uniforms:{viewport:{value:new THREE.Vector2(1,1)},width:{value:width}},side:THREE.BackSide,
    depthTest:true,depthWrite:false,transparent:true,toneMapped:false});
  const normal=edge(1.3),focused=edge(2.3),viewport=new THREE.Vector2();
  function silhouette(root:THREE.Group){
    const group=new THREE.Group();group.name='interaction-outline';group.visible=false;
    root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert();
    root.traverse(o=>{
      if(!(o instanceof THREE.Mesh)||!o.visible)return;
      const copy=new THREE.Mesh(o.geometry,normal);copy.matrixAutoUpdate=false;
      copy.matrix.multiplyMatrices(inverse,o.matrixWorld);copy.renderOrder=90;copy.frustumCulled=false;group.add(copy);
    });
    root.add(group);return group;
  }
  function spawn(t:MapInteraction){
    if(t.kind!=='loot'&&t.kind!=='loose')return;
    const root=new THREE.Group();root.position.set(...t.position);
    const probe:Vec3=[t.position[0],t.position[1]+(t.kind==='loot'?.16:0),t.position[2]];
    const support=map.blockedDistance(probe,[0,-1,0],1.76);
    root.position.y= support===null?t.position[1]-.12:probe[1]-support;
    root.userData.detailCenter=root.position;root.userData.detailRadius=1;
    let searched:(()=>void)|undefined;
    if(t.kind==='loose'){
      root.name='goods-'+t.id;const model=makeLootModel(t.item);
      model.rotation.y=[...t.id].reduce((sum,ch)=>sum+ch.charCodeAt(0),0)*.41;
      root.add(model);
    }else{
      root.name='container-'+t.id;
      const original=map.scene.getObjectByName(t.id);if(original)original.visible=false;
      const {kind}=caseProfile(t.id,t.item,t.search);
      const floor=map.groundHeight?.([root.position.x,root.position.y-.42,root.position.z],.08);
      const tabletop=floor!=null&&root.position.y-floor<1.55;
      const variant=[...t.id].reduce((sum,ch)=>sum+ch.charCodeAt(0),0);
      const model=makeCaseModel(kind,tabletop,variant);root.add(model.root);searched=model.searched;
      const [x,y,z]=root.position.toArray();
      const orientations=[0,Math.PI/2,Math.PI,-Math.PI/2];
      function access(angle:number){
        const dx=Math.sin(angle),dz=Math.cos(angle),px=x+dx*.92,pz=z+dz*.92;
        const approach=map.groundHeight?.([px,y+.12,pz],.22);
        const open=approach!=null&&y-approach<1.55&&map.bodyClear?.([px,approach,pz],.28,1.5);
        const clearance=map.blockedDistance([x,y+.16,z],[dx,0,dz],1.7)??1.7;
        return clearance+(open?2:0)+(open&&tabletop&&y-approach!>.35?.5:0);
      }
      root.rotation.y=t.yaw??orientations.sort((a,b)=>access(b)-access(a))[0];
    }
    map.scene.add(root);root.updateMatrixWorld(true);
    const center=new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
    visuals.set(t.id,{root,center,searched});
  }
  for(const t of map.interactions)spawn(t);
  return {
    spawn,
    remove(id:string){const v=visuals.get(id);if(v){v.root.removeFromParent();visuals.delete(id);active.delete(id);}},
    searched(id:string){visuals.get(id)?.searched?.();},
    updateHighlights(renderer:THREE.WebGLRenderer,eye:Vec3,aimed:string|undefined,consumed:ReadonlySet<string>){
      renderer.getDrawingBufferSize(viewport);
      normal.uniforms.viewport.value.copy(viewport);focused.uniforms.viewport.value.copy(viewport);
      normal.uniforms.width.value=1.3*renderer.getPixelRatio();focused.uniforms.width.value=2.3*renderer.getPixelRatio();
      const p=new THREE.Vector3(...eye);
      const candidates=[...visuals.entries()].filter(([id,v])=>!consumed.has(id)&&v.root.visible&&v.center.distanceToSquared(p)<100)
        .sort((a,b)=>Number(b[0]===aimed)-Number(a[0]===aimed)||a[1].center.distanceToSquared(p)-b[1].center.distanceToSquared(p)).slice(0,14);
      const next=new Set(candidates.map(([id])=>id));
      for(const id of active)if(!next.has(id)){const v=visuals.get(id);if(v?.halo)v.halo.visible=false;}
      active.clear();
      for(const [id,v] of candidates){
        const halo=v.halo??=silhouette(v.root);halo.visible=true;
        for(const o of halo.children)(o as THREE.Mesh).material=id===aimed?focused:normal;
        active.add(id);
      }
    },
    dispose(){normal.dispose();focused.dispose();},
  };
}
