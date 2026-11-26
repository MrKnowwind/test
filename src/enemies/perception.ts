import type { EnemyState, Vec3, WorldQueries } from '../contracts/demo.ts';
import { segmentBlocked } from '../combat/geometry.ts';
import { isLabLevel, lab, ramp, researchPad } from '../world/researchPlan.ts';

export const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const ear = (p: Vec3): Vec3 => [p[0], p[1] + 1.1, p[2]];
const entrance: Vec3 = [(ramp.minX + ramp.maxX) / 2, lab.y, ramp.minZ];
const landing: Vec3 = [entrance[0], researchPad.height, ramp.maxZ];
export function soundPath(world: WorldQueries, from: Vec3, to: Vec3) {
  const fromLab = isLabLevel(from);
  if (fromLab !== isLabLevel(to)) {
    const below = fromLab ? from : to,
      above = below === from ? to : from;
    // Cross-floor sound must travel through the real ramp. A listener on the ramp
    // can receive a direct sound when the sloped passage is clear.
    const onRamp = (p: Vec3) =>
      p[0] >= ramp.minX && p[0] <= ramp.maxX && p[2] >= ramp.minZ && p[2] <= ramp.maxZ;
    if ((onRamp(from) || onRamp(to)) && !segmentBlocked(world, ear(from), ear(to))) return distance(from, to);
    return distance(below, entrance) + distance(entrance, landing) + distance(landing, above);
  }
  return distance(from, to) * (segmentBlocked(world, ear(from), ear(to)) ? 2 : 1);
}
export function inView(enemy: EnemyState, point: Vec3) {
  const dx = point[0] - enemy.position[0],
    dz = point[2] - enemy.position[2],
    dist = Math.hypot(dx, dz);
  const infected = enemy.kind === 'infected';
  if (dist < 0.001 || (infected && dist <= 2)) return true;
  return (-Math.sin(enemy.yaw) * dx - Math.cos(enemy.yaw) * dz) / dist >= (infected ? 0.5 : Math.SQRT1_2);
}
// Nodes are placed at doors and aisle intersections on the current port map.
// Short edges are tested with the same body clearance and floor query as the actor.
const nodes: Vec3[] = [
  [-78, 0, 27],
  [-78, 0, 15],
  [-78, 0, 4],
  [-78, 0, -5],
  [-78, 0, -12],
  [-84, 0, -11.4],
  [-78, 0, -25],
  [-86, 0, -23],
  [117, 0, -40],
  [127, 0, -40],
  [136, 0, -40],
  [139, 0, -29],
  [140, 0, -17],
  [16, lab.y, -158],
  [27, lab.y, -158],
  [40, lab.y, -158],
  [40, lab.y, -166],
  [27, lab.y, -166],
  [16, lab.y, -166],
  entrance,
  [entrance[0], (lab.y + researchPad.height) / 2, (ramp.maxZ + ramp.minZ) / 2],
  landing,
];
export function detour(world: WorldQueries, from: Vec3, to: Vec3, radius: number, height: number): Vec3[] {
  const nearby = nodes.filter((n) => distance(n, from) < 26 || distance(n, to) < 16);
  if (!nearby.length) return [];
  const points = [from, ...nearby, to],
    end = points.length - 1;
  const prev = new Map<number, number>([[0, -1]]),
    queue = [0];
  const walkable = (a: Vec3, b: Vec3) => {
    const dx = b[0] - a[0],
      dz = b[2] - a[2],
      n = Math.ceil(Math.hypot(dx, dz) / 0.65);
    if (n > 25 || n === 0) return false;
    let p = a;
    for (let i = 0; i < n; i++) {
      p = world.moveGrounded(p, dx / n, dz / n, radius, height);
      if (Math.hypot(p[0] - a[0] - (dx * (i + 1)) / n, p[2] - a[2] - (dz * (i + 1)) / n) > 0.24) return false;
    }
    return Math.abs(p[1] - b[1]) < 0.8;
  };
  for (let k = 0; k < queue.length; k++) {
    const a = queue[k];
    for (let b = 1; b < points.length; b++) {
      if (prev.has(b) || !walkable(points[a], points[b])) continue;
      prev.set(b, a);
      queue.push(b);
      if (b === end) {
        const result: Vec3[] = [];
        for (let i = end; i !== 0; i = prev.get(i)!) result.unshift(points[i]);
        return result;
      }
    }
  }
  return [];
}
