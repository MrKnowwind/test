import { districtRect } from './layout.ts';
import type { Vec3, WorldQueries } from '../contracts/demo.ts';

export interface Slope {
  axis: 0 | 2;
  start: number;
  height: number;
  gradient: number;
}

export interface Solid {
  min: Vec3;
  max: Vec3;
  floor?: true;
  slope?: Slope;
}

export const mapBounds = { minX: -172, maxX: 228, minZ: -220, maxZ: 180 };
export const lab = { ...districtRect('research', { minX: -8, maxX: 26, minZ: -42, maxZ: -20 }), y: -5.4 };
export const ramp = { ...districtRect('research', { minX: 18, maxX: 23, minZ: -20, maxZ: -3 }), thickness: .32 };
export const factory = { ...districtRect('plant', { minX: 30, maxX: 51, minZ: -16, maxZ: 4 }), y: 3.2 };
export const factoryRamp = { ...districtRect('plant', { minX: 43, maxX: 48, minZ: 4, maxZ: 18 }) };
export const dock = { ...districtRect('wharf', { minX: -62, maxX: -32, minZ: -40, maxZ: 29 }), y: -.8 };
export const dockRamp = { ...districtRect('wharf', { minX: -32, maxX: -27, minZ: -40, maxZ: 29 }) };

export const rampSlope: Slope = { axis: 2, start: ramp.maxZ, height: 0, gradient: -lab.y / (ramp.maxZ - ramp.minZ) };
export const factorySlope: Slope = { axis: 2, start: factoryRamp.maxZ, height: 0, gradient: -factory.y / (factoryRamp.maxZ - factoryRamp.minZ) };
export const dockSlope: Slope = { axis: 0, start: dockRamp.maxX, height: 0, gradient: -dock.y / (dockRamp.maxX - dockRamp.minX) };
export function slopeHeight(slope: Slope, x: number, z: number) {
  return slope.height + ((slope.axis === 0 ? x : z) - slope.start) * slope.gradient;
}
export const rampHeight = (z: number) => slopeHeight(rampSlope, 0, z);

function inside(rect: { minX: number; maxX: number; minZ: number; maxZ: number }, x: number, z: number) {
  return x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ;
}

function floorAt(x: number, y: number, z: number) {
  if (!inside(mapBounds, x, z)) return null;
  if (inside(ramp, x, z)) return rampHeight(z);
  if (inside(factoryRamp, x, z)) return slopeHeight(factorySlope, x, z);
  if (inside(dockRamp, x, z)) return slopeHeight(dockSlope, x, z);
  if (y < -2.5) return inside(lab, x, z) ? lab.y : null;
  if (inside(factory, x, z) && y > 1.5) return factory.y;
  if (inside(dock, x, z)) return dock.y;
  return 0;
}

function blocksBody(solid: Solid, x: number, y: number, z: number, radius: number, height: number) {
  if (solid.max[1] <= y + .001 || solid.min[1] >= y + height) return false;
  const dx = Math.max(solid.min[0] - x, 0, x - solid.max[0]);
  const dz = Math.max(solid.min[2] - z, 0, z - solid.max[2]);
  return dx * dx + dz * dz <= radius * radius;
}

function rayHit(solid: Solid, origin: Vec3, direction: Vec3, limit: number) {
  if (solid.slope) {
    const slope = solid.slope;
    origin = [origin[0], origin[1] - slopeHeight(slope, origin[0], origin[2]), origin[2]];
    direction = [direction[0], direction[1] - direction[slope.axis] * slope.gradient, direction[2]];
  }
  let entry = 0, leave = limit;
  for (let axis = 0; axis < 3; axis++) {
    if (Math.abs(direction[axis]) < 1e-9) {
      if (origin[axis] < solid.min[axis] || origin[axis] > solid.max[axis]) return null;
      continue;
    }
    const a = (solid.min[axis] - origin[axis]) / direction[axis];
    const b = (solid.max[axis] - origin[axis]) / direction[axis];
    entry = Math.max(entry, Math.min(a, b));
    leave = Math.min(leave, Math.max(a, b));
    if (entry > leave) return null;
  }
  return entry;
}

