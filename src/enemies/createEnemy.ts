import type { CombatInput, EnemySpawn, EnemyState, Vec3, WorldQueries } from '../contracts/demo.ts';
import { segmentBlocked } from '../combat/geometry.ts';
import { enemySpecs } from './specs.ts';

const TIME_EPSILON = 1e-8;
const INFECTED_NOTICE_RANGE = 10;
const INFECTED_MELEE_HEIGHT = 0.9;
const CHASE_SPEED = 2.05;
const PATROL_SPEED = 0.85;
const PATROL_DISTANCE = 1.4;
const SEARCH_TIME = 5;

export function createEnemy(world: WorldQueries, spawn: EnemySpawn) {
  const spec = enemySpecs[spawn.kind];
  const state: EnemyState = {
    ...spawn, position: [...spawn.position], health: spec.health, action: 'idle', actionProgress: 0,
  };
  let elapsed = 0;
  const patrolEnd: Vec3 = [
    spawn.position[0] - Math.sin(spawn.yaw) * PATROL_DISTANCE,
    spawn.position[1],
    spawn.position[2] - Math.cos(spawn.yaw) * PATROL_DISTANCE,
  ];
  let patrolTarget = patrolEnd;
  let lastSeen: Vec3 | undefined;
  let searchRemaining = 0;
  let avoidanceSide = spawn.id.charCodeAt(spawn.id.length - 1) % 2 ? 1 : -1;

  function begin(action: EnemyState['action']) {
    state.action = action;
    state.actionProgress = 0;
    elapsed = 0;
  }

  function moveToward(target: Vec3, travel: number, stopDistance = 0): boolean {
    const from = state.position;
    const dx = target[0] - from[0];
    const dz = target[2] - from[2];
    const distance = Math.hypot(dx, dz);
    if (distance <= stopDistance + 1e-6) return false;

    const step = Math.min(travel, distance - stopDistance);
    const heading = Math.atan2(dx, dz);
    const probeDistance = Math.max(step, 0.6);
    let angle = 0;
    const straight = world.moveGrounded(from, Math.sin(heading) * probeDistance,
      Math.cos(heading) * probeDistance, spec.radius, spec.height);
    const straightProgress = Math.hypot(straight[0] - from[0], straight[2] - from[2]);
    if (straightProgress < probeDistance * 0.86) {
      // Keep a preferred side while following cover so a symmetric obstacle does not cause oscillation.
      let bestScore = -Infinity;
      for (const turn of [0.55, 1.0, 1.45, 1.9, -0.55, -1.0, -1.45, -1.9]) {
        if (turn < 0 && bestScore > -Infinity) break;
        const candidate = turn * avoidanceSide;
        const probe = world.moveGrounded(from, Math.sin(heading + candidate) * probeDistance,
          Math.cos(heading + candidate) * probeDistance, spec.radius, spec.height);
        const moved = Math.hypot(probe[0] - from[0], probe[2] - from[2]);
        if (moved < probeDistance * 0.8) continue;
        const progress = distance - Math.hypot(target[0] - probe[0], target[2] - probe[2]);
        const score = progress - Math.abs(turn) * 0.04 + (turn > 0 ? 0.12 : 0);
        if (score > bestScore) {
          bestScore = score;
          angle = candidate;
        }
      }
      if (angle !== 0) avoidanceSide = Math.sign(angle);
    }
    const next = world.moveGrounded(from, Math.sin(heading + angle) * step,
      Math.cos(heading + angle) * step, spec.radius, spec.height);
    const movedX = next[0] - from[0];
    const movedZ = next[2] - from[2];
    state.position = next;
    if (Math.hypot(movedX, movedZ) <= 1e-6) return false;
    state.yaw = Math.atan2(-movedX, -movedZ);
    return true;
  }

  function update(dt: number, input: CombatInput): number {
    if (state.action === 'dead') return 0;

    if (state.action === 'attacking' || state.action === 'recovering') {
      elapsed += dt;
      const duration = spec.attacking + spec.recovery;
      if (elapsed < spec.attacking - TIME_EPSILON) {
        state.actionProgress = elapsed / spec.attacking;
        return 0;
      }
      if (elapsed < duration - TIME_EPSILON) {
        state.action = 'recovering';
        state.actionProgress = Math.max(0, elapsed - spec.attacking) / spec.recovery;
        return 0;
      }
      dt = Math.max(0, elapsed - duration);
      begin('idle');
    }

    const [x, y, z] = state.position;
    const [playerX, playerY, playerZ] = input.playerFeet;
    const dx = playerX - x;
    const dz = playerZ - z;
    const dy = playerY - y;
    const origin: Vec3 = [x, y + spec.attackHeight, z];
    const torso: Vec3 = [playerX, playerY + 1.15, playerZ];
    const infected = state.kind === 'infected';
    const distance = Math.hypot(dx, dy, dz);
    const noticeRange = infected ? INFECTED_NOTICE_RANGE : spec.range;
    const canSee = distance <= noticeRange && !segmentBlocked(world, origin, torso);
    if (canSee) {
      lastSeen = [...input.playerFeet];
      searchRemaining = SEARCH_TIME;
    } else {
      searchRemaining = Math.max(0, searchRemaining - dt);
    }
    const canAttack = canSee && distance <= spec.range && (!infected || Math.abs(dy) <= INFECTED_MELEE_HEIGHT);
    if (canAttack && (dx !== 0 || dz !== 0)) state.yaw = Math.atan2(-dx, -dz);

    if (state.action === 'windup') {
      if (!canAttack) {
        begin('idle');
        return 0;
      }
      elapsed += dt;
      if (elapsed < spec.windup - TIME_EPSILON) {
        state.actionProgress = elapsed / spec.windup;
        return 0;
      }
      const overflow = elapsed - spec.windup;
      begin('attacking');
      elapsed = Math.max(0, overflow);
      return spec.damage;
    }

    if (canAttack) {
      begin('windup');
    } else if (infected && dt > 0) {
      if (canSee || (lastSeen && searchRemaining > 0)) {
        begin(moveToward(canSee ? input.playerFeet : lastSeen!, CHASE_SPEED * dt, 0.9) ? 'moving' : 'idle');
      } else {
        const moved = moveToward(patrolTarget, PATROL_SPEED * dt);
        if (!moved) patrolTarget = patrolTarget === patrolEnd ? spawn.position : patrolEnd;
        begin(moved ? 'moving' : 'idle');
      }
    }
    return 0;
  }

  return { state, update };
}
