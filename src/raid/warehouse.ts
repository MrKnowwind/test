import type { ItemId } from '../contracts/demo.ts';
import type { Inventory, RaidResult } from './raid.ts';
import type { Cargo } from './backpack.ts';
import { itemSpecs, isPack, equipSlot, isShield, shields, shieldCharge } from './catalog.ts';
import { buildLoadout, isMaterial, loadoutRequests, type Loadout } from './loadout.ts';
import { roll } from './loot.ts';
import { stashArea, stashFits, stashMinimumRows, stashColumns } from './stash.ts';

const prefix = 'wasteland-raid.warehouse.v1:';
const storable = Object.keys(itemSpecs) as ItemId[];
const accountKey = 'wasteland-raid.market.v1';
export const startingCredits = 600;
export const marketInterval = 5 * 60 * 1000;
export const shopItems = storable.filter(item =>
  !('art' in itemSpecs[item]) && ['weapon', 'carry', 'medical', 'ammo','protection'].includes(itemSpecs[item].tag));
export const exchanges = [
  {id:'cell',needs:{coil:1,terminal:1},reward:'shield-cell',quantity:3},
  {id:'armor',needs:{salvage:1,seals:1},reward:'shield-white',quantity:1},
] as const satisfies readonly {id:string;needs:Inventory;reward:ItemId;quantity:number}[];

