import type {
  ExitZone,
  FirstMap,
  FlagId,
  ItemId,
  SpawnPoint,
  Vec3,
  MapInteraction,
} from '../contracts/demo.ts';
import { createContainerSearch, type Placement } from './containerSearch.ts';
import { equipSlot, isPack, itemSpecs, packs, type EquipSlot } from './catalog.ts';
import { type Cargo, createBackpack, portion } from './backpack.ts';
import { buildLoadout, defaultLoadout, type Loadout } from './loadout.ts';

export type Inventory = Partial<Record<ItemId, number>>;
export type RaidLog = {
  shots: number;
  hits: number;
  kills: number;
  heals: number;
  first?: string;
  cancellations: string[];
};
export type RaidResult = {
  practice?:boolean;
  seed?: number;
  spawn?: string;
  log?: RaidLog;
  runId: string;
  items: Inventory;
  lost?: Inventory;
  seconds?: number;
  damage?: string;
  instances?: Cargo[];
  visited?: string[];
} & ({ outcome: 'extracted'; exitId: string } | { outcome: 'dead' | 'abandoned' });

type RaidMap = Pick<FirstMap, 'spawnPoints' | 'interactions' | 'exits'>;

function chooseSpawn(seed: number, spawns: readonly SpawnPoint[]) {
  if (spawns.length === 0) throw new Error('地图没有出生候选点');
  let value = (seed + 0x9e3779b9) | 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  const fraction = ((value ^ (value >>> 15)) >>> 0) / 0x100000000;
  return spawns[Math.floor(fraction * spawns.length)];
}

const extractionTime = 5;

function contains(exit: ExitZone, feet: Vec3) {
  const [x, y, z] = exit.position;
  return Math.abs(feet[1] - y) < 1.2 && Math.hypot(feet[0] - x, feet[2] - z) <= exit.radius;
}

