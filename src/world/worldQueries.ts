import { roads, footpaths } from './roads.ts';
import { districtRect } from './layout.ts';
import type { Ledge, Vec3, WorldQueries } from '../contracts/demo.ts';
import { offshoreWalkAreas,shipEnvelope } from './harborPlan.ts';
import { terrainHeight } from './terrainPlan.ts';
import { isLabLevel, lab, ramp, researchPad } from './researchPlan.ts';
export { lab, ramp } from './researchPlan.ts';

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
  walkSurface?: true;
  surface?: 'metal' | 'concrete';
  slope?: Slope;
}

export const mapBounds = { minX: -172, maxX: 228, minZ: -220, maxZ: 180 };
// Render extent includes the vessel; movement does not gain a rectangular ocean floor.
export const mapViewBounds={...mapBounds,minX:shipEnvelope.minX};
export const factory = { ...districtRect('plant', { minX: 30, maxX: 51, minZ: -16, maxZ: 4 }), y: 3.2 };
export const factoryRamp = { ...districtRect('plant', { minX: 43, maxX: 48, minZ: 4, maxZ: 18 }) };
export const dock = { ...districtRect('wharf', { minX: -62, maxX: -32, minZ: -40, maxZ: 29 }), y: -.8 };
export const dockRamp = { ...districtRect('wharf', { minX: -32, maxX: -27, minZ: -40, maxZ: 29 }) };

export const rampSlope: Slope = { axis: 2, start: ramp.maxZ, height: researchPad.height,
  gradient: (researchPad.height - lab.y) / (ramp.maxZ - ramp.minZ) };
export const factorySlope: Slope = { axis: 2, start: factoryRamp.maxZ, height: 0, gradient: -factory.y / (factoryRamp.maxZ - factoryRamp.minZ) };
export const dockSlope: Slope = { axis: 0, start: dockRamp.maxX, height: 0, gradient: -dock.y / (dockRamp.maxX - dockRamp.minX) };
export function slopeHeight(slope: Slope, x: number, z: number) {
  return slope.height + ((slope.axis === 0 ? x : z) - slope.start) * slope.gradient;
}
export const rampHeight = (z: number) => slopeHeight(rampSlope, 0, z);

function inside(rect: { minX: number; maxX: number; minZ: number; maxZ: number }, x: number, z: number) {
  return x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ;
}
function playable(x:number,z:number){return inside(mapBounds,x,z)||offshoreWalkAreas.some(area=>inside(area,x,z));}
function playableFootprint(x:number,z:number,radius:number){return [-radius,radius].every(dx=>[-radius,radius].every(dz=>playable(x+dx,z+dz)));}

function floorAt(x: number, y: number, z: number) {
  if (!inside(mapBounds, x, z)) return null;
  if (inside(ramp, x, z)) return rampHeight(z);
  if (isLabLevel([x, y, z])) return lab.y;
  const terrain=terrainHeight(x,z);
  if(terrain!==null)return terrain;
  if (inside(factoryRamp, x, z)) return slopeHeight(factorySlope, x, z);
  if (inside(dockRamp, x, z)) return slopeHeight(dockSlope, x, z);
  if (inside(factory, x, z) && y > 1.5) return factory.y;
  if (inside(dock, x, z)) return dock.y;
  return 0;
}

function supportHeight(solid:Solid,x:number,z:number){
  if(!solid.slope)return solid.max[1];
  // The capsule can overlap the last tread after its centre has reached the flat landing.
  if(solid.walkSurface){
    x=Math.max(solid.min[0],Math.min(solid.max[0],x));
    z=Math.max(solid.min[2],Math.min(solid.max[2],z));
  }
  return slopeHeight(solid.slope,x,z);
}

