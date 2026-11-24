import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackpack } from '../src/raid/backpack.ts';
import { packs } from '../src/raid/catalog.ts';
import { createContainerSearch } from '../src/raid/containerSearch.ts';
import { drawLoose, tier, tiers } from '../src/raid/loot.ts';
import { createRaid } from '../src/raid/raid.ts';
import { mapInteractions } from '../src/world/environment.ts';

const at = [0, 0, 0];
const spot = (section, x = 0, y = 0, rotated = false) => ({ section, x, y, rotated });
const cargo = (item) => ({ item, quantity: 1 });
const bagWith = (item) => {
  const bag = createBackpack(3, 2, true);
  bag.swap(cargo(item));
  return bag;
};

test('a lone district red has 15 of 10000 intervals, with reproducible empty and red field seeds', () => {
  const buckets = Array(7).fill(0);
  for (let i = 0; i < 10000; i++) buckets[tier(tiers.district, (i + 0.5) / 10000)]++;
  assert.deepEqual(buckets, [3635, 3200, 1700, 900, 400, 150, 15]);
  const core = (seed) => drawLoose(seed, 'open-factory-salvage', 'electronics', 'district', ['core']);
  assert.equal(core(0), undefined);
  assert.equal(core(48), 'core');
  assert.equal(
    drawLoose(14, 'open-yard-salvage', 'shipping', 'district', ['rail', 'sealbag', 'lens']),
    'rail',
  );
});

test('seeded cases are independent of map iteration and emergency stocks remain available', () => {
  const boxes = createContainerSearch(32, mapInteractions).containers;
  const reversed = createContainerSearch(32, [...mapInteractions].reverse()).containers;
  for (const [id, box] of boxes) assert.deepEqual(box, reversed.get(id));
  const small = boxes.get('plant-workshop'),
    big = boxes.get('transit-tools');
  assert.deepEqual([small.width, small.height, big.width, big.height], [4, 2, 6, 4]);
  assert.ok(big.entries.length > small.entries.length);
  for (const [id, item] of [
    ['triage-stock', 'medkit'],
    ['depot-stock', 'pistol-ammo'],
    ['duty-card', 'service-card'],
  ]) {
    assert.equal(boxes.get(id).entries[0].item, item);
  }
  assert.ok(boxes.get('lab-research').entries.some((e) => e.item === 'research-sample'));
  assert.ok(
    !createContainerSearch(0, mapInteractions)
      .containers.get('lab-research')
      .entries.some((e) => e.item === 'research-sample'),
  );
  for (const [id, b] of boxes)
    if (!id.startsWith('lab-')) assert.ok(!b.entries.some((e) => e.item === 'research-sample'));
});

test('seven independent pack layouts, side pockets and rotated long cargo', () => {
  assert.deepEqual(
    Object.values(packs).map((ss) => ss.reduce((sum, s) => sum + s.w * s.h, 0)),
    [10, 16, 16, 16, 30, 54, 56],
  );
  const repair = bagWith('repairpack'),
    basic = bagWith('daypack');
  for (const bag of [basic, repair]) assert.ok(bag.receive(cargo('pump'), spot('main')));
  assert.ok(!basic.canPlace('gauge', 0, 3, false, 1, 'main'));
  assert.ok(repair.receive(cargo('gauge'), spot('side')));
  const alpine = bagWith('alpine');
  for (const id of ['l', 'r']) assert.ok(alpine.receive(cargo('turbine'), spot(id, 0, 0, true)));
  assert.ok(alpine.receive(cargo('wrench'), spot('top')));
  const long = bagWith('longpack');
  assert.ok(!long.receive(cargo('rail'), spot('main')));
  assert.ok(long.receive(cargo('rail'), spot('main', 0, 0, true)));
  assert.ok(!bagWith('alpine').receive(cargo('rail')));
  assert.ok(!long.receive(cargo('gauge'), spot('nonexistent')));
});

test('swapping a loaded bag cancels card extraction, retains its inventory, and recovers it only once', () => {
  const raid = createRaid('swap', 2, {
    spawnPoints: [{ id: 'start', position: at, yaw: 0 }],
    interactions: ['daypack', 'repairpack', 'service-card'].map((item) => ({
      kind: 'loose',
      id: item,
      item,
      quantity: 1,
      position: at,
    })),
    exits: [{ id: 'service', position: at, radius: 2, requirements: [{ kind: 'item', id: 'service-card' }] }],
  });
  assert.ok(raid.equipPack('daypack', undefined, at));
  assert.ok(raid.collect('service-card'));
  const card = raid.backpack.entries.find((e) => e.item === 'service-card');
  assert.ok(raid.backpack.move(card.id, 0, 0, false, 'main'));
  raid.update(0, at, 100, true);
  assert.ok(raid.countdown);
  const snapshot = structuredClone(raid.backpack.entries);
  assert.equal(raid.equipPack('absent', undefined, at), undefined);
  assert.deepEqual(raid.backpack.entries, snapshot);
  const old = raid.equipPack('repairpack', undefined, at).dropped;
  assert.equal(raid.countdown, undefined);
  assert.equal(raid.items['service-card'], undefined);
  assert.equal(raid.collect(old.id), false);
  assert.equal(raid.ground.get(old.id).instance, 'swap/daypack');
  const source = raid.groundContainer(old.id);
  assert.ok(raid.takeContainerItem(old.id, source.entries[0].id));
  assert.equal(raid.ground.get(old.id).contents.length, 0);
  assert.ok(raid.collect(old.id));
  assert.ok(!raid.collect(old.id));
  raid.update(0, at, 100, true);
  raid.update(5, at, 100);
  assert.deepEqual(raid.result.items, { daypack: 1, repairpack: 1, 'service-card': 1 });
  assert.equal(new Set(raid.result.instances.map((e) => e.instance)).size, 3);
});

