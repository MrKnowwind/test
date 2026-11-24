import type { ShotTrace, EnemyState, Vec3, WorldQueries } from '../contracts/demo.ts';
import { enemySpecs } from '../enemies/specs.ts';

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
): ShotTrace | undefined {
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
  const sightHit=world.blockedDistance(origin,direction,distance);
  const point=(a:Vec3,v:Vec3,d:number):Vec3=>[a[0]+v[0]*d,a[1]+v[1]*d,a[2]+v[2]*d];
  const end=point(origin,direction,sightHit??distance);
  function cover(from:Vec3,to:Vec3,dir:Vec3):ShotTrace {
    const normal=world.impactNormal?.(to,dir);
    return normal?{from,to,surface:'cover',normal}:{from,to,surface:'cover'};
  }
  function obstruction(from:Vec3,to:Vec3):ShotTrace|undefined{
    const dx=to[0]-from[0],dy=to[1]-from[1],dz=to[2]-from[2],length=Math.hypot(dx,dy,dz);
    if(length<.00001)return;
    const dir:Vec3=[dx/length,dy/length,dz/length];
    const hit=world.blockedDistance(from,dir,length);
    if(hit!==null)return cover(from,point(from,dir,hit),dir);
  }
  if(muzzle){
    const obstructionHit=obstruction(origin,muzzle)??obstruction(muzzle,end);
    if(obstructionHit)return obstructionHit;
  }
  const from=muzzle??origin;
  if(sightHit!==null)return cover(from,end,direction);
  if(!target)return {from,to:end,surface:'air'};
  target.health=Math.max(0,target.health-damage);
  if(target.health===0){
    target.action='dead';
    target.actionProgress=0;
  }
  return {from,to:end,surface:target.kind};
}
