import assert from 'node:assert/strict';
import test from 'node:test';
import { createFirstMap } from '../src/world/firstMap.ts';
import { districtPoint as at, highwayPosition } from '../src/world/layout.ts';
import { lab, rampHeight } from '../src/world/worldQueries.ts';
import { supplySites } from '../src/world/supplySites.ts';

const map = createFirstMap(42);
const radius=.36, height=1.8;

test('each roadside site has two ground stores and a reachable elevated store', () => {
  for (const site of supplySites) {
    const { x, z } = site;
    visible([x - 3, 0, z + 3.3], site.id + '-stock');
    visible([x + 3, 0, z + 3.3], site.id + '-tools');
    for (let step = 0; step < site.height / 1.6; step++) {
      const feet = [x + 10, step * 1.6 + .7, z + 4.85 - step * 2.6];
      const landing = map.climbTarget(feet, [0, 0, -1], radius, height);
      assert.ok(landing, `${site.id}: step ${step + 1} is blocked`);
      assert.ok(Math.abs(landing[1] - (step + 1) * 1.6) < .01);
    }
    const topZ = z + 3 - (site.height / 1.6 - 1) * 2.6;
    const from = [x + 10, site.height, topZ];
    const bridge = map.moveBody(from, -5.7, 0, 0, radius, height);
    assert.ok(Math.abs(bridge[0] - (x + 4.3)) < .01, site.id + ' bridge');
    const deck = map.moveBody(bridge, 0, 0, z - 9.3 - bridge[2], radius, height);
    const approach = map.moveBody(deck, -4.3, 0, 0, radius, height);
    assert.ok(Math.abs(approach[0] - x) < .01, site.id + ' deck');
    visible(approach, site.id + '-upper');
  }
});
function walk(start, route, district) {
 if(district){ const point=at(district,start); route=route.map(([x,z])=>{ const p=at(district,[x,0,z]); return [p[0],p[2]]; }); start=point; }
 let feet=start;
 for(const [x,z] of route){
  const steps=Math.max(1,Math.ceil(Math.hypot(x-feet[0],z-feet[2])/.14));
  const dx=(x-feet[0])/steps,dz=(z-feet[2])/steps;
  for(let i=0;i<steps;i++)feet=map.moveGrounded(feet,dx,dz,radius,height);
  assert.ok(Math.hypot(feet[0]-x,feet[2]-z)<.01,'Blocked en route to '+[x,z]+' at '+feet);
 }
 return feet;
}
function visible(feet,id){
 const target=map.interactions.find(t=>t.id===id);
 const eye=[feet[0],feet[1]+1.65,feet[2]];
 const delta=target.position.map((v,i)=>v-eye[i]),distance=Math.hypot(...delta);
 assert.ok(distance<2.7,id+' is too far '+distance);
 assert.equal(map.blockedDistance(eye,delta.map(v=>v/distance),distance-.24),null,id+' is occluded');
 assert.ok(map.scene.getObjectByName(id),id+' has no pickup model');
}

test('the full map has five connected districts and every ground spawn has a highway route',()=>{
 assert.ok(map.regions.length>=5);
 const routes={
  'south-loading':[[-24,155],[-151,155],[-151,145]],
  'warehouse-alley':[[149,95],[-151,95],[-151,145]],
  'scrap-shelter':[[-129,24],[-129,27],[-120,27],[-120,95],[-151,95],[-151,145]],
 };
 for(const spawn of map.spawnPoints){
  const feet=walk(spawn.position,routes[spawn.id]);
  assert.equal(feet[1],0);
  assert.ok(Math.hypot(feet[0]-highwayPosition[0],feet[2]-highwayPosition[2])<map.exits[0].radius);
 }
});

test('lab ramp and factory ramp both have continuous traversable height and return routes',()=>{
 const underground=walk([20.5,0,-2],[[20.5,-22]],'research');
 assert.equal(underground[1],lab.y);
 assert.equal(walk(underground,[[40.5,-132]])[1],0);
 const platform=walk([45,0,19],[[45,1]],'plant');
 assert.equal(platform[1],3.2);
 assert.equal(walk(platform,[[140,-16]])[1],0);
 const wharf=walk([-25,0,27],[[-34,27]],'wharf');
 assert.ok(Math.abs(wharf[1]+.8)<.001);
 assert.equal(walk(wharf,[[-120,27]])[1],0);
});

