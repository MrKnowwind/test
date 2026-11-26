import assert from 'node:assert/strict';
import test from 'node:test';
import { createFirstMap } from '../src/world/firstMap.ts';
import { districtPoint as at } from '../src/world/layout.ts';
import { lab, rampHeight } from '../src/world/worldQueries.ts';
import { supplySites } from '../src/world/supplySites.ts';
import { Box3, Group, Raycaster, Vector3 } from 'three';
import { addSearchContainers } from '../src/app/containers.ts';
import { findInteraction } from '../src/player/controller.ts';
import { createRaid } from '../src/raid/raid.ts';
import { itemSpecs, packs } from '../src/raid/catalog.ts';
import { districtRoutes } from './fixtures/district-routes.mjs';
import { isLabLevel, labLift, researchPad, researchBuildingFloor, researchUpperY } from '../src/world/researchPlan.ts';
import { communityPad, residentialPad, southInteractions, transitPad } from '../src/world/southPlan.ts';
import { marketArea, marketInteractions, parkingPad, pharmacyPad } from '../src/world/marketPlan.ts';
import { innArea, innDoorX, innFloor, innInteractions, innPad, innStair, innUpperY } from '../src/world/innPlan.ts';
import { archivePad, observationPad, researchAnnexArea, researchAnnexInteractions, ridgeCrest } from '../src/world/researchAnnexPlan.ts';
import { tidalWalk } from '../src/world/terrainPlan.ts';

const map = createFirstMap(42);
const radius=.36, height=1.8;

test('the south loading pack is reachable and the seven ground packs have distinct physical bounds', () => {
  const target = map.interactions.find(t => t.id === 'evac-daypack');
  const eye = [-24, 1.65, 142.1];
  const delta = target.position.map((coordinate, index) => coordinate - eye[index]);
  const length = Math.hypot(...delta);
  const raid = createRaid('pack', 42, map);
  assert.equal(findInteraction(map, raid.targets, raid.consumed, eye, delta.map(v => v / length)), target);
  assert.ok(raid.equipPack(target.id, undefined, [-24, .18, 142.1]));
  assert.equal(raid.backpack.equipped.item, 'daypack');

  const interactions = Object.keys(packs).map((item, index) => ({
    id: item, kind: 'loose', item, label: itemSpecs[item].name, quantity: 1, position: [index, .18, 0],
  }));
  const scene = new Group();
  addSearchContainers({ scene, interactions, blockedDistance: () => .18 });
  const sizes = new Set(interactions.map(({id}) => {
    const root = scene.getObjectByName('goods-' + id);
    const bounds = new Box3().setFromObject(root);
    assert.ok(Math.abs(bounds.min.y) < .005, id + ' contacts the floor');
    return bounds.getSize(new Vector3()).toArray().map(n => n.toFixed(2)).join(',');
  }));
  assert.equal(sizes.size, interactions.length);
});

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

test('eight safe spawns can all walk to their one open, opposite-side extraction',()=>{
 assert.equal(map.spawnPoints.length,8);
 for(const {id,seed,waypoints} of districtRoutes){
  const raid=createRaid('route-'+id,seed,map);
  assert.equal(raid.spawn.id,id);
  assert.equal(map.bodyClear(raid.spawn.position,radius,height),true);
  assert.equal(map.groundHeight(raid.spawn.position,radius),raid.spawn.position[1]);
  const open=map.exits.filter(exit=>raid.exitStatus(exit).kind==='ready');
  assert.deepEqual(open.map(exit=>exit.id),[id[0]==='N'?'highway':'north-gate']);
  const [exit]=open;
  const closed=map.exits.find(other=>other.openForSpawnSide&&other!==exit);
  assert.equal(raid.exitStatus(closed).label,'本局未开放');
  assert.equal(raid.update(6,closed.position,100),'本局未开放');
  assert.equal(raid.countdown,undefined);
  assert.equal(raid.result,undefined);
  assert.equal(raid.exitStatus(map.exits.find(exit=>exit.id==='service-passage')).label,'维修卡未携带');
  assert.equal(raid.exitStatus(map.exits.find(exit=>exit.id==='lab-lift')).label,'需要开启实验室配电柜');
  const feet=walk(raid.spawn.position,waypoints);
  assert.ok(Math.abs(feet[1]-exit.position[1])<.001);
  raid.update(1,feet,100);
  assert.equal(raid.countdown.exit.id,exit.id);
  raid.update(4,feet,100);
  assert.equal(raid.result.exitId,exit.id);
 }
});

