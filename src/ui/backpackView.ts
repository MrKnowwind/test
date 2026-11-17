import type { SearchContainer, Placement } from '../raid/containerSearch.ts';
import type { MapInteraction } from '../contracts/demo.ts';
import { itemSpecs, type createBackpack } from '../raid/backpack.ts';

type Backpack = ReturnType<typeof createBackpack>;

export function createBackpackView(callbacks: {
  close(): void;
  take(id: string, entry: number, placement?: Placement): boolean;
  use(id: number): boolean;
  discard(id: number): void;
}) {
  const panel = document.createElement('section');
  panel.id = 'backpack-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', '背包和容器');
  panel.innerHTML = `
    <div class="bag-window">
      <header><div><span class="eyebrow">FIELD INVENTORY</span><h2>装备与背包</h2></div><button id="bag-close">返回出击</button></header>
      <div class="bag-columns">
        <div class="equipment"><h3>装备</h3><div><kbd>1</kbd> 主武器 I <small>空</small></div><div><kbd>2</kbd> 主武器 II <small>空</small></div><div><kbd>3</kbd> 手枪 <small>已装备</small></div><div><kbd>4</kbd> 战术刀 <small>已装备</small></div></div>
        <div><h3>随身背包 <span id="bag-size"></span></h3><div id="bag-grid"></div><p class="bag-help">拖动物品移动 · R 旋转 · 双击使用补给</p></div>
        <div class="bag-container"><h3 id="container-title">物品详情</h3><div id="container-content"></div><div id="selected-item"></div><div class="bag-actions"><button id="bag-use" hidden>使用</button><button id="bag-drop" hidden>丢弃</button></div></div>
      </div><p id="bag-feedback" role="status"></p>
    </div>`;
  document.body.append(panel);
  const grid = panel.querySelector<HTMLElement>('#bag-grid')!;
  const size = panel.querySelector('#bag-size')!;
  const feedback = panel.querySelector('#bag-feedback')!;
  const content = panel.querySelector('#container-content')!;
  const detail = panel.querySelector('#selected-item')!;
  const useButton = panel.querySelector<HTMLButtonElement>('#bag-use')!;
  const dropButton = panel.querySelector<HTMLButtonElement>('#bag-drop')!;
  let bag: Backpack;
  let container: MapInteraction | undefined;
  let source: SearchContainer | undefined;
  let sourceSelected: number | undefined;
  let selected: number | undefined;
  let revealVersion = -1;
  let dragging = false;
  let rotated = false;
  function message(text: string) { feedback.textContent = text; }
  function select(id: number) {
    selected = id;sourceSelected = undefined;
    const entry = bag.entries.find(entry => entry.id === id);
    if (entry) {
      rotated = entry.rotated;
      const spec = itemSpecs[entry.item];
      detail.textContent = `${spec.name} × ${entry.quantity} · ${spec.w} × ${spec.h} 格 · 单件售价 ${spec.price} 券`;
      useButton.hidden = entry.item !== 'medkit' && entry.item !== 'pistol-ammo';
      dropButton.hidden = false;
    }
  }
  function refresh() {
    if (!bag.entries.some(entry => entry.id === selected)) {
      selected = undefined;
      detail.textContent = '';
      useButton.hidden = dropButton.hidden = true;
    }
    grid.replaceChildren();
    grid.style.setProperty('--columns', String(bag.width));
    grid.style.setProperty('--rows', String(bag.height));
    let occupied = 0;
    for (let y = 0; y < bag.height; y++) for (let x = 0; x < bag.width; x++) {
      const cell = document.createElement('button');
      cell.className = 'bag-cell';
      cell.dataset.x = String(x); cell.dataset.y = String(y);
      cell.setAttribute('aria-label', `背包格 ${x + 1},${y + 1}`);
      cell.onclick = () => {
        if (sourceSelected !== undefined) { transfer({x,y,rotated}); return; }
        if (selected === undefined) return;
        message(bag.move(selected, x, y, rotated) ? '位置已更新' : '空间不足或与其他物品重叠');
        refresh();
      };
      cell.ondragover = event => event.preventDefault();
      cell.ondrop = event => {
        event.preventDefault();
        const data = event.dataTransfer?.getData('text/plain');
        if (data?.startsWith('source:')) { sourceSelected=Number(data.slice(7));transfer({x,y,rotated});return; }
        const id = Number(data);
        const entry = bag.entries.find(entry => entry.id === id);
        if (!entry) return;
        message(bag.move(id, x, y, selected === id ? rotated : entry.rotated) ? '位置已更新' : '放置位置不可用');
        refresh();
      };
      grid.append(cell);
    }
    for (const entry of bag.entries) {
      const spec = itemSpecs[entry.item];
      const [w, h] = bag.dimensions(entry);
      occupied += w * h;
      const button = document.createElement('button');
      button.className = 'bag-item';
      button.draggable = true;
      button.dataset.entry = String(entry.id);
      button.style.cssText = `left:calc(${entry.x} * var(--cell));top:calc(${entry.y} * var(--cell));width:calc(${w} * var(--cell));height:calc(${h} * var(--cell));--item-color:${spec.color}`;
      button.textContent = `${spec.name}${entry.quantity > 1 ? ' × ' + entry.quantity : ''}`;
      button.prepend(itemIcon(entry.item));
      button.title = `${spec.name} · ${w}×${h}`;
      button.onclick = () => { if(sourceSelected!==undefined) transfer({x:entry.x,y:entry.y,rotated});else select(entry.id); };
      button.ondragstart = event => {
        if (selected !== entry.id) select(entry.id);
        event.dataTransfer?.setData('text/plain', String(entry.id));
      };
      button.ondblclick = () => {
        message(callbacks.use(entry.id) ? '补给已使用' : '该物品当前无法使用');
        refresh();
      };
      grid.append(button);
    }
    size.textContent = `${occupied} / ${bag.width * bag.height} 格`;
    renderSource();
    const preview=document.createElement('div');preview.id='placement-preview';preview.hidden=true;grid.append(preview);
  }
  function transfer(placement?: Placement) {
    if(!container || sourceSelected===undefined) return;
    if(callbacks.take(container.id,sourceSelected,placement)) {
      sourceSelected=undefined;message('物品已放入背包');
    } else message('放置失败：空间不足、重叠或物品尚未揭示');
    dragging=false;refresh();
  }
  function renderSource() {
    content.replaceChildren();
    panel.querySelector('#container-title')!.textContent = container ? container.label : '物品详情';
    if(!source) {content.textContent='选择背包物品查看详情';return;}
    const sourceGrid=document.createElement('div');sourceGrid.id='container-grid';
    sourceGrid.style.setProperty('--columns',String(source.width));sourceGrid.style.setProperty('--rows',String(source.height));
    content.append(sourceGrid);
    for(let i=0;i<source.width*source.height;i++) {
      const cell=document.createElement('span');cell.className='source-cell';sourceGrid.append(cell);
    }
    const active=source.entries.find(e=>!e.revealed);
    for(const entry of source.entries) {
      const spec=itemSpecs[entry.item], [w,h]=bag.dimensions(entry);
      const button=document.createElement('button');
      button.className='source-item '+(entry.revealed?'revealed':'unknown');
      button.dataset.source=String(entry.id);
      button.style.cssText=`left:calc(${entry.x} * var(--cell));top:calc(${entry.y} * var(--cell));width:calc(${w} * var(--cell));height:calc(${h} * var(--cell));--item-color:${entry.revealed?spec.color:'#7d8d8b'}`;
      button.setAttribute('aria-label',entry.revealed?`${spec.name} × ${entry.quantity}`:`未知物品 ${w}×${h} 格`);
      button.title=button.getAttribute('aria-label')!;
      button.draggable=entry.revealed;
      if(entry.revealed) {
        button.append(itemIcon(entry.item),document.createTextNode(spec.name+(entry.quantity>1?' × '+entry.quantity:'')));
        button.onclick=()=>{sourceSelected=entry.id;selected=undefined;rotated=entry.rotated;detail.textContent=`${spec.name} × ${entry.quantity} · ${w}×${h} 格 · 单件 ${spec.price} 券`;useButton.hidden=dropButton.hidden=true;message('点击背包格放入 · R 旋转 · 双击自动放置');};
        button.ondblclick=()=>{sourceSelected=entry.id;transfer();};
        button.ondragstart=e=>{if(sourceSelected!==entry.id)rotated=entry.rotated;sourceSelected=entry.id;selected=undefined;e.dataTransfer?.setData('text/plain','source:'+entry.id);};
      } else {
        button.textContent='?';
        if(entry===active) { const ring=document.createElement('span');ring.className='search-ring';button.append(ring); }
      }
      sourceGrid.append(button);
    }
    const status=document.createElement('p');status.id='search-status';content.append(status);
    revealVersion=source.entries.filter(e=>e.revealed).length;
    updateSearch();
  }
  function updateSearch(paused=false) {
    if(panel.hidden||!source) return;
    const count=source.entries.filter(e=>e.revealed).length;
    if(count!==revealVersion && !dragging) {renderSource();return;}
    const active=source.entries.find(e=>!e.revealed);
    const ring=content.querySelector<HTMLElement>('.search-ring');
    ring?.style.setProperty('--progress',String(active?active.progress/active.duration*360:360)+'deg');
    const status=content.querySelector('#search-status');
    if(status) status.textContent=paused?'距离过远 · 搜索暂停，靠近后可继续':active?'逐件搜索中 · 已揭示 '+count+' 件':'搜索完成 · '+source.entries.length+' 件可取';
  }
  function preview(event: MouseEvent | DragEvent) {
    const node=grid.querySelector<HTMLElement>('#placement-preview')!;
    const entry=source?.entries.find(e=>e.id===sourceSelected);
    if(!entry) {node.hidden=true;return;}
    const rect=grid.getBoundingClientRect(),cell=rect.width/bag.width;
    const x=Math.floor((event.clientX-rect.left)/cell),y=Math.floor((event.clientY-rect.top)/cell);
    const [w,h]=bag.dimensions({...entry,rotated});
    node.hidden=false;node.style.cssText=`left:${x*cell}px;top:${y*cell}px;width:${w*cell}px;height:${h*cell}px`;
    node.dataset.valid=String(bag.canPlace(entry.item,x,y,rotated));
  }
  panel.addEventListener('dragstart',()=>{dragging=true;});
  panel.addEventListener('dragend',()=>{dragging=false;updateSearch();});
  grid.addEventListener('mousemove',preview);grid.addEventListener('dragover',event=>{event.preventDefault();preview(event);});
  grid.addEventListener('mouseleave',()=>{const p=grid.querySelector<HTMLElement>('#placement-preview');if(p)p.hidden=true;});
  panel.querySelector('#bag-close')!.addEventListener('click', callbacks.close);
  useButton.onclick = () => {
    if (selected !== undefined) {
      message(callbacks.use(selected) ? '补给已使用' : '当前无法使用');
      refresh();
    }
  };
  dropButton.onclick = () => {
    if (selected !== undefined) callbacks.discard(selected);
    selected = undefined;
    dropButton.hidden = useButton.hidden = true;
    detail.textContent = '';
    refresh();
  };
  window.addEventListener('keydown', event => {
    if (panel.hidden) return;
    if (event.code === 'KeyR' && (selected !== undefined || sourceSelected !== undefined)) {
      rotated = !rotated;
      message('已旋转放置方向，点击空格完成放置');
    }
    if (event.code === 'Escape' || event.code === 'Tab') {
      event.preventDefault();
      callbacks.close();
    }
  });
  return {
    get open() { return !panel.hidden; },
    get activeContainer() {return container?.id;},
    updateSearch,
    show(backpack: Backpack, target?: MapInteraction, contents?: SearchContainer) {
      bag = backpack; container = target; source = contents; selected = undefined;sourceSelected=undefined;
      message(''); detail.textContent = ''; dropButton.hidden = useButton.hidden = true;
      panel.hidden = false;refresh();
    },
    hide() { panel.hidden = true; },
  };
}

