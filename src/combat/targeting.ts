import type { CombatFrame, EnemyState, Vec3, WorldQueries } from '../contracts/demo.ts';
import { enemySpecs } from '../enemies/specs.ts';
import { segmentBlocked } from './geometry.ts';

function hitDistance(enemy: EnemyState, origin: Vec3, direction: Vec3, limit: number) {
  const { radius, height } = enemySpecs[enemy.kind];
  const [x, y, z] = enemy.position;
  const min: Vec3 = [x - radius, y, z - radius];
  const max: Vec3 = [x + radius, y + height, z + radius];
  let entry = 0;
  let exit = limit;
  for (let axis = 0; axis < 3; axis += 1) {
    const start = origin[axis];
    const delta = direction[axis];
    if (Math.abs(delta) < 1e-9) {
      if (start < min[axis] || start > max[axis]) return null;
      continue;
    }
    const a = (min[axis] - start) / delta;
    const b = (max[axis] - start) / delta;
    entry = Math.max(entry, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
    if (entry > exit) return null;
  }
  return entry;
}

export function strike(
  world: WorldQueries, enemies: readonly EnemyState[], origin: Vec3, aim: Vec3,
  range: number, damage: number, muzzle?: Vec3,
): CombatFrame['feedback'] {
  const length = Math.hypot(...aim);
  if (length === 0) return;
  const direction: Vec3 = [aim[0] / length, aim[1] / length, aim[2] / length];
  let target: EnemyState | undefined;
  let distance = range;
  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;
    const hit = hitDistance(enemy, origin, direction, distance);
    if (hit === null || (target && hit === distance)) continue;
    target = enemy;
    distance = hit;
  }
  if (world.blockedDistance(origin, direction, distance) !== null) return 'blocked';
  if (muzzle) {
    const end: Vec3 = [
      origin[0] + direction[0] * distance,
      origin[1] + direction[1] * distance,
      origin[2] + direction[2] * distance,
    ];
    if (segmentBlocked(world, origin, muzzle) || segmentBlocked(world, muzzle, end)) return 'blocked';
  }
  if (!target) return;

  target.health = Math.max(0, target.health - damage);
  if (target.health === 0) {
    target.action = 'dead';
    target.actionProgress = 0;
  }
  return 'hit';
}
