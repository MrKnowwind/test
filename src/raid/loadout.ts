import { createBackpack, type Cargo, type Placement } from './backpack.ts';
import { itemSpecs, type ItemId, type PackId } from './catalog.ts';

export const supplyItems = ['pistol-ammo', 'medkit', 'healing-injector'] as const;
export type Supply = typeof supplyItems[number];
export type PreparedPlacement = Placement & { item: ItemId; quantity: number; issued?:number };
export const isMaterial = (item: ItemId) => ['mechanical','electronics','shipping','research'].includes(itemSpecs[item].tag);
type WeaponSource = 'issued' | 'warehouse';
export type Loadout = {
  pack?: PackId;
  pistol?: WeaponSource;
  knife?: WeaponSource;
  cargo?: Partial<Record<ItemId, number>>;
  layout?: PreparedPlacement[];
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
  for (const item of Object.keys(plan.cargo ?? {}) as ItemId[])
    if (itemSpecs[item] && isMaterial(item) && plan.cargo![item]) requested.push([item, plan.cargo![item]!]);
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
    if ((supplyItems.some(item => item === cargo.item) || isMaterial(cargo.item)) && !bag.receive(cargo)) return;
  if (plan.layout) {
    // Reapply the player's arrangement using the actual requisition, preserving issued rounds and individual durability.
    const pool = bag.entries.map(entry => ({...entry}));
    for (const entry of [...bag.entries]) bag.remove(entry.id);
    for (const placement of plan.layout) {
      if (!Number.isSafeInteger(placement.quantity) || placement.quantity<=0 || !placement.section ||
          !Object.hasOwn(itemSpecs,placement.item) || placement.quantity>itemSpecs[placement.item].stack) return;
      let remaining = placement.quantity;
      let freeRemaining=placement.issued;
      if(freeRemaining!==undefined&&(!Number.isSafeInteger(freeRemaining)||freeRemaining<0||freeRemaining>remaining))return;
      for (const entry of pool) {
        if (entry.item !== placement.item || !entry.quantity || !remaining) continue;
        const free=Math.min(entry.issued??0,freeRemaining??remaining);
        const paid=Math.min(entry.quantity-(entry.issued??0),remaining-(freeRemaining??free));
        if(free+paid<=0)continue;
        const cargo={...entry,quantity:free+paid,issued:free};
        if (!bag.receive(cargo, placement)) return;
        entry.quantity -= cargo.quantity;
        entry.issued = (entry.issued ?? 0) - free;
        remaining -= cargo.quantity;
        if(freeRemaining!==undefined)freeRemaining-=free;
      }
      if (remaining || freeRemaining) return;
    }
    if (pool.some(entry => entry.quantity)) return;
  }
  return bag;
}
