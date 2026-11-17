import type { Combat, CombatFrame, CombatInput, EnemySpawn, WeaponState, WorldQueries } from '../contracts/demo.ts';
import { createEnemy } from '../enemies/createEnemy.ts';
import { strike } from './targeting.ts';

const MAX_HEALTH = 100;
const MAGAZINE_SIZE = 6;
const STARTING_RESERVE = 6;
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

export function createCombat(world: WorldQueries, spawns: readonly EnemySpawn[]): Combat {
  let health = MAX_HEALTH;
  const weapon: WeaponState = {
    id: 'pistol', aiming: false, action: 'ready', actionProgress: 0,
    loaded: MAGAZINE_SIZE, reserve: STARTING_RESERVE,
  };
  const agents = spawns.map((spawn) => createEnemy(world, spawn));
  const enemies = agents.map(({ state }) => state);
  let attackHeld = false;
  let attackCooldown = 0;
  let actionRemaining = 0;
  let actionDuration = 0;
  let reloadRequested = false;
  let feedback: CombatFrame['feedback'];

  function startAction(action: WeaponState['action'], duration = 0) {
    weapon.action = action;
    weapon.actionProgress = 0;
    actionDuration = duration;
    actionRemaining = duration;
  }

  function advanceAction(dt: number, input: CombatInput) {
    if (weapon.action === 'ready') return;
    const previous = actionRemaining;
    actionRemaining -= dt;
    if (weapon.action === 'slashing' && previous > KNIFE_CONTACT_REMAINING + TIME_EPSILON
      && actionRemaining <= KNIFE_CONTACT_REMAINING + TIME_EPSILON) {
      feedback = strike(world, enemies, input.eye, input.aimDirection, KNIFE_RANGE, KNIFE_DAMAGE);
    }
    if (actionRemaining > TIME_EPSILON) {
      weapon.actionProgress = 1 - actionRemaining / actionDuration;
      return;
    }
    if (weapon.action === 'reloading') {
      const rounds = Math.min(MAGAZINE_SIZE - weapon.loaded, weapon.reserve);
      weapon.loaded += rounds;
      weapon.reserve -= rounds;
    }
    startAction('ready');
  }

  function updateWeapon(dt: number, input: CombatInput) {
    const attack = input.attackPressed && !attackHeld;
    attackHeld = input.attackPressed;
    attackCooldown = Math.max(0, attackCooldown - dt);
    const available = input.switchTo === 'knife' || input.switchTo === 'pistol';
    if (available && input.switchTo && input.switchTo !== weapon.id) {
      weapon.id = input.switchTo;
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
          attackCooldown = SHOT_INTERVAL;
          startAction('firing', SHOT_INTERVAL);
          feedback = strike(world, enemies, input.eye, input.aimDirection, PISTOL_RANGE, PISTOL_DAMAGE, input.muzzle);
        }
      }
    }
    weapon.aiming = weapon.id === 'pistol' && input.aiming && weapon.action !== 'reloading';
  }

  function snapshot(): CombatFrame {
    const frame: CombatFrame = {
      health,
      weapon: { ...weapon },
      enemies: enemies.map((enemy) => ({ ...enemy, position: [...enemy.position] })),
    };
    if (feedback) frame.feedback = feedback;
    return frame;
  }

  return {
    snapshot,
    update(dt, input) {
      feedback = undefined;
      if (health <= 0) return snapshot();
      updateWeapon(dt, input);
      for (const agent of agents) {
        health = Math.max(0, health - agent.update(dt, input));
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
      if (health > 0 && Number.isFinite(amount) && amount > 0) weapon.reserve += Math.floor(amount);
    },
    heal(amount) {
      if (health > 0 && Number.isFinite(amount) && amount > 0) {
        health = Math.min(MAX_HEALTH, health + Math.floor(amount));
      }
    },
  };
}
