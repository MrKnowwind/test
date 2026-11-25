import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRaid } from '../src/raid/raid.ts';
import { createWarehouse } from '../src/raid/warehouse.ts';

const spawns = [
  { id: 'south', position: [0, 0, 3], yaw: 0 },
  { id: 'alley', position: [4, 0, 0], yaw: 1 },
  { id: 'yard', position: [-4, 0, 0], yaw: 2 },
];
const map = {
  spawnPoints: spawns,
  interactions: [{ id: 'crate', kind: 'loot', label: 'crate', item: 'salvage', quantity: 2, position: [0, 0, 2] }],
  exits: [{ id: 'road', label: 'road', position: [0, 0, 0], radius: 2, requirements: [] }],
};

function collect(raid,id) {
 raid.searchContainer(id,30);
 const entries=[...raid.containers.get(id).entries];
 const item=entries[0].item;
 let quantity=0;
 for(const entry of entries.filter(e=>e.item===item)) if(raid.takeContainerItem(id,entry.id))quantity+=entry.quantity;
 assert.ok(quantity>0);
 return {[item]:quantity};
}

test('a fixed seed always chooses the same complete candidate and different seeds cover all candidates', () => {
  const candidates = new Set();
  for (let seed = 0; seed < 32; seed += 1) {
    const first = createRaid('a', seed, map).spawn;
    assert.deepEqual(createRaid('b', seed, map).spawn, first);
    assert.ok(spawns.some((candidate) => candidate === first));
    candidates.add(first.id);
  }
  assert.equal(candidates.size, 3);
});

test('leave the road exit to cancel, then restart the full count and settle the pickup once', () => {
  const raid = createRaid('road-run', 1, map);
  const picked=collect(raid,'crate');
  assert.equal(raid.interact('crate'), undefined);
  raid.update(0, [0, 0, 0], 100, true);
  raid.update(4.9, [0, 0, 0], 100);
  assert.ok(raid.countdown);
  raid.update(0.2, [0, 0, 3], 100);
  assert.equal(raid.countdown, undefined);
  raid.update(0, [0, 0, 0], 100, true);
  raid.update(0.2, [0, 0, 0], 100);
  assert.equal(raid.result, undefined);
  raid.update(4.8, [0, 0, 0], 100);
  assert.equal(raid.result.exitId,'road');
  assert.equal(raid.result.outcome,'extracted');
  assert.deepEqual(raid.result.items,picked);
  const result = raid.result;
  raid.update(1, [0, 0, 0], 0, true);
  assert.equal(raid.result, result);
});

test('maintenance checks the carried card and lab power only applies to the current raid', () => {
  const maintenance = { id: 'maintenance', label: 'maintenance', position: [6, 0, 0], radius: 2,
    requirements: [{ kind: 'item', id: 'service-card' }] };
  const elevator = { id: 'elevator', label: 'elevator', position: [0, -5, 0], radius: 2,
    requirements: [{ kind: 'flag', id: 'lab-power' }] };
  const conditionalMap = {
    ...map,
    exits: [...map.exits, maintenance, elevator],
    interactions: [
      { id: 'duty-card', kind: 'loot', item: 'service-card', quantity: 1 },
      { id: 'breaker', kind: 'switch', flag: 'lab-power' },
    ],
  };
  const raid = createRaid('maintenance', 0, conditionalMap);
  assert.equal(raid.update(0, maintenance.position, 100, true), '维修卡未携带');
  collect(raid,'duty-card');
  raid.update(0, maintenance.position, 100, true);
  raid.update(5, maintenance.position, 100);
  assert.equal(raid.result.exitId, 'maintenance');
  assert.deepEqual(raid.result.items, { 'service-card': 1 });

  const lab = createRaid('lab', 0, conditionalMap);
  assert.equal(lab.exitAt([0, -3, 0]), undefined);
  assert.equal(lab.update(0, elevator.position, 100, true), '需要开启实验室配电柜');
  lab.interact('breaker');
  lab.update(0, elevator.position, 100, true);
  lab.update(5, elevator.position, 100);
  assert.equal(lab.result.exitId, 'elevator');
  assert.equal(createRaid('next', 0, conditionalMap).blockedReason(elevator), '需要开启实验室配电柜');
});

test('lethal damage on the final tick wins over extraction and discards loot', () => {
  const raid = createRaid('lost', 0, map);
  const picked=collect(raid,'crate');
  raid.update(0, [0, 0, 0], 100, true);
  raid.update(5, [0, 0, 0], 0);
  assert.deepEqual(raid.items, {});
  assert.equal(raid.result.outcome,'dead');
  assert.deepEqual(raid.result.items,{});
  for(const [item,n] of Object.entries(picked))assert.ok(raid.result.lost[item]>=n);
  const abandoned = createRaid('left', 0, map);
  collect(abandoned,'crate');
  abandoned.abandon();
  assert.deepEqual(abandoned.items, {});
  assert.equal(abandoned.result.outcome, 'abandoned');
});

