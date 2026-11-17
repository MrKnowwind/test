import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackpack } from '../src/raid/backpack.ts';

test('loot uses physical cells, rotates, and a rejected transfer leaves both stock and space unchanged', () => {
  const bag = createBackpack(3, 3);
  assert.equal(bag.add('salvage', 1), true);
  assert.equal(bag.add('medkit', 1), false);
  assert.deepEqual(bag.inventory(), { salvage: 1 });
  assert.equal(bag.add('research-sample', 1), true);
  const sample = bag.entries.find(entry => entry.item === 'research-sample');
  assert.equal(bag.move(sample.id, 0, 2, true), true);
  assert.equal(bag.move(sample.id, 1, 1, true), false);
  assert.deepEqual([sample.x, sample.y, sample.rotated], [0, 2, true]);
  assert.equal(bag.remove(sample.id).item, 'research-sample');
  assert.equal(bag.entries.length, 1);
});