test('lab ramp and factory ramp both have continuous traversable height and return routes',()=>{
 const underground=walk([20.5,0,-2],[[20.5,-22]],'research');
 assert.equal(underground[1],lab.y);
 assert.equal(walk(underground,[[40.5,-132]])[1],researchPad.height);
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
 near(map.blockedDistance(at('research',[6,1.6,-29]),[0,-1,0],10),1.6);
 near(map.blockedDistance(at('research',[11,-3.8,-29]),[0,1,0],10),3.125);
 near(map.blockedDistance(at('research',[20.5,1,-10]),[0,-1,0],10),1+researchPad.height-rampHeight(-140));
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
 const [south,north]=map.exits.filter(exit=>exit.openForSpawnSide);
 assert.equal(south.position[2]-north.position[2],383);
 const routes = [
  [[-24,0,143],[[-24,95],[-115,95],[-115,27],[-129,27]]],
  [[-24,0,143],[[-24,95],[-4,95],[-4,32],[-4,18]]],
  [[-24,0,143],[[-24,155],[175,155],[175,-10],[149,-10],[149,-60]]],
  [[-24,0,143],[[-24,95],[60,95],[60,-70],[40.5,-70],[40.5,-132]]],
 ];
 for (const [start, route] of routes) walk(start, route);
});

test('cold chain and switchgear buildings have clear entrances and reachable supported search points',()=>{
 const cold=walk([38,0,0],[[38,23],[38,35]]);
 assert.equal(cold[1],3.6);
 for (const [feet,id] of [
  [walk(cold,[[38,43],[34.3,43]]),'cold-chain-intake'],
  [walk(cold,[[38,31.6],[32,31.6],[32,30.7]]),'cold-chain-medical'],
  [walk(cold,[[38,32],[42,32]]),'cold-chain-calibration'],
 ]) visible(feet,id);
 assert.ok(Math.abs(walk(cold,[[38,70]])[1])<.001);
 assert.ok(Math.abs(walk([38,0,70],[[38,0]])[1])<.001);
 const plant=walk([120,0,-57],[[120,-76]]);
 for (const [feet,id] of [
  [walk(plant,[[110.6,-76]]),'switchgear-diagnostics'],
  [walk(plant,[[120,-65],[129.2,-65]]),'switchgear-spares'],
  [walk(plant,[[120,-83],[127.5,-83]]),'switchgear-tools'],
 ]) visible(feet,id);
 walk(plant,[[120,-94]]);
});


test('the dense transfer sample keeps both loading doors, the workshop and its loot accessible',()=>{
 walk([-78,0,35],[[-78,17],[-78,-12],[-78,-25]]);
 walk([-115,0,-42],[[-78,-42],[-78,-25],[-78,30]]);
 walk([-41,0,22],[[-41,8],[-42,4]]);
 visible([-84,0,-11.4],'transit-tools');
 visible([-42,0,4],'workshop-supplies');
});


test('expanded plant and research interiors keep north/south doors and resource worktables reachable',()=>{
 for(const [x,z,d] of [[90,-32,36],[120,-76,30],[7,-113,24]])
  walk([x,0,z+d/2+3],[[x,z],[x,z-d/2-3]]);
 visible([83.6,0,-46.3],'plant-workshop');
 visible([1,0,-121.3],'research-office');
 const edge=map.moveGrounded([227,0,20],5,0,radius,height);
 assert.ok(edge[0]<=228);
});