export type Settlement={runId:string;outcome:RaidResult['outcome'];practice:boolean;at:number;seconds:number;kills:number;exitId?:string;items:Inventory;lost:Inventory;returned:number;deployed:number;net:number};
function unitValue(item:ItemId,entry?:Cargo) {
  return item==='healing-injector'?30*(entry?.durability??3):isShield(item)?Math.round(itemSpecs[item].price*(.65+.35*shieldCharge(item,entry?.charge)/shields[item])):itemSpecs[item].price;
}
function valuation(items:Inventory,instances:readonly Cargo[]=[]){
  return (Object.keys(items) as ItemId[]).reduce((sum,item)=>{
    const count=items[item]??0,matched=instances.filter(e=>e.item===item).slice(0,count);
    return sum+matched.reduce((n,e)=>n+unitValue(item,e)*e.quantity,0)+Math.max(0,count-matched.reduce((n,e)=>n+e.quantity,0))*unitValue(item);
  },0);
}
function summarize(result:RaidResult,deployed:readonly Cargo[],at:number):Settlement {
  const counts:Inventory={};for(const e of deployed)counts[e.item]=(counts[e.item]??0)+e.quantity;
  const items=result.outcome==='extracted'?result.items:{},returned=valuation(items,result.instances),risk=valuation(counts,deployed);
  const lost:Inventory={...result.lost};
  if(result.outcome==='extracted'){
    const returnedInstances=new Set(result.instances?.map(e=>e.instance));
    for(const item of Object.keys(counts) as ItemId[]){const originals=deployed.filter(e=>e.item===item),instances=originals.filter(e=>e.instance);const tracked=instances.reduce((n,e)=>n+e.quantity,0),missing=instances.filter(e=>!returnedInstances.has(e.instance)).reduce((n,e)=>n+e.quantity,0)+Math.max(0,(counts[item]??0)-tracked-Math.max(0,(items[item]??0)-tracked));if(missing)lost[item]=missing;}
  }else for(const item of Object.keys(counts) as ItemId[])lost[item]=Math.max(lost[item]??0,counts[item]??0);
  return {runId:result.runId,outcome:result.outcome,practice:!!result.practice,at,seconds:result.seconds??0,kills:result.log?.kills??0,exitId:result.outcome==='extracted'?result.exitId:undefined,items,lost,returned,deployed:risk,net:result.practice?0:returned-risk};
}

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
  rows:number;
  charges:Record<string,number>;
  deployments:Record<string,Cargo[]>;
  lastDeployment?: { runId: string; cargo: Cargo[] };
};
type StoredRecord = Inventory & { instances?: Cargo[];settlement?:Settlement };

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
      rows:Math.max(stashMinimumRows,Math.min(60,Number(parsed.rows)||stashMinimumRows)),
      charges:parsed.charges??{},
      deployments:parsed.deployments??(parsed.lastDeployment?{[parsed.lastDeployment.runId]:parsed.lastDeployment.cargo}:{}),
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
      let record: StoredRecord;
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
    return { total, instances:instances.map(e=>({...e,charge:isShield(e.item)?shieldCharge(e.item,state.charges[e.instance!]??e.charge):e.charge})) };
  }
  function makeCargo(runId: string, plan: Loadout, available: ReturnType<typeof stock>) {
    const cargo: Cargo[] = [], used: string[] = [];
    for (const [item, count] of loadoutRequests(plan)) {
      if (!Number.isSafeInteger(count) || count < 1 || count > (available.total[item] ?? 0)) return;
      if (item === 'pistol-ammo' || item === 'medkit' || item==='shield-cell' || isMaterial(item)) {
        cargo.push({item, quantity:count});
        continue;
      }
      const owned = available.instances.filter(entry => entry.item === item);
      for (let index = 0; index < count; index++) {
        const entry = owned[index];
        if (entry?.instance) used.push(entry.instance);
        cargo.push({
          item, quantity: 1, instance: runId + '/' + item + '-' + index,
          ...(item==='pistol'?{loaded:entry?.loaded??8}:{}),
          ...(item==='healing-injector'?{durability:entry?.durability??3}:{}),
          ...(isShield(item)?{charge:shieldCharge(item,entry?.charge)}:{}),
        });
      }
    }
    return { cargo, used };
  }
  function quote(item: ItemId, instance?: Cargo, at = now()) {
    const value = unitValue(item,instance);
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
  function recordPurchase(state:Account,item:ItemId,quantity:number){
    state.bought[item]=(state.bought[item]??0)+quantity;
    if(item==='healing-injector'||equipSlot(item)||isPack(item))state.purchases.push({item,quantity,instance:'market/'+item+'/'+state.bought[item],charge:isShield(item)?shields[item]:undefined});
  }
  function expansionPrice(rows:number){return 350+Math.max(0,rows-stashMinimumRows)/4*150;}
  function damagedShield(item:ItemId,state:Account){
    if(!isShield(item))return;
    const entry=stock(state).instances.find(e=>e.item===item&&shieldCharge(item,e.charge)<shields[item]);
    if(entry?.instance)return {entry,price:Math.max(1,Math.ceil((shields[item]-shieldCharge(item,entry.charge))*.8))};
  }
  return {
    commit(result: RaidResult, deployed: readonly Cargo[] = []) {
      const items: Inventory = result.practice ? {} : result.outcome==='extracted'?result.items:{};
      // A practice run refunds the original requisition. Generated and found items stay in the practice run.
      const instances = result.practice ? deployed : result.instances;
      if (result.practice) for (const entry of deployed)
        items[entry.item] = (items[entry.item] ?? 0) + entry.quantity;
      try {
        const storage = getStorage();
        const key = prefix + result.runId;
        if (storage.getItem(key) === null) storage.setItem(key, JSON.stringify({...items, instances,settlement:summarize(result,deployed,now())}));
        return true;
      } catch { return false; }
    },
    settlement(result:RaidResult,deployed:readonly Cargo[]=[]){
      try{return (JSON.parse(getStorage().getItem(prefix+result.runId)??'{}') as StoredRecord).settlement??summarize(result,deployed,now());}catch{return summarize(result,deployed,now());}
    },
    history(){
      const records:Settlement[]=[];try{const storage=getStorage();for(let i=0;i<storage.length;i++){const key=storage.key(i);if(!key?.startsWith(prefix))continue;try{const record=JSON.parse(storage.getItem(key)??'{}') as StoredRecord;if(record.settlement)records.push(record.settlement);}catch{/* old record */}}}catch{/* storage unavailable */}return records.sort((a,b)=>b.at-a.at).slice(0,30);
    },
    capacity(){try{const current=account(),{total}=stock(current);return {rows:current.rows,used:stashArea(total),limit:current.rows*stashColumns,overflow:!stashFits(total,current.rows),price:expansionPrice(current.rows),max:current.rows>=60};}catch{return {rows:stashMinimumRows,used:0,limit:120,overflow:false,price:350,max:false};}},
    expand(){return transact(()=>{const current=account(),price=expansionPrice(current.rows);if(current.rows>=60||current.credits<price)return false;current.rows+=4;current.credits-=price;write(current);return true;},false);},
    condition(item:ItemId){try{return stock(account()).instances.find(e=>e.item===item);}catch{return undefined;}},
    repairQuote(item:ItemId){try{return damagedShield(item,account());}catch{return undefined;}},
    repair(item:ItemId,expected:number){return transact(()=>{const state=account(),damaged=damagedShield(item,state);if(!damaged||damaged.price!==expected||state.credits<expected||!isShield(item))return false;state.credits-=expected;state.charges[damaged.entry.instance!]=shields[item];write(state);return true;},false);},
    exchange(id:string){return transact(()=>{const recipe=exchanges.find(r=>r.id===id);if(!recipe)return false;const state=account(),{total}=stock(state),projected={...total};for(const [key,quantity] of Object.entries(recipe.needs)){const item=key as ItemId;if((total[item]??0)<quantity)return false;projected[item]=(total[item]??0)-quantity;}projected[recipe.reward]=(projected[recipe.reward]??0)+recipe.quantity;if(!stashFits(projected,state.rows))return false;for(const [key,quantity] of Object.entries(recipe.needs)){const item=key as ItemId;state.withdrawn[item]=(state.withdrawn[item]??0)+quantity;}recordPurchase(state,recipe.reward,recipe.quantity);write(state);return true;},false);},
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
        const quantity = item === 'pistol-ammo' ? 12 : 1;
        const {total}=stock(current);total[item]=(total[item]??0)+quantity;
        if(!stashFits(total,current.rows))return false;
        current.credits -= price;
        recordPurchase(current,item,quantity);
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
        if (Object.hasOwn(current.deployments,runId)) return current.deployments[runId];
        if (getStorage().getItem(prefix+runId)!==null)return;
        const requisition = makeCargo(runId, plan, stock(current));
        if (!requisition || !buildLoadout(runId, plan, requisition.cargo)) return;
        if (!requisition.cargo.length) return [];
        for (const [item, count] of loadoutRequests(plan))
          current.withdrawn[item] = (current.withdrawn[item] ?? 0) + count;
        current.used.push(...requisition.used);
        current.lastDeployment = { runId, cargo: requisition.cargo };
        current.deployments[runId]=requisition.cargo;
        // Retain unsettled transactions for retries, and keep the most recent settled ones.
        for(const id of Object.keys(current.deployments).slice(0,-32))if(getStorage().getItem(prefix+id)!==null)delete current.deployments[id];
        write(current);
        return requisition.cargo;
      }, undefined);
    },
  };
}
