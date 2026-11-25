import { createBackpack, dimensions, portion, type BagEntry, type Placement } from '../raid/backpack.ts';
import { isPack, itemSpecs, packs, type ItemId, type PackId } from '../raid/catalog.ts';
import { defaultLoadout, isMaterial, loadoutRequests, supplyItems, type Loadout, type Supply } from '../raid/loadout.ts';
import { arrangeStash, readStashLayout, remainingStock, saveStashLayout, stashColumns, visibleStashRows } from '../raid/stash.ts';
import { buyPrice, shopItems, type createWarehouse } from '../raid/warehouse.ts';
import { itemIcon } from './itemArt.ts';
import { renderPortMapPreviews } from './portMapPreview.ts';
import { renderMerchantPortrait } from './merchantArt.ts';

type Pane = 'home' | 'prepare' | 'buy' | 'sell' | 'tasks' | 'base';
type Bag = NonNullable<ReturnType<ReturnType<typeof createWarehouse>['preview']>>;
type Selection = { from: 'stash' | 'carry'; id: number } | { from: 'slot'; slot: 'pack' | 'pistol' | 'knife' };
const categories = { weapon:'装备', carry:'背包', ammo:'弹药', medical:'医疗', mechanical:'工业', electronics:'电子', shipping:'港务', research:'研究' };
const qualityLabels = ['普通','军用','精良','稀有','珍贵','机密'];
const q = <T extends HTMLElement = HTMLElement>(id:string) => document.getElementById(id) as T;
const isSupply = (item:ItemId): item is Supply => supplyItems.some(supply=>item===supply);

