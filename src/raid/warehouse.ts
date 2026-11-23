import type { ItemId } from '../contracts/demo.ts';
import type { Inventory, RaidResult } from './raid.ts';
import { itemSpecs } from './backpack.ts';

const prefix = 'wasteland-raid.warehouse.v1:';
const storable = Object.keys(itemSpecs) as ItemId[];
const accountKey = 'wasteland-raid.market.v1';

export function createWarehouse(getStorage: () => Storage) {
  function account() {
    const raw = getStorage().getItem(accountKey);
    const parsed = raw ? JSON.parse(raw) : {};
    return { credits: Math.max(0, Number(parsed.credits) || 0), sold: (parsed.sold ?? {}) as Inventory, used: (parsed.used??[]) as string[] };
  }
  function injectors(){
    const storage=getStorage(),used=new Set(account().used),stock:{instance:string;durability:number}[]=[];
    for(let i=0;i<storage.length;i++){
      const key=storage.key(i);if(!key?.startsWith(prefix))continue;
      let data;try{data=JSON.parse(storage.getItem(key)??'null');}catch{continue;}
      for(const entry of Array.isArray(data?.instances)?data.instances:[]){
        if(entry.item==='healing-injector' && entry.instance && !used.has(entry.instance))stock.push(entry);
      }
    }
    return stock;
  }
  let pending = Promise.resolve(true);
  function sellOne(item: ItemId) {
    try {
      if (!itemSpecs[item] || (api.read()?.[item] ?? 0) < 1) return false;
      const current = account();
      current.sold[item] = (current.sold[item] ?? 0) + 1;
      let price=itemSpecs[item].price;
      if(item==='healing-injector'){
        const next=injectors()[0];if(!next)return false;
        price=30*next.durability;current.used.push(next.instance);
      }
      current.credits+=price;
      getStorage().setItem(accountKey, JSON.stringify(current));
      return true;
    } catch { return false; }
  }
  const api = {
    commit(result: RaidResult) {
      if (result.practice || result.outcome !== 'extracted' || !Object.keys(result.items).length) return true;
      try {
        const storage = getStorage();
        const key = prefix + result.runId;
        // Each run has one atomic record, so another tab can save a different run independently.
        if (storage.getItem(key) === null) storage.setItem(key, JSON.stringify({...result.items,...(result.instances?.length?{instances:result.instances}:{})}));
        return true;
      } catch {
        return false;
      }
    },
    read(): Inventory | undefined {
      try {
        const storage = getStorage();
        const total: Inventory = {};
        for (let index = 0; index < storage.length; index += 1) {
          const key = storage.key(index);
          if (!key?.startsWith(prefix)) continue;
          const value = storage.getItem(key);
          if (!value) continue;
          let items: Inventory | null;
          try { items = JSON.parse(value); } catch { continue; }
          for (const item of storable) {
            const count = items?.[item] ?? 0;
            if (Number.isSafeInteger(count) && count > 0) total[item] = (total[item] ?? 0) + count;
          }
        }
        const sold = account().sold;
        for (const item of storable) {
          const count = Math.max(0, (total[item] ?? 0) - (sold[item] ?? 0));
          if (count) total[item] = count;
          else delete total[item];
        }
        return total;
      } catch {
        return undefined;
      }
    },
    price(item:ItemId){try{return item==='healing-injector'?(injectors()[0]?.durability??0)*30:itemSpecs[item].price;}catch{return 0;}},
    credits() {
      try { return account().credits; } catch { return 0; }
    },
    sell(item: ItemId): Promise<boolean> {
      const execute = () => globalThis.navigator?.locks
        ? navigator.locks.request('wasteland-raid.market', () => sellOne(item))
        : Promise.resolve(sellOne(item));
      pending = pending.then(execute, execute);
      return pending;
    },
  };
  return api;
}
