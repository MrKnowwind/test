import type { Combat, CombatFrame, CombatInput, EnemySpawn, WeaponState, WorldQueries } from '../contracts/demo.ts';
import { createEnemy } from '../enemies/createEnemy.ts';
import {soundPath,distance} from '../enemies/perception.ts';
import type {Vec3} from '../contracts/demo.ts';
import { strike } from './targeting.ts';
import { isShield, shieldCharge, shields } from '../raid/catalog.ts';

const MAX_HEALTH = 100;
const MAGAZINE_SIZE = 8;
const STARTING_RESERVE = 15;
const SHOT_INTERVAL = 1 / 2.5;
const RELOAD_TIME = 1.6;
const PISTOL_RANGE = 45;
const PISTOL_DAMAGE = 30;
const KNIFE_RANGE = 1.55;
const KNIFE_DAMAGE = 35;
const KNIFE_INTERVAL = 0.65;
// The blade contacts its target at 36% of the visible action.
const KNIFE_CONTACT_REMAINING = KNIFE_INTERVAL * (1 - 0.36);
const TIME_EPSILON = 1e-8;

export function createCombat(world: WorldQueries, spawns: readonly EnemySpawn[], kit?:ReturnType<typeof import('../raid/backpack.ts').createBackpack>): Combat {
  let health = MAX_HEALTH;
  let shieldHit=0;
  let creative=false;
  const weapon: WeaponState = {
    id: 'pistol', aiming: false, action: 'ready', actionProgress: 0,
    loaded: MAGAZINE_SIZE, magazineCapacity: MAGAZINE_SIZE, reserve: STARTING_RESERVE,
  };
  const agents = spawns.map((spawn) => createEnemy(world, spawn));
  const enemies = agents.map(({ state }) => state);
  let hitOrigin:Vec3|undefined,noiseTime=0;
  let previousNoise:{point:Vec3;time:number;radius:number}|undefined;
  function emitNoise(point:Vec3,radius:number){
    if(creative)return;
    if(previousNoise && noiseTime-previousNoise.time<1.5 && radius<=previousNoise.radius && distance(point,previousNoise.point)<2.5)return;
    previousNoise={point:[...point],time:noiseTime,radius};
    const listeners=agents.filter(a=>a.state.health>0 && distance(a.state.position,point)<=radius)
      .map(agent=>({agent,d:soundPath(world,agent.state.position,point)})).filter(a=>a.d<=radius).sort((a,b)=>a.d-b.d);
    for(const {agent} of listeners.slice(0,2))agent.hear(point);
  }
  let lastHit:EnemySpawn['kind']|undefined;
  let attackHeld = false;
  let attackCooldown = 0;
  let actionRemaining = 0;
  let actionDuration = 0;
  let reloadRequested = false;
  let shot:CombatFrame['shot'];
  let feedback: CombatFrame['feedback'];

  function contact(input:CombatInput,range:number,damage:number,firearm:boolean){
    const trace=strike(world,enemies,input.eye,input.aimDirection,range,damage,firearm?input.muzzle:undefined);
    if(firearm)shot=trace;
    feedback=trace?.surface==='cover'?'blocked':trace && trace.surface!=='air'?'hit':undefined;
  }

  function startAction(action: WeaponState['action'], duration = 0) {
    weapon.action = action;
    weapon.actionProgress = 0;
    actionDuration = duration;
    actionRemaining = duration;
  }

  let equippedId=kit?.slots.pistol?.instance;
  function syncEquipment() {
    if(!kit)return;
    const active=weapon.id==='knife'?kit.slots.knife:kit.slots.pistol;
    const next=active??kit.slots.pistol??kit.slots.knife;
    if(next?.instance!==equippedId){
      startAction('ready');reloadRequested=false;weapon.aiming=false;
      equippedId=next?.instance;
      if(next)weapon.id=next.item==='knife'?'knife':'pistol';
    }
    weapon.loaded=kit.slots.pistol?.loaded??0;weapon.reserve=kit.ammoCount();
    weapon.unarmed=!next;
  }
  function advanceAction(dt: number, input: CombatInput) {
    if (weapon.action === 'ready') return;
    const previous = actionRemaining;
    actionRemaining -= dt;
    if (weapon.action === 'slashing' && previous > KNIFE_CONTACT_REMAINING + TIME_EPSILON
      && actionRemaining <= KNIFE_CONTACT_REMAINING + TIME_EPSILON) {
      contact(input,KNIFE_RANGE,KNIFE_DAMAGE,false);
    }
    if (actionRemaining > TIME_EPSILON) {
      weapon.actionProgress = 1 - actionRemaining / actionDuration;
      return;
    }
    if (weapon.action === 'reloading') {
      const rounds = Math.min(MAGAZINE_SIZE - weapon.loaded, weapon.reserve);
      weapon.loaded += rounds;
      weapon.reserve -= rounds;
      kit?.takeAmmo(rounds);
    }
    startAction('ready');
  }

  function updateWeapon(dt: number, input: CombatInput) {
    const attack = input.attackPressed && !attackHeld;
    attackHeld = input.attackPressed;
    attackCooldown = Math.max(0, attackCooldown - dt);
    const available = (input.switchTo === 'knife' || input.switchTo === 'pistol') && (!kit||kit.slots[input.switchTo]);
    if (available && input.switchTo && input.switchTo !== weapon.id) {
      weapon.id = input.switchTo;
      if(kit&&(input.switchTo==='pistol'||input.switchTo==='knife'))equippedId=kit.slots[input.switchTo]?.instance;
      reloadRequested = false;
      startAction('ready');
    }
    if (weapon.id === 'pistol' && input.reloadPressed && weapon.action !== 'reloading'
      && weapon.loaded < MAGAZINE_SIZE && weapon.reserve > 0) reloadRequested = true;
    advanceAction(dt, input);
    if (weapon.action === 'ready') {
      if (weapon.id === 'pistol' && reloadRequested) {
        reloadRequested = false;
        startAction('reloading', RELOAD_TIME);
      } else if (attack && attackCooldown <= TIME_EPSILON) {
        if (weapon.id === 'knife') {
          attackCooldown = KNIFE_INTERVAL;
          startAction('slashing', KNIFE_INTERVAL);
        } else if (weapon.loaded === 0) {
          feedback = 'empty';
        } else {
          weapon.loaded -= 1;
          emitNoise(input.playerFeet,28);
          attackCooldown = SHOT_INTERVAL;
          startAction('firing', SHOT_INTERVAL);
          contact(input,PISTOL_RANGE,PISTOL_DAMAGE,true);
        }
      }
    }
    weapon.aiming = weapon.id === 'pistol' && input.aiming && weapon.action !== 'reloading';
  }

  function snapshot(): CombatFrame {
    const frame: CombatFrame = {
      health:creative?MAX_HEALTH:health,creative,lastHit,hitOrigin,
      weapon: { ...weapon },
      enemies: enemies.map((enemy) => ({ ...enemy, position: [...enemy.position] })),
    };
    const armor=kit?.slots.shield;
    if(armor&&isShield(armor.item))frame.shield={item:armor.item,charge:shieldCharge(armor.item,armor.charge),capacity:shields[armor.item]};
    if(shieldHit)frame.shieldHit=shieldHit;
    if(shot)frame.shot=shot;
    if (feedback) frame.feedback = feedback;
    return frame;
  }

  syncEquipment();
  return {
    snapshot,
    setCreative(active){
      creative=active;
      previousNoise=undefined;
      if(active)for(const agent of agents)agent.forgetPlayer();
    },
    update(dt, input) {
      shot = feedback = undefined;
      shieldHit=0;
      if (health <= 0) return snapshot();
      noiseTime+=dt;
      if(input.stepRadius)emitNoise(input.playerFeet,input.stepRadius);
      syncEquipment();
      if(input.treating || input.handsBusy){reloadRequested=false;startAction('ready');weapon.aiming=false;attackHeld=input.attackPressed;}else if(!weapon.unarmed)updateWeapon(dt,input);
      if(kit?.slots.pistol)kit.slots.pistol.loaded=weapon.loaded;
      for (const agent of agents) {
        const damage=agent.update(dt,input,creative);
        if(!creative && damage>0){
          hitOrigin=[...agent.state.position];lastHit=agent.state.kind;
          const armor=kit?.slots.shield;
          let absorbed=0;
          if(armor&&isShield(armor.item)){
            const charge=shieldCharge(armor.item,armor.charge);
            absorbed=Math.min(charge,damage);
            armor.charge=charge-absorbed;
            shieldHit+=absorbed;
          }
          health=Math.max(0,health-(damage-absorbed));
        }
        if (health === 0) {
          reloadRequested = false;
          startAction('ready');
          weapon.aiming = false;
          break;
        }
      }
      return snapshot();
    },
    addReserve(amount) {
      if (health > 0 && Number.isFinite(amount) && amount > 0) {
        if(kit)kit.add('pistol-ammo',Math.floor(amount));else weapon.reserve+=Math.floor(amount);
      }
    },
    heal(amount) {
      if (health > 0 && Number.isFinite(amount) && amount > 0) {
        health = Math.min(MAX_HEALTH, health + Math.floor(amount));
      }
    },
  };
}
