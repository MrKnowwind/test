import { createRadialMenu, radialIndex, radialPageSize } from './radialMenu.ts';
import { itemSpecs } from '../raid/catalog.ts';
import type { BagEntry } from '../raid/backpack.ts';
import type { createInput } from '../player/input.ts';
import { itemIcon } from './itemArt.ts';
type Controls = ReturnType<ReturnType<typeof createInput>['sample']>;
export function createMedicineWheel() {
  const menu = createRadialMenu(document.querySelector('#hud')!, 'medicine-wheel');
  let key = '',
    selected: number | undefined,
    x = 0,
    y = 0;
  return {
    reset() {
      menu.setOpen(false);
      key = '';
      selected = undefined;
      x = y = 0;
    },
    update(c: Controls, entries: BagEntry[]) {
      let i = Math.max(
        0,
        entries.findIndex((e) => e.id === selected),
      );
      menu.setOpen(c.medicineHeld);
      if (c.medicineHeld) {
        if (c.medicineCycle && entries.length) {
          i = (i + c.medicineCycle + entries.length) % entries.length;
          x = y = 0;
        }
        x += c.lookX;
        y += c.lookY;
        const start = Math.floor(i / radialPageSize) * radialPageSize,
          options = entries.slice(start, start + radialPageSize);
        if (options.length && Math.hypot(x, y) > 24) i = start + radialIndex(x, y, options.length);
        c.lookX = c.lookY = 0;
        c.attackPressed = c.aiming = c.reloadPressed = false;
        selected = entries[i]?.id;
        const signature = i + '/' + options.map((e) => e.id + '-' + e.durability).join('/');
        if (signature !== key) {
          key = signature;
          menu.render(
            options.map((e) => ({
              label: itemSpecs[e.item].name,
              icon: itemIcon(e.item),
              detail: e.durability ? e.durability + '/3' : '40 HP',
            })),
            i - start,
            entries[i] ? itemSpecs[entries[i].item].name : '随身无药物',
            '',
          );
        }
      } else {
        x = y = 0;
        if (c.medicineRelease === 'quick' || c.healPressed) return entries[i]?.id;
      }
    },
  };
}
