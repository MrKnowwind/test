import { distantEnemy } from './distantEnemy.ts';
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

export function createRaidEnemy(kind:EnemyKind){
  const group=new Group(), detailed=createEnemyVisual(kind), far=distantEnemy(kind);
  group.add(detailed.group);
  let distant=false,phase=0;
  return {group,restore(){group.add(detailed.group,far);}, update(dt:number,state:EnemyState,distance:number){
    const useFar=distance>(distant?44:50);
    if(useFar!==distant){
      (useFar?detailed.group:far).removeFromParent();
      group.add(useFar?far:detailed.group);
      distant=useFar;
    }
    if(!distant){detailed.update(dt,state);return;}
    phase+=dt*8;
    const down=state.action==='dead';
    far.rotation.set(down?-Math.PI/2:state.action==='windup'?-.13:0,0,0);
    far.position.y=down?.29:state.action==='moving'?Math.abs(Math.sin(phase))*.047:0;
  }};
}
