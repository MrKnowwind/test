import type { ItemId } from '../contracts/demo.ts';

export const itemSpecs = {
  'pistol-ammo': { name: '9mm 弹药', w: 1, h: 1, stack: 24, price: 8, color: '#c3a26a' },
  medkit: { name: '急救包', w: 2, h: 2, stack: 1, price: 75, color: '#ac6454' },
  salvage: { name: '工业零件', w: 2, h: 2, stack: 1, price: 140, color: '#7497a2' },
  'research-sample': { name: '研究样本', w: 1, h: 2, stack: 1, price: 900, color: '#76afa2' },
  'service-card': { name: '维修卡', w: 1, h: 1, stack: 1, price: 40, color: '#b5b3a0' },
} satisfies Record<ItemId, { name: string; w: number; h: number; stack: number; price: number; color: string }>;

export interface BagEntry {
  id: number;
  item: ItemId;
  quantity: number;
  x: number;
  y: number;
  rotated: boolean;
}

export function createBackpack(width = 6, height = 5) {
  const entries: BagEntry[] = [];
  let nextId = 1;
  function dimensions(entry: Pick<BagEntry, 'item' | 'rotated'>) {
    const spec = itemSpecs[entry.item];
    return entry.rotated ? [spec.h, spec.w] : [spec.w, spec.h];
  }
  function fits(candidate: BagEntry, occupied: readonly BagEntry[]) {
    const [w, h] = dimensions(candidate);
    if (candidate.x < 0 || candidate.y < 0 || candidate.x + w > width || candidate.y + h > height) return false;
    return occupied.every(other => {
      if (other.id === candidate.id) return true;
      const [ow, oh] = dimensions(other);
      return candidate.x >= other.x + ow || candidate.x + w <= other.x ||
        candidate.y >= other.y + oh || candidate.y + h <= other.y;
    });
  }
  return {
    width, height, entries: entries as readonly BagEntry[], dimensions,
    canPlace(item: ItemId, x: number, y: number, rotated: boolean) {
      return Number.isInteger(x) && Number.isInteger(y) && fits({ id: -1, item, quantity: 1, x, y, rotated }, entries);
    },
    place(item: ItemId, quantity: number, x: number, y: number, rotated: boolean) {
      if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > itemSpecs[item].stack ||
        !Number.isInteger(x) || !Number.isInteger(y)) return false;
      const entry = { id: nextId, item, quantity, x, y, rotated };
      if (!fits(entry, entries)) return false;
      entries.push(entry);nextId++;
      return true;
    },
    add(item: ItemId, quantity: number) {
      if (!Number.isSafeInteger(quantity) || quantity <= 0) return false;
      const draft = entries.map(entry => ({ ...entry }));
      const spec = itemSpecs[item];
      let remaining = quantity;
      for (const entry of draft) {
        if (entry.item !== item) continue;
        const delta = Math.min(remaining, spec.stack - entry.quantity);
        entry.quantity += delta;
        remaining -= delta;
      }
      let draftNext = nextId;
      while (remaining > 0) {
        const entry: BagEntry = { id: draftNext++, item, quantity: Math.min(spec.stack, remaining), x: 0, y: 0, rotated: false };
        let placed = false;
        for (const rotated of [false, true]) {
          for (let y = 0; y < height && !placed; y++) for (let x = 0; x < width && !placed; x++) {
            Object.assign(entry, { x, y, rotated });
            if (fits(entry, draft)) { draft.push(entry); placed = true; }
          }
          if (placed) break;
        }
        if (!placed) return false;
        remaining -= entry.quantity;
      }
      entries.splice(0, entries.length, ...draft);
      nextId = draftNext;
      return true;
    },
    move(id: number, x: number, y: number, rotated: boolean) {
      const entry = entries.find(entry => entry.id === id);
      if (!entry || !Number.isInteger(x) || !Number.isInteger(y)) return false;
      const candidate = { ...entry, x, y, rotated };
      if (!fits(candidate, entries)) return false;
      Object.assign(entry, candidate);
      return true;
    },
    remove(id: number) {
      const index = entries.findIndex(entry => entry.id === id);
      return index < 0 ? undefined : entries.splice(index, 1)[0];
    },
    clear() { entries.length = 0; },
    inventory() {
      const result: Partial<Record<ItemId, number>> = {};
      for (const entry of entries) result[entry.item] = (result[entry.item] ?? 0) + entry.quantity;
      return result;
    },
  };
}