function blocksBody(solid: Solid, x: number, y: number, z: number, radius: number, height: number) {
  if (solid.max[1] <= y + .001 || solid.min[1] >= y + height) return false;
  // A capsule on a stair touches the adjoining landing edge before its feet reach the top.
  if(solid.walkSurface && !solid.slope && y>=solid.max[1]-.29 &&
      (x<solid.min[0] || x>solid.max[0] || z<solid.min[2] || z>solid.max[2]))return false;
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
  // Door bounds change only in Y. References in the horizontal index stay valid as shutters slide.
  const cellSize=12, margin=2, cells=new Map<string,Solid[]>(), empty:Solid[]=[];
  const cell=(n:number)=>Math.floor(n/cellSize);
  for(const solid of solids){
    for(let x=cell(solid.min[0]-margin);x<=cell(solid.max[0]+margin);x++){
      for(let z=cell(solid.min[2]-margin);z<=cell(solid.max[2]+margin);z++){
        const key=x+','+z, list=cells.get(key);
        if(list)list.push(solid);else cells.set(key,[solid]);
      }
    }
  }
  const nearby=(x:number,z:number,r:number)=>r<=margin ? cells.get(cell(x)+','+cell(z))??empty : solids;
  function groundHeight(from: Vec3, radius: number) {
    const [x, y, z] = from;
    let ground = floorAt(x, y, z);
    if (ground !== null && ground > y + .13) ground = null;
    for (const solid of nearby(x,z,radius)) {
      if (x < solid.min[0] - radius * .35 || x > solid.max[0] + radius * .35 ||
          z < solid.min[2] - radius * .35 || z > solid.max[2] + radius * .35) continue;
      const top = supportHeight(solid,x,z);
      if (top <= y + .13 && (ground === null || top > ground)) ground = top;
    }
    return ground;
  }
  function blocked(at: Vec3, radius: number, height: number) {
    if (!playableFootprint(at[0],at[2],radius))return true;
    return nearby(at[0],at[2],radius).some(solid => {
      if (!solid.slope) return blocksBody(solid, ...at, radius, height);
      const local: Vec3 = [at[0], at[1] - supportHeight(solid, at[0], at[2]), at[2]];
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
  function climbLedge(from: Vec3, forward: Vec3, radius: number, height: number): Ledge | null {
      let nearest = 1.15;
      let ledge: Solid | undefined;
      const origin: Vec3 = [from[0], from[1] + .5, from[2]];
      for (const solid of nearby(from[0],from[2],nearest)) {
        if (solid.floor || solid.slope || solid.max[1] - from[1] < .35 || solid.max[1] - from[1] > 1.85) continue;
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
      const faceX = from[0] + forward[0] * nearest;
      const faceZ = from[2] + forward[2] * nearest;
      const edge = ledge;
      const grip = (side: number): Vec3 => [
        Math.max(edge.min[0], Math.min(edge.max[0], faceX - side * forward[2] * .19 + forward[0] * .035)),
        edge.max[1] + .025,
        Math.max(edge.min[2], Math.min(edge.max[2], faceZ + side * forward[0] * .19 + forward[2] * .035)),
      ];
      return { landing: target, left: grip(-1), right: grip(1) };
  }
  return {
    groundHeight, moveBody, climbLedge,
    surfaceAt(at) {
      const [x,y,z] = at;
      for (const solid of nearby(x,z,.36)) {
        if (!solid.surface || x < solid.min[0] || x > solid.max[0] || z < solid.min[2] || z > solid.max[2]) continue;
        if (Math.abs(supportHeight(solid,x,z)-y) < .14) return solid.surface;
      }
      if (Math.abs(y-(terrainHeight(x,z)??0)) < .15 && [roads,footpaths].some(lanes => lanes.some(r=>x>=r.x1 && x<=r.x2 && z>=r.z1 && z<=r.z2))) return 'concrete';
      return 'gravel';
    },
    bodyClear: (at, radius, height) => !blocked(at, radius, height),
    climbTarget: (from, forward, radius, height) => climbLedge(from, forward, radius, height)?.landing ?? null,
    moveGrounded(from, dx, dz, radius, height) {
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .16));
      let [x, y, z] = from;
      function tryStep(toX: number, toZ: number) {
        if(!playableFootprint(toX,toZ,radius))return false;
        let toY = floorAt(toX, y, toZ);
        const local=nearby(toX,toZ,radius);
        for(const s of local){
          if(!s.walkSurface || toX<s.min[0] || toX>s.max[0] || toZ<s.min[2] || toZ>s.max[2])continue;
          const top=supportHeight(s,toX,toZ);
          if(Math.abs(top-y)<=.12 && (toY===null || top>toY))toY=top;
        }
        if (toY === null || Math.abs(toY - y) > .12) return false;
        if (local.some(solid => !solid.floor && blocksBody(solid, toX, toY, toZ, radius, height))) return false;
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
    impactNormal(point,direction){
      let best=0,normal:Vec3=[-direction[0],-direction[1],-direction[2]];
      for(const s of nearby(point[0],point[2],.01)){
        const local=[point[0],point[1]-(s.slope?slopeHeight(s.slope,point[0],point[2]):0),point[2]];
        if(local.some((v,i)=>v<s.min[i]-.004 || v>s.max[i]+.004))continue;
        for(let i=0;i<3;i++)for(const sign of [-1,1]){
          if(Math.abs(local[i]-(sign<0?s.min[i]:s.max[i]))>.004)continue;
          const face:[number,number,number]=[0,0,0];face[i]=sign;
          if(i===1 && s.slope)face[s.slope.axis]=-sign*s.slope.gradient;
          const length=Math.hypot(...face), facing=-(face[0]*direction[0]+face[1]*direction[1]+face[2]*direction[2])/length;
          if(facing>best){best=facing;normal=[face[0]/length,face[1]/length,face[2]/length];}
        }
      }
      return normal;
    },
    blockedDistance(origin, direction, maxDistance) {
      let nearest: number | null = null;
      const dx=direction[0],dz=direction[2];
      if(!Number.isFinite(maxDistance) || maxDistance*Math.max(Math.abs(dx),Math.abs(dz))>1000){
        for(const solid of solids)nearest=rayHit(solid,origin,direction,nearest??maxDistance)??nearest;
        return nearest;
      }
      let x=cell(origin[0]),z=cell(origin[2]);
      const sx=Math.sign(dx),sz=Math.sign(dz);
      const stepX=dx?cellSize/Math.abs(dx):Infinity,stepZ=dz?cellSize/Math.abs(dz):Infinity;
      let edgeX=dx?((x+(dx>0?1:0))*cellSize-origin[0])/dx:Infinity;
      let edgeZ=dz?((z+(dz>0?1:0))*cellSize-origin[2])/dz:Infinity;
      for(;;){
        for(const solid of cells.get(x+','+z)??empty)nearest=rayHit(solid,origin,direction,nearest??maxDistance)??nearest;
        const next=Math.min(edgeX,edgeZ);
        if(next>=(nearest??maxDistance))break;
        if(edgeX===next){x+=sx;edgeX+=stepX;}
        if(edgeZ===next){z+=sz;edgeZ+=stepZ;}
      }
      return nearest;
    },
  };
}