export function createRaid(runId: string, seed: number, map: RaidMap, plan: Loadout = defaultLoadout, stock: readonly Cargo[] = []) {
  const spawn = chooseSpawn(seed, map.spawnPoints);
  const bag = buildLoadout(runId, plan, stock);
  if (!bag) throw new Error('整备无法装入随身空间');
  const backpack = bag;
  const targets = [...map.interactions],
    ground = new Map<string, Cargo>();
  for (const t of targets)
    if (t.kind === 'loose')
      ground.set(t.id, { item: t.item, quantity: t.quantity, instance: runId + '/' + t.id });
  let serial = 0,
    seconds = 0,
    damage = '';
  const visited = new Set<string>();
  const log: RaidLog = { shots: 0, hits: 0, kills: 0, heals: 0, cancellations: [] };
  let creative=false, practice=false, generated=0;
  const record = () => ({
    practice,
    seed,
    spawn: spawn.id,
    seconds,
    damage,
    visited: [...visited],
    log: structuredClone(log),
  });
  function cancelExit(reason: string) {
    if (countdown) log.cancellations.push(reason);
    countdown = undefined;
  }
  function checkCard() {
    if (countdown) {
      const reason = blockedReason(countdown.exit);
      if (reason) cancelExit(reason);
    }
  }
  const search = createContainerSearch(seed, map.interactions);
  for (const box of search.containers.values()) {
    for (const entry of box.entries) {
      if(entry.item==='healing-injector'||equipSlot(entry.item))entry.instance=box.id+'/'+entry.id;
      if(entry.instance)entry.instance=runId+'/'+entry.instance;
    }
  }
  const consumed = new Set<string>();
  const flags = new Set<FlagId>();
  type Timer = { exit: ExitZone; remaining: number };
  let countdown: Timer | undefined;
  let lift: Timer | undefined;
  let result: RaidResult | undefined;
  let serviceTask = false;

  const exitAt = (feet: Vec3) => map.exits.find((exit) => contains(exit, feet));

  function blockedReason(exit: ExitZone) {
    if (exit.openForSpawnSide && exit.openForSpawnSide !== spawn.side) return '本局未开放';
    for (const requirement of exit.requirements) {
      if (requirement.kind === 'item' && !backpack.entries.some(entry => entry.item === requirement.id && entry.quantity > 0)) return '维修卡未携带';
      if (requirement.kind === 'flag' && !flags.has(requirement.id)) return '需要开启实验室配电柜';
    }
    return undefined;
  }

  function interact(id: string) {
    if (result || consumed.has(id)) return;
    const target = map.interactions.find((interaction) => interaction.id === id);
    if (!target) return;
    if (target.kind === 'switch') {
      const exit = map.exits.find(zone => zone.remote?.flag === target.flag);
      if (exit?.remote) {
        if (lift) return;
        lift = { exit, remaining: exit.remote.seconds };
      }
      flags.add(target.flag);
    } else return;
    consumed.add(id);
    return target;
  }

  function takeContainerItem(containerId: string, entryId: number, placement?: Placement, quantity?:number) {
    if (result) return false;
    const container = search.containers.get(containerId);
    const entry = container?.entries.find((entry) => entry.id === entryId);
    if (!container || !entry?.revealed) return false;
    const part=portion(entry,quantity);
    if (!part || !backpack.receive(part, placement)) return false;
    if (entry.item === 'service-card') serviceTask = true;
    log.first ??= itemSpecs[entry.item].name;
    if(part.quantity===entry.quantity)container.entries.splice(container.entries.indexOf(entry),1);
    else {entry.quantity-=part.quantity;entry.issued=(entry.issued??0)-(part.issued??0);}
    const pack = ground.get(containerId);
    if(pack)pack.contents=container.entries.map(e=>({...e}));
    if (!container.entries.length && !pack) consumed.add(containerId);
    return true;
  }

  function putContainerItem(containerId:string,id:number){
    const box=search.containers.get(containerId), cargo=backpack.entries.find(e=>e.id===id);
    if(result || !box || !cargo)return false;
    const partials=box.entries.filter(e=>e.revealed && e.item===cargo.item && e.quantity<itemSpecs[e.item].stack);
    let left=cargo.quantity,issued=cargo.issued??0;
    const transfers=partials.map(target=>{
      const n=Math.min(left,itemSpecs[cargo.item].stack-target.quantity),free=Math.min(n,issued);
      left-=n;issued-=free;return {target,n,free};
    });
    if(left){
      const grid=createBackpack(box.width,box.height,false,box.sections);
      const spot=grid.room({...cargo,quantity:left},box.entries);
      if(!spot)return false;
      const entryId=1+Math.max(0,...box.entries.map(e=>e.id));
      box.entries.push({...spot,quantity:left,issued,id:entryId,progress:1,duration:1,revealed:true});
    }
    for(const {target,n,free} of transfers){target.quantity+=n;target.issued=(target.issued??0)+free;}
    backpack.remove(id);consumed.delete(containerId);
    const pack=ground.get(containerId);if(pack)pack.contents=box.entries.map(e=>({...e}));
    checkCard();return true;
  }

  const floorLimit=12;
  function canDrop(at:Vec3,leaving?:string) {
    return targets.filter(t=>t.id!==leaving && t.id.startsWith('drop-') && ground.has(t.id)
      && Math.hypot(t.position[0]-at[0],t.position[1]-at[1],t.position[2]-at[2])<=3).length<floorLimit;
  }
  function drop(c: Cargo, at: Vec3) {
    const id = 'drop-' + ++serial;
    const t: MapInteraction = {
      id,
      kind: 'loose',
      item: c.item,
      quantity: c.quantity,
      label: itemSpecs[c.item].name,
      position: at,
    };
    targets.push(t);
    ground.set(id, c);
    return t;
  }
  function generateItem(item:ItemId,quantity:number,at?:Vec3){
    if(!creative || result || !Number.isSafeInteger(quantity) || quantity<1 || quantity>itemSpecs[item].stack)return false;
    const cargo:Cargo={item,quantity};
    if(isPack(item)||equipSlot(item)||item==='healing-injector')cargo.instance=runId+'/creative-'+(++generated);
    if(item==='pistol')cargo.loaded=8;
    if(item==='healing-injector')cargo.durability=3;
    if(at)return canDrop(at)?drop(cargo,at):false;
    return backpack.receive(cargo);
  }
  function removeGround(id: string) {
    ground.delete(id);
    search.containers.delete(id);
    if(id.startsWith('drop-')){
      const index=targets.findIndex(t=>t.id===id);
      if(index!==-1)targets.splice(index,1);
    }else consumed.add(id);
  }
  function groundContainer(id: string) {
    const c = ground.get(id);
    if (!c || !isPack(c.item)) return;
    let box = search.containers.get(id);
    if (!box) {
      const regions = packs[c.item];
      box = {
        id,
        width: Math.max(...regions.map((s) => s.w)),
        height: regions.reduce((n, s) => n + s.h, 0),
        sections: regions,
        entries: (c.contents ?? []).map((e) => ({ ...e, progress: 1, duration: 1, revealed: true })),
      };
      search.containers.set(id, box);
    }
    return box;
  }
  function equipPack(from: string, id: number | undefined, at: Vec3) {
    if (result) return;
    const box = search.containers.get(from),
      e = id === undefined ? undefined : box?.entries.find((e) => e.id === id && e.revealed);
    const c =
      from === 'carried'
        ? backpack.entries.find((e) => e.id === id)
        : id === undefined
          ? ground.get(from)
          : e;
    if (!c || !isPack(c.item) || backpack.equipped && !canDrop(at,id===undefined?from:undefined)) return;
    if (from === 'carried') backpack.remove(id!);
    else if (e && box) {
      box.entries.splice(box.entries.indexOf(e), 1);
      if (!box.entries.length && !ground.has(from)) consumed.add(from);
      const owner = ground.get(from);
      if (owner) owner.contents = owner.contents?.filter((entry) => entry.id !== id);
    } else {
      removeGround(from);
    }
    log.first ??= itemSpecs[c.item].name;
    const old = backpack.swap(c);
    const dropped = old ? drop(old, at) : undefined;
    checkCard();
    return { dropped };
  }
  function collect(id: string) {
    const c = ground.get(id);
    if (result || !c || !backpack.receive(c)) return false;
    if (c.item === 'service-card') serviceTask = true;
    log.first ??= itemSpecs[c.item].name;
    removeGround(id);
    return true;
  }
  function dropCarried(id: number, at: Vec3, quantity?:number) {
    if (result || !canDrop(at)) return;
    const e = backpack.takePart(id,quantity);
    if (!e) return;
    checkCard();
    return drop(e, at);
  }
  function dropSlot(slot:EquipSlot,at:Vec3){
    const cargo=backpack.slots[slot];
    if(result || !cargo || !canDrop(at))return;
    delete backpack.slots[slot];return drop(cargo,at);
  }
  function discardSource(id:string,entryId:number,at:Vec3){
    const box=search.containers.get(id),e=box?.entries.find(e=>e.id===entryId && e.revealed);
    if(result || !box || !e || !canDrop(at))return;
    box.entries.splice(box.entries.indexOf(e),1);
    const pack=ground.get(id);
    if(pack)pack.contents=box.entries.map(e=>({...e}));else if(!box.entries.length)consumed.add(id);
    return drop(e,at);
  }
  function unpack(at: Vec3) {
    if (result || !backpack.equipped || !canDrop(at)) return;
    const old = backpack.swap(undefined)!;
    checkCard();
    return drop(old, at);
  }
  function holster(id: number) {
    const e = backpack.entries.find((e) => e.id === id);
    const slot=e&&equipSlot(e.item);
    if (result || !e || !slot) return false;
    const old=backpack.slots[slot];
    backpack.remove(e.id);
    if(old&&!backpack.receive(old,e)){backpack.entries.push(e);return false;}
    backpack.slots[slot] = e;
    return true;
  }
  function equipFromContainer(containerId:string,entryId:number,slot:EquipSlot){
    const container=search.containers.get(containerId),entry=container?.entries.find(e=>e.id===entryId&&e.revealed);
    if(result||!container||!entry||equipSlot(entry.item)!==slot)return false;
    const old=backpack.slots[slot];
    if(old&&!backpack.receive(old))return false;
    backpack.slots[slot]={...entry};
    container.entries.splice(container.entries.indexOf(entry),1);
    const pack=ground.get(containerId);
    if(pack)pack.contents=container.entries.map(e=>({...e}));
    else if(!container.entries.length)consumed.add(containerId);
    log.first??=itemSpecs[entry.item].name;
    return true;
  }
  function stow(slot: EquipSlot, placement?: Placement) {
    const e = backpack.slots[slot];
    if (result || !e || !backpack.receive(e, placement)) return false;
    delete backpack.slots[slot];
    return true;
  }
  function exitStatus(exit: ExitZone) {
    const timer = countdown?.exit === exit ? countdown : lift?.exit === exit ? lift : undefined;
    if (timer) return { kind: 'active', label: '进行中 · ' + Math.ceil(timer.remaining) + ' 秒' };
    const reason = blockedReason(exit);
    return reason ? { kind: 'locked', label: reason }
      : { kind: 'ready', label: '可撤离' };
  }

  function finish(outcome: 'dead' | 'abandoned') {
    if (result) return;
    const lost = backpack.inventory();
    backpack.clear();
    result = { runId, outcome, items: {}, lost, ...record() };
    countdown = lift = undefined;
  }

  function extract(exit: ExitZone) {
    result = {
      runId, outcome: 'extracted', exitId: exit.id, items: backpack.inventory(true), ...record(),
      instances: [...backpack.entries, ...Object.values(backpack.slots), ...(backpack.equipped ? [backpack.equipped] : [])]
        .filter(e => e.instance && !e.issued).map(e => ({ ...e })),
    };
    countdown = lift = undefined;
  }

  function update(dt: number, feet: Vec3, health: number) {
    if (result) return;
    const delta = Math.max(0, dt);
    seconds += delta;
    if (health <= 0) { finish('dead'); return; }
    let message: string | undefined;
    if (countdown && (!contains(countdown.exit, feet) || blockedReason(countdown.exit))) {
      const reason = blockedReason(countdown.exit) ?? '离开撤离区';
      cancelExit(reason);
      message = reason + '，计时取消';
    }
    const local = map.exits.find(exit => !exit.remote && contains(exit, feet) && !blockedReason(exit));
    if (!countdown && local) countdown = { exit: local, remaining: extractionTime };
    // Resolve by simulated deadline. Map order breaks exact ties, including overlapping zones.
    let winner: Timer | undefined;
    for (const timer of [countdown, lift]) {
      if (!timer) continue;
      timer.remaining -= delta;
      if (timer.remaining > 1e-9 || !contains(timer.exit, feet) || blockedReason(timer.exit)) continue;
      if (!winner || timer.remaining < winner.remaining ||
          (timer.remaining === winner.remaining && map.exits.indexOf(timer.exit) < map.exits.indexOf(winner.exit))) winner = timer;
    }
    if (winner) { extract(winner.exit); return; }
    if (lift && lift.remaining <= 1e-9) {
      const flag = lift.exit.remote!.flag;
      flags.delete(flag);
      for (const t of map.interactions) if (t.kind === 'switch' && t.flag === flag) consumed.delete(t.id);
      lift = undefined;
      log.cancellations.push('错过货梯');
      return '货梯已离站 · 可返回配电柜重新呼叫';
    }
    const zone = exitAt(feet);
    return message ?? (zone && blockedReason(zone));
  }

  return {
    log,
    targets,
    get creative(){return creative;},
    setCreative(active:boolean){if(!result){creative=active;practice ||= active;}},
    generateItem,
    ground,
    groundContainer,
    equipPack,
    dropCarried, dropSlot, discardSource, putContainerItem,
    collect,
    unpack,
    holster,
    equipFromContainer,
    stow,
    visited,
    hitBy(source: string) {
      damage = source;
    },
    seed,
    spawn,
    backpack,
    get items(): Readonly<Inventory> {
      return backpack.inventory();
    },
    consumed: consumed as ReadonlySet<string>,
    containers: search.containers,
    searchContainer: (id: string, dt: number) => (result ? 0 : search.search(id, dt)),
    takeContainerItem,
    flags: flags as ReadonlySet<FlagId>,
    exitAt,
    blockedReason, exitStatus,
    get liftWindow() { return lift; },
    objectives() {
      const tasks: { title: string; detail: string }[] = [];
      if (lift) tasks.push({title: '货梯撤离', detail: '抵达 B1 货梯 · ' + Math.ceil(lift.remaining) + ' 秒'});
      const service = map.exits.find(exit => exit.id === 'service-passage');
      if (service && countdown?.exit !== service && (serviceTask || visited.has('duty-card')))
        tasks.push({title: service.label, detail: blockedReason(service) ? '获取维修卡' : '携带维修卡抵达通道'});
      if (countdown) tasks.push({title: countdown.exit.label, detail: '留在撤离区 · ' + Math.ceil(countdown.remaining) + ' 秒'});
      return tasks;
    },
    interact,
    update,
    get result() {
      return result;
    },
    get countdown() {
      return countdown ?? lift;
    },
    abandon: () => finish('abandoned'),
  };
}
