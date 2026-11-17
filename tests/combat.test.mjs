import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombat } from '../src/combat/createCombat.ts';
import { createWorldQueries } from '../src/world/worldQueries.ts';

const player = {
  playerFeet: [0, 0, 0],
  eye: [0, 1.65, 0],
  aimDirection: [0, 0, -1],
  muzzle: [0.25, 1.4, -0.45],
  attackPressed: false,
  reloadPressed: false,
  aiming: false,
};

const openWorld = {
  moveGrounded: ([x, y, z], dx, dz) => [x + dx, y, z + dz],
  blockedDistance: () => null,
};

const update = (combat, dt = 0, input = {}) => combat.update(dt, { ...player, ...input });
const infected = (id, position) => ({ id, kind: 'infected', position, yaw: 0 });
const securityBot = (position) => ({ id: 'bot', kind: 'security-bot', position, yaw: 0 });

function wallAtZ(z, covers = () => true) {
  return {
    ...openWorld,
    blockedDistance(origin, direction, limit) {
      assert.ok(Math.abs(Math.hypot(...direction) - 1) < 1e-9);
      if (direction[2] === 0) return null;
      const distance = (z - origin[2]) / direction[2];
      if (distance < 0 || distance > limit) return null;
      const x = origin[0] + direction[0] * distance;
      const y = origin[1] + direction[1] * distance;
      return covers(x, y) ? distance : null;
    },
  };
}

test('the raid starts at full health with a 6+6 pistol and supports held ADS', () => {
  const combat = createCombat(openWorld, []);
  const start = combat.snapshot();
  assert.equal(start.health, 100);
  assert.equal(start.weapon.id, 'pistol');
  assert.equal(start.weapon.loaded, 6);
  assert.equal(start.weapon.reserve, 6);
  assert.equal(start.weapon.aiming, false);

  assert.equal(update(combat, 0, { aiming: true }).weapon.aiming, true);
  assert.equal(update(combat).weapon.aiming, false);
  assert.equal(update(combat, 0, { switchTo: 'knife', aiming: true }).weapon.aiming, false);
  assert.equal(combat.snapshot().weapon.id, 'knife');
});

test('empty primary slots never change the pistol or knife and preserve pistol ammunition', () => {
  const combat = createCombat(openWorld, []);
  update(combat, 0, { attackPressed: true });
  update(combat, 0.4);
  for (const switchTo of ['rifle', 'shotgun']) {
    const unchanged = update(combat, 0, { switchTo });
    assert.equal(unchanged.weapon.id, 'pistol');
    assert.equal(unchanged.weapon.loaded, 5);
  }
  update(combat, 0, { switchTo: 'knife' });
  for (const switchTo of ['rifle', 'shotgun']) {
    assert.equal(update(combat, 0, { switchTo, aiming: true }).weapon.id, 'knife');
    assert.equal(combat.snapshot().weapon.aiming, false);
  }
  const pistol = update(combat, 0, { switchTo: 'pistol' });
  assert.equal(pistol.weapon.loaded, 5);
  assert.equal(pistol.weapon.reserve, 6);
});

test('the pistol consumes one round per trigger press and enforces the shot interval', () => {
  const combat = createCombat(openWorld, []);
  const shot = update(combat, 0, { attackPressed: true });
  assert.equal(shot.weapon.action, 'firing');
  assert.equal(shot.weapon.loaded, 5);
  assert.equal(update(combat, 0.5, { attackPressed: true }).weapon.loaded, 5);

  update(combat);
  assert.equal(update(combat, 0, { attackPressed: true }).weapon.loaded, 4);
  update(combat, 0.39);
  assert.equal(update(combat, 0, { attackPressed: true }).weapon.loaded, 4);
  update(combat, 0.01);
  assert.equal(update(combat, 0, { attackPressed: true }).weapon.loaded, 3);
});

test('reload pressed during shot recovery starts when the pistol is ready, including across empty slots', () => {
  const combat = createCombat(openWorld, []);
  update(combat, 0, { attackPressed: true });
  const recovering = update(combat, 0.1, { reloadPressed: true });
  assert.equal(recovering.weapon.action, 'firing');
  update(combat, 0.1, { switchTo: 'rifle' });
  update(combat, 0.1, { switchTo: 'shotgun' });
  const queued = update(combat, 0.1);
  assert.equal(queued.weapon.id, 'pistol');
  assert.equal(queued.weapon.action, 'reloading');
  assert.equal(queued.weapon.loaded, 5);
  const finished = update(combat, 1.6);
  assert.equal(finished.weapon.action, 'ready');
  assert.equal(finished.weapon.loaded, 6);
  assert.equal(finished.weapon.reserve, 5);
});

