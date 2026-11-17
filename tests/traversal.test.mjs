import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera } from 'three';
import { createPlayer } from '../src/player/controller.ts';
import { createWorldQueries } from '../src/world/worldQueries.ts';

const input = { strafe: 0, forward: 0, running: false, lookX: 0, lookY: 0, jumpPressed: false };
const crate = { min: [-1, 0, -2], max: [1, 1.6, 0] };
const world = (extra = []) => createWorldQueries([crate, ...extra]);
function player(w = world(), feet = [0, 0, .65]) {
  return createPlayer(new PerspectiveCamera(), w, { id: 'test', position: feet, yaw: 0 });
}

test('Space jumps once, gravity lands on the floor, and airborne presses cannot double jump', () => {
  const p = player(world(), [4, 0, 4]);
  p.move(1 / 60, { ...input, jumpPressed: true }, false);
  assert.ok(p.feet[1] > 0, 'jump must leave the ground');
  let apex = 0;
  for (let i = 0; i < 100; i++) {
    p.move(1 / 60, { ...input, jumpPressed: i === 10 }, false);
    apex = Math.max(apex, p.feet[1]);
  }
  assert.ok(apex > .85 && apex < 1.2);
  assert.equal(p.feet[1], 0);
});

test('a second jump at a reachable edge climbs onto its real top and walking off falls', () => {
  const p = player();
  p.move(1 / 60, { ...input, jumpPressed: true }, false);
  for (let i = 0; i < 8; i++) p.move(1 / 60, input, false);
  assert.ok(p.feet[1] > .5);
  p.move(1 / 60, { ...input, jumpPressed: true }, false);
  assert.equal(p.climbing, true);
  for (let i = 0; i < 60; i++) p.move(1 / 60, input, false);
  assert.equal(p.climbing, false);
  assert.equal(p.feet[1], 1.6);
  assert.ok(p.feet[2] < 0);
  for (let i = 0; i < 90; i++) p.move(1 / 60, { ...input, strafe: 1 }, false);
  assert.equal(p.feet[1], 0);
});

test('head clearance, tall walls and airborne collision prevent climbing through geometry', () => {
  const roof = { min: [-2, 2.4, -3], max: [2, 2.8, 1] };
  assert.equal(world([roof]).climbTarget([0, .8, .65], [0, 0, -1], .36, 1.8), null);
  const tall = createWorldQueries([{ min: [-1, 0, -2], max: [1, 5, 0] }]);
  assert.equal(tall.climbTarget([0, .8, .65], [0, 0, -1], .36, 1.8), null);
  const blocked = tall.moveBody([0, .8, .65], 0, 0, -4, .36, 1.8);
  assert.ok(blocked[2] >= .36);
  const p = player(world([roof]));
  p.move(1 / 60, { ...input, jumpPressed: true }, false);
  let apex = 0;
  for (let i = 0; i < 90; i++) { p.move(1 / 60, input, false); apex = Math.max(apex, p.feet[1]); }
  assert.ok(apex <= .6);
  assert.equal(p.feet[1], 0);
});
