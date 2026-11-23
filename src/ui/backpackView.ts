import { itemIcon } from './itemArt.ts';
import {
  dimensions,
  type BagEntry,
  type Placement,
  type Cargo,
  type createBackpack,
} from '../raid/backpack.ts';
import { itemSpecs, isPack, packs, pockets, type Section, type ItemId } from '../raid/catalog.ts';
import type { SearchContainer, SearchEntry } from '../raid/containerSearch.ts';
import type { MapInteraction } from '../contracts/demo.ts';
type Bag = ReturnType<typeof createBackpack>;
type Action = {
  close(): void;
  take(id: string, entry: number, p?: Placement): boolean;
  use(id: number): boolean;
  discard(id: number): boolean;
  equip(from: string, id?: number): boolean;
  fold(from: string): boolean;
  unpack(): boolean;
  stow(slot: 'knife' | 'pistol', p?: Placement): boolean;
  holster(id: number): boolean;
};
type Selection = { from: 'bag' | 'source' | 'slot'; id: number; entry: Cargo; rotated: boolean };
export function createBackpackView(actions: Action) {
  const panel = document.createElement('section');
  panel.id = 'backpack-panel';
  panel.hidden = true;
  panel.innerHTML = `<div class="bag-window"><header><h2>装备与携带空间</h2><button id="bag-close">返回出击</button></header>
  <div class="bag-columns"><div class="equipment"><h3>装备</h3><canvas class="operator-portrait"></canvas><div id="loadout"></div></div>
  <div><h3>随身空间 <span id="bag-size"></span></h3><div id="carry-grids"></div></div>
  <div class="bag-container"><h3 id="container-title">物品详情</h3><div id="container-content"></div><div id="selected-item"></div><div class="bag-actions"></div></div></div>
  <p id="bag-danger" role="status"></p><p class="bag-help">单击选择、再点格子放置，或拖放 · R 旋转 · 双击已揭示物品快取</p><p id="bag-feedback" role="status"></p>
  <dialog class="swap-preview"><h3>确认换包</h3><div class="swap-comparison"></div><button value="cancel">返回</button> <button value="confirm">确认装备</button></dialog></div>`;
  document.body.append(panel);
  const q = (s: string) => panel.querySelector<HTMLElement>(s)!;
  const dialog = panel.querySelector('dialog')!;
  let bag: Bag,
    target: MapInteraction | undefined,
    source: SearchContainer | undefined,
    selected: Selection | undefined;
  let count = -1,
    dragging = false,
    confirmSwap: (() => void) | undefined;
  const msg = (s: string) => {
    q('#bag-feedback').textContent = s;
  };
  function button(parent: HTMLElement, label: string, fn: () => void) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.onclick = fn;
    parent.append(b);
    return b;
  }
  function clearSelection() {
    selected = undefined;
    q('#selected-item').textContent = '';
    q('.bag-actions').replaceChildren();
  }
  function action(label: string, fn: () => boolean) {
    button(q('.bag-actions'), label, () => {
      if (fn()) {
        clearSelection();
        refresh();
      } else msg('操作未完成，请检查位置、距离或装备栏');
    });
  }
  function diagram(parent: HTMLElement, sections: Section[], entries: readonly BagEntry[]) {
    for (const s of sections) {
      const line = document.createElement('p');
      line.textContent = s.name + ' ' + s.h + '×' + s.w;
      const g = document.createElement('span');
      g.className = 'mini-grid';
      g.style.gridTemplateColumns = 'repeat(' + s.w + ',8px)';
      for (let y = 0; y < s.h; y++)
        for (let x = 0; x < s.w; x++) {
          const cell = document.createElement('i');
          const e = entries.find((e) => {
            const [w, h] = dimensions(e);
            return e.section === s.id && x >= e.x && x < e.x + w && y >= e.y && y < e.y + h;
          });
          if (e) cell.style.background = itemSpecs[e.item].color;
          g.append(cell);
        }
      line.append(g);
      parent.append(line);
    }
  }
  function requestEquip(item: ItemId, from: string, id?: number) {
    if (!isPack(item)) return;
    const apply = () => {
      if (!actions.equip(from, id)) {
        msg('装备失败，物品仍在原位');
        return;
      }
      if (from !== 'carried' && id === undefined) {
        target = undefined;
        source = undefined;
      }
      clearSelection();
      refresh();
      msg('已装备 ' + itemSpecs[item].name);
    };
    if (!bag.equipped) {
      apply();
      return;
    }
    const area = q('.swap-comparison');
    area.replaceChildren();
    const old = document.createElement('div'),
      next = document.createElement('div');
    old.textContent = '落地 · ' + itemSpecs[bag.equipped.item].name;
    next.textContent = '穿戴 · ' + itemSpecs[item].name;
    area.append(old, next);
    const contents = bag.entries.filter(e => !(from==='carried' && e.id===id) && !pockets.some(s=>s.id===e.section));
    diagram(old, bag.sections.slice(3), contents);
    diagram(next, packs[item], id === undefined && target?.kind === 'loose' ? (source?.entries ?? []) : []);
    const note = document.createElement('p');
    note.textContent =
      '旧包随包落地：' + (contents.map((e) => itemSpecs[e.item].name + ' ×' + e.quantity).join('、') || '空');
    old.append(note);
    confirmSwap = apply;
    dialog.showModal();
  }
  dialog.querySelector('[value=cancel]')!.addEventListener('click', () => dialog.close());
  dialog.querySelector('[value=confirm]')!.addEventListener('click', () => {
    dialog.close();
    confirmSwap?.();
  });
  function select(s: Selection) {
    selected = s;
    const spec = itemSpecs[s.entry.item];
    q('#selected-item').textContent =
      spec.name +
      ' · ' +
      spec.h +
      '×' +
      spec.w +
      ' 格 · ' +
      spec.price +
      ' 券' +
      (s.entry.durability!==undefined?' · 剩余 '+s.entry.durability+'/3':'')+
      (s.entry.loaded !== undefined ? ' · 弹匣 ' + s.entry.loaded : '');
    const bar = q('.bag-actions');
    bar.replaceChildren();
    if (s.from === 'slot') {
      action('收进格子', () => actions.stow(s.entry.item as 'pistol' | 'knife'));
      return;
    }
    if (isPack(s.entry.item))
      button(bar, '直接装备', () =>
        requestEquip(s.entry.item, s.from === 'bag' ? 'carried' : target!.id, s.id),
      );
    if (s.from === 'source') {
      button(bar, '快取', () => transfer());
      return;
    }
    if (spec.tag === 'weapon') action('放回武器栏', () => actions.holster(s.id));
    if (['medkit','healing-injector'].includes(s.entry.item)) action('使用', () => actions.use(s.id));
    button(bar,'放到地上',()=>{if(actions.discard(s.id)){clearSelection();refresh();msg('已放到地上');}else msg('附近地面物品太多，请换个位置');});
  }
  function transfer(p?: Placement) {
    const s = selected;
    if (!s) return;
    const ok =
      s.from === 'source' && target
        ? actions.take(target.id, s.id, p)
        : s.from === 'slot'
          ? actions.stow(s.entry.item as 'pistol' | 'knife', p)
          : p
            ? bag.move(s.id, p.x, p.y, p.rotated, p.section)
            : false;
    if (ok) {
      clearSelection();
      refresh();
      msg('物品已转移');
    } else msg(p ? '该位置有重叠或超出分隔' : bag.failure(s.entry.item));
  }
  function tile(grid: HTMLElement, e: BagEntry, revealed: boolean, from: 'bag' | 'source', active = false) {
    const b = document.createElement('button'),
      [w, h] = dimensions(e),
      spec = itemSpecs[e.item];
    b.className = from === 'bag' ? 'bag-item' : 'source-item ' + (revealed ? 'revealed' : 'unknown');
    b.dataset[from === 'bag' ? 'entry' : 'source'] = String(e.id);
    b.style.cssText =
      'left:calc(' +
      e.x +
      ' * var(--cell));top:calc(' +
      e.y +
      ' * var(--cell));width:calc(' +
      w +
      ' * var(--cell));height:calc(' +
      h +
      ' * var(--cell));--item-color:' +
      (revealed ? spec.color : '#78909e');
    b.title = revealed ? spec.name : '未知物品';
    b.setAttribute('aria-label', b.title);
    if (revealed) {
      b.append(itemIcon(e.item));
      if (e.quantity > 1) {
        const n = document.createElement('b');
        n.className = 'stack-count';
        n.textContent = String(e.quantity);
        b.append(n);
      }
      const choose = () => select({ from, id: e.id, entry: e, rotated: e.rotated });
      b.onclick = () => {
        if (from === 'bag' && selected?.from === 'source')
          transfer({ section: e.section, x: e.x, y: e.y, rotated: selected.rotated });
        else choose();
      };
      b.draggable = true;
      b.ondragstart = (event) => {
        dragging = true;
        if(selected?.from!==from || selected.id!==e.id)choose();
        event.dataTransfer?.setData('text/plain', String(e.id));
      };
      b.ondblclick = () => {
        choose();
        if (from === 'source') transfer();
        else if (isPack(e.item)) requestEquip(e.item, 'carried', e.id);
        else if (['medkit','healing-injector'].includes(e.item) && actions.use(e.id)) {
          clearSelection();
          refresh();
        }
      };
    } else {
      b.textContent = '?';
      if (active) {
        const r = document.createElement('span');
        r.className = 'search-ring';
        b.append(r);
      }
    }
    grid.append(b);
  }
  function gridFor(parent: HTMLElement, s: Section, from: 'bag' | 'source', entries: readonly BagEntry[]) {
    const wrap = document.createElement('section'),
      title = document.createElement('small');
    title.textContent = s.name + ' · ' + s.h + '×' + s.w;
    wrap.append(title);
    const grid = document.createElement('div');
    grid.className = 'section-grid';
    grid.dataset.section = s.id;
    grid.style.setProperty('--columns', String(s.w));
    grid.style.setProperty('--rows', String(s.h));
    wrap.append(grid);
    parent.append(wrap);
    const preview = document.createElement('i');
    preview.className = 'placement-preview';
    preview.hidden = true;
    for (let y = 0; y < s.h; y++)
      for (let x = 0; x < s.w; x++) {
        const cell = document.createElement(from === 'bag' ? 'button' : 'span');
        cell.className = from === 'bag' ? 'bag-cell' : 'source-cell';
        grid.append(cell);
        cell.dataset.x = String(x);
        cell.dataset.y = String(y);
      }
    if (from === 'bag') {
      const position = (ev: MouseEvent) => {
        const r = grid.getBoundingClientRect();
        return {
          x: Math.floor(((ev.clientX - r.left) / grid.clientWidth) * s.w),
          y: Math.floor(((ev.clientY - r.top) / grid.clientHeight) * s.h),
          rotated: selected?.rotated ?? false,
          section: s.id,
        };
      };
      const hint = (ev: MouseEvent) => {
        if (!selected) {
          preview.hidden = true;
          return;
        }
        const p = position(ev),
          [w, h] = dimensions({ ...selected.entry, rotated: p.rotated });
        preview.hidden = false;
        preview.style.cssText =
          'left:calc(' +
          p.x +
          ' * var(--cell));top:calc(' +
          p.y +
          ' * var(--cell));width:calc(' +
          w +
          ' * var(--cell));height:calc(' +
          h +
          ' * var(--cell))';
        preview.dataset.valid = String(
          bag.canPlace(
            selected.entry.item,
            p.x,
            p.y,
            p.rotated,
            selected.entry.quantity,
            s.id,
            selected.from === 'bag' ? selected.id : -1,
          ),
        );
      };
      grid.onmousemove = hint;
      grid.onmouseleave = () => {
        preview.hidden = true;
      };
      grid.ondragover = (ev) => {
        ev.preventDefault();
        hint(ev);
      };
      grid.ondrop = (ev) => {
        ev.preventDefault();
        dragging = false;
        transfer(position(ev));
      };
      grid.onclick = (ev) => {
        const el = ev.target as HTMLElement;
        if (el.classList.contains('bag-cell') && selected)
          transfer({
            section: s.id,
            x: Number(el.dataset.x),
            y: Number(el.dataset.y),
            rotated: selected.rotated,
          });
      };
    }
    const active = source?.entries.find((e) => !e.revealed);
    for (const e of entries)
      if (e.section === s.id || (!e.section && s.id === 'grid'))
        tile(grid, e, from === 'bag' || (e as SearchEntry).revealed, from, e === active);
    grid.append(preview);
  }
  function renderSource() {
    const dest = q('#container-content');
    dest.replaceChildren();
    q('#container-title').textContent = target?.label ?? '物品详情';
    if (target?.kind === 'loose' && isPack(target.item)) {
      const t = target;
      button(dest, '装备此包', () => requestEquip(t.item, t.id));
      if (!source?.entries.length)
        button(dest, '折叠收起', () => {
          if (actions.fold(t.id)) {
            source = target = undefined;
            refresh();
          } else msg(bag.failure(t.item));
        });
    }
    if (!source) return;
    for (const s of source.sections ?? [{ id: 'grid', name: '容器', w: source.width, h: source.height }])
      gridFor(dest, s, 'source', source.entries);
    const status = document.createElement('p');
    status.id = 'search-status';
    dest.append(status);
    count = source.entries.filter((e) => e.revealed).length;
  }
  function refresh() {
    const g = q('#carry-grids');
    g.replaceChildren();
    for (const s of bag.sections) gridFor(g, s, 'bag', bag.entries);
    q('#bag-size').textContent =
      bag.entries.reduce((n, e) => n + itemSpecs[e.item].w * itemSpecs[e.item].h, 0) +
      ' / ' +
      bag.sections.reduce((n, s) => n + s.w * s.h, 0) +
      ' 格';
    const kit = q('#loadout');
    kit.replaceChildren();
    for (const label of ['1 主武器 I · 空', '2 主武器 II · 空']) {
      const p = document.createElement('small');
      p.textContent = label;
      kit.append(p);
    }
    for (const key of ['pistol', 'knife'] as const) {
      const e = bag.slots[key];
      const choose = () => {
        if (e) select({ from: 'slot', entry: e, id: -1, rotated: false });
      };
      const b = button(kit, (key === 'pistol' ? '3 · ' : '4 · ') + (e ? itemSpecs[key].name : '空'), choose);
      if (e) b.prepend(itemIcon(key));
      b.draggable = !!e;
      b.ondragstart = (ev) => {
        if(selected?.from!=='slot'||selected.entry.item!==key)choose();
        dragging = true;
        ev.dataTransfer?.setData('text/plain', key);
      };
      b.ondragover = (ev) => ev.preventDefault();
      b.ondrop = (ev) => {
        ev.preventDefault();
        if (selected?.from === 'bag' && selected.entry.item === key && actions.holster(selected.id)) {
          clearSelection();
          refresh();
        }
      };
    }
    button(kit, bag.equipped ? itemSpecs[bag.equipped.item].name + ' · 卸下' : '背包栏 · 空', () => {
      if (bag.equipped && actions.unpack()) {
        clearSelection();
        refresh();
        msg('背包和内容已一起放到地面');
      }
    });
    renderSource();
  }
  panel.ondragend = () => {
    dragging = false;
  };
  q('#bag-close').onclick = actions.close;
  window.addEventListener('keydown', (ev) => {
    if (panel.hidden || dialog.open) return;
    if (ev.code === 'KeyR' && selected) {
      selected.rotated = !selected.rotated;
      msg('已旋转，点击目标格放置');
    }
    if (ev.code === 'Escape' || ev.code === 'Tab') {
      ev.preventDefault();
      actions.close();
    }
  });
  return {
    get open() {
      return !panel.hidden;
    },
    get activeContainer() {
      return target?.id;
    },
    show(b: Bag, t?: MapInteraction, c?: SearchContainer) {
      bag = b;
      target = t;
      source = c;
      clearSelection();
      msg('');
      panel.hidden = false;
      refresh();
    },
    risk(message:string){q('#bag-danger').textContent=message;},
    hide() {
      if (dialog.open) dialog.close();
      panel.hidden = true;
    },
    updateSearch(paused = false) {
      if (!source || panel.hidden) return;
      const n = source.entries.filter((e) => e.revealed).length;
      if (n !== count && !dragging) renderSource();
      const e = source.entries.find((e) => !e.revealed),
        status = q('#search-status');
      if (status)
        status.textContent =
          e && paused ? '视线或距离中断 · 搜索暂停' : e ? '搜索中 · ' + n + ' 件已揭示' : '搜索完成';
      panel
        .querySelector<HTMLElement>('.search-ring')
        ?.style.setProperty('--progress', (e ? (360 * e.progress) / e.duration : 360) + 'deg');
    },
  };
}
