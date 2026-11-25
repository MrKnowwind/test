import type { EnemyKind } from '../contracts/demo.ts';

export const enemySpecs = {
  infected: {
    health: 90, radius: 0.36, height: 1.9, attackHeight: 1.25,
    range: 1.6, windup: 0.46, attacking: 0.18, recovery: 0.40, damage: 25,
  },
  'security-bot': {
    health: 60, radius: 0.43, height: 1.5, attackHeight: 1.0,
    range: 11, windup: 0.72, attacking: 0.2, recovery: 0.65, damage: 20,
  },
} satisfies Record<EnemyKind, {
  health: number; radius: number; height: number; attackHeight: number;
  range: number; windup: number; attacking: number; recovery: number; damage: number;
}>;