test('switching weapons or dying cancels a queued reload without transferring ammunition', () => {
  const combat = createCombat(openWorld, []);
  update(combat, 0, { attackPressed: true });
  update(combat, 0.1, { reloadPressed: true });
  update(combat, 0, { switchTo: 'knife' });
  const returned = update(combat, 0.4, { switchTo: 'pistol' });
  assert.equal(returned.weapon.action, 'ready');
  assert.equal(returned.weapon.loaded, 5);
  assert.equal(returned.weapon.reserve, 6);

  const lethal = createCombat(openWorld, Array.from({ length: 4 }, (_, i) => infected('attacker-' + i, [0, 0, -1.2])));
  update(lethal, 0, { attackPressed: true, aimDirection: [1, 0, 0] });
  update(lethal, 0.1, { reloadPressed: true });
  const dead = update(lethal, 0.55);
  assert.equal(dead.health, 0);
  assert.equal(dead.weapon.action, 'ready');
  assert.equal(dead.weapon.loaded, 5);
  const later = update(lethal, 2);
  assert.equal(later.weapon.action, 'ready');
  assert.equal(later.weapon.loaded, 5);
  assert.equal(later.weapon.reserve, 6);
});

test('an empty pistol reports dry fire and switching interrupts a reload before ammo transfer', () => {
  const combat = createCombat(openWorld, []);
  for (let shot = 0; shot < 6; shot += 1) {
    update(combat, 0, { attackPressed: true });
    update(combat, 0.4);
  }
  const dryFire = update(combat, 0, { attackPressed: true });
  assert.equal(dryFire.feedback, 'empty');
  assert.equal(dryFire.weapon.loaded, 0);
  assert.equal(update(combat).feedback, undefined);

  const reload = update(combat, 0, { reloadPressed: true, aiming: true });
  assert.equal(reload.weapon.action, 'reloading');
  assert.equal(reload.weapon.aiming, false);
  const halfway = update(combat, 0.8, { attackPressed: true });
  assert.equal(halfway.weapon.actionProgress, 0.5);
  assert.equal(halfway.weapon.loaded, 0);
  const cancelled = update(combat, 0, { switchTo: 'knife' });
  assert.equal(cancelled.weapon.action, 'ready');
  assert.equal(cancelled.weapon.reserve, 6);

  update(combat, 0, { switchTo: 'pistol', reloadPressed: true });
  const finished = update(combat, 1.6, { aiming: true });
  assert.equal(finished.weapon.action, 'ready');
  assert.equal(finished.weapon.aiming, true);
  assert.equal(finished.weapon.loaded, 6);
  assert.equal(finished.weapon.reserve, 0);
});

test('a pistol hit damages the nearest target and the third hit kills an infected', () => {
  const combat = createCombat(openWorld, [infected('far', [0, 0, -7]), infected('near', [0, 0, -4])]);
  const shot = update(combat, 0, { attackPressed: true });
  assert.equal(shot.feedback, 'hit');
  assert.equal(shot.enemies[0].health, 90);
  assert.equal(shot.enemies[1].health, 60);
  for (let i = 0; i < 2; i += 1) {
    update(combat, 0.4);
    update(combat, 0, { attackPressed: true });
  }
  const killed = combat.snapshot();
  assert.equal(killed.enemies[1].health, 0);
  assert.equal(killed.enemies[1].action, 'dead');
  assert.equal(killed.enemies[0].health, 90);
  assert.equal(shot.enemies[1].health, 60);
});

test('a wall blocks shots through the camera ray, beside the muzzle, and behind a clipped muzzle', () => {
  const cases = [
    ['wall in camera ray', wallAtZ(-2)],
    ['wall between muzzle and target', wallAtZ(-0.8, (x) => x > 0.15)],
    ['wall between eye and muzzle', wallAtZ(-0.2, (x) => x > 0.06)],
  ];
  for (const [label, world] of cases) {
    const combat = createCombat(world, [infected('target', [0, 0, -4])]);
    const shot = update(combat, 0, { attackPressed: true });
    assert.equal(shot.feedback, 'blocked', label);
    assert.equal(shot.enemies[0].health, 90, label);
    assert.equal(shot.weapon.loaded, 5, label);
  }
});

