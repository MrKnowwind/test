import assert from 'node:assert/strict';
import test from 'node:test';
import {createWarehouse} from '../src/raid/warehouse.ts';
import {createRaid} from '../src/raid/raid.ts';
import {createBackpack} from '../src/raid/backpack.ts';
import {createCombat} from '../src/combat/createCombat.ts';
import {createTreatment} from '../src/combat/treatment.ts';
import {arrangeStash,stashFits} from '../src/raid/stash.ts';
import {shields} from '../src/raid/catalog.ts';

const map={spawnPoints:[{id:'s',position:[0,0,0],yaw:0}],interactions:[],exits:[{id:'road',position:[0,0,0],radius:2,requirements:[]}]};
function fixture(){const records=new Map();const storage={get length(){return records.size;},key:i=>[...records.keys()][i]??null,getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value)};return {storage,records,stock:createWarehouse(()=>storage,()=>1000)};}

test('five shield tiers, partial absorption, recharge interruption and exact consumption',()=>{
  assert.deepEqual(Object.values(shields),[25,50,75,100,125]);
  const bag=createBackpack(3,2,true);bag.slots.shield={item:'shield-white',quantity:1,charge:30};bag.add('shield-cell',2);
  const enemy={id:'near',kind:'infected',position:[0,0,-1.2],yaw:0};
  const world={moveGrounded:([x,y,z],dx,dz)=>[x+dx,y,z+dz],blockedDistance:()=>null};
  const combat=createCombat(world,[enemy],bag),input={playerFeet:[0,0,0],eye:[0,1.65,0],aimDirection:[0,0,-1],muzzle:[0,1.65,0],attackPressed:false,reloadPressed:false,aiming:false};
  combat.update(0,input);const hit=combat.update(.46,input);assert.equal(hit.health,100);assert.equal(hit.shield.charge,0);assert.equal(hit.shieldHit,25);
  const treatment=createTreatment(bag),id=bag.entries.find(e=>e.item==='shield-cell').id;
  assert.ok(treatment.start(id,100));treatment.advance(1.59,false,100);treatment.advance(.01,true,100);assert.equal(bag.inventory()['shield-cell'],2);assert.equal(bag.slots.shield.charge,0);
  assert.ok(treatment.start(id,100));treatment.advance(1.6,false,100);assert.equal(bag.inventory()['shield-cell'],1);assert.equal(combat.snapshot().shield.charge,25);assert.equal(treatment.start(id,100),false);
  bag.slots.shield.charge=10;combat.update(.18,input);combat.update(.4,input);combat.update(.45,input);const next=combat.update(.01,input);assert.equal(next.health,85);assert.equal(next.shield.charge,0);
});

test('gear can move from bag to slots and return with exact charge; settlement and maintenance are idempotent',async()=>{
  const {stock,storage}=fixture();stock.commit({runId:'loot',outcome:'extracted',exitId:'road',items:{'shield-green':1,'head-survey':1,'shield-cell':2},instances:[{item:'shield-green',quantity:1,instance:'original',charge:11}]});
  const plan={shield:'shield-green',head:'head-survey','shield-cell':2};const cargo=await stock.deploy('gear',plan);assert.ok(cargo);
  const raid=createRaid('gear',0,map,plan,cargo);assert.equal(raid.backpack.slots.shield.charge,11);assert.equal(raid.backpack.slots.head.item,'head-survey');
  assert.ok(raid.stow('shield'));const entry=raid.backpack.entries.find(e=>e.item==='shield-green');assert.equal(entry.charge,11);assert.ok(raid.holster(entry.id));raid.backpack.slots.shield.charge=8;
  raid.backpack.takePart(raid.backpack.entries.find(e=>e.item==='shield-cell').id,1);raid.update(5,[0,0,0],100);
  assert.ok(stock.commit(raid.result,cargo));assert.ok(stock.commit(raid.result,cargo));assert.equal(stock.read()['shield-green'],1);assert.equal(stock.condition('shield-green').charge,8);
  const settlement=stock.settlement(raid.result,cargo);assert.equal(settlement.lost['shield-cell'],1);assert.ok(settlement.net<0);assert.equal(stock.history().filter(r=>r.runId==='gear').length,1);
  const repair=stock.repairQuote('shield-green'),balance=stock.credits();assert.ok(await stock.repair('shield-green',repair.price));assert.equal(await stock.repair('shield-green',repair.price),false);assert.equal(stock.credits(),balance-repair.price);assert.equal(createWarehouse(()=>storage).condition('shield-green').charge,50);
});

test('warehouse expansion and overflow preservation; exchanges consume materials once',async()=>{
  const {stock,storage}=fixture();stock.commit({runId:'bulk',outcome:'extracted',exitId:'road',items:{salvage:31,coil:1,terminal:1}});assert.equal(stock.capacity().overflow,true);assert.equal(await stock.buy('head-scout'),false);assert.deepEqual(arrangeStash(stock.read()).inventory(),stock.read());
  assert.ok(await stock.expand());assert.equal(stock.capacity().limit,160);assert.equal(stock.capacity().overflow,false);assert.ok(stashFits(stock.read(),16));assert.ok(await stock.exchange('cell'));assert.equal(await stock.exchange('cell'),false);assert.equal(stock.read()['shield-cell'],3);assert.equal(stock.read().coil,undefined);assert.equal(stock.read().terminal,undefined);assert.equal(createWarehouse(()=>storage).capacity().rows,16);
});

test('searched gear equips directly and a previous shield keeps its individual condition',()=>{
  const raid=createRaid('direct',0,map,{shield:'shield-white'},[{item:'shield-white',quantity:1,instance:'old',charge:3}]);
  const entry={item:'shield-purple',quantity:1,instance:'found',charge:40,id:1,x:0,y:0,rotated:false,section:'grid',progress:0,duration:2,revealed:false};
  raid.containers.set('case',{id:'case',width:4,height:3,entries:[entry]});
  assert.equal(raid.equipFromContainer('case',1,'shield'),false);entry.revealed=true;assert.equal(raid.equipFromContainer('case',1,'head'),false);assert.ok(raid.equipFromContainer('case',1,'shield'));assert.equal(raid.backpack.slots.shield.charge,40);assert.equal(raid.backpack.entries.find(e=>e.instance==='old').charge,3);assert.equal(raid.equipFromContainer('case',1,'shield'),false);
});

test('withdrawal across warehouse views is exclusive and practice restores only the requisition',async()=>{
  const {stock,storage}=fixture();assert.ok(await stock.buy('shield-white'));const other=createWarehouse(()=>storage),plan={shield:'shield-white'};
  const [a,b]=await Promise.all([stock.deploy('a',plan),other.deploy('b',plan)]);assert.equal([a,b].filter(Boolean).length,1);const cargo=a??b,runId=a?'a':'b';
  const raid=createRaid(runId,0,map,plan,cargo);raid.setCreative(true);raid.generateItem('shield-red',1);raid.abandon();assert.ok(stock.commit(raid.result,cargo));assert.ok(other.commit(raid.result,cargo));assert.equal(stock.read()['shield-white'],1);assert.equal(stock.read()['shield-red'],undefined);assert.equal(stock.history().find(r=>r.runId===runId).net,0);
  assert.ok(await other.deploy('next',plan));assert.deepEqual(await stock.deploy(runId,plan),cargo);assert.equal(stock.read()['shield-white'],undefined);
});
