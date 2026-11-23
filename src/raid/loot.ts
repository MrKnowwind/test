import { itemSpecs, type Tag, type ItemId, type PackId } from './catalog.ts';
export type Risk = 'outer' | 'district' | 'high';
export const tiers: Record<Risk, number[]> = {
  outer: [4025, 3600, 1500, 600, 200, 70, 5],
  district: [3635, 3200, 1700, 900, 400, 150, 15],
  high: [2965, 2700, 2000, 1300, 700, 300, 35],
};
export function roll(seed: number, id: string, draw: number) {
  let h = (seed ^ 0x51c3b1a9) >>> 0;
  for (const ch of 'cel-port/loot-v1/' + id + '/' + draw) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function tier(weights: readonly number[], u: number) {
  let n = u * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    n -= weights[i];
    if (n < 0) return i;
  }
  return weights.length - 1;
}
export const pools: Record<Tag, ItemId[]> = {
  mechanical: ['coil', 'seals', 'valve', 'turbine', 'salvage', 'wrench'],
  electronics: ['terminal', 'gauge', 'board', 'servo', 'core'],
  shipping: ['sealbag', 'manual', 'lens', 'recorder'],
  research: ['tray', 'calibration', 'spectrum', 'archive', 'research-sample'],
  ammo: ['pistol-ammo', 'terminal', 'gauge'],
  medical: ['medkit', 'tray', 'seals'],
  carry: [],
  weapon: [],
};
export function drawLoose(
  seed: number,
  id: string,
  tag: Tag,
  risk: Risk,
  allowed: readonly ItemId[] = pools[tag],
) {
  const rank = tier(tiers[risk], roll(seed, id, 0)) - 1;
  const candidates = [...new Set(allowed)].filter((i) => itemSpecs[i].rank === rank);
  return candidates[Math.floor(roll(seed, id, 1) * candidates.length)];
}
export const caseTypes = {
  tin: [4, 2, 2, 3],
  medical: [4, 3, 2, 3],
  tool: [5, 3, 3, 5],
  drawers: [3, 4, 3, 5],
  crate: [6, 4, 5, 8],
  locker: [5, 4, 3, 5],
  cold: [4, 3, 2, 3],
  panel: [4, 2, 2, 3],
  files: [3, 4, 3, 5],
  cage: [6, 4, 5, 8],
  carrier: [5, 4, 3, 5],
} as const;
export type CaseKind = keyof typeof caseTypes;
type Profile = {
  kind: CaseKind;
  tag: Tag;
  bags?: PackId[];
  chance?: number;
  bonus?: boolean;
  task?: ItemId;
  extra?: ItemId[];
};
export function caseProfile(id: string, item: ItemId): Profile {
  switch (id) {
    case 'triage-stock':
      return { kind: 'medical', tag: 'medical', task: 'medkit' };
    case 'depot-stock':
      return { kind: 'tin', tag: 'ammo', task: 'pistol-ammo' };
    case 'duty-card':
      return { kind: 'files', tag: 'shipping', task: 'service-card' };
    case 'plant-workshop':
      return { kind: 'panel', tag: 'electronics' };
    case 'transit-tools':
      return {
        kind: 'cage',
        tag: 'mechanical',
        extra: ['pump'],
        bags: ['tube', 'longpack'],
        chance: 0.42,
        bonus: true,
      };
    case 'lab-research':
      return { kind: 'carrier', tag: 'research', bonus: true };
    case 'triage-tools':
    case 'depot-tools':
      return { kind: 'locker', tag: 'medical', bags: ['daypack', 'sling'], chance: 0.8 };
    case 'pump-tools':
      return { kind: 'tool', tag: 'mechanical', bags: ['repairpack'], chance: 0.85 };
    case 'customs-tools':
    case 'relay-tools':
      return { kind: 'locker', tag: 'shipping', bags: ['alpine'], chance: 0.55 };
    case 'research-office':
    case 'workshop-supplies':
      return { kind: 'locker', tag: 'shipping', bags: ['school'], chance: 0.5 };
    case 'yard-salvage':
      return { kind: 'crate', tag: 'shipping', bags: ['longpack', 'tube'], chance: 0.55 };
  }
  const tag = itemSpecs[item].tag;
  if (tag === 'research')
    return { kind: 'cold', tag: id.startsWith('lab-') ? 'research' : 'electronics', bonus: true };
  if (tag === 'ammo') return { kind: 'tin', tag };
  if (tag === 'medical') return { kind: 'medical', tag };
  if (tag === 'shipping') return { kind: 'drawers', tag };
  return { kind: 'crate', tag: 'mechanical' };
}