test('a knife swing has short reach, respects cover and leaves the pistol ammo intact', () => {
  const swing = { switchTo: 'knife', attackPressed: true };
  const nearby = infected('near', [0, 0, -1.6]);
  const closeCombat = createCombat(openWorld, [nearby]);
  const windup = update(closeCombat, 0, swing);
  assert.equal(windup.enemies[0].health, 90);
  assert.equal(windup.weapon.action, 'slashing');
  assert.equal(update(closeCombat, 0.2).enemies[0].health, 90);
  const hit = update(closeCombat, 0.04);
  assert.equal(hit.feedback, 'hit');
  assert.equal(hit.enemies[0].health, 55);
  assert.equal(hit.weapon.loaded, 6);
  assert.equal(update(closeCombat, 0.4).enemies[0].health, 55);
  assert.ok(update(closeCombat, 0, swing).weapon.actionProgress > 0.98);
  update(closeCombat, 0.01);
  assert.equal(update(closeCombat, 0, swing).weapon.actionProgress, 0);
  assert.equal(update(closeCombat, 0.24).enemies[0].health, 20);

  const tooFar = createCombat(openWorld, [infected('far', [0, 0, -2])]);
  update(tooFar, 0, swing);
  assert.equal(update(tooFar, 0.24).enemies[0].health, 90);
  const covered = createCombat(wallAtZ(-0.8), [nearby]);
  update(covered, 0, swing);
  const blocked = update(covered, 0.24);
  assert.equal(blocked.feedback, 'blocked');
  assert.equal(blocked.enemies[0].health, 90);
});

test('an infected telegraphs its strike, and stepping out of reach prevents the hit', () => {
  const target = infected('infected', [0, 0, -1.2]);
  const combat = createCombat(openWorld, [target]);
  const warning = update(combat);
  assert.equal(warning.enemies[0].action, 'windup');
  assert.equal(warning.health, 100);
  const almost = update(combat, 0.64);
  assert.equal(almost.health, 100);
  assert.ok(almost.enemies[0].actionProgress > 0.9);
  const hit = update(combat, 0.01);
  assert.equal(hit.enemies[0].action, 'attacking');
  assert.equal(hit.health, 75);
  assert.equal(update(combat, 0.18).enemies[0].action, 'recovering');
  assert.equal(update(combat, 0.57).health, 75);
  assert.equal(update(combat, 0.64).health, 75);
  assert.equal(update(combat, 0.01).health, 50);

  const evade = createCombat(openWorld, [target]);
  update(evade);
  const retreat = { playerFeet: [0, 0, 2], eye: [0, 1.65, 2] };
  const missed = update(evade, 0.65, retreat);
  assert.equal(missed.health, 100);
  assert.notEqual(missed.enemies[0].action, 'attacking');
});

test('an infected pursues a visible player and uses the world movement constraints', () => {
  const target = infected('infected', [0, 0, -4]);
  const chase = createCombat(openWorld, [target]);
  const moving = update(chase, 0.5).enemies[0];
  assert.equal(moving.action, 'moving');
  assert.ok(moving.position[2] > target.position[2]);
  assert.ok(Math.abs(Math.abs(moving.yaw) - Math.PI) < 1e-9);

  const collision = createCombat({ ...openWorld, moveGrounded: (from) => from }, [target]);
  assert.deepEqual(update(collision, 0.5).enemies[0].position, target.position);

  const concealed = createCombat(wallAtZ(-2), [target]);
  const patrol = update(concealed, 0.5).enemies[0];
  assert.ok(patrol.position[2] < target.position[2]);
  assert.equal(update(concealed, 0.5).health, 100);
});

test('an infected routes around low cover instead of staying against its front edge', () => {
  const world = createWorldQueries([{
    min: [-0.8, 0, -3.0], max: [0.8, 0.7, -1.7],
  }]);
  const combat = createCombat(world, [infected('blocked', [0, 0, -4.0])]);
  let reached = false;
  for (let frame = 0; frame < 360; frame++) {
    const enemy = update(combat, 1 / 60).enemies[0];
    if (enemy.position[2] > -1.6) reached = true;
  }
  assert.ok(reached, 'The enemy should walk past the low crate before attacking');
});

test('losing sight searches the last observed position without tracking through cover', () => {
  let hidden = false;
  const world = { ...openWorld, blockedDistance: () => hidden ? 0.5 : null };
  const combat = createCombat(world, [infected('searching', [0, 0, -5])]);
  update(combat, 0);
  hidden = true;
  const searching = update(combat, 0.5, { playerFeet: [7, 0, 0], eye: [7, 1.65, 0] });
  assert.equal(searching.health, 100);
  assert.equal(searching.enemies[0].action, 'moving');
  assert.ok(Math.abs(searching.enemies[0].position[0]) < 1e-6);
  assert.ok(searching.enemies[0].position[2] > -5);
  const forgotten = update(combat, 5.1, { playerFeet: [7, 0, 0], eye: [7, 1.65, 0] });
  assert.equal(forgotten.health, 100);
  assert.ok(forgotten.enemies[0].position[2] < searching.enemies[0].position[2]);
});

