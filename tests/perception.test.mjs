import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombat } from '../src/combat/createCombat.ts';
import { soundPath } from '../src/enemies/perception.ts';
import { createBackpack } from '../src/raid/backpack.ts';
import { createTreatment } from '../src/combat/treatment.ts';
const world = { moveGrounded: ([x, y, z], dx, dz) => [x + dx, y, z + dz], blockedDistance: () => null };
const player = {
  playerFeet: [0, 0, 0],
  eye: [0, 1.65, 0],
  aimDirection: [0, 0, 1],
  muzzle: [0, 1.5, 0.3],
  aiming: false,
  attackPressed: false,
  reloadPressed: false,
};
const posts = [4, 5, 6].map((z) => ({ id: 'watch-' + z, kind: 'infected', position: [0, 0, -z], yaw: 0 }));
test('quiet approach behind a guard stays hidden; an actual shot draws only the two nearest guards', () => {
  const combat = createCombat(world, posts);
  let frame = combat.update(0, { ...player, stepRadius: 3 });
  assert.deepEqual(
    frame.enemies.map((e) => e.intent),
    ['patrol', 'patrol', 'patrol'],
  );
  frame = combat.update(0, { ...player, attackPressed: true });
  assert.deepEqual(
    frame.enemies.map((e) => e.intent),
    ['investigate', 'investigate', 'patrol'],
  );
  const walls = { ...world, blockedDistance: () => 0.35 };
  assert.equal(soundPath(walls, [0, 0, 0], [0, 0, 4]), 8);
  assert.ok(soundPath(world, [26, 0, -166], [26, -5.4, -166]) > 28);
});
test('a security bot facing away waits for evidence; a nearby shot starts a full visible lock', () => {
  const combat = createCombat(world, [{ ...posts[0], kind: 'security-bot' }]);
  assert.equal(combat.update(0, player).enemies[0].action, 'idle');
  const alerted = combat.update(0, { ...player, attackPressed: true });
  assert.equal(alerted.enemies[0].action, 'windup');
  assert.equal(combat.update(0.71, player).health, 100);
  assert.equal(combat.update(0.01, player).health, 80);
});
test('interruption on the last treatment tick keeps the kit, and completion consumes it once', () => {
  const bag = createBackpack(3, 2, true);
  bag.add('medkit', 1);
  const care = createTreatment(bag),
    id = bag.entries[0].id;
  assert.ok(care.start(id, 50));
  assert.equal(care.advance(2.49, false, 50), 0);
  assert.equal(care.advance(0.01, true, 50), 0);
  assert.equal(bag.entries.length, 1);
  assert.ok(care.start(id, 50));
  assert.ok(care.advance(2.5, false, 50));
  assert.equal(bag.entries.length, 0);
  assert.equal(care.advance(1, false, 50), 0);
});
test('injector heals per second across damage, retains remaining charge after interruption', () => {
  const bag = createBackpack(3, 2, true);
  bag.receive({ item: 'healing-injector', quantity: 1, instance: 'sample/needle' });
  const care = createTreatment(bag),
    needle = bag.entries[0];
  assert.ok(care.start(needle.id, 60));
  assert.equal(care.advance(1, true, 60), 10);
  assert.equal(needle.durability, 2);
  care.cancel();
  assert.equal(care.advance(2, false, 70), 0);
  assert.ok(care.start(needle.id, 70));
  assert.equal(care.advance(1, false, 0), 0);
  assert.equal(needle.durability, 2);
});

test('partial injector shipment keeps remaining charges through retry, sale and reload', async () => {
  const { createWarehouse } = await import('../src/raid/warehouse.ts');
  const records = new Map();
  const storage = {
    get length() {
      return records.size;
    },
    key: (i) => [...records.keys()][i],
    getItem: (k) => records.get(k) ?? null,
    setItem: (k, v) => records.set(k, v),
  };
  const stock = createWarehouse(() => storage, () => 0);
  const item = 'healing-injector',
    data = {
      runId: 'medicine',
      outcome: 'extracted',
      exitId: 'highway',
      items: { [item]: 1 },
      instances: [{ item, quantity: 1, instance: 'medicine/1', durability: 2 }],
    };
  assert.ok(stock.commit(data));
  assert.ok(stock.commit(data));
  const credits = stock.credits(), quote = stock.price(item);
  assert.ok(quote >= 48 && quote <= 72);
  assert.ok(await stock.sell(item));
  assert.equal(await stock.sell(item), false);
  assert.equal(createWarehouse(() => storage).credits(), credits + quote);
});
