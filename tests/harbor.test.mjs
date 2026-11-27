import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirstMap} from '../src/world/firstMap.ts';
import {findInteraction} from '../src/player/controller.ts';
import {Raycaster,Vector3} from 'three';
import {dispatchFloor,dispatchUpperY,gangways,harborInteractions,harborFloor,openContainerPlans,shipDeck,shipEnvelope,shipLevels} from '../src/world/harborPlan.ts';
import {mapBounds,mapViewBounds} from '../src/world/worldQueries.ts';
import {createRaid} from '../src/raid/raid.ts';

const map=createFirstMap(42), radius=.36,height=1.8;
function walk(start,points){let p=start;for(const [x,z] of points){const n=Math.max(1,Math.ceil(Math.hypot(x-p[0],z-p[2])/.07)),dx=(x-p[0])/n,dz=(z-p[2])/n;for(let i=0;i<n;i++)p=map.moveBody(p,dx,-.012,dz,radius,height);assert.ok(Math.hypot(x-p[0],z-p[2])<.08,`blocked: ${p} → ${[x,z]}`);}return p;}
function view(p,id){const t=map.interactions.find(e=>e.id===id),eye=[p[0],p[1]+1.65,p[2]],delta=t.position.map((v,i)=>v-eye[i]),d=Math.hypot(...delta);assert.ok(d<2.7,`${id}: ${d}m`);assert.equal(findInteraction(map,map.interactions,new Set(),eye,delta.map(v=>v/d))?.id,id);return t;}

test('offshore vessel is outside the land footprint, connected by two genuine slopes, not an ocean floor',()=>{
  assert.ok(shipEnvelope.maxX<mapBounds.minX);assert.equal(mapViewBounds.minX,shipEnvelope.minX);
  assert.equal(map.groundHeight([-180,.7,-38],radius),null);assert.equal(map.bodyClear([-180,.7,-38],radius,height),false);
  for(const g of gangways){let p=walk([-165,0,g.z],[[-172,g.z],[-188,g.z]]);assert.ok(Math.abs(p[1]-shipLevels.cabin)<.03);assert.equal(harborFloor(p),'船舱');p=walk(p,[[-165,g.z]]);assert.ok(Math.abs(p[1])<.03);}
  assert.equal(map.bodyClear([shipDeck.minX-1,shipLevels.upper,-32],radius,height),false);
});

test('both decks and the return route connect through the real stair well',()=>{
  const lower=walk([-165,0,-48],[[-188,-48],[-188,4],[-202,4],[-202,1]]);
  const top=walk(lower,[[-202,-13],[-202,-15],[-188,-15],[-188,-59]]);
  assert.ok(Math.abs(top[1]-shipLevels.upper)<.04);assert.equal(harborFloor(top),'上甲板');
  const back=walk(top,[[-188,-15],[-202,-15],[-202,-13],[-202,1],[-202,4],[-188,4],[-188,0],[-165,0]]);assert.ok(Math.abs(back[1])<.04);
  assert.ok(map.blockedDistance([-194,2.0,-60],[0,1,0],4)!==null,'deck ceiling has real collision');
});

test('the four open container models admit the playable body, with reachable distinct cases',()=>{
  for(const c of openContainerPlans){const start=[c.x,-.8,c.z+3.8],p=walk(start,[[c.x,c.z+2],[c.x,c.z-.55]]);view(p,'harbor-'+c.id);walk(p,[[c.x,c.z+3.8]]);assert.ok(map.blockedDistance([c.x,-.8+1.0,c.z],[1,0,0],2)!==null);}
});

test('ship reception, three cabins, lounge and upper service points can be inspected on the correct deck',()=>{
  view(walk([-188,.7,-61],[[-195,-61],[-202,-60.6]]),'ship-reception');
  for(const [id,z] of [['ship-cabin-a',-51],['ship-cabin-b',-43],['ship-cabin-c',-35]]){
    const p=walk([-188,.7,z+1],[[-194,z+1],[-194,z-1.4],[-203,z-1.4]]);view(p,id);
  }
  view(walk([-188,.7,-22],[[-203,-22]]),'ship-lounge');
  view(walk([-188,.7,-9],[[-196.5,-9]]),'ship-medical');
  view(walk([-188,.7,1.5],[[-196.1,1.5]]),'ship-luggage');
  view(walk([-188,4.1,-59],[[-197.2,-59]]),'ship-upper-service');
  view([-191.1,4.1,-19],'ship-upper-locker');
});

