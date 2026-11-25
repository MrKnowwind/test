import { dimensions } from '../raid/backpack.ts';
import { isPack, itemSpecs, packs, type ItemId, type PackId } from '../raid/catalog.ts';
import { defaultLoadout, supplyItems, type Loadout } from '../raid/loadout.ts';
import { buyPrice, shopItems, type createWarehouse } from '../raid/warehouse.ts';
import { itemIcon } from './itemArt.ts';

type Pane = 'prepare' | 'buy' | 'sell';
export function createOutpostView(warehouse: ReturnType<typeof createWarehouse>, message: (text?: string) => void) {
  const root = document.querySelector<HTMLElement>('#outpost')!;
  const slots = root.querySelector<HTMLElement>('#prepare-slots')!;
  const grid = root.querySelector<HTMLElement>('#prepare-grid')!;
  const refreshLabel = root.querySelector<HTMLTimeElement>('#market-refresh')!;
  let plan: Loadout = { ...defaultLoadout };
  let pane: Pane = 'prepare';
  let refreshAt = 0;

  function prepare() {
    slots.replaceChildren();
    const stock = warehouse.read() ?? {};
    const bag = warehouse.preview(plan);
    function field(title: string, input: HTMLInputElement | HTMLSelectElement) {
      const row = document.createElement('label');
      input.setAttribute('aria-label', title);
      row.append(title, input);
      slots.append(row);
    }
    function select(title: string, options: readonly (readonly [string, string])[], value: string, choose: (v: string) => void) {
      const input = document.createElement('select');
      for (const [key, name] of options) input.add(new Option(name, key));
      input.value = value;
      input.onchange = () => {
        choose(input.value); message(); prepare();
        Array.from(slots.querySelectorAll('select')).find(select => select.getAttribute('aria-label') === title)?.focus();
      };
      field(title, input);
    }
    const availablePacks = (Object.keys(packs) as PackId[]).filter(item => stock[item] || item === plan.pack);
    select('背包', [['', '空'], ...availablePacks.map(item => [item, itemSpecs[item].name + ' ×' + (stock[item] ?? 0)] as const)],
      plan.pack ?? '', value => { plan.pack = isPack(value as ItemId) ? value as PackId : undefined; });
    for (const [weapon, title] of [['pistol', '手枪'], ['knife', '近战']] as const) {
      const options: [string, string][] = [['', '空'], ['issued', itemSpecs[weapon].name + ' · 配发']];
      if (stock[weapon] || plan[weapon] === 'warehouse')
        options.push(['warehouse', itemSpecs[weapon].name + ' · 仓库 ×' + (stock[weapon] ?? 0)]);
      select(title, options, plan[weapon] ?? '', value => {
        plan[weapon] = value === 'issued' || value === 'warehouse' ? value : undefined;
      });
    }
    for (const item of supplyItems) {
      const input = document.createElement('input');
      input.type = 'number'; input.min = '0'; input.max = String(stock[item] ?? 0);
      input.value = String(plan[item] ?? 0); input.dataset.supply = item;
      input.disabled = !stock[item] && !plan[item];
      input.onchange = () => {
        plan[item] = Math.max(0, Math.min(stock[item] ?? 0, Math.trunc(input.valueAsNumber || 0)));
        message(); prepare();
        slots.querySelector<HTMLInputElement>('[data-supply="' + item + '"]')?.focus();
      };
      field(itemSpecs[item].name + ' · ' + input.max, input);
    }
    grid.replaceChildren();
    if (!bag) { grid.textContent = '装备或空间不足'; return; }
    const equipped = document.createElement('div'), pockets = document.createElement('div'), pack = document.createElement('div');
    equipped.className = 'prepare-kit';
    pockets.className = pack.className = 'prepare-compartments';
    grid.append(equipped, pockets, pack);
    for (const cargo of [bag.slots.pistol, bag.slots.knife, bag.equipped]) {
      if (!cargo) continue;
      const icon = itemIcon(cargo.item);
      icon.title = itemSpecs[cargo.item].name;
      equipped.append(icon);
    }
    for (const section of bag.sections) {
      const area = document.createElement('div');
      area.className = 'prepare-section';
      area.title = section.name;
      area.style.setProperty('--columns', String(section.w));
      area.style.setProperty('--rows', String(section.h));
      for (const entry of bag.entries.filter(entry => entry.section === section.id)) {
        const icon = itemIcon(entry.item);
        const [w, h] = dimensions(entry);
        icon.style.gridArea = (entry.y + 1) + ' / ' + (entry.x + 1) + ' / span ' + h + ' / span ' + w;
        area.append(icon);
      }
      (['left', 'center', 'right'].includes(section.id) ? pockets : pack).append(area);
    }
  }
  function tradeRow(item: ItemId, amount: number, price: number, buying: boolean, credits: number) {
    const row = document.createElement('article'), label = document.createElement('div');
    const name = document.createElement('strong'), quantity = document.createElement('small');
    const button = document.createElement('button');
    name.textContent = itemSpecs[item].name;
    quantity.textContent = (buying && item === 'pistol-ammo' ? '每盒 12 发 · ' : '') + '持有 ' + amount;
    label.append(name, quantity);
    button.textContent = (buying ? '购买' : '出售') + ' · ' + price;
    button.setAttribute('aria-label', button.textContent + ' 券 · ' + name.textContent);
    button.type = 'button';
    button.dataset[buying ? 'buy' : 'sell'] = item;
    button.disabled = buying && credits < price;
    button.onclick = async () => {
      button.disabled = true;
      const ok = await (buying ? warehouse.buy(item) : warehouse.sell(item, price));
      message(ok ? '' : '交易未完成，库存或报价已更新');
      refresh();
      root.querySelector<HTMLButtonElement>('[' + (buying ? 'data-buy' : 'data-sell') + '="' + item + '"]')?.focus();
    };
    row.append(itemIcon(item), label, button);
    return row;
  }
  function updateMarket(show = pane === 'sell') {
    const market = warehouse.market();
    refreshAt = market.refreshAt;
    if (!show) return;
    const list = root.querySelector<HTMLElement>('#market-stock')!;
    list.replaceChildren(...market.offers.map(({item, quantity, price}) => tradeRow(item, quantity, price, false, 0)));
    if (!market.offers.length) list.textContent = '仓库为空';
  }
  function refresh() {
    const credits = warehouse.credits();
    root.querySelector('#credits')!.textContent = String(credits);
    if (pane === 'prepare') prepare();
    if (pane === 'buy') {
      const stock = warehouse.read();
      root.querySelector('#buy-stock')!.replaceChildren(...shopItems.map(item =>
        tradeRow(item, stock?.[item] ?? 0, buyPrice(item), true, credits)));
    }
    updateMarket();
    clock();
  }
  function clock() {
    if (pane !== 'sell' || root.hidden || root.closest('#overlay')?.hasAttribute('hidden')) return;
    if (Date.now() >= refreshAt) updateMarket();
    const remaining = Math.max(0, Math.ceil((refreshAt - Date.now()) / 1000));
    refreshLabel.textContent = '刷新 ' + Math.floor(remaining / 60) + ':' + String(remaining % 60).padStart(2, '0');
  }
  function open(next: Pane) {
    pane = next;
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-outpost]'))
      button.setAttribute('aria-pressed', String(button.dataset.outpost === next));
    for (const id of ['prepare', 'buy', 'sell'])
      root.querySelector<HTMLElement>('#' + id + '-pane')!.hidden = next !== id;
    message(); refresh();
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-outpost]'))
    button.onclick = () => open(button.dataset.outpost as Pane);
  const timer = window.setInterval(clock, 1000);
  return {
    get plan() { return { ...plan }; },
    open, refresh,
    reset() { plan = { ...defaultLoadout }; open('prepare'); },
    dispose() { window.clearInterval(timer); },
  };
}