test('the northern observation and archive facilities connect to the road and each other on foot', () => {
  const observation = walk([80,0,-196], [[80,-149],[80,-142.3]]);
  assert.equal(observation[1], observationPad.height);
  assert.equal(researchAnnexArea(observation), '隔离观察设施');
  assert.equal(researchAnnexArea([80,0,-142.3]), undefined);
  visible(walk(observation, [[80,-140.9],[75.3,-140.9]]), 'observation-intake');
  for (const [x, id] of [[84,'observation-medical'],[93,'quarantine-samples']])
    visible(walk(observation, [[x,-142.3],[x,-137.1]]), id);

  const archive = walk(observation, [[80,-150.1],[195,-150.1]]);
  assert.equal(archive[1], archivePad.height);
  assert.equal(researchAnnexArea(archive), '科研档案中心');
  visible(walk(archive, [[193,-150.1],[193,-142.1]]), 'annex-archive-files');
  visible(walk(archive, [[195,-151.5],[207,-151.5],[207,-150.2]]), 'annex-archive-reading');
  visible(walk(archive, [[195,-151.5],[217.4,-151.5],[217.4,-142.8]]), 'annex-archive-server');
  const road = walk(archive, [[195,-151.5],[223.8,-151.5],[223.8,-156.1],[195,-156.1],[195,-198]]);
  assert.equal(road[1], 0);
  assert.equal(walk(road, [[195,-150.1],[80,-150.1],[80,-196]])[1], 0);
  for (const target of researchAnnexInteractions) {
    assert.equal(map.interactions.filter(item => item.id === target.id).length, 1);
    assert.ok(!isLabLevel(target.position));
  }
  for (const id of ['district-infected-2', 'annex-archive-infected']) {
    const { position } = map.enemies.find(enemy => enemy.id === id);
    assert.equal(map.groundHeight(position, radius), position[1]);
    assert.ok(map.bodyClear(position, radius, height), id);
  }
});

test('the playable coastline, tidal walkway and ridge have matching render and collision heights', () => {
  const high = walk([195,0,-198], [[195,-156.1],[216,-156.1],[216,-217.8]]);
  assert.equal(high[1], ridgeCrest.height);
  assert.equal(researchAnnexArea(high), '东北山脊');
  assert.equal(walk(high, [[216,-156.1],[195,-156.1],[195,-198]])[1], 0);

  const low = walk([-160.5,0,62], [[-160.5,77]]);
  assert.equal(low[1], tidalWalk.height);
  assert.equal(high[1] - low[1], 22.5);
  assert.equal(walk(low, [[-160.5,93]])[1], 0);
  assert.equal(walk([-160.5,0,93], [[-160.5,62]])[1], 0);
  assert.equal(map.groundHeight([-171, 1, -204], radius), null);
  assert.equal(map.groundHeight([226, 1, 65], radius), null);
  assert.equal(map.groundHeight([214, 1, 173], radius), null);
  assert.equal(map.blockedDistance([-171,2,-204],[0,-1,0],3), null);
  assert.equal(map.bodyClear([-171,0,-204], radius, height), false);
  assert.equal(map.groundHeight([-162,0,-205], radius), 0);
  const edge = map.moveGrounded([-162,0,-205], -15, 0, radius, height);
  assert.ok(edge[0] > -165 && edge[0] < -164.4, 'the capsule stops against the actual shoreline');

  map.scene.updateMatrixWorld(true);
  function renderedFloor([x, y, z]) {
    const ray = new Raycaster(new Vector3(x,y + 3,z), new Vector3(0,-1,0), 0, 3.1);
    return ray.intersectObject(map.scene, true)[0]?.point.y;
  }
  for (const feet of [high, low, [-162,0,-204]]) {
    assert.ok(Math.abs(renderedFloor(feet) - feet[1]) < .05, 'rendered floor at ' + feet);
  }
  assert.equal(renderedFloor([-171,0,-204]), undefined);
});

test('districts retain alternate approaches from the opposite side of the road network',()=>{
 walk([-115,0,-42],[[-120,-42],[-120,-37],[-129,-37]]);
 walk([-4,0,-12],[[-4,2],[-1,2],[-1,18]]);
 walk([149,0,-70],[[149,-10]]);
 walk([116,0,-56],[[116,-10]]);
 walk([-65,0,-196],[[36,-196],[36,-174],[40.5,-174],[40.5,-152]]);
});