test('the warehouse doorways lead to its duty office and ordinary supplies',()=>{
 const mainAisle=walk([-4,0,32],[[-4,18]]);
 const duty=walk(mainAisle,[[-10,18],[-10,15],[-9,14]]);
 visible(duty,'duty-card');
 const bench=walk(mainAisle,[[-4,8],[-6,7.5]]);
 assert.equal(bench[1],0);
 visible([-21,0,29.3],'yard-ammo');
 visible(at('wharf',[-42.8,-.8,22.1]),'yard-medkit');
 visible(at('wharf',[-37,-.8,-7.8]),'yard-salvage');
 visible(at('plant',[35,0,22.1]),'factory-ammo');
});

test('sample, power and freight lift are reachable through the actual underground openings',()=>{
 const corridor=walk([20.5,0,-2],[[20.5,-29],[7.2,-29]],'research');
 const sample=walk(corridor,[[27.2,-167.4]]);
 visible(sample,'lab-research');
 const cabinet=walk(sample,[[27.2,-159],[16,-159],[16,-167.6]]);
 const target=map.interactions.find(t=>t.id==='lab-power-panel');
 const eye=[cabinet[0],cabinet[1]+1.65,cabinet[2]];
 const d=target.position.map((v,i)=>v-eye[i]),length=Math.hypot(...d);
 assert.ok(length<2.7);
 assert.equal(map.blockedDistance(eye,d.map(v=>v/length),length-.24),null);
 const elevator=walk(cabinet,[[16,-159],[15.4,-155]]);
 assert.equal(elevator[1],map.exits.find(e=>e.id==='lab-lift').position[1]);
 assert.deepEqual(map.exits.find(e=>e.id==='service-passage').requirements,[{kind:'item',id:'service-card'}]);
 assert.deepEqual(map.exits.find(e=>e.id==='lab-lift').requirements,[{kind:'flag',id:'lab-power'}]);
});

test('factory maintenance aisle gives access to the upper resource bench',()=>{
 const upper=walk([45,0,19],[[45,1],[36.9,1],[36.9,-7.7]],'plant');
 visible(upper,'factory-salvage');
 assert.equal(upper[1],3.2);
 const service=walk([189,0,10],[[189,-90]]);
 assert.equal(service[1],0);
});

test('floor, ceiling and ramp rays distinguish underground and surface',()=>{
 const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<.01,actual+' != '+expected);
 near(map.blockedDistance(at('research',[11,1.6,-29]),[0,-1,0],10),1.6);
 near(map.blockedDistance(at('research',[11,-3.8,-29]),[0,1,0],10),3.125);
 near(map.blockedDistance(at('research',[20.5,1,-10]),[0,-1,0],10),1-rampHeight(-140));
 assert.notEqual(map.blockedDistance(at('research',[20.5,-3.8,-28]),[-1,0,0],30),null);
 const wall=map.moveGrounded(at('research',[16,0,-8]),4,0,radius,height);
 assert.ok(wall[0]<36.5);
});

test('seeded mechanical posts remain underground and all initial spawns have breathing room',()=>{
 const another=createFirstMap(42);
 assert.deepEqual(another.enemies,map.enemies);
 const bot=map.enemies.find(e=>e.kind==='security-bot');
 assert.equal(bot.position[1],lab.y);
 assert.ok(map.enemies.filter(e=>e.kind==='infected').length>1);
 for(const spawn of map.spawnPoints)
  for(const enemy of map.enemies)
   assert.ok(Math.hypot(...enemy.position.map((v,i)=>v-spawn.position[i]))>16);
 assert.ok(map.interactions.filter(t=>t.kind==='loot').every(t=>!['rifle','shotgun'].includes(t.item)));
});


test('the district plan spans 400m with two surface approaches to each major district', () => {
 assert.ok(Math.abs(map.exits[0].position[0] - map.exits[1].position[0]) > 300);
 const routes = [
  [[-24,0,143],[[-24,95],[-115,95],[-115,27],[-129,27]]],
  [[-24,0,143],[[-24,95],[-4,95],[-4,32],[-4,18]]],
  [[-24,0,143],[[-24,155],[175,155],[175,-10],[149,-10],[149,-60]]],
  [[-24,0,143],[[-24,95],[60,95],[60,-120],[40.5,-120],[40.5,-132]]],
 ];
 for (const [start, route] of routes) walk(start, route);
});


