/** Positions are in meters and time in seconds. */
export type Vec3 = readonly [x: number, y: number, z: number];
export type WeaponId = 'knife' | 'pistol' | 'rifle' | 'shotgun';
export type EnemyKind = 'infected' | 'security-bot';
import type { ItemId } from '../raid/catalog.ts';
export type { ItemId } from '../raid/catalog.ts';
export type FlagId = 'lab-power';

export interface SpawnPoint {
  id: string;
  position: Vec3;
  yaw: number;
}

export interface EnemySpawn extends SpawnPoint {
  kind: EnemyKind;
}

export type ExitRequirement =
  | { kind: 'item'; id: 'service-card' }
  | { kind: 'flag'; id: FlagId };

export interface ExitZone {
  id: string;
  label: string;
  position: Vec3;
  radius: number;
  requirements: readonly ExitRequirement[];
}

export type MapInteraction = { id: string; label: string; position: Vec3 } & (
  | { kind: 'loot'; item: ItemId; quantity: number }
  | { kind: 'loose'; item:ItemId; quantity:number }
  | { kind: 'door' }
  | { kind: 'switch'; flag: FlagId }
);

export interface WorldQueries {
  moveGrounded(from: Vec3, dx: number, dz: number, radius: number, height: number): Vec3;
  /** Player movement with airborne collision. Legacy grounded callers remain supported. */
  moveBody?(from: Vec3, dx: number, dy: number, dz: number, radius: number, height: number): Vec3;
  groundHeight?(from: Vec3, radius: number): number | null;
  climbTarget?(from: Vec3, forward: Vec3, radius: number, height: number): Vec3 | null;
  /** Returns the first solid hit distance for a normalized direction, or null on a miss. */
  impactNormal?(point:Vec3,direction:Vec3):Vec3;
  blockedDistance(origin: Vec3, direction: Vec3, maxDistance: number): number | null;
}

export interface FirstMap extends WorldQueries {
  spawnPoints: readonly SpawnPoint[];
  exits: readonly ExitZone[];
  interactions: readonly MapInteraction[];
  enemies: readonly EnemySpawn[];
  regions?: readonly { id: string; label: string; center: Vec3; radius: number }[];
}

export interface WeaponState {
  unarmed?:boolean;
  id: WeaponId;
  aiming: boolean;
  action: 'ready' | 'firing' | 'reloading' | 'slashing';
  actionProgress: number;
  loaded: number;
  reserve: number;
}

export interface EnemyState extends EnemySpawn {
  intent?:'patrol'|'investigate'|'chase'|'search';
  health: number;
  action: 'idle' | 'moving' | 'windup' | 'attacking' | 'recovering' | 'dead';
  actionProgress: number;
}

export interface CombatInput {
  playerFeet: Vec3;
  eye: Vec3;
  aimDirection: Vec3;
  muzzle: Vec3;
  stepRadius?:number;
  treating?:boolean;
  attackPressed: boolean;
  reloadPressed: boolean;
  aiming: boolean;
  switchTo?: WeaponId;
}

export type ShotTrace = { from:Vec3; to:Vec3; surface:'air'|'cover'|EnemyKind; normal?:Vec3 };
export interface CombatFrame {
  shot?:ShotTrace;
  creative?:boolean;
  lastHit?:EnemyKind;
  hitOrigin?:Vec3;
  health: number;
  weapon: WeaponState;
  enemies: readonly EnemyState[];
  feedback?: 'hit' | 'blocked' | 'empty';
}

export interface Combat {
  setCreative(active:boolean):void;
  snapshot(): CombatFrame;
  update(dt: number, input: CombatInput): CombatFrame;
  addReserve(amount: number): void;
  heal(amount: number): void;
}
