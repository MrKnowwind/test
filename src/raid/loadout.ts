import { createBackpack, type Cargo, type Placement } from './backpack.ts';
import { equipSlot, isShield, itemSpecs, shieldCharge, type ItemId, type PackId, type ShieldId, type HeadId } from './catalog.ts';

export const supplyItems = ['pistol-ammo', 'medkit', 'healing-injector','shield-cell'] as const;
export type Supply = typeof supplyItems[number];
export type PreparedPlacement = Placement & { item: ItemId; quantity: number; issued?:number };
export const isMaterial = (item: ItemId) => 'art' in itemSpecs[item] || ['mechanical','electronics','shipping','research'].includes(itemSpecs[item].tag);
export const isCarryCargo = (item:ItemId) => isMaterial(item) || !!equipSlot(item);
type WeaponSource = 'issued' | 'warehouse';
export type Loadout = {
  pack?: PackId;
  pistol?: WeaponSource;
  knife?: WeaponSource;
  shield?:ShieldId;
  head?:HeadId;
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
  if(plan.shield)requested.push([plan.shield,1]);
  if(plan.head)requested.push([plan.head,1]);
  for (const item of supplyItems)
    if (plan[item]) requested.push([item, plan[item]!]);
  for (const item of Object.keys(plan.cargo ?? {}) as ItemId[])
    if (itemSpecs[item] && isCarryCargo(item) && plan.cargo![item]) requested.push([item, plan.cargo![item]!]);
  const combined=new Map<ItemId,number>();
  for(const [item,quantity] of requested)combined.set(item,(combined.get(item)??0)+quantity);
  return [...combined];
}

export function buildLoadout(runId: string, plan: Loadout, stock: readonly Cargo[]) {
  const bag = createBackpack(3, 2, true);
  const remaining=[...stock];
  const take=(item:ItemId)=>{
    const index=remaining.findIndex(cargo=>cargo.item===item);
    return index>=0?remaining.splice(index,1)[0]:undefined;
  };
  if (plan.pack) {
    const pack = take(plan.pack);
    if (!pack) return;
    bag.swap(pack);
  }
  for (const weapon of ['pistol', 'knife'] as const) {
    const source = plan[weapon];
    if (!source) continue;
    const cargo = source === 'issued'
      ? { item: weapon, quantity: 1, issued: 1, loaded: weapon === 'pistol' ? 8 : undefined, instance: runId + '/' + weapon }
      : take(weapon);
    if (!cargo) return;
    bag.slots[weapon] = { ...cargo };
  }
  for (const slot of ['shield','head'] as const) {
    const item=plan[slot];
    if(!item)continue;
    const cargo=take(item);
    if(!cargo || equipSlot(cargo.item)!==slot)return;
    bag.slots[slot]={...cargo,charge:isShield(cargo.item)?shieldCharge(cargo.item,cargo.charge):undefined};
  }
  if (plan.pistol === 'issued') bag.receive({ item: 'pistol-ammo', quantity: issuedRounds, issued: issuedRounds });
  for (const cargo of remaining)
    if ((supplyItems.some(item => item === cargo.item) || isCarryCargo(cargo.item)) && !bag.receive(cargo)) return;
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
