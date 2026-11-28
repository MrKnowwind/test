import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { itemSpecs } from '../src/raid/catalog.ts';
import { makeLootModel } from '../src/presentation/lootModels.ts';
import { makeCaseModel } from '../src/world/detail/caseModels.ts';
import { caseTypes } from '../src/raid/loot.ts';
import { createEnvironment, mapInteractions } from '../src/world/environment.ts';
import { createFirstMap } from '../src/world/firstMap.ts';
import { loosePoints } from '../src/world/loosePoints.ts';
import { addSearchContainers } from '../src/app/containers.ts';
import { auditStructure } from './scene-geometry-audit.mjs';

function signature(root){
  root.updateMatrixWorld(true);const parts=[];
  root.traverse(o=>{if(o.isMesh){const box=new THREE.Box3().setFromObject(o);parts.push([o.geometry.attributes.position.count,...box.min.toArray(),...box.max.toArray()].map(n=>n.toFixed(4)).join(','));}});
  return parts.sort().join('|');
}

test('all 98 item IDs have distinct grounded procedural forms and clone independently',()=>{
  const signatures=new Set();
  for(const id of Object.keys(itemSpecs)){
    const model=makeLootModel(id),copy=makeLootModel(id),b=new THREE.Box3().setFromObject(model);
    assert.ok(Number.isFinite(b.min.y)&&Math.abs(b.min.y)<.0001,id+' grounded');
    assert.ok(b.getSize(new THREE.Vector3()).length()>.10,id+' readable size');
    const s=signature(model);assert.ok(s.length>0&&!signatures.has(s),id+' distinct mesh recipe');signatures.add(s);
    assert.equal(signature(copy),s);copy.position.x=10;assert.equal(model.position.x,0);
  }assert.equal(signatures.size,Object.keys(itemSpecs).length);
});

test('all case classes have distinguishable geometry and a separate searched indicator',()=>{
  const signatures=new Set();
  for(const kind of Object.keys(caseTypes)){
    const c=makeCaseModel(kind,true),b=new THREE.Box3().setFromObject(c.root);
    assert.ok(Math.abs(b.min.y)<.0001,kind);const s=signature(c.root);
    assert.ok(!signatures.has(s),kind);signatures.add(s);
    const before=c.indicator.material;c.searched();assert.notEqual(c.indicator.material,before);
  }
  assert.equal(signatures.size,11);
});

test('the depth-tested white outlines use normal/focused widths, hide after empty or distance and follow dropped items',()=>{
  const scene=new THREE.Group(),items=[{id:'fixed',kind:'loot',item:'medkit',quantity:1,label:'test',position:[0,.12,0]},{id:'drop',kind:'loose',item:'coil',quantity:1,label:'test',position:[2,.12,0]}];
  const c=addSearchContainers({scene,interactions:items,blockedDistance:()=>.12});
  const renderer={getDrawingBufferSize:v=>v.set(1280,720),getPixelRatio:()=>1};
  c.updateHighlights(renderer,[0,1.55,2],'fixed',new Set());
  const fixed=scene.getObjectByName('container-fixed').getObjectByName('interaction-outline'),drop=scene.getObjectByName('goods-drop').getObjectByName('interaction-outline');
  assert.ok(fixed.visible&&drop.visible);assert.equal(fixed.children[0].material.uniforms.width.value,2.3);
  assert.equal(drop.children[0].material.uniforms.width.value,1.3);assert.ok(drop.children[0].material.depthTest);assert.equal(drop.children[0].material.depthWrite,false);
  c.updateHighlights(renderer,[0,1.55,2],undefined,new Set(['fixed']));assert.equal(fixed.visible,false);
  c.updateHighlights(renderer,[100,1.55,100],undefined,new Set());assert.equal(drop.visible,false);
  c.remove('drop');assert.equal(scene.getObjectByName('goods-drop'),undefined);c.dispose();
});

const environment=createEnvironment(),map=createFirstMap(42,environment);
test('large exposed wall, soffit and fascia surfaces have no competing near-coplanar finish',()=>{
  const result=auditStructure(environment);
  assert.ok(result.faces>100000);
  assert.deepEqual(result.visible,[]);
});
test('outdoor resource sites are supported, varied, and seeded without changing original fixed containers',()=>{
  assert.equal(environment.outdoorLoot.length,30);
  assert.equal(map.interactions.filter(t=>t.kind==='loot').length,203);
  for(const s of environment.outdoorLoot){const d=map.blockedDistance(s.position,[0,-1,0],2);assert.ok(d!==null&&Math.abs(d-.12)<.01,s.id);}
  const generated=seed=>loosePoints(seed,mapInteractions,p=>map.blockedDistance(p,[0,-1,0],3),environment.outdoorLoot);
  assert.deepEqual(generated(42),generated(42));assert.notDeepEqual(generated(42),generated(43));
  const avg=Array.from({length:256},(_,seed)=>generated(seed).length).reduce((a,b)=>a+b,0)/256;
  assert.ok(avg>20&&avg<30,`mean ${avg}`);
});

test('container geometry does not sink into physical furniture or walls',()=>{
  addSearchContainers(map);
  for(const t of map.interactions.filter(t=>t.kind==='loot')){
    const o=map.scene.getObjectByName('container-'+t.id),b=new THREE.Box3().setFromObject(o);
    for(const s of environment.solids){
      if(s.floor)continue;
      const overlap=[0,1,2].map(k=>Math.min(b.max.getComponent(k),s.max[k])-Math.max(b.min.getComponent(k),s.min[k]));
      assert.ok(!overlap.every(n=>n>.015),t.id+' overlaps '+JSON.stringify(s));
    }
  }
});

test('visual land continues beyond three shores but does not extend the playable map',()=>{
  map.scene.updateMatrixWorld(true);const ray=new THREE.Raycaster();
  for(const [x,z] of [[-115,-222],[26,-224],[160,-230],[230,-150],[231,30],[228,130],[26,184],[-110,184],[160,188]]){
    ray.set(new THREE.Vector3(x,120,z),new THREE.Vector3(0,-1,0));
    const hit=ray.intersectObject(map.scene,true)[0];assert.ok(hit&&hit.point.y> -1,`land at ${x}, ${z}`);
    assert.equal(map.bodyClear([x,hit.point.y,z],.36,1.8),false);
  }
});