test('weapon instances, magazine and issued ammo survive packing, dropping and re-equipping', () => {
  const raid = createRaid('arms', 0, {
    spawnPoints: [{ id: 'start', position: at, yaw: 0 }],
    interactions: [],
    exits: [],
  });
  const gun = raid.backpack.slots.pistol;
  gun.loaded = 3;
  assert.ok(raid.stow('pistol'));
  const entry = raid.backpack.entries.find((e) => e.item === 'pistol');
  const dropped = raid.dropCarried(entry.id, at);
  assert.ok(raid.collect(dropped.id));
  assert.ok(raid.holster(raid.backpack.entries.find((e) => e.item === 'pistol').id));
  assert.deepEqual(
    [
      raid.backpack.slots.pistol.instance,
      raid.backpack.slots.pistol.loaded,
      raid.backpack.slots.pistol.issued,
    ],
    [gun.instance, 3, 1],
  );
  assert.ok(raid.backpack.add('pistol-ammo', 8));
  assert.equal(raid.backpack.takeAmmo(16), 16);
  assert.deepEqual(raid.backpack.inventory(true), { 'pistol-ammo': 7 });
});

test('split stacks, transfer in both directions and drop while preserving quantities and issued ammunition',()=>{
  const raid=createRaid('split-proof',42,{spawnPoints:[{id:'test',position:at,yaw:0}],
    interactions:[{id:'test-case',kind:'loot',label:'箱',item:'pistol-ammo',quantity:8,position:at}],exits:[]});
  const bag=raid.backpack,box=raid.containers.get('test-case');
  box.entries.length=0;
  assert.ok(bag.receive({item:'pistol-ammo',quantity:4}));
  const first=bag.entries[0];
  assert.ok(!bag.split(first.id,19));
  assert.ok(bag.split(first.id,8));
  const separate=bag.entries.find(e=>e.id!==first.id);
  assert.equal(bag.ammoCount(),19);
  assert.ok(bag.quickMove(separate.id));
  assert.ok(raid.putContainerItem(box.id,separate.id));
  const stored=box.entries[0];
  assert.deepEqual([stored.quantity,stored.issued,stored.revealed],[8,8,true]);
  assert.ok(raid.takeContainerItem(box.id,stored.id,undefined,3));
  assert.equal(box.entries[0].quantity,5);
  assert.ok(raid.takeContainerItem(box.id,stored.id));
  assert.ok(raid.consumed.has(box.id));
  assert.ok(raid.putContainerItem(box.id,first.id));
  assert.ok(!raid.consumed.has(box.id));
  const floor=raid.discardSource(box.id,box.entries[0].id,at);
  assert.ok(raid.collect(floor.id));assert.ok(!raid.collect(floor.id));
  assert.equal(bag.ammoCount(),19);
  assert.deepEqual(bag.inventory(true),{'pistol-ammo':4});
  const pistol=raid.dropSlot('pistol',at);assert.equal(raid.ground.get(pistol.id).loaded,8);
  assert.ok(!raid.dropSlot('pistol',at));
});

test('a full destination and a hidden stack cannot absorb or duplicate a quick transfer',()=>{
  const raid=createRaid('packed',0,{spawnPoints:[{id:'test',position:at,yaw:0}],
    interactions:[{id:'small',kind:'loot',label:'箱',item:'manual',quantity:1,position:at}],exits:[]});
  const box=raid.containers.get('small');
  Object.assign(box,{width:1,height:1,entries:[{id:1,item:'pistol-ammo',quantity:59,x:0,y:0,section:'grid',rotated:false,revealed:false,progress:0,duration:1}]});
  const bag=raid.backpack,id=bag.entries[0].id;
  assert.ok(!raid.putContainerItem(box.id,id));
  box.entries[0].revealed=true;
  assert.ok(!raid.putContainerItem(box.id,id));
  assert.equal(box.entries[0].quantity,59);assert.equal(bag.ammoCount(),15);
  for(const s of bag.sections)for(let y=0;y<s.h;y++)for(let x=0;x<s.w;x++)bag.place('seals',1,x,y,false,s.id);
  assert.ok(!bag.split(id,4));assert.equal(bag.ammoCount(),15);
});
