import { Group } from 'three';
import type { EnemyKind, EnemyState } from '../contracts/demo.ts';
import { makeInfected } from './infectedModel.ts';
import { makeSecurityBot } from './securityModel.ts';

export function createEnemyVisual(kind: EnemyKind) {
  const group = new Group();
  group.name = kind;
  const update = kind === 'infected' ? makeInfected(group) : makeSecurityBot(group);
  let previousHealth:number|undefined, flinch=0;
  return {group,update(dt:number,state:EnemyState){
    if(previousHealth!==undefined && state.health<previousHealth)flinch=.17;
    previousHealth=state.health;
    flinch=Math.max(0,flinch-dt);
    const contact=state.health>0?Math.sin(flinch/.17*Math.PI):0;
    group.rotation.x=-.09*contact;group.rotation.z=.045*contact;
    update(dt,state);
  }};
}
