import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWarehouse, marketInterval } from '../src/raid/warehouse.ts';
import { createRaid } from '../src/raid/raid.ts';
import { arrangeStash, remainingStock, readStashLayout, saveStashLayout } from '../src/raid/stash.ts';

test('outpost purchases can be equipped, returned once on extraction, and lost on death', async () => {
  const records = new Map();
  const storage = {
    get length() { return records.size; },
    key: i => [...records.keys()][i] ?? null,
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
  };
  const stock = createWarehouse(() => storage, () => 0);
  assert.equal(stock.credits(), 600);
  for (const item of ['daypack', 'pistol', 'medkit', 'healing-injector']) assert.ok(await stock.buy(item));
  const plan = { pack: 'daypack', pistol: 'warehouse', knife: 'issued', 'healing-injector': 1, medkit: 1 };
  const map = {
    spawnPoints: [{ id: 's', position: [0, 0, 0], yaw: 0 }],
    interactions: [],
    exits: [{ id: 'highway', position: [0, 0, 0], radius: 2, requirements: [] }],
  };
  const cargo = await stock.deploy('first', plan);
  assert.ok(cargo);
  assert.deepEqual(stock.read(), {});
  assert.equal(await stock.deploy('unavailable', plan), undefined);
  const raid = createRaid('first', 42, map, plan, cargo);
  assert.equal(raid.backpack.equipped.item, 'daypack');
  assert.equal(raid.backpack.slots.pistol.loaded, 8);
  assert.equal(raid.backpack.entries.find(e => e.item === 'healing-injector').durability, 3);
  raid.update(5, [0, 0, 0], 100);
  assert.ok(stock.commit(raid.result) && stock.commit(raid.result));
  assert.equal(stock.read().daypack, 1);
  const second = await stock.deploy('second', plan);
  const failed = createRaid('second', 42, map, plan, second);
  failed.update(0, [0, 0, 0], 0);
  assert.ok(stock.commit(failed.result));
  assert.deepEqual(stock.read(), {});
  assert.equal(createWarehouse(() => storage).credits(), stock.credits());
});

test('legacy accounts keep their balance and a sale uses the active five-minute quote', async () => {
  const records = new Map([['wasteland-raid.market.v1', JSON.stringify({ credits: 50, sold: {} })]]);
  const storage = {
    get length() { return records.size; },
    key: i => [...records.keys()][i] ?? null,
    getItem: k => records.get(k) ?? null,
    setItem: (k, v) => records.set(k, v),
  };
  let now = 0;
  const stock = createWarehouse(() => storage, () => now);
  assert.equal(stock.credits(), 650);
  stock.commit({ runId: 'loot', outcome: 'extracted', items: { salvage: 1 } });
  const [first] = stock.market().offers;
  now = marketInterval - 1;
  assert.deepEqual(stock.market().offers, [first]);
  assert.equal(stock.market().refreshAt, marketInterval);
  now = marketInterval;
  const [second] = stock.market().offers;
  assert.notEqual(second.price, first.price);
  assert.ok(second.price >= 112 && second.price <= 168);
  assert.equal(await stock.sell('salvage', first.price), false);
  assert.equal(await stock.sell('salvage', second.price), true);
  assert.equal(createWarehouse(() => storage).credits(), 650 + second.price);
});

test('warehouse layout preserves ownership through rotation, split, reload, reserve and sort', () => {
  const storageRecords = new Map();
  const storage = { getItem:k=>storageRecords.get(k)??null, setItem:(k,v)=>storageRecords.set(k,v) };
  const stock = { 'pistol-ammo':132, rail:1, medkit:2, coil:2 };
  const stash=arrangeStash(stock);
  assert.deepEqual(stash.inventory(),stock);
  const rail=stash.entries.find(e=>e.item==='rail');
  assert.ok(stash.move(rail.id,8,5,true));
  const ammo=stash.entries.find(e=>e.item==='pistol-ammo');
  assert.ok(stash.split(ammo.id,5));
  saveStashLayout(storage,stash.entries);
  const reopened=arrangeStash(stock,readStashLayout(storage));
  assert.deepEqual(reopened.inventory(),stock);
  assert.equal(reopened.entries.find(e=>e.item==='rail').rotated,true);
  assert.equal(reopened.entries.find(e=>e.item==='rail').x,8);
  assert.equal(reopened.entries.filter(e=>e.item==='pistol-ammo').length,4);
  const reserved=remainingStock(stock,{'pistol-ammo':5,medkit:1,cargo:{coil:2}});
  const displayed=arrangeStash(reserved,readStashLayout(storage));
  assert.deepEqual(displayed.inventory(),{'pistol-ammo':127,rail:1,medkit:1});
  const sorted=arrangeStash(stock);
  assert.deepEqual(sorted.inventory(),stock);
  assert.equal(sorted.entries.filter(e=>e.item==='pistol-ammo').length,3);
});

test('prepared positions and carried materials survive actual requisition, and invalid layout cannot debit stock',async()=>{
  const records=new Map();
  const storage={get length(){return records.size;},key:i=>[...records.keys()][i]??null,getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)};
  const stock=createWarehouse(()=>storage,()=>0);
  stock.commit({runId:'loot',outcome:'extracted',exitId:'highway',items:{daypack:1,coil:1,medkit:1,'pistol-ammo':12}});
  const plan={pack:'daypack',pistol:'issued',knife:'issued',medkit:1,'pistol-ammo':12,cargo:{coil:1}};
  const preview=stock.preview(plan);
  assert.ok(preview);
  const coil=preview.entries.find(e=>e.item==='coil');
  assert.ok(preview.move(coil.id,3,0,true,'main'));
  const ammo=preview.entries.find(e=>e.item==='pistol-ammo');
  assert.ok(preview.split(ammo.id,7));
  plan.layout=preview.entries.map(({item,quantity,x,y,rotated,section,issued})=>({item,quantity,x,y,rotated,section,issued:issued??0}));
  const faulty={...plan,layout:plan.layout.map(e=>({...e,x:999}))};
  assert.equal(await stock.deploy('bad',faulty),undefined);
  assert.equal(stock.read().coil,1);
  const cargo=await stock.deploy('good',plan);
  assert.ok(cargo);
  assert.deepEqual(stock.read(),{});
  const map={spawnPoints:[{id:'s',position:[0,0,0],yaw:0}],interactions:[],exits:[{id:'highway',position:[0,0,0],radius:2,requirements:[]}]};
  const raid=createRaid('good',42,map,plan,cargo);
  assert.deepEqual(raid.backpack.entries.map(({item,quantity,x,y,rotated,section,issued})=>({item,quantity,x,y,rotated,section,issued:issued??0})),plan.layout);
  assert.equal(raid.backpack.inventory(true)['pistol-ammo'],12);
  raid.update(5,[0,0,0],100);
  assert.ok(stock.commit(raid.result));
  assert.deepEqual(stock.read(),{daypack:1,coil:1,medkit:1,'pistol-ammo':12});
});
