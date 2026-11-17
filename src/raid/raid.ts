import type { ExitZone, FirstMap, FlagId, ItemId, SpawnPoint, Vec3 } from '../contracts/demo.ts';
import { createContainerSearch, type Placement } from './containerSearch.ts';
import { createBackpack } from './backpack.ts';

export type Inventory = Partial<Record<ItemId, number>>;
export type RaidResult = { runId: string; items: Inventory } & (
  | { outcome: 'extracted'; exitId: string }
  | { outcome: 'dead' | 'abandoned' }
);

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
  const backpack = createBackpack();
  const search = createContainerSearch(seed, map.interactions);
  const consumed = new Set<string>();
  const flags = new Set<FlagId>();
  let countdown: { exit: ExitZone; elapsed: number } | undefined;
  let result: RaidResult | undefined;

  const exitAt = (feet: Vec3) => map.exits.find((exit) => contains(exit, feet));

  function blockedReason(exit: ExitZone) {
    for (const requirement of exit.requirements) {
      if (requirement.kind === 'item' && !backpack.inventory()[requirement.id]) return '需要携带维修卡';
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
    const entry = container?.entries.find(entry => entry.id === entryId);
    if (!container || !entry?.revealed) return false;
    const placed = placement ? backpack.place(entry.item, entry.quantity, placement.x, placement.y, placement.rotated)
      : backpack.add(entry.item, entry.quantity);
    if (!placed) return false;
    container.entries.splice(container.entries.indexOf(entry), 1);
    if (!container.entries.length) consumed.add(containerId);
    return true;
  }

  function finish(outcome: 'dead' | 'abandoned') {
    if (result) return;
    backpack.clear();
    result = { runId, outcome, items: {} };
    countdown = undefined;
  }

  function update(dt: number, feet: Vec3, health: number, requestExit = false) {
    if (result) return;
    if (health <= 0) {
      finish('dead');
      return;
    }
    if (countdown && !contains(countdown.exit, feet)) {
      countdown = undefined;
      return '已离开撤离区，计时取消';
    }
    if (countdown) {
      const reason = blockedReason(countdown.exit);
      if (reason) {
        countdown = undefined;
        return reason;
      }
      countdown.elapsed += dt;
      if (countdown.elapsed >= extractionTime - 1e-9) {
        result = { runId, outcome: 'extracted', exitId: countdown.exit.id, items: backpack.inventory() };
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
    seed, spawn, backpack, get items(): Readonly<Inventory> { return backpack.inventory(); }, consumed: consumed as ReadonlySet<string>,
    containers: search.containers, searchContainer: (id: string, dt: number) => result ? 0 : search.search(id, dt), takeContainerItem,
    flags: flags as ReadonlySet<FlagId>, exitAt, blockedReason, interact, update,
    get result() { return result; },
    get countdown() {
      return countdown && { exit: countdown.exit, remaining: extractionTime - countdown.elapsed };
    },
    abandon: () => finish('abandoned'),
  };
}
