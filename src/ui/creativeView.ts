import { itemSpecs, type ItemId } from '../raid/catalog.ts';

export function createCreativeView(
  toggle: (enabled: boolean) => void,
  generate: (id: ItemId, amount: number, ground: boolean) => string,
) {
  const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const button = get<HTMLButtonElement>('creative-toggle'),
    options = get('creative-options');
  const flight = get<HTMLInputElement>('creative-flight'),
    speed = get<HTMLInputElement>('creative-speed');
  const value = get('speed-value'),
    item = get<HTMLSelectElement>('creative-item'),
    count = get<HTMLInputElement>('creative-qty');
  const feedback = get('creative-feedback');
  for (const [id, spec] of Object.entries(itemSpecs)) item.add(new Option(spec.name, id));
  function limit() {
    count.max = String(itemSpecs[item.value as ItemId].stack);
    count.value = String(Math.min(Number(count.max), Math.max(1, Math.trunc(Number(count.value) || 1))));
  }
  function display(on: boolean) {
    button.setAttribute('aria-pressed', String(on));
    button.textContent = (on ? '关闭' : '开启') + '开发者创造模式';
    options.hidden = !on;
    feedback.textContent = '';
  }
  button.onclick = () => {
    const on = options.hidden === true;
    toggle(on);
    display(on);
  };
  speed.oninput = () => {
    value.textContent = speed.value + '×';
  };
  item.onchange = limit;
  for (const [id, ground] of [
    ['creative-give', false],
    ['creative-drop', true],
  ] as const) {
    get(id).onclick = () => {
      limit();
      feedback.textContent = generate(item.value as ItemId, Number(count.value), ground);
    };
  }
  return {
    settings: {
      get flight() {
        return flight.checked;
      },
      get speed() {
        return Number(speed.value);
      },
    },
    reset() {
      display(false);
      flight.checked = true;
      speed.value = '1';
      value.textContent = '1×';
      item.selectedIndex = 0;
      count.value = '1';
      limit();
    },
  };
}