test('the dense transfer sample keeps both loading doors, the workshop and its loot accessible',()=>{
 walk([-78,0,35],[[-78,17],[-78,-12],[-78,-25]]);
 walk([-115,0,-42],[[-78,-42],[-78,-25],[-78,30]]);
 walk([-41,0,22],[[-41,8],[-42,4]]);
 visible([-84,0,-11.4],'transit-tools');
 visible([-42,0,4],'workshop-supplies');
});


test('expanded plant and research interiors keep north/south doors and resource worktables reachable',()=>{
 for(const [x,z,d] of [[90,-32,36],[120,-76,30],[7,-113,24],[83,-156,28]])
  walk([x,0,z+d/2+3],[[x,z],[x,z-d/2-3]]);
 visible([83.6,0,-46.3],'plant-workshop');
 visible([1,0,-121.3],'research-office');
 visible([78.2,0,-166.3],'quarantine-samples');
 const edge=map.moveGrounded([227,0,20],5,0,radius,height);
 assert.ok(edge[0]<=228);
});

test('districts retain alternate approaches from the opposite side of the road network',()=>{
 walk([-115,0,-42],[[-120,-42],[-120,-37],[-129,-37]]);
 walk([-4,0,-12],[[-4,2],[-1,2],[-1,18]]);
 walk([149,0,-70],[[149,-10]]);
 walk([116,0,-56],[[116,-10]]);
 walk([-4,0,-90],[[-4,-95],[40.5,-95],[40.5,-132]]);
});

test('lab threshold has no rendered panel in the traversable opening at eye height', async()=>{
  const {Raycaster,Vector3}=await import('three');
  map.scene.updateMatrixWorld(true);
  for(const x of [38.55,40.5,40.9,42.5]) {
    const origin=[x,-3.75,-152.5],direction=[0,0,1];
    assert.equal(map.blockedDistance(origin,direction,3),null);
    const ray=new Raycaster(new Vector3(...origin),new Vector3(...direction),0,3);
    assert.equal(ray.intersectObject(map.scene,true).length,0,'rendered obstruction at '+x);
  }
});

test('every search case rests on a support surface and remains level after searching',async()=>{
  const {addSearchContainers}=await import('../src/app/containers.ts');
  const cases=addSearchContainers(map);
  for(const item of map.interactions.filter(item=>item.kind==='loot')){
    const drop=map.blockedDistance(item.position,[0,-1,0],1);
    assert.notEqual(drop,null,'no surface below '+item.id);
    const model=map.scene.getObjectByName('container-'+item.id);
    assert.ok(Math.abs(model.position.y+drop-item.position[1])<.001,item.id);
    cases.searched(item.id);
    assert.equal(model.rotation.z,0,item.id);
  }
});

test('each signed supply entrance is connected to a public road by a walkable approach',async()=>{
  const {siteApproaches}=await import('../src/world/supplySites.ts');
  const {roads}=await import('../src/world/roads.ts');
  for(const {points,site} of siteApproaches) {
    const [x,z]=points[0];
    assert.ok(roads.some(r=>x>=r.x1 && x<=r.x2 && z>=r.z1 && z<=r.z2),site.id);
    const forward=walk([x,0,z],[...points.slice(1),[site.x,site.z+4]]);
    walk(forward,[...points].reverse());
  }
});

test('arrivals, cargo control and bio transfer platforms can be crossed from either portal',()=>{
  for(const [x,z,depth] of [[-15,130,9],[12,113,10],[24,-84,8]]) {
    const front=z+depth/2+1.5, rear=z-depth/2-1.5;
    for(const offset of [-.95,.95]) walk([x+offset,0,front],[[x+offset,rear],[x+offset,front]]);
  }
});

test('freight court links the transfer shed, supply gate and both sides of the pallet stacks',async()=>{
  const {freightWalk}=await import('../src/world/roads.ts');
  const [start,...lane]=freightWalk;
  walk([start[0],0,start[1]],lane);
  walk([-72,0,95],[[-72,82],[-77,82],[-77,75],[-72,75],[-72,51]]);
  walk([-72,0,95],[[-72,85],[-68,85],[-68,75],[-72,75]]);
});

test('street blocks leave a continuous ground-floor passage under every upper floor',async()=>{
  const {portBlocks}=await import('../src/world/portBlocks.ts');
  for(const [x,z,,depth] of portBlocks) {
    const south=z+depth/2+.8,north=z-depth/2-.8;
    walk([x,0,south],[[x,north],[x,south]]);
    assert.ok(map.blockedDistance([x,1.65,z],[0,1,0],4)!==null);
  }
});
