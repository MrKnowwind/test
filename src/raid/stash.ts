import { createBackpack, dimensions, type BagEntry } from './backpack.ts';
import { itemSpecs, type ItemId } from './catalog.ts';
import type { Inventory } from './raid.ts';
import { loadoutRequests, type Loadout, type PreparedPlacement } from './loadout.ts';

export const stashColumns = 10;
export const stashMinimumRows = 12;
const layoutKey = 'wasteland-raid.stash-layout.v1';

export function remainingStock(stock: Inventory, plan: Loadout) {
  const available = {...stock};
  for (const [item, quantity] of loadoutRequests(plan))
    available[item] = Math.max(0,(available[item] ?? 0)-quantity);
  return available;
}

export function arrangeStash(stock: Inventory, saved: readonly PreparedPlacement[] = []) {
  const entries = (Object.keys(itemSpecs) as ItemId[]).filter(item => (stock[item] ?? 0) > 0);
  const area = entries.reduce((sum,item) => {
    const spec=itemSpecs[item];
    return sum + spec.w*spec.h*Math.ceil(stock[item]!/spec.stack);
  },0);
  // The ledger remains authoritative. Allocate enough rows for old and newly acquired stock.
  const stash = createBackpack(stashColumns,Math.max(stashMinimumRows,area+stashMinimumRows));
  const remaining={...stock};
  for(const placement of saved){
    if(!placement || !Object.hasOwn(itemSpecs,placement.item) ||
       !Number.isSafeInteger(placement.quantity) || placement.quantity<=0) continue;
    const quantity=Math.min(placement.quantity,remaining[placement.item] ?? 0,itemSpecs[placement.item].stack);
    if(!quantity) continue;
    if(stash.place(placement.item,quantity,placement.x,placement.y,!!placement.rotated))
      remaining[placement.item]!-=quantity;
  }
  for(const item of entries.sort((a,b)=>itemSpecs[b].w*itemSpecs[b].h-itemSpecs[a].w*itemSpecs[a].h || a.localeCompare(b))) {
    const quantity=remaining[item] ?? 0;
    if(quantity && !stash.add(item,quantity)) throw Error('仓库布局无法容纳库存');
  }
  return stash;
}

export function visibleStashRows(entries: readonly BagEntry[]) {
  return Math.max(stashMinimumRows,...entries.map(entry=>entry.y+dimensions(entry)[1]+2));
}

export function readStashLayout(storage: Pick<Storage,'getItem'>): PreparedPlacement[] {
  try {
    const saved=JSON.parse(storage.getItem(layoutKey) ?? '[]');
    return Array.isArray(saved) ? saved : [];
  } catch { return []; }
}

export function saveStashLayout(storage: Pick<Storage,'setItem'>, entries: readonly BagEntry[]) {
  try {
    storage.setItem(layoutKey,JSON.stringify(entries.map(({item,quantity,x,y,rotated})=>({item,quantity,x,y,rotated}))));
  } catch { /* The display layout is optional; stored inventory is unaffected. */ }
}