export function createWorldQueries(solids: readonly Solid[]): WorldQueries {
  const obstacles = solids.filter(solid => !solid.floor);
  function groundHeight(from: Vec3, radius: number) {
    const [x, y, z] = from;
    let ground = floorAt(x, y, z);
    if (ground !== null && ground > y + .13) ground = null;
    for (const solid of solids) {
      if (x < solid.min[0] - radius * .35 || x > solid.max[0] + radius * .35 ||
          z < solid.min[2] - radius * .35 || z > solid.max[2] + radius * .35) continue;
      const top = solid.slope ? slopeHeight(solid.slope, x, z) : solid.max[1];
      if (top <= y + .13 && (ground === null || top > ground)) ground = top;
    }
    return ground;
  }
  function blocked(at: Vec3, radius: number, height: number) {
    if (!inside(mapBounds, at[0] - radius, at[2] - radius) ||
        !inside(mapBounds, at[0] + radius, at[2] + radius)) return true;
    return solids.some(solid => {
      if (!solid.slope) return blocksBody(solid, ...at, radius, height);
      const local: Vec3 = [at[0], at[1] - slopeHeight(solid.slope, at[0], at[2]), at[2]];
      return blocksBody(solid, ...local, radius, height);
    });
  }
  function moveBody(from: Vec3, dx: number, dy: number, dz: number, radius: number, height: number): Vec3 {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy, dz) / .08));
    let at: Vec3 = from;
    for (let step = 0; step < steps; step++) {
      for (const axis of [0, 2, 1]) {
        const delta = [dx, dy, dz][axis] / steps;
        const next: [number, number, number] = [...at];
        next[axis] += delta;
        const support = groundHeight(next, radius);
        if (axis === 1 && delta <= 0 && support !== null && next[1] < support) next[1] = support;
        if (axis !== 1 && dy <= 0) {
          const previous = groundHeight(at, radius);
          if (previous !== null && Math.abs(at[1] - previous) < .04 && support !== null &&
              Math.abs(support - at[1]) <= .12) next[1] = support;
        }
        if (!blocked(next, radius, height)) at = next;
      }
    }
    return at;
  }
  return {
    groundHeight,
    moveBody,
    climbTarget(from, forward, radius, height) {
      let nearest = 1.15;
      let ledge: Solid | undefined;
      const origin: Vec3 = [from[0], from[1] + .5, from[2]];
      for (const solid of obstacles) {
        if (solid.slope || solid.max[1] - from[1] < .35 || solid.max[1] - from[1] > 1.85) continue;
        const hit = rayHit(solid, origin, forward, nearest);
        if (hit !== null) { nearest = hit; ledge = solid; }
      }
      if (!ledge) return null;
      const target: Vec3 = [from[0] + forward[0] * (nearest + radius + .2), ledge.max[1],
        from[2] + forward[2] * (nearest + radius + .2)];
      const above: Vec3 = [from[0], target[1] + .04, from[2]];
      if (blocked(target, radius, height) || groundHeight(target, radius) !== target[1]) return null;
      const raised = moveBody(from, 0, above[1] - from[1], 0, radius, height);
      if (Math.abs(raised[1] - above[1]) > .01) return null;
      const across = moveBody(raised, target[0] - raised[0], 0, target[2] - raised[2], radius, height);
      if (Math.hypot(across[0] - target[0], across[2] - target[2]) > .01) return null;
      return target;
    },
    moveGrounded(from, dx, dz, radius, height) {
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .16));
      let [x, y, z] = from;
      function tryStep(toX: number, toZ: number) {
        const toY = floorAt(toX, y, toZ);
        if (toY === null || Math.abs(toY - y) > .12) return false;
        if (obstacles.some(solid => blocksBody(solid, toX, toY, toZ, radius, height))) return false;
        x = toX; y = toY; z = toZ;
        return true;
      }
      for (let step = 0; step < steps; step++) {
        if (tryStep(x + dx / steps, z + dz / steps)) continue;
        tryStep(x + dx / steps, z);
        tryStep(x, z + dz / steps);
      }
      return [x, y, z];
    },
    blockedDistance(origin, direction, maxDistance) {
      let nearest: number | null = null;
      for (const solid of solids) nearest = rayHit(solid, origin, direction, nearest ?? maxDistance) ?? nearest;
      return nearest;
    },
  };
}
