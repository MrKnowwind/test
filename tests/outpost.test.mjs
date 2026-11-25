import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWarehouse, marketInterval } from '../src/raid/warehouse.ts';
import { createRaid } from '../src/raid/raid.ts';

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