test('expanded passenger wing connects eight distinct rooms, the forward lounge and aft rooms to the old corridor',()=>{
  const hall=walk([-188,.7,0],[[-188,12],[-208.5,12]]);
  for(const [id,z] of [['ship-galley',-84],['ship-dining',-67],['ship-cabin-d',-51],['ship-cabin-e',-34],['ship-theater',-16],['ship-laundry',7],['ship-crew',25],['ship-bulk-storage',37]]){
    const room=walk(hall,[[-208.5,z],[-223.2,z]]);view(room,id);walk(room,[[-208.5,z]]);
  }
  view(walk(hall,[[-208.5,-83],[-204.3,-83]]),'ship-forward-lounge');
  for(const [id,z] of [['ship-aft-office',23],['ship-aft-quarters',36]])view(walk([-188,.7,12],[[-188,z],[-198.9,z]]),id);
});

test('two lower stairs plus accessible third deck and upper interior hall paths complete round trips',()=>{
  const bow=walk([-188,.7,-70],[[-188,-88]]);assert.ok(Math.abs(bow[1]-shipLevels.upper)<.04);assert.ok(Math.abs(walk(bow,[[-188,-70]])[1]-shipLevels.cabin)<.04);
  for(const [id,z] of [['ship-upper-library',-64],['ship-upper-cafe',-33]]){
    const room=walk([-188,4.1,-15],[[-206.5,-15],[-206.5,z],[-222.1,z]]);view(room,id);walk(room,[[-206.5,z]]);
  }
  for(const [id,z] of [['ship-upper-ballroom',22],['ship-upper-fitness',34]])view(walk([-188,4.1,12],[[-188,z],[-213.9,z]]),id);
  const roof=walk([-202,4.1,-15],[[-222,-15],[-222,9],[-222,26],[-222,30],[-213,30],[-213,33]]);
  assert.ok(Math.abs(roof[1]-shipLevels.sun)<.05);assert.equal(harborFloor(roof),'顶层甲板');view(roof,'ship-sun-service');
  const back=walk(roof,[[-213,30],[-222,30],[-222,26],[-222,9]]);assert.ok(Math.abs(back[1]-shipLevels.upper)<.04);
});

test('landside facilities have actual entrances, search surfaces and an upper office return route',()=>{
  view(walk([-137.5,0,-70],[[-137.5,-83],[-147,-83]]),'harbor-terminal-luggage');
  view(walk([-137.5,0,-70],[[-137.5,-92],[-128,-92]]),'harbor-terminal-desk');
  view(walk([-163.5,0,17],[[-163.5,31.4],[-164.4,31.4]]),'harbor-repair-tools');
  const kit=walk([-141,0,35],[[-141,44.8],[-133.9,44.8],[-133.9,49],[-132,49.52]]);
  assert.equal(dispatchFloor(kit),'1F');
  view(kit,'harbor-dispatch-kit');
  const entry=walk(kit,[[-133.9,49],[-133.9,44.8],[-141,44.8],[-141,35]]);
  assert.ok(Math.abs(entry[1])<.04);
  const office=walk([-141,0,35],[[-141,38.5],[-150,38.5],[-150,39],[-150,51],[-145,52],[-137,51.5]]);view(office,'harbor-dispatch-office');assert.ok(Math.abs(office[1]-3.48)<.04);
  const window=walk(office,[[-145,52],[-153,52],[-153,46.8]]);
  assert.ok(Math.abs(window[1]-dispatchUpperY)<.04);
  assert.equal(dispatchFloor(window),'2F');
  map.scene.updateMatrixWorld(true);
  const eye=new Vector3(window[0],window[1]+1.65,window[2]);
  const hits=new Raycaster(eye,new Vector3(-1,0,0),0,2.3).intersectObject(map.scene,true);
  assert.ok(hits.length&&hits.every(({object})=>object.material.transparent),'dispatch overlooks the water through glass');
  assert.ok(map.moveBody(window,-4,0,0,radius,height)[0]>-154,'the window still stops the player');
  const back=walk(window,[[-153,52],[-150,52],[-150,51],[-150,39],[-150,38.5],[-141,38.5],[-141,35]]);assert.ok(Math.abs(back[1])<.04);
});

test('new harbor search locations have real inventory containers and physical supporting surfaces',()=>{
  const raid=createRaid('harbor-check',42,map);for(const t of harborInteractions){assert.ok(map.scene.getObjectByName(t.id),t.id);assert.ok(raid.containers.has(t.id),t.id);assert.ok(map.blockedDistance([t.position[0],t.position[1]+.3,t.position[2]],[0,-1,0],.8)!==null,`${t.id} has no support`);}
});
