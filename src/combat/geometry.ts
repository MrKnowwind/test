import type { Vec3, WorldQueries } from '../contracts/demo.ts';

export function segmentBlocked(world: WorldQueries, from: Vec3, to: Vec3): boolean {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const length = Math.hypot(dx, dy, dz);
  return length > 0 && world.blockedDistance(from, [dx / length, dy / length, dz / length], length) !== null;
}