export function createOutpostView(warehouse: ReturnType<typeof createWarehouse>, message: (text?: string) => void) {
  const root = q('outpost'), slots = q('prepare-slots'), grid = q('prepare-grid'), stashGrid=q('stash-grid');
  const detail=q('stash-detail'), search=q<HTMLInputElement>('stash-search'), category=q<HTMLSelectElement>('stash-category');
  const merchantCategory=q<HTMLSelectElement>('merchant-category'), refreshLabel=q<HTMLTimeElement>('market-refresh');
  const nav = [...document.querySelectorAll<HTMLButtonElement>('[data-outpost]')];
  let plan: Loadout = { ...defaultLoadout };
  let pane: Pane = 'home', refreshAt=0;
  let bag = warehouse.preview(plan);
  let stash = arrangeStash(remainingStock(warehouse.read() ?? {},plan),readStashLayout(localStorage));
  let selected:Selection|undefined, dragging:Selection|undefined;
  for(const [key,title] of Object.entries(categories)){
    category.add(new Option(title,key));
    merchantCategory.add(new Option(title,key));
  }
  renderPortMapPreviews();
  renderMerchantPortrait(q<HTMLCanvasElement>('merchant-portrait'));
  const dialog=q<HTMLDialogElement>('map-dialog');
  q('map-open').onclick=()=>dialog.showModal();
  q('map-close').onclick=q('map-select').onclick=()=>dialog.close();

  function entryFor(s:Selection) {
    if(s.from==='stash')return stash.entries.find(e=>e.id===s.id);
    if(s.from==='carry')return bag?.entries.find(e=>e.id===s.id);
    if(s.from==='slot')return s.slot==='pack'?bag?.equipped:bag?.slots[s.slot];
  }
  function makeTile(entry: Pick<BagEntry,'item'|'quantity'|'rotated'>, selection:Selection, paid?:number) {
    const spec=itemSpecs[entry.item], button=document.createElement('button');
    button.type='button';button.className='inventory-tile';
    button.style.setProperty('--item-color',spec.color);
    button.title=spec.name+' ×'+entry.quantity;
    button.setAttribute('aria-label',spec.name);
    const icon=itemIcon(entry.item); icon.classList.toggle('rotated',entry.rotated);
    button.append(icon);
    if(entry.quantity>1){
      const count=document.createElement('small');count.textContent=String(entry.quantity);button.append(count);
    }
    if(paid!==undefined){
      const mark=document.createElement('span');mark.className='issued-mark';mark.textContent=paid===0?'配发':paid<entry.quantity?'混合':'自带';button.append(mark);
    }
    button.draggable=true;
    button.ondragstart=event=>{dragging=selection;choose(selection);event.dataTransfer?.setData('text/plain','saltport-inventory');};
    button.ondragend=()=>{dragging=undefined;};
    button.onclick=event=>{choose(selection);if(event.shiftKey)quickMove(selection);};
    button.ondblclick=()=>quickMove(selection);
    if(selection.from!=='slot')button.dataset[selection.from==='stash'?'stockEntry':'carryEntry']=String(selection.id);
    else button.dataset.slot=selection.slot;
    return button;
  }
  function placeTile(button:HTMLButtonElement,entry:BagEntry){
    const [w,h]=dimensions(entry);
    button.style.gridArea=(entry.y+1)+' / '+(entry.x+1)+' / span '+h+' / span '+w;
  }
  function dropTarget(element:HTMLElement,perform:(selection:Selection,event:DragEvent)=>void){
    element.ondragover=event=>{if(dragging){event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';}};
    element.ondrop=event=>{if(!dragging)return;event.preventDefault();event.stopPropagation();const source=dragging;dragging=undefined;perform(source,event);};
  }
  function cellAt(element:HTMLElement,event:DragEvent,columns:number,section?:string):Placement {
    const rect=element.getBoundingClientRect(),cell=rect.width/columns;
    return {x:Math.floor((event.clientX-rect.left)/cell),y:Math.floor((event.clientY-rect.top)/cell),rotated:false,section};
  }
  function saveLayout(){saveStashLayout(localStorage,stash.entries);}
  function clearSelection(){selected=undefined;detail.replaceChildren();for(const el of root.querySelectorAll('.inventory-tile.selected'))el.classList.remove('selected');}
  function choose(s:Selection){
    const entry=entryFor(s);
    if(!entry)return;
    selected=s;
    for(const el of root.querySelectorAll('.inventory-tile.selected'))el.classList.remove('selected');
    const selector=s.from==='stash'?'[data-stock-entry="'+s.id+'"]':s.from==='carry'?'[data-carry-entry="'+s.id+'"]':s.from==='slot'?'[data-slot="'+s.slot+'"]':'';
    if(selector)root.querySelector(selector)?.classList.add('selected');
    const spec=itemSpecs[entry.item], heading=document.createElement('div'), text=document.createElement('div'), name=document.createElement('strong'), meta=document.createElement('small');
    heading.className='inspect-heading';name.textContent=spec.name+' ×'+entry.quantity;
    meta.textContent=[qualityLabels[spec.rank],categories[spec.tag],spec.w+' × '+spec.h+' 格',entry.durability!==undefined?'耐久 '+entry.durability+'/3':'',entry.loaded!==undefined?'装填 '+entry.loaded:'',warehouse.price(entry.item)+' 券/件'].filter(Boolean).join(' · ');
    text.append(name,meta);heading.append(itemIcon(entry.item),text);
    const actions=document.createElement('div');actions.className='inspect-actions';
    function action(label:string,fn:()=>void){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;actions.append(b);}
    if(s.from==='stash'){action('带入整备',()=>quickMove(s));action('旋转',()=>rotate(s));}
    else {action('退回仓库',()=>quickMove(s));if(s.from==='carry')action('旋转',()=>rotate(s));}
    if(s.from!=='slot' && entry.quantity>1 && spec.stack>1){
      const amount=document.createElement('input');amount.type='number';amount.min='1';amount.max=String(entry.quantity-1);amount.value=String(Math.floor(entry.quantity/2));amount.setAttribute('aria-label','拆分数量');
      actions.append(amount);
      action('拆分',()=>{
        const model=s.from==='stash'?stash:bag;
        if(!model?.split(s.id,Number(amount.value)))return message('没有足够的连续空间，无法拆分');
        if(s.from==='carry')storeCarryLayout(model);
        else{saveLayout();renderStash();}
        clearSelection();
      });
    }
    detail.replaceChildren(heading,actions);
  }
  function carryLayout(model:Bag){
    return model.entries.map(({item,quantity,x,y,rotated,section,issued})=>({item,quantity,x,y,rotated,section,issued:issued??0}));
  }
  function storeCarryLayout(model:Bag){
    plan={...plan,layout:carryLayout(model)};
    bag=warehouse.preview(plan);
    renderCarry();clearSelection();
  }
  function changePlan(next:Loadout, position?:Placement, item?:ItemId, preserve=true) {
    const revised:Loadout={...next,layout:undefined};
    const preview=warehouse.preview(revised);
    if(!preview){message('装备或连续空间不足，请调整整备');return false;}
    // Keep the existing arrangement when stock changes, using the new loadout as the authoritative inventory.
    if(preserve && bag?.entries.length){
      const target=createBackpack(3,2,true);
      if(preview.equipped)target.swap(preview.equipped);
      const pool=preview.entries.map(e=>({...e}));
      for(const entry of bag.entries){
        for(const source of pool){
          if(source.item!==entry.item || !source.quantity)continue;
          const already=target.entries.find(e=>e.section===entry.section&&e.x===entry.x&&e.y===entry.y&&e.item===entry.item)?.quantity??0;
          const quantity=Math.min(entry.quantity-already,source.quantity);
          if(quantity<=0)break;
          const part=portion(source,quantity)!;
          if(target.receive(part,entry)){source.quantity-=quantity;source.issued=(source.issued??0)-(part.issued??0);}
        }
      }
      let placed=true;
      if(position&&item){
        const sources=pool.filter(e=>e.item===item&&e.quantity>0);
        if(!sources.length)placed=false;
        for(const source of sources){
          if(!target.receive(source,position)){placed=false;break;}
          source.quantity=0;
        }
      }
      if(placed)for(const source of pool){
        if(source.quantity>0&&!target.receive(source)){placed=false;break;}
      }
      if(placed)revised.layout=carryLayout(target);
      else if(position){message('目标格子空间不足');return false;}
    }else if(position&&item){
      const entry=preview.entries.find(e=>e.item===item);
      if(!entry||!preview.move(entry.id,position.x,position.y,position.rotated,position.section)){
        message('目标格子空间不足');return false;
      }
      revised.layout=carryLayout(preview);
    }
    if(revised.layout&&!warehouse.preview(revised)){message('装备布局已变化，请重新整备');return false;}
    plan=revised;message();refresh();return true;
  }
  function reserve(item:ItemId,quantity:number,position?:Placement) {
    const next:Loadout={...plan,cargo:{...plan.cargo}};
    if(isPack(item))next.pack=item;
    else if(item==='pistol'||item==='knife')next[item]='warehouse';
    else if(isSupply(item))next[item]=(plan[item]??0)+quantity;
    else if(isMaterial(item))next.cargo![item]=(plan.cargo?.[item]??0)+quantity;
    else return false;
    return changePlan(next,isSupply(item)||isMaterial(item)?position:undefined,item);
  }
  function release(s:Selection, position?:Placement){
    const next:Loadout={...plan,cargo:{...plan.cargo}};
    const entry=entryFor(s);if(!entry)return;
    let amount=entry.quantity-(entry.issued??0);
    if(s.from==='slot'){
      if(entry.issued){message('基础配发装备可在装备栏取消');return;}
      amount=1;
      if(s.slot==='pack')next.pack=undefined;else next[s.slot]=undefined;
    }else if(s.from==='carry'){
      if(!amount){message('配发补给不计入仓库');return;}
      if(isSupply(entry.item))next[entry.item]=Math.max(0,(plan[entry.item]??0)-amount);
      else if(isMaterial(entry.item))next.cargo![entry.item]=Math.max(0,(plan.cargo?.[entry.item]??0)-amount);
      else return;
    }
    const previous=stash.entries.map(e=>({...e}));
    if(position && !stash.receive({item:entry.item,quantity:amount},position)){
      message('仓库目标格子空间不足');return;
    }
    if(!changePlan(next)&&position){
      stash=arrangeStash(remainingStock(warehouse.read()??{},plan),previous);
      renderStash();clearSelection();
    }
  }
  function quickMove(s:Selection){
    if(s.from!=='stash'){release(s);return;}
    const e=entryFor(s);if(e)reserve(e.item,e.quantity);
  }
  function rotate(s:Selection){
    if(s.from==='slot')return;
    const model=s.from==='stash'?stash:bag,entry=model?.entries.find(e=>e.id===s.id);
    if(!model||!entry)return;
    if(!model.move(entry.id,entry.x,entry.y,!entry.rotated,entry.section)){message('旋转后空间不足');return;}
    if(s.from==='stash'){saveLayout();renderStash();choose(s);}
    else storeCarryLayout(model);
  }
  window.addEventListener('keydown',event=>{
    if(pane!=='prepare'||root.hidden||root.closest('#overlay')?.hasAttribute('hidden')||!selected||event.code!=='KeyR'||
      document.querySelector('dialog[open]')||event.target instanceof HTMLInputElement||event.target instanceof HTMLSelectElement)return;
    event.preventDefault();rotate(selected);
  });

  function renderCarry(){
    grid.replaceChildren();q('equipment-slots').replaceChildren();
    if(!bag){grid.textContent='装备或空间不足';return;}
    const kit=document.createElement('div');kit.className='prepare-kit';
    for(const [slot,label] of [['pistol','手枪'],['knife','近战'],['pack','背包']] as const){
      const area=document.createElement('div');area.className='equip-slot';
      const title=document.createElement('small');title.textContent=label;area.append(title);
      const cargo=slot==='pack'?bag.equipped:bag.slots[slot];
      if(cargo)area.append(makeTile({...cargo,rotated:false},{from:'slot',slot},cargo.issued?0:1));
      else{const empty=document.createElement('span');empty.className='empty-equip';empty.textContent='空';area.append(empty);}
      dropTarget(area,s=>{
        if(s.from!=='stash')return;
        const item=entryFor(s)?.item;
        if(item && (slot==='pack'?isPack(item):slot===item))reserve(item,1);
        else message('请选择相应类型的装备');
      });
      kit.append(area);
    }
    q('equipment-slots').append(kit);
    const sections=document.createElement('div');sections.className='prepare-compartments';
    const pockets=document.createElement('div'), backpack=document.createElement('div');
    pockets.className=backpack.className='compartment-row';
    sections.append(pockets,backpack);
    for(const section of bag.sections){
      const panel=document.createElement('section'), label=document.createElement('label'), area=document.createElement('div');
      label.textContent=section.name; area.className='prepare-section inventory-grid';area.dataset.carrySection=section.id;
      area.style.setProperty('--columns',String(section.w));area.style.setProperty('--rows',String(section.h));
      for(const entry of bag.entries.filter(e=>e.section===section.id)){
        const tile=makeTile(entry,{from:'carry',id:entry.id},entry.quantity-(entry.issued??0));placeTile(tile,entry);area.append(tile);
      }
      dropTarget(area,(s,event)=>{
        const e=entryFor(s);if(!e)return;
        const pos=cellAt(area,event,section.w,section.id);pos.rotated='rotated' in e?!!e.rotated:false;
        if(s.from==='stash')reserve(e.item,e.quantity,pos);
        else if(s.from==='carry' && bag){
          if(bag.move(s.id,pos.x,pos.y,pos.rotated,pos.section)){storeCarryLayout(bag);message();}
          else message('格子被占用或超出范围');
        }
      });
      panel.append(label,area);(['left','center','right'].includes(section.id)?pockets:backpack).append(panel);
    }
    grid.append(sections);
    dropTarget(grid,s=>{if(s.from==='stash')quickMove(s);});
  }
  function prepare(){
    slots.replaceChildren();
    const stock=warehouse.read()??{};
    function field(title:string,input:HTMLInputElement|HTMLSelectElement){
      const row=document.createElement('label');input.setAttribute('aria-label',title);row.append(title,input);slots.append(row);
    }
    function select(title:string,options:readonly (readonly [string,string])[],value:string,choose:(value:string)=>void){
      const input=document.createElement('select');for(const [key,name] of options)input.add(new Option(name,key));
      input.value=value;input.onchange=()=>choose(input.value);field(title,input);
    }
    const available=(Object.keys(packs) as PackId[]).filter(item=>stock[item]||item===plan.pack);
    select('背包',[['','空'],...available.map(item=>[item,itemSpecs[item].name+' ×'+(stock[item]??0)] as const)],plan.pack??'',value=>{
      if(!changePlan({...plan,pack:isPack(value as ItemId)?value as PackId:undefined}))prepare();
    });
    for(const [weapon,title] of [['pistol','手枪'],['knife','近战']] as const){
      const options:[string,string][]=[['','空'],['issued',itemSpecs[weapon].name+' · 配发']];
      if(stock[weapon]||plan[weapon]==='warehouse')options.push(['warehouse',itemSpecs[weapon].name+' · 仓库 ×'+(stock[weapon]??0)]);
      select(title,options,plan[weapon]??'',value=>{
        if(!changePlan({...plan,[weapon]:value==='issued'||value==='warehouse'?value:undefined}))prepare();
      });
    }
    for(const item of supplyItems){
      const input=document.createElement('input');input.type='number';input.min='0';input.max=String(stock[item]??0);
      input.value=String(plan[item]??0);input.dataset.supply=item;input.disabled=!stock[item]&&!plan[item];
      input.onchange=()=>{
        if(!changePlan({...plan,[item]:Math.max(0,Math.min(stock[item]??0,Math.trunc(input.valueAsNumber||0)))}))prepare();
      };
      field(itemSpecs[item].name,input);
    }
    renderCarry();
  }
  function renderStash(){
    stashGrid.replaceChildren();stashGrid.style.setProperty('--columns',String(stashColumns));
    stashGrid.style.setProperty('--rows',String(visibleStashRows(stash.entries)));
    let matching=0;
    for(const entry of stash.entries){
      const spec=itemSpecs[entry.item];
      if(category.value&&category.value!==spec.tag||search.value.trim()&&!spec.name.includes(search.value.trim()))continue;
      const tile=makeTile(entry,{from:'stash',id:entry.id});placeTile(tile,entry);stashGrid.append(tile);matching++;
    }
    q('stash-count').textContent=matching+' / '+stash.entries.length+' 组';
  }
  dropTarget(stashGrid,(s,event)=>{
    if(s.from!=='stash'){
      const entry=entryFor(s);
      const pos=cellAt(stashGrid,event,stashColumns);
      pos.rotated=!!(entry&&'rotated' in entry&&entry.rotated);
      release(s,pos);return;
    }
    const e=stash.entries.find(e=>e.id===s.id);if(!e)return;
    const pos=cellAt(stashGrid,event,stashColumns);
    if(!stash.move(s.id,pos.x,pos.y,e.rotated)){message('目标格子已占用或超出范围');return;}
    saveLayout();renderStash();clearSelection();message();
  });
  search.oninput=category.onchange=()=>{clearSelection();renderStash();};
  q('stash-sort').onclick=()=>{stash=arrangeStash(remainingStock(warehouse.read()??{},plan));saveLayout();renderStash();clearSelection();message();};
  q('reset-loadout').onclick=()=>changePlan({...defaultLoadout},undefined,undefined,false);

  function tradeRow(item: ItemId, amount: number, price: number, buying: boolean, credits: number) {
    const row=document.createElement('article'), header=document.createElement('div'), name=document.createElement('strong'), info=document.createElement('small'), button=document.createElement('button');
    row.style.setProperty('--item-color',itemSpecs[item].color);
    name.textContent=itemSpecs[item].name; info.textContent=(buying&&item==='pistol-ammo'?'每盒 12 发 · ':'')+'持有 '+amount;
    header.append(name,info);
    button.textContent=(buying?'购买':'出售')+' · '+price;
    button.setAttribute('aria-label',button.textContent+' 券 · '+name.textContent);
    button.type='button';button.dataset[buying?'buy':'sell']=item;
    button.disabled=buying?credits<price:amount<1;
    button.onclick=async()=>{
      button.disabled=true;
      const ok=await (buying?warehouse.buy(item):warehouse.sell(item,price));
      message(ok?'':'交易未完成，库存或报价已更新');refresh();
    };
    row.append(itemIcon(item),header,button);return row;
  }
  function updateMarket(){
    const market=warehouse.market();refreshAt=market.refreshAt;
    const available=remainingStock(warehouse.read()??{},plan);
    const rows=market.offers.filter(({item})=>(available[item]??0)>0&&(!merchantCategory.value||merchantCategory.value===itemSpecs[item].tag));
    q('market-stock').replaceChildren(...rows.map(({item,price})=>tradeRow(item,available[item]!,price,false,0)));
    if(!rows.length)q('market-stock').textContent='没有可出售的物资';
  }
  function clock(){
    if(pane!=='sell'||root.hidden||root.closest('#overlay')?.hasAttribute('hidden'))return;
    if(Date.now()>=refreshAt)updateMarket();
    const remaining=Math.max(0,Math.ceil((refreshAt-Date.now())/1000));
    refreshLabel.textContent='刷新 '+Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0');
  }
  function refresh(){
    const credits=warehouse.credits(),stock=warehouse.read()??{};
    q('credits').textContent=String(credits);
    bag=warehouse.preview(plan);
    q('kit-status').textContent=bag?'整备就绪 · 自带 '+loadoutRequests(plan).reduce((n,[,count])=>n+count,0)+' 件':'请检查整备';
    const kit=q('lobby-loadout');kit.replaceChildren();
    for(const cargo of [bag?.slots.pistol,bag?.slots.knife,bag?.equipped]){
      if(!cargo)continue;
      const icon=itemIcon(cargo.item);icon.title=itemSpecs[cargo.item].name;kit.append(icon);
    }
    stash=arrangeStash(remainingStock(stock,plan),stash.entries);
    saveLayout();clearSelection();
    if(pane==='prepare'){prepare();renderStash();}
    if(pane==='buy'){
      const items=shopItems.filter(item=>!merchantCategory.value||merchantCategory.value===itemSpecs[item].tag);
      q('buy-stock').replaceChildren(...items.map(item=>tradeRow(item,stock[item]??0,buyPrice(item),true,credits)));
      if(!items.length)q('buy-stock').textContent='此分类暂无商品';
    }
    if(pane==='sell')updateMarket();
    clock();
  }
  merchantCategory.onchange=refresh;
  function open(next:Pane){
    pane=next;
    root.scrollTop=0;
    const merchant=next==='buy'||next==='sell';
    for(const button of nav){
      if(button.hasAttribute('aria-pressed'))
        button.setAttribute('aria-pressed',String(button.dataset.outpost===next||button.closest('.outpost-nav')&&merchant&&button.dataset.outpost==='buy'));
    }
    for(const id of ['home','prepare','tasks','base'])q(id+'-pane').hidden=next!==id;
    q('merchant-pane').hidden=!merchant;q('buy-pane').hidden=next!=='buy';q('sell-pane').hidden=next!=='sell';
    message();refresh();
  }
  nav.forEach(button=>button.onclick=()=>open(button.dataset.outpost as Pane));
  const timer=window.setInterval(clock,1000);
  return {
    get plan(){return structuredClone(plan);},
    open,refresh,
    reset(){plan={...defaultLoadout};open('home');},
    dispose(){window.clearInterval(timer);},
  };
}
