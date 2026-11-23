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
import { isPack, itemSpecs, packs } from './catalog.ts';
import { type Cargo, createBackpack } from './backpack.ts';

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

export function createRaid(runId: string, seed: number, map: RaidMap) {
  const spawn = chooseSpawn(seed, map.spawnPoints);
  const backpack = createBackpack(3, 2, true);
  backpack.receive({ item: 'pistol-ammo', quantity: 15, issued: 15 });
  backpack.slots.pistol = { item: 'pistol', quantity: 1, issued: 1, loaded: 8, instance: runId + '/pistol' };
  backpack.slots.knife = { item: 'knife', quantity: 1, issued: 1, instance: runId + '/knife' };
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
  const record = () => ({
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
    for (const entry of box.entries) if (entry.instance) entry.instance = runId + '/' + entry.instance;
  }
  const consumed = new Set<string>();
  const flags = new Set<FlagId>();
  let countdown: { exit: ExitZone; elapsed: number } | undefined;
  let result: RaidResult | undefined;

  const exitAt = (feet: Vec3) => map.exits.find((exit) => contains(exit, feet));

  function blockedReason(exit: ExitZone) {
    for (const requirement of exit.requirements) {
      if (requirement.kind === 'item' && !backpack.inventory()[requirement.id]) return '维修卡未携带';
      if (requirement.kind === 'flag' && !flags.has(requirement.id)) return '需要开启实验室配电柜';
    }
    return undefined;
  }

  function interact(id: string) {
    if (result || consumed.has(id)) return;
    const target = map.interactions.find((interaction) => interaction.id === id);
    if (!target) return;
    if (target.kind === 'switch') {
      flags.add(target.flag);
    } else return;
    consumed.add(id);
    return target;
  }

  function takeContainerItem(containerId: string, entryId: number, placement?: Placement) {
    if (result) return false;
    const container = search.containers.get(containerId);
    const entry = container?.entries.find((entry) => entry.id === entryId);
    if (!container || !entry?.revealed) return false;
    if (!backpack.receive(entry, placement)) return false;
    log.first ??= itemSpecs[entry.item].name;
    container.entries.splice(container.entries.indexOf(entry), 1);
    const pack = ground.get(containerId);
    if (pack) pack.contents = pack.contents?.filter((e) => e.id !== entryId);
    if (!container.entries.length && !pack) consumed.add(containerId);
    return true;
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
    if (!c || !isPack(c.item)) return;
    if (from === 'carried') backpack.remove(id!);
    else if (e && box) {
      box.entries.splice(box.entries.indexOf(e), 1);
      if (!box.entries.length && !ground.has(from)) consumed.add(from);
      const owner = ground.get(from);
      if (owner) owner.contents = owner.contents?.filter((entry) => entry.id !== id);
    } else {
      ground.delete(from);
      consumed.add(from);
      search.containers.delete(from);
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
    log.first ??= itemSpecs[c.item].name;
    ground.delete(id);
    consumed.add(id);
    search.containers.delete(id);
    return true;
  }
  function dropCarried(id: number, at: Vec3) {
    if (result) return;
    const e = backpack.remove(id);
    if (!e) return;
    checkCard();
    return drop(e, at);
  }
  function unpack(at: Vec3) {
    if (result || !backpack.equipped) return;
    const old = backpack.swap(undefined)!;
    checkCard();
    return drop(old, at);
  }
  function holster(id: number) {
    const e = backpack.entries.find((e) => e.id === id);
    if (result || !e || (e.item !== 'pistol' && e.item !== 'knife') || backpack.slots[e.item]) return false;
    backpack.remove(e.id);
    backpack.slots[e.item] = e;
    return true;
  }
  function stow(slot: 'pistol' | 'knife', placement?: Placement) {
    const e = backpack.slots[slot];
    if (result || !e || !backpack.receive(e, placement)) return false;
    delete backpack.slots[slot];
    return true;
  }
  function finish(outcome: 'dead' | 'abandoned') {
    if (result) return;
    const lost = backpack.inventory();
    backpack.clear();
    result = { runId, outcome, items: {}, lost, ...record() };
    countdown = undefined;
  }

  function update(dt: number, feet: Vec3, health: number, requestExit = false) {
    if (result) return;
    seconds += Math.max(dt, 0);
    if (health <= 0) {
      finish('dead');
      return;
    }
    if (countdown && !contains(countdown.exit, feet)) {
      cancelExit('离开撤离区');
      return '已离开撤离区，计时取消';
    }
    if (countdown) {
      const reason = blockedReason(countdown.exit);
      if (reason) {
        cancelExit(reason);
        return reason;
      }
      countdown.elapsed += dt;
      if (countdown.elapsed >= extractionTime - 1e-9) {
        result = {
          runId,
          outcome: 'extracted',
          exitId: countdown.exit.id,
          items: backpack.inventory(true),
          ...record(),
          instances: [
            ...backpack.entries,
            ...Object.values(backpack.slots),
            ...(backpack.equipped ? [backpack.equipped] : []),
          ]
            .filter((e) => e.instance && !e.issued)
            .map((e) => ({ ...e })),
        };
        countdown = undefined;
      }
    } else if (requestExit) {
      const exit = exitAt(feet);
      if (!exit) return;
      const reason = blockedReason(exit);
      if (reason) return reason;
      countdown = { exit, elapsed: 0 };
    }
    return undefined;
  }

  return {
    log,
    targets,
    ground,
    groundContainer,
    equipPack,
    dropCarried,
    collect,
    unpack,
    holster,
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
    blockedReason,
    interact,
    update,
    get result() {
      return result;
    },
    get countdown() {
      return countdown && { exit: countdown.exit, remaining: extractionTime - countdown.elapsed };
    },
    abandon: () => finish('abandoned'),
  };
}
