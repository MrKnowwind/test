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
  take(id: string, entry: number, p?: Placement, quantity?:number): boolean;
  put(id:string,entry:number):boolean;
  use(id: number): boolean;
  discard(s:Selection,container?:string): boolean;
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
  <p id="bag-danger" role="status"></p><p class="bag-help">单击选择、再点格子放置，或拖放 · R 旋转 · Shift + 左键 快移 · 点击堆叠物拆分 · 拖至右侧或 Delete 丢弃</p><p id="bag-feedback" role="status"></p>
  <dialog class="swap-preview"><h3>确认换包</h3><div class="swap-comparison"></div><button value="cancel">返回</button> <button value="confirm">确认装备</button></dialog></div><aside id="drop-zone" aria-label="丢到地面"><strong>↓</strong><span>丢到地面</span></aside>`;
  document.body.append(panel);
  const q = (s: string) => panel.querySelector<HTMLElement>(s)!;
  const dialog = panel.querySelector('dialog')!;
  let bag: Bag,
    target: MapInteraction | undefined,
    source: SearchContainer | undefined,
    selected: Selection | undefined;
  let count = -1,
    dragging = false, draggingPack=false,
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
  function complete(ok:boolean,success:string,failure:string){
    if(ok){clearSelection();refresh();}
    msg(ok?success:failure);
  }
  function discard(){
    if(selected)complete(actions.discard(selected,target?.id),'已放到脚边，可拾回','无法丢弃，请检查距离和附近地面空间');
  }
  function quickMove(s:Selection){
    if(s.from==='source'){transfer();return;}
    if(s.from==='slot'){
      complete(actions.stow(s.entry.item as 'pistol'|'knife'),'已收入随身空间','随身空间不足');return;
    }
    if(target && source)complete(actions.put(target.id,s.id),'已存入 '+target.label,'容器空间不足或已超出互动距离');
    else complete(bag.quickMove(s.id),'已移至另一分隔','另一分隔没有合适的空间');
  }
  function stackControls(bar:HTMLElement,s:Selection){
    if(s.entry.quantity<2 || itemSpecs[s.entry.item].stack===1 || s.from==='slot')return;
    const controls=document.createElement('div');
    controls.className='split-controls';
    const label=document.createElement('label'),slider=document.createElement('input'),out=document.createElement('output');
    slider.type='range';slider.min='1';slider.max=String(s.entry.quantity-1);
    slider.value=String(Math.max(1,Math.floor(s.entry.quantity/2)));slider.setAttribute('aria-label','拆出数量');
    const sync=()=>{out.textContent=slider.value+' / '+s.entry.quantity;};
    slider.oninput=sync;sync();label.append('拆出 ',out);controls.append(label);
    button(controls,'−',()=>{slider.stepDown();sync();});controls.append(slider);
    button(controls,'+',()=>{slider.stepUp();sync();});
    button(controls,s.from==='source'?'取出此数量':'拆为两组',()=>{
      const n=Number(slider.value);
      const ok=s.from==='source' && target?actions.take(target.id,s.id,undefined,n):bag.split(s.id,n);
      complete(ok,'已拆出 '+n+' 件','需要空格或物品数量已变化');
    });
    bar.append(controls);
  }
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
    stackControls(bar,s);
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
    button(bar,'放到地上',discard);
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
      msg(itemSpecs[s.entry.item].name+' ×'+s.entry.quantity+' 已转移');
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
      b.onclick = (ev) => {
        if(ev.shiftKey){choose();quickMove(selected!);return;}
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
    wrap.setAttribute('aria-label', s.name + ' ' + s.w + '×' + s.h);
    if (from === 'bag') wrap.style.gridArea = s.id;
    else {
      title.textContent = s.name + ' · ' + s.w + '×' + s.h;
      wrap.append(title);
    }
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
        if (from === 'bag') cell.setAttribute('aria-label', s.name + ' 第' + (y + 1) + '行第' + (x + 1) + '列');
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
    const pocketRow = document.createElement('div');
    pocketRow.className = 'pocket-row';
    pocketRow.setAttribute('aria-label', '随身袋');
    g.append(pocketRow);
    for (const section of pockets) gridFor(pocketRow, section, 'bag', bag.entries);
    if (bag.equipped && isPack(bag.equipped.item)) {
      const sack = document.createElement('div');
      sack.className = 'pack-layout';
      sack.dataset.pack = bag.equipped.item;
      sack.setAttribute('aria-label', itemSpecs[bag.equipped.item].name);
      g.append(sack);
      for (const section of packs[bag.equipped.item]) gridFor(sack, section, 'bag', bag.entries);
    }
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
      if(e){
        b.prepend(itemIcon(key));
        b.onclick=ev=>{choose();if(ev.shiftKey)quickMove(selected!);};
      }
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
    const packButton=button(kit, bag.equipped ? itemSpecs[bag.equipped.item].name + ' · 卸下' : '背包栏 · 空', () => {
      if (bag.equipped && actions.unpack()) {
        clearSelection();
        refresh();
        msg('背包和内容已一起放到地面');
      }
    });
    packButton.draggable=!!bag.equipped;
    packButton.ondragstart=ev=>{
      if(!bag.equipped)return;
      clearSelection();dragging=draggingPack=true;
      ev.dataTransfer?.setData('text/plain','worn-backpack');
    };
    renderSource();
  }
  q('#container-content').ondragover=ev=>{if(dragging && selected?.from==='bag' && source)ev.preventDefault();};
  q('#container-content').ondrop=ev=>{
    if(!dragging || selected?.from!=='bag' || !source)return;
    ev.preventDefault();quickMove(selected);dragging=false;panel.classList.remove('has-drag');
  };
  const dropZone=q('#drop-zone');
  dropZone.ondragover=ev=>{
    if(!dragging || (!selected && !draggingPack))return;
    ev.preventDefault();dropZone.classList.add('over');
    if(ev.dataTransfer)ev.dataTransfer.dropEffect='move';
  };
  dropZone.ondragleave=()=>dropZone.classList.remove('over');
  dropZone.ondrop=ev=>{
    ev.preventDefault();dropZone.classList.remove('over');
    if(draggingPack)complete(actions.unpack(),'已将背包和内容放到脚边','附近地面空间不足');
    else if(dragging && selected)discard();
    draggingPack=dragging=false;panel.classList.remove('has-drag');
  };
  panel.addEventListener('dragstart',()=>{if(dragging)panel.classList.add('has-drag');});
  panel.ondragend = () => {
    panel.classList.remove('has-drag');dropZone.classList.remove('over');
    draggingPack=dragging=false;
  };
  q('#bag-close').onclick = actions.close;
  window.addEventListener('keydown', (ev) => {
    if (panel.hidden || dialog.open) return;
    if(ev.code==='Delete' && selected && !ev.repeat){ev.preventDefault();discard();return;}
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
      draggingPack=dragging=false;panel.classList.remove('has-drag');dropZone.classList.remove('over');clearSelection();
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
