import type { ItemId } from '../contracts/demo.ts';
import type { Inventory, RaidResult } from './raid.ts';
import type { Cargo } from './backpack.ts';
import { itemSpecs, isPack } from './catalog.ts';
import { buildLoadout, isMaterial, loadoutRequests, type Loadout } from './loadout.ts';
import { roll } from './loot.ts';

const prefix = 'wasteland-raid.warehouse.v1:';
const storable = Object.keys(itemSpecs) as ItemId[];
const accountKey = 'wasteland-raid.market.v1';
export const startingCredits = 600;
export const marketInterval = 5 * 60 * 1000;
export const shopItems = storable.filter(item =>
  ['weapon', 'carry', 'medical', 'ammo'].includes(itemSpecs[item].tag));

export function buyPrice(item: ItemId) {
  const base = Math.ceil(itemSpecs[item].price * 1.35);
  return item === 'pistol-ammo' ? base * 12 : base;
}

type Account = {
  starterGranted: true;
  credits: number;
  sold: Inventory;
  bought: Inventory;
  withdrawn: Inventory;
  used: string[];
  purchases: Cargo[];
  lastDeployment?: { runId: string; cargo: Cargo[] };
};
type Record = Inventory & { instances?: Cargo[] };

export function createWarehouse(getStorage: () => Storage, now = Date.now) {
  function account(): Account {
    const raw = getStorage().getItem(accountKey);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      starterGranted: true,
      credits: Math.max(0, Number(parsed.credits) || 0) + (parsed.starterGranted ? 0 : startingCredits),
      sold: parsed.sold ?? {},
      bought: parsed.bought ?? {},
      withdrawn: parsed.withdrawn ?? {},
      used: parsed.used ?? [],
      purchases: parsed.purchases ?? [],
      lastDeployment: parsed.lastDeployment,
    };
  }
  function write(state: Account) {
    getStorage().setItem(accountKey, JSON.stringify(state));
  }
  function stock(state: Account) {
    const total: Inventory = {};
    const storage = getStorage();
    const used = new Set(state.used);
    const instances = state.purchases.filter(entry => !used.has(entry.instance!));
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (!key?.startsWith(prefix)) continue;
      let record: Record;
      try { record = JSON.parse(storage.getItem(key) ?? '{}') ?? {}; } catch { continue; }
      for (const item of storable) {
        const count = record[item] ?? 0;
        if (Number.isSafeInteger(count) && count > 0) total[item] = (total[item] ?? 0) + count;
      }
      for (const entry of Array.isArray(record.instances) ? record.instances : [])
        if (entry.instance && !used.has(entry.instance)) instances.push(entry);
    }
    for (const item of storable) {
      const count = (total[item] ?? 0) + (state.bought[item] ?? 0)
        - (state.sold[item] ?? 0) - (state.withdrawn[item] ?? 0);
      if (count > 0) total[item] = count;
      else delete total[item];
    }
    return { total, instances };
  }
  function makeCargo(runId: string, plan: Loadout, available: ReturnType<typeof stock>) {
    const cargo: Cargo[] = [], used: string[] = [];
    for (const [item, count] of loadoutRequests(plan)) {
      if (!Number.isSafeInteger(count) || count < 1 || count > (available.total[item] ?? 0)) return;
      if (item === 'pistol-ammo' || item === 'medkit' || isMaterial(item)) {
        cargo.push({item, quantity:count});
        continue;
      }
      const owned = available.instances.filter(entry => entry.item === item);
      for (let index = 0; index < count; index++) {
        const entry = owned[index];
        if (entry?.instance) used.push(entry.instance);
        cargo.push({
          item, quantity: 1, instance: runId + '/' + item + '-' + index,
          loaded: item === 'pistol' ? entry?.loaded ?? 8 : undefined,
          durability: item === 'healing-injector' ? entry?.durability ?? 3 : undefined,
        });
      }
    }
    return { cargo, used };
  }
  function quote(item: ItemId, instance?: Cargo, at = now()) {
    const value = item === 'healing-injector' ? 30 * (instance?.durability ?? 3) : itemSpecs[item].price;
    const variation = .8 + .4 * roll(Math.floor(at / marketInterval), item, 0);
    return Math.max(1, Math.round(value * variation));
  }
  let pending: Promise<unknown> = Promise.resolve();
  function transact<T>(perform: () => T, fallback: T) {
    const safe = () => { try { return perform(); } catch { return fallback; } };
    const execute = () => globalThis.navigator?.locks
      ? navigator.locks.request(accountKey, safe)
      : Promise.resolve(safe());
    const result = pending.then(execute, execute);
    pending = result;
    return result;
  }
  return {
    commit(result: RaidResult, deployed: readonly Cargo[] = []) {
      if (!result.practice && result.outcome !== 'extracted') return true;
      const items: Inventory = result.practice ? {} : result.items;
      // A practice run refunds the original requisition. Generated and found items stay in the practice run.
      const instances = result.practice ? deployed : result.instances;
      if (result.practice) for (const entry of deployed)
        items[entry.item] = (items[entry.item] ?? 0) + entry.quantity;
      if (!Object.keys(items).length) return true;
      try {
        const storage = getStorage();
        const key = prefix + result.runId;
        if (storage.getItem(key) === null) storage.setItem(key, JSON.stringify({...items, instances}));
        return true;
      } catch { return false; }
    },
    read(): Inventory | undefined {
      try { return stock(account()).total; } catch { return undefined; }
    },
    market() {
      const at = now();
      let current: ReturnType<typeof stock> | undefined;
      try { current = stock(account()); } catch { /* storage unavailable */ }
      const offers = storable.filter(item => current?.total[item]).map(item => ({
        item, quantity: current!.total[item]!,
        price: quote(item, current!.instances.find(entry => entry.item === item), at),
      }));
      return { offers, refreshAt: (Math.floor(at / marketInterval) + 1) * marketInterval };
    },
    price(item: ItemId) {
      try { return quote(item, stock(account()).instances.find(entry => entry.item === item)); }
      catch { return 0; }
    },
    credits() {
      try { return account().credits; } catch { return 0; }
    },
    sell(item: ItemId, expected?: number) {
      return transact(() => {
        const current = account(), { total, instances } = stock(current);
        if (!total[item]) return false;
        const entry = instances.find(entry => entry.item === item);
        const price = quote(item, entry);
        if (expected !== undefined && price !== expected) return false;
        if (entry?.instance) current.used.push(entry.instance);
        current.sold[item] = (current.sold[item] ?? 0) + 1;
        current.credits += price;
        write(current);
        return true;
      }, false);
    },
    buy(item: ItemId) {
      return transact(() => {
        if (!shopItems.includes(item)) return false;
        const current = account(), price = buyPrice(item);
        if (price > current.credits) return false;
        current.credits -= price;
        const quantity = item === 'pistol-ammo' ? 12 : 1;
        current.bought[item] = (current.bought[item] ?? 0) + quantity;
        if (item === 'healing-injector' || item === 'pistol' || item === 'knife' || isPack(item))
          current.purchases.push({item, quantity, instance: 'market/' + item + '/' + current.bought[item]});
        write(current);
        return true;
      }, false);
    },
    preview(plan: Loadout) {
      try {
        const requisition = makeCargo('preview', plan, stock(account()));
        return requisition && buildLoadout('preview', plan, requisition.cargo);
      } catch { return undefined; }
    },
    deploy(runId: string, plan: Loadout) {
      return transact(() => {
        const current = account();
        if (current.lastDeployment?.runId === runId) return current.lastDeployment.cargo;
        const requisition = makeCargo(runId, plan, stock(current));
        if (!requisition || !buildLoadout(runId, plan, requisition.cargo)) return;
        if (!requisition.cargo.length) return [];
        for (const [item, count] of loadoutRequests(plan))
          current.withdrawn[item] = (current.withdrawn[item] ?? 0) + count;
        current.used.push(...requisition.used);
        current.lastDeployment = { runId, cargo: requisition.cargo };
        write(current);
        return requisition.cargo;
      }, undefined);
    },
  };
}
