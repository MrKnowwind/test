import { createBackpack, type Cargo } from './backpack.ts';
import type { ItemId, PackId } from './catalog.ts';

export const supplyItems = ['pistol-ammo', 'medkit', 'healing-injector'] as const;
export type Supply = typeof supplyItems[number];
type WeaponSource = 'issued' | 'warehouse';
export type Loadout = {
  pack?: PackId;
  pistol?: WeaponSource;
  knife?: WeaponSource;
} & Partial<Record<Supply, number>>;

export const defaultLoadout: Loadout = { pistol: 'issued', knife: 'issued' };
export const issuedRounds = 15;

export function loadoutRequests(plan: Loadout) {
  const requested: [ItemId, number][] = [];
  if (plan.pack) requested.push([plan.pack, 1]);
  for (const weapon of ['pistol', 'knife'] as const)
    if (plan[weapon] === 'warehouse') requested.push([weapon, 1]);
  for (const item of supplyItems)
    if (plan[item]) requested.push([item, plan[item]!]);
  return requested;
}

export function buildLoadout(runId: string, plan: Loadout, stock: readonly Cargo[]) {
  const bag = createBackpack(3, 2, true);
  if (plan.pack) {
    const pack = stock.find(cargo => cargo.item === plan.pack);
    if (!pack) return;
    bag.swap(pack);
  }
  for (const weapon of ['pistol', 'knife'] as const) {
    const source = plan[weapon];
    if (!source) continue;
    const cargo = source === 'issued'
      ? { item: weapon, quantity: 1, issued: 1, loaded: weapon === 'pistol' ? 8 : undefined, instance: runId + '/' + weapon }
      : stock.find(cargo => cargo.item === weapon);
    if (!cargo) return;
    bag.slots[weapon] = { ...cargo };
  }
  if (plan.pistol === 'issued') bag.receive({ item: 'pistol-ammo', quantity: issuedRounds, issued: issuedRounds });
  for (const cargo of stock)
    if (supplyItems.some(item => item === cargo.item) && !bag.receive(cargo)) return;
  return bag;
}
