import { Group } from 'three';
import type { EnemyKind } from '../contracts/demo.ts';
import { makeInfected } from './infectedModel.ts';
import { makeSecurityBot } from './securityModel.ts';

export function createEnemyVisual(kind: EnemyKind) {
  const group = new Group();
  group.name = kind;
  const update = kind === 'infected' ? makeInfected(group) : makeSecurityBot(group);
  return { group, update };
}
