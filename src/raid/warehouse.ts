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
    return { credits: Math.max(0, Number(parsed.credits) || 0), sold: (parsed.sold ?? {}) as Inventory };
  }
  let pending = Promise.resolve(true);
  function sellOne(item: ItemId) {
    try {
      if (!itemSpecs[item] || (api.read()?.[item] ?? 0) < 1) return false;
      const current = account();
      current.sold[item] = (current.sold[item] ?? 0) + 1;
      current.credits += itemSpecs[item].price;
      getStorage().setItem(accountKey, JSON.stringify(current));
      return true;
    } catch { return false; }
  }
  const api = {
    commit(result: RaidResult) {
      if (result.outcome !== 'extracted' || !Object.keys(result.items).length) return true;
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