test('lab threshold has no rendered panel in the traversable opening at eye height', async()=>{
  const {Raycaster,Vector3}=await import('three');
  map.scene.updateMatrixWorld(true);
  for(const x of [38.55,40.5,40.9,42.5]) {
    const origin=[x,lab.y+1.65,-152.5],direction=[0,0,1];
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

test('freight mezzanines and shop balconies allow a round trip on foot to their search cases',async()=>{
  const {arcadeWidth, portBlocks, shopSide}=await import('../src/world/portBlocks.ts');
  const {freightHalls, galleryHeight, hasGallery}=await import('../src/world/upperRoutes.ts');
  const {findInteraction}=await import('../src/player/controller.ts');
  function traverse(feet, targets, id){
    for(const [x,z] of targets){
      const steps=Math.ceil(Math.hypot(x-feet[0],z-feet[2])/.07);
      const dx=(x-feet[0])/steps, dz=(z-feet[2])/steps;
      for(let i=0;i<steps;i++)feet=map.moveBody(feet,dx,-.014,dz,radius,height);
      assert.ok(Math.hypot(feet[0]-x,feet[2]-z)<.10,id+' blocked at '+feet);
    }
    return feet;
  }
  function visit(id,points,level){
    const [x,z]=points[0], feet=traverse([x,0,z],points.slice(1),id);
    assert.ok(Math.abs(feet[1]-level)<.1,id+' did not reach its floor');
    const target=map.interactions.find(item=>item.id===id),eye=[feet[0],feet[1]+1.65,feet[2]];
    const delta=target.position.map((v,i)=>v-eye[i]), distance=Math.hypot(...delta);
    assert.equal(findInteraction(map,map.interactions,new Set(),eye,delta.map(v=>v/distance))?.id,id);
    const back=traverse(feet,points.slice(0,-1).reverse(),id);
    assert.ok(Math.abs(back[1])<.10,id+' did not return to street level');
  }
  portBlocks.forEach(([x,z,w,d,,i])=>{
    if(!hasGallery(w,d))return;
    const side=shopSide(i),sx=x-side*(w/2-(w-arcadeWidth(i))/4),landing=z-d/2+1.05,deskZ=z-.1*d;
    visit('gallery-'+i,[[sx,z+d/2+.65],[sx,landing],[x,landing],[x,deskZ],[x+side*(w/2-2.26),deskZ]],galleryHeight);
  });
  freightHalls.forEach(([x,z,w,d,i])=>{
    const sx=x+w/2-1.5,low=z-d/2+1.2,bridge=z+d/2-2.1;
    visit('freight-loft-'+i,[[sx,low-.70],[sx,low+7.8],[sx,bridge],[x-w/2+3.38,bridge]],3.12);
  });
});

test('the playable body crosses port, B1 and new district ramp seams in both directions',async()=>{
  const {PerspectiveCamera}=await import('three');
  const {createPlayer}=await import('../src/player/controller.ts');
  for(const [start,end] of [
    [[-135,-.8,27],[-120,0,27]], [[140.5,0,-16],[140.5,3.2,-34]], [[40.5,researchPad.height,-130],[40.5,lab.y,-155]],
    [[26,0,-196],[26,1.8,-212]], [[38,0,0],[38,3.6,35]], [[38,0,70],[38,3.6,35]],
    [[40.5,0,-70],[40.5,researchPad.height,-130]], [[36,0,-196],[36,researchPad.height,-174]],
    [[-122.7,0,95],[-122.7,residentialPad.height,121]],
    [[-122.7,residentialPad.height,148],[-122.7,0,155.4]],
    [[27,0,95],[27,communityPad.height,116]], [[27,0,151],[27,communityPad.height,137]],
    [[123,0,158],[123,transitPad.height,130]], [[123,0,95],[123,transitPad.height,113]],
  ]){
    const player=createPlayer(new PerspectiveCamera(),map,{id:'seam',position:start,yaw:0});
    for(const to of [end,start]){
      player.pose(player.feet,Math.atan2(player.feet[0]-to[0],player.feet[2]-to[2]));
      const limit=Math.ceil(Math.hypot(to[0]-player.feet[0],to[2]-player.feet[2])*60/6.25)+6;
      for(let i=0;i<limit && Math.hypot(player.feet[0]-to[0],player.feet[2]-to[2])>.1;i++)
        player.move(1/60,{forward:1,strafe:0,lookX:0,lookY:0,running:true},false);
      assert.ok(Math.hypot(player.feet[0]-to[0],player.feet[2]-to[2])<.12,JSON.stringify({to,feet:player.feet}));
      assert.ok(Math.abs(player.feet[1]-to[1])<.02);
    }
  }
});

test('southern terraces connect both arterials and offer distinct, searchable public interiors',()=>{
 const home=walk([-122.7,0,95],[[-122.7,123],[-122.7,148]]);
 assert.equal(home[1],residentialPad.height);
 assert.ok(Math.abs(walk(home,[[-122.7,155.4]])[1])<.02);

 const court=walk([27,0,152],[[27,136],[27,122.15]]);
 assert.equal(court[1],communityPad.height);
 visible(walk(court,[[45.4,122.15]]),'community-medical');
 visible(walk(court,[[27,128.6],[36.35,128.6]]),'community-reception');
 visible(walk(court,[[27,128.6],[34.5,128.6],[34.5,127.5],[47.5,127.5],[47.5,128.3]]),'community-activity');
 assert.ok(Math.abs(walk(court,[[27,95]])[1])<.02);

 const station=walk([123,0,158],[[123,122]]);
 assert.equal(station[1],transitPad.height);
 visible(walk(station,[[136,122],[136,117.75]]),'transit-dispatch');
 visible(walk(station,[[143.5,122],[143.5,125.95]]),'transit-luggage');
 visible(walk(station,[[160.2,122],[160.2,120.5]]),'transit-catering');
 assert.ok(Math.abs(walk(station,[[123,95]])[1])<.02);
 const raid=createRaid('south-cases',42,map);
 for(const {id} of southInteractions) assert.ok(raid.containers.has(id),id);
 for(const enemy of map.enemies.filter(enemy=>['community-infected','transit-infected'].includes(enemy.id))){
   assert.equal(map.bodyClear(enemy.position,.36,1.8),true,enemy.id);
   assert.equal(map.groundHeight(enemy.position,.36),enemy.position[1],enemy.id);
 }
});

test('market stores, the single pharmacy and parking have continuous approaches and reachable cases',async()=>{
 const court=walk([-79.5,0,95],[[-79.5,119.4],[-66,119.4]]);
 assert.equal(marketArea(court),'生活商街');
 for(const [route,id] of [
  [[[-74,119.4],[-74,112.15]],'market-convenience'],
  [[[-67.2,119.4],[-67.2,114.25]],'market-hardware'],
  [[[-60.2,119.4],[-60.2,112.75]],'market-kitchen'],
 ]) visible(walk(court,route),id);
 const clinic=walk(court,[[-66,137.0]]);
 assert.equal(clinic[1],pharmacyPad.height);
 visible(walk(clinic,[[-70.45,137.0],[-71.2,137.0]]),'room-clinic-8');
 visible(walk(clinic,[[-66,133.6],[-63.4,133.6]]),'pharmacy-cold');
 visible(walk(clinic,[[-66,141.15],[-62.6,141.15]]),'pharmacy-treatment');
 assert.equal(map.interactions.filter(i=>i.label.startsWith('极光药局')).length,1);
 assert.equal(map.interactions.filter(i=>i.id==='room-clinic-8').length,1);

 const parking=walk([198,0,95],[[198,127]]);
 assert.equal(parking[1],parkingPad.height);
 visible(walk(parking,[[198,136],[203.6,136]]),'parking-charge');
 visible(walk(parking,[[198,142.96],[187.8,142.96],[187.8,139.5]]),'parking-booth');
 for(const {id,position} of marketInteractions){
   const support=map.blockedDistance(position,[0,-1,0],1);
   assert.ok(support!==null&&support<.10,id);
 }

 const {PerspectiveCamera}=await import('three');
 const {createPlayer}=await import('../src/player/controller.ts');
 for(const [start,ends] of [
  [[-66,0,155.8],[[-66,pharmacyPad.height,138],[-66,0,120]]],
  [[198,0,95],[[198,parkingPad.height,127],[198,0,155]]],
 ]){
   const player=createPlayer(new PerspectiveCamera(),map,{id:'market-route',position:start,yaw:0});
   for(const destination of [...ends,ends[0],start]){
     const [x,y,z]=destination, [px,,pz]=player.feet;
     player.pose(player.feet,Math.atan2(px-x,pz-z));
     const frames=Math.ceil(Math.hypot(px-x,pz-z)*10)+20;
     for(let i=0;i<frames&&Math.hypot(player.feet[0]-x,player.feet[2]-z)>.14;i++)
       player.move(1/60,{forward:1,strafe:0,lookX:0,lookY:0,running:true},false);
     assert.ok(Math.hypot(player.feet[0]-x,player.feet[2]-z)<.15&&Math.abs(player.feet[1]-y)<.025,
       JSON.stringify({destination,feet:player.feet}));
   }
 }
});

test('the main research building has an accessible second floor and a separate B1 projection', () => {
 const entry=walk([24,researchPad.height,-147],[[24,-155],[24,-157.8]]);
 assert.equal(researchBuildingFloor(entry),'1F');
 visible(walk(entry,[[18.4,-158.1]]),'research-intake');
 visible(walk(entry,[[30.7,-156.1]]),'research-bench');
 const top=walk(entry,[[29.8,-157.8],[29.8,-169.5],[22.4,-169.5],[22.4,-166.5]]);
 assert.equal(researchBuildingFloor(top),'2F');
 assert.equal(top[1],researchUpperY);
 visible(top,'research-upper');
 assert.equal(walk(top,[[29.8,-169.5],[29.8,-157.8],[24,-157.8],[24,-147]])[1],researchPad.height);
 for (const y of [lab.y,researchPad.height,researchUpperY]) {
   const feet=[labLift[0],y,labLift[2]];
   assert.equal(isLabLevel(feet),y===lab.y);
   assert.ok(Math.abs(map.groundHeight(feet,radius)-y)<.01);
 }
 const raid=createRaid('raised-lift',42,map);
 raid.interact('lab-power-panel');
 raid.update(12,[labLift[0],researchPad.height,labLift[2]],100);
 assert.equal(raid.result,undefined);
 raid.interact('lab-power-panel');
 raid.update(12,labLift,100);
 assert.equal(raid.result.exitId,'lab-lift');
});

test('seafarers inn connects its approach ramps, stair and three distinct guest rooms',async()=>{
 const lobby=walk([innDoorX,0,155],[[innDoorX,129.5]]);
 assert.equal(lobby[1],innPad.height);
 assert.equal(innArea(lobby),'海员旅馆 · 1F');
 visible(walk(lobby,[[93.4,130.23]]),'inn-reception');
 visible(walk(lobby,[[innDoorX,122.1],[89.65,122.1]]),'inn-linen');
 visible(walk(lobby,[[innDoorX,116.7],[90.05,116.7]]),'inn-luggage');
 assert.ok(Math.abs(walk(lobby,[[innDoorX,95]])[1])<.001);
 const upper=walk(lobby,[[innStair.x,129.5],[innStair.x,115.7],[99.1,115.7]]);
 assert.equal(upper[1],innUpperY);
 assert.equal(innFloor(upper),'2F');
 for(const [z,id] of [[117.1,'inn-crew'],[124.4,'inn-twin'],[132.4,'inn-corner']]){
   visible(walk(upper,[[99.1,z],[90.75,z]]),id);
 }
 const downstairs=walk(upper,[[innStair.x,115.7],[innStair.x,129.5],[innDoorX,129.5]]);
 assert.equal(downstairs[1],innPad.height);
 assert.ok(Math.abs(walk(downstairs,[[innDoorX,155]])[1])<.001);

 const raid=createRaid('inn-layout',42,map);
 for(const {id,position} of innInteractions){
   assert.ok(raid.containers.has(id),id);
   const hit=map.blockedDistance(position,[0,-1,0],.10);
   assert.ok(hit!==null&&hit<.10,id);
 }
 const ceiling=map.blockedDistance([88.6,innPad.height+1.65,117.1],[0,1,0],3);
 assert.ok(ceiling!==null&&ceiling<2.1);
 const guard=map.enemies.find(enemy=>enemy.id==='inn-infected');
 assert.ok(map.bodyClear(guard.position,radius,height));
 assert.equal(map.groundHeight(guard.position,radius),innPad.height);

 const {PerspectiveCamera}=await import('three');
 const {createPlayer}=await import('../src/player/controller.ts');
 const start=[innDoorX,0,155];
 const player=createPlayer(new PerspectiveCamera(),map,{id:'inn-test',position:start,yaw:0});
 for(const [x,y,z] of [[innDoorX,innPad.height,130],[innStair.x,innPad.height,130],
   [innStair.x,innUpperY,115.7],[innStair.x,innPad.height,130],[innDoorX,innPad.height,130],
   [innDoorX,0,95],[innDoorX,innPad.height,130],start]){
   const [px,,pz]=player.feet;
   player.pose(player.feet,Math.atan2(px-x,pz-z));
   const frames=Math.ceil(Math.hypot(px-x,pz-z)*11)+15;
   for(let i=0;i<frames&&Math.hypot(player.feet[0]-x,player.feet[2]-z)>.14;i++)
     player.move(1/60,{forward:1,strafe:0,lookX:0,lookY:0,running:true},false);
   assert.ok(Math.hypot(player.feet[0]-x,player.feet[2]-z)<.15&&Math.abs(player.feet[1]-y)<.03,
     JSON.stringify({goal:[x,y,z],feet:player.feet}));
 }
});
