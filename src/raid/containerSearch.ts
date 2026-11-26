import { caseProfile, caseTypes, roll, tier, pools } from './loot.ts';
import { itemSpecs, searchSeconds } from './catalog.ts';
import type { ItemId, MapInteraction } from '../contracts/demo.ts';
import { createBackpack, type BagEntry } from './backpack.ts';
export interface SearchEntry extends BagEntry {
  progress: number;
  duration: number;
  revealed: boolean;
}
export interface SearchContainer {
  id: string;
  width: number;
  height: number;
  sections?: import('./catalog.ts').Section[];
  entries: SearchEntry[];
}

export function createContainerSearch(seed: number, interactions: readonly MapInteraction[]) {
  const containers = new Map<string, SearchContainer>();
  for (const source of interactions) {
    if (source.kind !== 'loot') continue;
    const profile = caseProfile(source.id, source.item);
    const [width, height, min, max] = caseTypes[profile.kind];
    const grid = createBackpack(width, height);
    const random = (n: number) => roll(seed, source.id, n);
    const pool = [...pools[profile.tag], ...(profile.extra ?? [])];
    if (profile.task) grid.add(profile.task, profile.task === 'pistol-ammo' ? 6 : 1);
    if (profile.bonus) {
      const rank = [-1, 2, 3, 4, 5][tier([737, 180, 60, 20, 3], random(1))];
      const choices = pool.filter((i) => itemSpecs[i].rank === rank);
      const reward = choices[Math.floor(random(2) * choices.length)];
      if (reward) grid.add(reward, 1);
    }
    if (profile.bags && random(3) < (profile.chance ?? 0)) {
      const bag = profile.bags[Math.floor(random(4) * profile.bags.length)];
      grid.receive({ item: bag, quantity: 1, instance: source.id + '/pack' });
    }
    const goal = min + Math.floor(random(5) * (max - min + 1));
    // Basic rolls place individual stacks. Ammo stacks keep their own searchable slot.
    for (let i = 0; i < goal; i++) {
      const rank = tier([700, 220, 70, 9, 1], random(10 + 3 * i));
      const fits = pool.filter((item) => grid.canFit({ item, quantity: 1 }));
      let choices: ItemId[] = [];
      for (let r = rank; r >= 0 && !choices.length; r--)
        choices = fits.filter((item) => itemSpecs[item].rank === r);
      if (!choices.length && profile.tag === 'medical') choices = fits.filter((item) => item === 'medkit');
      if (!choices.length) continue;
      const item = choices[Math.floor(random(11 + 3 * i) * choices.length)];
      const n = item === 'pistol-ammo' ? 3 + Math.floor(random(12 + 3 * i) * 7) : 1;
      const pos = grid.room({ item, quantity: n });
      if (pos) grid.place(item, n, pos.x, pos.y, pos.rotated);
    }
    // Independent equipment roll preserves existing material and quest placement.
    if (['locker','cage','carrier'].includes(profile.kind) && random(101)<.32) {
      const choices:ItemId[]=profile.kind==='carrier'
        ? ['shield-green','shield-blue','shield-blue','shield-purple','shield-red','head-survey']
        : ['shield-white','shield-white','shield-green','head-scout','shield-cell'];
      grid.add(choices[Math.floor(random(102)*choices.length)],1);
    } else if(profile.kind==='medical' && random(103)<.22)grid.add('shield-cell',1);
    const entries = grid.entries.map((e) => ({
      ...e,
      progress: 0,
      revealed: false,
      duration: searchSeconds[itemSpecs[e.item].rank],
    }));
    entries.sort(
      (a, b) =>
        Number(b.item === profile.task) - Number(a.item === profile.task) ||
        itemSpecs[a.item].rank - itemSpecs[b.item].rank,
    );
    containers.set(source.id, { id: source.id, width, height, entries });
  }
  function search(id: string, dt: number) {
    const container = containers.get(id);
    if (!container || !Number.isFinite(dt) || dt <= 0) return 0;
    let completed = 0;
    for (const entry of container.entries) {
      if (entry.revealed) continue;
      const elapsed = Math.min(dt, entry.duration - entry.progress);
      entry.progress += elapsed;
      dt -= elapsed;
      if (entry.progress >= entry.duration - 1e-9) {
        entry.revealed = true;
        completed++;
      }
      if (dt <= 0) break;
    }
    return completed;
  }
  return { containers, search };
}
export type { Placement } from './backpack.ts';
