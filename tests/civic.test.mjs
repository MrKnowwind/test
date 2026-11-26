import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirstMap} from '../src/world/firstMap.ts';
import {northTerrace,terrainHeight,civicInteractions,houses} from '../src/world/terrainPlan.ts';
import {findInteraction} from '../src/player/controller.ts';
import {createRaid} from '../src/raid/raid.ts';
import {residentialPad} from '../src/world/southPlan.ts';

const map=createFirstMap(42),radius=.36,height=1.8;
function walk(start,points){let p=start;for(const [x,z] of points){const n=Math.max(1,Math.ceil(Math.hypot(x-p[0],z-p[2])/.08)),dx=(x-p[0])/n,dz=(z-p[2])/n;for(let i=0;i<n;i++)p=map.moveBody(p,dx,-.012,dz,radius,height);assert.ok(Math.hypot(x-p[0],z-p[2])<.09,`blocked: ${p} → ${[x,z]}`);}return p;}
function inspect(p,id){const t=map.interactions.find(x=>x.id===id),eye=[p[0],p[1]+1.65,p[2]],v=t.position.map((n,i)=>n-eye[i]),d=Math.hypot(...v);assert.ok(d<2.7,`${id}: ${d}m`);assert.equal(findInteraction(map,map.interactions,new Set(),eye,v.map(n=>n/d))?.id,id);}

test('north terrace is actual supported terrain with a straight two-way graded road, rather than visual-only hills',()=>{
  const p=walk([-115,0,-107],[[-115,-138],[-115,-170],[-115,-200]]);assert.ok(Math.abs(p[1]-northTerrace.height)<.03);
  assert.ok(Math.abs(terrainHeight(-115,-138)-27*8/55)<.001);assert.equal(map.surfaceAt(p),'concrete');
  assert.ok(Math.abs(map.blockedDistance([-115,10,-138],[0,-1,0],15)-(10-terrainHeight(-115,-138)))<.01);
  assert.equal(map.bodyClear([-125,1,-180],radius,height),false);
  const back=walk(p,[[-115,-138],[-115,-107]]);assert.ok(Math.abs(back[1])<.04);
  const npc=map.moveGrounded([-115,0,-107],0,-93,radius,height);assert.ok(Math.abs(npc[1]-8)<.04&&Math.abs(npc[2]+200)<.08);
});

test('north customs hall and observation station have real entrance, search furniture and second-floor return',()=>{
  const upperRoad=walk([-115,0,-107],[[-115,-179]]);
  inspect(walk(upperRoad,[[-146.6,-179]]),'north-customs-desk');
  inspect(walk(upperRoad,[[-134,-179],[-136,-183.5]]),'north-customs-locker');
  const office=walk(upperRoad,[[-115,-204],[-138.8,-204]]);inspect(office,'north-observatory-console');
  const top=walk(office,[[-134,-204],[-134,-197.25],[-147.5,-197.25],[-147.5,-211.7],[-142,-212],[-142,-205.6]]);
  assert.ok(Math.abs(top[1]-11.4)<.04);inspect(top,'north-observatory-upper');
  const back=walk(top,[[-142,-212],[-147.5,-212],[-147.5,-197.25],[-134,-197.25],[-134,-204],[-115,-204],[-115,-107]]);assert.ok(Math.abs(back[1])<.05);
});

test('each attached residence has a distinct accessible first and second floor',()=>{
  for(const [i,{z}] of houses.entries()){
    const y=residentialPad.height;
    const lower=walk([-122,y,z],[[-133.8,z]]);inspect(lower,`residential-${i}-ground`);
    const top=walk(lower,[[-128.7,z],[-128.7,z-3],[-143,z-3],[-143,z],[-139,z]]);assert.ok(Math.abs(top[1]-y-3.2)<.05);inspect(top,`residential-${i}-upper`);
    const back=walk(top,[[-143,z],[-143,z-3],[-128.7,z-3],[-128.7,z],[-122,z]]);assert.ok(Math.abs(back[1]-y)<.05);
  }
});

test('new civic inventory containers are attached to real support at the proper elevation',()=>{
  const raid=createRaid('civic-check',42,map);for(const t of civicInteractions){assert.ok(raid.containers.has(t.id),t.id);assert.ok(map.scene.getObjectByName(t.id),t.id);assert.ok(map.blockedDistance([t.position[0],t.position[1]+.3,t.position[2]],[0,-1,0],.8)!==null,t.id);}
});