test('warehouse retries a rejected write, then keeps both runs across reloads without double credit', () => {
  const data = new Map();
  let canWrite = false;
  const storage = {
    get length() { return data.size; },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem(key, value) {
      if (!canWrite) throw new Error('storage unavailable');
      data.set(key, value);
    },
  };
  const warehouse = createWarehouse(() => storage);
  const result = { runId: 'one', outcome: 'extracted', exitId: 'road', items: { salvage: 2 } };
  assert.equal(warehouse.commit(result), false);
  assert.deepEqual(warehouse.read(), {});
  canWrite = true;
  assert.equal(warehouse.commit(result), true);
  const reopened = createWarehouse(() => storage);
  assert.equal(reopened.commit({ ...result, items: { salvage: 999 } }), true);
  assert.equal(reopened.commit({ ...result, runId: 'two', items: { 'research-sample': 1 } }), true);
  assert.equal(reopened.commit({ ...result, runId: 'three', outcome: 'dead' }), true);
  assert.deepEqual(warehouse.read(), { salvage: 2, 'research-sample': 1 });
});

test('supplies take backpack space and can be carried out with loot', () => {
  const raid = createRaid('primary-supply', 1, {
    ...map,
    interactions: [
      { id: 'ammo', kind: 'loose', item: 'pistol-ammo', quantity: 20 },
      { id: 'medkit', kind: 'loose', item: 'medkit', quantity: 1 },
    ],
  });
  assert.ok(raid.collect('ammo'));
  assert.ok(raid.collect('medkit'));
  assert.equal(raid.items['pistol-ammo'],35);
  assert.equal(raid.items.medkit,1);
  raid.update(0, [0, 0, 0], 100, true);
  raid.update(5, [0, 0, 0], 100);
  assert.deepEqual(raid.result.items, { 'pistol-ammo': 20, medkit: 1 });
});

test('selling extracted stock credits once and persists after reopening the warehouse', async () => {
  const records = new Map();
  const storage = {
    get length() { return records.size; },
    key: index => [...records.keys()][index] ?? null,
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
  };
  const market = createWarehouse(() => storage, () => 0);
  market.commit({ runId: 'sale', outcome: 'extracted', exitId: 'road', items: { salvage: 1 } });
  const before = market.credits(), quote = market.price('salvage');
  assert.deepEqual(await Promise.all([market.sell('salvage'), market.sell('salvage')]), [true, false]);
  const reopened = createWarehouse(() => storage);
  assert.deepEqual(reopened.read(), {});
  assert.equal(reopened.credits(), before + quote);
  assert.equal(await reopened.sell('salvage'), false);
});

test('discarding the required card cancels an active conditional extraction', () => {
  const conditional = {
    ...map,
    interactions: [{ id: 'duty-card', kind: 'loot', item: 'service-card', quantity: 1 }],
    exits: [{ ...map.exits[0], requirements: [{ kind: 'item', id: 'service-card' }] }],
  };
  const raid = createRaid('discard-card', 1, conditional);
  collect(raid,'duty-card');
  raid.update(0, [0, 0, 0], 100, true);
  raid.backpack.remove(raid.backpack.entries.find(e=>e.item==='service-card').id);
  raid.update(5, [0, 0, 0], 100);
  assert.equal(raid.result, undefined);
  assert.equal(raid.countdown, undefined);
});

test('remote lift keeps its scheduled departure, can be recalled and requires the correct floor at departure', () => {
  const exit = {id:'lift', label:'货梯', remote:{flag:'lab-power',seconds:12}, position:[16,-5.4,-155],
    radius:1.85, requirements:[{kind:'flag',id:'lab-power'}]};
  const panel = {id:'panel',kind:'switch',flag:'lab-power'};
  const run = createRaid('lift-window',42,{...map,exits:[...map.exits,exit],interactions:[panel]});
  assert.ok(run.interact(panel.id));
  run.update(2, exit.position, 100);
  assert.equal(run.interact(panel.id),undefined);
  run.update(9, [16,0,-155], 100);
  assert.equal(run.liftWindow.remaining,1);
  run.update(1,[16,0,-155],100);
  assert.equal(run.result,undefined);
  assert.equal(run.liftWindow,undefined);
  assert.ok(run.interact(panel.id));
  run.update(12, exit.position,100);
  assert.equal(run.result.exitId,'lift');
});

test('local extraction and a remote window resolve independently with death first',()=>{
  const exit={...map.exits[0],id:'lift',remote:{flag:'lab-power',seconds:5}};
  const config={...map,exits:[...map.exits,exit],interactions:[{id:'panel',kind:'switch',flag:'lab-power'}]};
  for(const health of [0,100]){
    const raid=createRaid('overlap',42,config);
    raid.interact('panel');raid.update(2,exit.position,100);
    assert.equal(raid.liftWindow.remaining,3);
    raid.update(3,exit.position,health);
    assert.equal(raid.result.outcome,health?'extracted':'dead');
    if(health)assert.equal(raid.result.exitId,'road');
  }
});