test('solid cover cancels a security bot lock, and peeking starts a fresh warning', () => {
  const combat = createCombat(wallAtZ(-2, (x) => x > 0.5), [securityBot([0, 0, -4])]);
  assert.equal(update(combat).enemies[0].action, 'windup');
  const warning = update(combat, 0.85);
  assert.equal(warning.health, 100);
  assert.ok(warning.enemies[0].actionProgress > 0.9);

  const behindCover = { playerFeet: [2, 0, 0], eye: [2, 1.65, 0] };
  const interrupted = update(combat, 0.1, behindCover);
  assert.equal(interrupted.health, 100);
  assert.equal(interrupted.enemies[0].action, 'idle');
  assert.equal(interrupted.enemies[0].actionProgress, 0);
  assert.equal(update(combat, 1, behindCover).health, 100);

  assert.equal(update(combat).enemies[0].action, 'windup');
  assert.equal(update(combat, 0.8).health, 100);
  const fired = update(combat, 0.1);
  assert.equal(fired.health, 80);
  assert.equal(fired.enemies[0].action, 'attacking');
  assert.equal(update(combat, 0.05).health, 80);
});

test('a lethal shot stops a bot from firing even when its lock expires on that update', () => {
  const combat = createCombat(openWorld, [securityBot([0, 0, -4])]);
  const fire = { aimDirection: [0, -0.15, -1], attackPressed: true };
  assert.equal(update(combat, 0, fire).enemies[0].health, 30);
  assert.equal(update(combat, 0.4).enemies[0].action, 'windup');
  const kill = update(combat, 0.5, fire);
  assert.equal(kill.health, 100);
  assert.equal(kill.enemies[0].health, 0);
  assert.equal(kill.enemies[0].action, 'dead');
});

test('supplies restore health and reserve, and death ends combat until the next raid', () => {
  const enemies = [infected('infected', [0, 0, -1.2])];
  const combat = createCombat(openWorld, enemies);
  update(combat);
  assert.equal(update(combat, 0.65).health, 75);
  update(combat, 0.75);
  assert.equal(update(combat, 0.65).health, 50);
  combat.heal(40);
  assert.equal(combat.snapshot().health, 90);
  combat.heal(40);
  assert.equal(combat.snapshot().health, 100);
  combat.addReserve(6);
  assert.equal(combat.snapshot().weapon.reserve, 12);
  assert.equal(combat.snapshot().weapon.loaded, 6);
  combat.heal(-40);
  combat.addReserve(-6);
  assert.equal(combat.snapshot().health, 100);
  assert.equal(combat.snapshot().weapon.reserve, 12);

  for (let i = 0; i < 4; i += 1) {
    update(combat, 0.75);
    update(combat, 0.65);
  }
  assert.equal(combat.snapshot().health, 0);
  combat.heal(40);
  combat.addReserve(6);
  const dead = update(combat, 1, { attackPressed: true, aiming: true });
  assert.equal(dead.health, 0);
  assert.equal(dead.weapon.loaded, 6);
  assert.equal(dead.weapon.reserve, 12);
  assert.equal(dead.weapon.aiming, false);
  assert.equal(dead.enemies[0].health, 90);
  assert.equal(createCombat(openWorld, enemies).snapshot().health, 100);
});

test('the scripted pistol hits and miss give identical results at 30 and 60 FPS', () => {
  function play(fps) {
    const stationary = { ...openWorld, moveGrounded: (from) => from };
    const combat = createCombat(stationary, [infected('target', [0, 0, -4])]);
    const results = [];
    for (let frame = 0; frame <= 1.5 * fps; frame += 1) {
      const click = frame % (fps / 2) === 0;
      const aimDirection = frame === fps ? [1, 0, -1] : [0, -0.1, -1];
      const state = update(combat, frame === 0 ? 0 : 1 / fps, { attackPressed: click, aimDirection });
      if (click) results.push([state.feedback, state.weapon.loaded, state.enemies[0].health]);
    }
    return results;
  }

  const expected = [['hit', 5, 60], ['hit', 4, 30], [undefined, 3, 30], ['hit', 2, 0]];
  assert.deepEqual(play(30), expected);
  assert.deepEqual(play(60), expected);
});