// Canvas pictograms: generated from item semantics, never loaded from files.
function itemIcon(item: string) {
 const canvas=document.createElement('canvas');canvas.width=64;canvas.height=48;canvas.className='item-icon';
 const c=canvas.getContext('2d')!;c.strokeStyle='#dbdfcd';c.fillStyle='#91a29a';c.lineWidth=3;
 if(item==='medkit') {c.strokeRect(10,10,44,30);c.fillRect(28,14,8,23);c.fillRect(20,22,24,8);}
 else if(item==='pistol-ammo') {for(let x=15;x<55;x+=12){c.strokeRect(x,16,7,24);c.beginPath();c.moveTo(x,16);c.lineTo(x+3.5,6);c.lineTo(x+7,16);c.stroke();}}
 else if(item==='research-sample') {c.strokeRect(23,9,18,31);c.fillRect(26,25,12,12);c.fillRect(20,5,24,5);}
 else if(item==='service-card') {c.strokeRect(7,9,50,30);c.fillRect(11,14,10,12);for(let y=17;y<35;y+=7)c.fillRect(26,y,25,2);}
 else {c.beginPath();for(let i=0;i<32;i++){const a=i/32*Math.PI*2,r=i%4<2?20:15;c.lineTo(32+Math.cos(a)*r,24+Math.sin(a)*r);}c.closePath();c.stroke();c.beginPath();c.arc(32,24,7,0,Math.PI*2);c.stroke();}
 return canvas;
}
