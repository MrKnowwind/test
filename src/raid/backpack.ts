import { itemSpecs, pockets, packs, isPack, type ItemId } from './catalog.ts';
export { itemSpecs } from './catalog.ts';
export type Placement = { x: number; y: number; rotated: boolean; section?: string };
export interface BagEntry extends Placement {
  id: number;
  item: ItemId;
  quantity: number;
  issued?: number;
  instance?: string;
  loaded?: number;
  durability?:number;
  contents?: BagEntry[];
}
export type Cargo = Pick<BagEntry, 'item' | 'quantity' | 'issued' | 'instance' | 'loaded' | 'durability' | 'contents'>;
export function dimensions(entry: Pick<BagEntry, 'item' | 'rotated'>) {
  const { w, h } = itemSpecs[entry.item];
  return entry.rotated ? [h, w] : [w, h];
}
export function createBackpack(width = 6, height = 5, personal = false) {
  let sections = personal ? [...pockets] : [{ id: 'grid', name: '容器', w: width, h: height }];
  const entries: BagEntry[] = [];
  let nextId = 1;
  let equipped: Cargo | undefined;
  const slots: Partial<Record<'pistol' | 'knife', Cargo>> = {};
  const ordered = () => [...sections].sort((a, b) => a.w * a.h - b.w * b.h);
  const locate = (section?: string) => sections.find((s) => s.id === (section ?? sections[0].id));
  function fits(e: BagEntry, others = entries) {
    const s = locate(e.section),
      [w, h] = dimensions(e);
    if (
      !s ||
      !Number.isInteger(e.x) ||
      !Number.isInteger(e.y) ||
      e.x < 0 ||
      e.y < 0 ||
      e.x + w > s.w ||
      e.y + h > s.h
    )
      return false;
    return others.every((other) => {
      if (e.id === other.id || other.section !== s.id) return true;
      const [ow, oh] = dimensions(other);
      return e.x >= other.x + ow || e.x + w <= other.x || e.y >= other.y + oh || e.y + h <= other.y;
    });
  }
  function firstRoom(c: Cargo, others = entries) {
    for (const s of ordered())
      for (const rotated of [false, true]) {
        const [w, h] = dimensions({ ...c, rotated });
        for (let y = 0; y <= s.h - h; y++)
          for (let x = 0; x <= s.w - w; x++) {
            const p = { id: -1, ...c, x, y, rotated, section: s.id };
            if (fits(p, others)) return p;
          }
      }
  }
  function receive(c: Cargo, p?: Placement) {
    if (p && !locate(p.section)) return false;
    if (!Number.isSafeInteger(c.quantity) || c.quantity < 1 || c.contents?.length) return false;
    const draft = entries.map((e) => ({ ...e })),
      limit = itemSpecs[c.item].stack;
    let n = c.quantity,
      issued = c.issued ?? 0,
      cursor = nextId;
    for (const e of draft) {
      if (
        e.item !== c.item ||
        limit === 1 ||
        (p && (e.x !== p.x || e.y !== p.y || e.section !== locate(p.section)?.id))
      )
        continue;
      const take = Math.min(n, limit - e.quantity),
        free = Math.min(issued, take);
      e.quantity += take;
      e.issued = (e.issued ?? 0) + free;
      n -= take;
      issued -= free;
      if (!n) break;
    }
    while (n > 0) {
      const quantity = Math.min(n, limit),
        free = Math.min(quantity, issued);
      const cargo: Cargo = { item: c.item, quantity, issued: free, instance: c.instance, loaded: c.loaded };
      if(c.item==='healing-injector')cargo.durability=c.durability??3;
      const spot = p
        ? { ...cargo, x: p.x, y: p.y, rotated: p.rotated, id: -1, section: locate(p.section)?.id }
        : firstRoom(cargo, draft);
      if (!spot || !fits(spot, draft)) return false;
      draft.push({ ...spot, id: cursor++ });
      n -= quantity;
      issued -= free;
    }
    entries.splice(0, entries.length, ...draft);
    nextId = cursor;
    return true;
  }
  const remove = (id: number) => {
    const i = entries.findIndex((e) => e.id === id);
    return i < 0 ? undefined : entries.splice(i, 1)[0];
  };
  function inventory(lootOnly = false) {
    const goods: Partial<Record<ItemId, number>> = {};
    for (const e of [...entries, ...Object.values(slots), ...(equipped ? [equipped] : [])]) {
      const n = e.quantity - (lootOnly ? (e.issued ?? 0) : 0);
      if (n) goods[e.item] = (goods[e.item] ?? 0) + n;
    }
    return goods;
  }
  function swap(c: Cargo | undefined) {
    if (c && !isPack(c.item)) throw Error('需要携行装备');
    const old = equipped && {
      ...equipped,
      contents: entries.filter((e) => !pockets.some((p) => p.id === e.section)),
    };
    for (const e of old?.contents ?? []) remove(e.id);
    sections = [...pockets, ...(c && isPack(c.item) ? packs[c.item] : [])];
    for (const e of c?.contents ?? []) entries.push({ ...e, id: nextId++ });
    equipped = c ? { ...c, contents: undefined } : undefined;
    return old;
  }
  return {
    width,
    height,
    get sections() {
      return sections;
    },
    get equipped() {
      return equipped;
    },
    slots,
    entries,
    dimensions,
    receive,
    remove,
    inventory,
    swap,
    room: firstRoom,
    canFit(c: Cargo) {
      return !!firstRoom(c);
    },
    canPlace(
      item: ItemId,
      x: number,
      y: number,
      rotated: boolean,
      quantity = 1,
      section?: string,
      ignore = -1,
    ) {
      const s = locate(section);
      if (!s) return false;
      const other = entries.find((e) => e.section === s.id && e.x === x && e.y === y && e.id !== ignore);
      if (other?.item === item && itemSpecs[item].stack > 1)
        return other.quantity + quantity <= itemSpecs[item].stack;
      return fits({ id: ignore, item, x, y, rotated, quantity, section: s.id });
    },
    add: (item: ItemId, quantity: number) => receive({ item, quantity }),
    place: (item: ItemId, quantity: number, x: number, y: number, rotated: boolean, section?: string) =>
      receive({ item, quantity }, { x, y, rotated, section }),
    move(id: number, x: number, y: number, rotated: boolean, section?: string) {
      const e = entries.find((v) => v.id === id);
      const s = locate(section ?? e?.section);
      if (!e || !s) return false;
      const target = entries.find(
        (o) => o !== e && o.section === s.id && o.x === x && o.y === y && o.item === e.item,
      );
      if (target && itemSpecs[e.item].stack > 1) {
        const n = Math.min(e.quantity, itemSpecs[e.item].stack - target.quantity);
        if (n <= 0) return false;
        const free = Math.min(e.issued ?? 0, n);
        target.quantity += n;
        target.issued = (target.issued ?? 0) + free;
        e.quantity -= n;
        e.issued = (e.issued ?? 0) - free;
        if (!e.quantity) remove(id);
        return true;
      }
      if (!fits({ ...e, x, y, rotated, section: s.id })) return false;
      Object.assign(e, { x, y, rotated, section: s.id });
      return true;
    },
    ammoCount: () => entries.reduce((n, e) => n + (e.item === 'pistol-ammo' ? e.quantity : 0), 0),
    takeAmmo(limit: number) {
      let left = limit;
      for (const issued of [true, false])
        for (const e of [...entries]) {
          if (e.item !== 'pistol-ammo') continue;
          const n = Math.min(left, issued ? (e.issued ?? 0) : e.quantity - (e.issued ?? 0));
          e.quantity -= n;
          if (issued) e.issued = (e.issued ?? 0) - n;
          left -= n;
          if (!e.quantity) remove(e.id);
        }
      return limit - left;
    },
    failure(item: ItemId) {
      const free =
        sections.reduce((n, s) => n + s.w * s.h, 0) -
        entries.reduce((n, e) => n + itemSpecs[e.item].w * itemSpecs[e.item].h, 0);
      return free === 0 ? '包里已满' : '缺少连续的 ' + itemSpecs[item].h + '×' + itemSpecs[item].w + ' 格';
    },
    clear() {
      entries.length = 0;
      equipped = undefined;
      delete slots.pistol;
      delete slots.knife;
    },
  };
}
