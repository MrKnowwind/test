import { gearLayout, itemSpecs, type GearSlot, type ItemId } from '../raid/catalog.ts';
import { markIssued } from './itemLabels.ts';
import { itemIcon } from './itemArt.ts';

const gearLabels = Object.fromEntries(gearLayout);
const emptyGear: Partial<Record<GearSlot,ItemId>> = {head:'head-scout',shield:'shield-white',pack:'daypack',pistol:'pistol',knife:'knife'};

export function equipmentSlot(key: GearSlot, cargo?: {item: ItemId; quantity: number; issued?: number}) {
  const item = cargo?.item;
  const button = document.createElement('button');
  button.type='button';
  button.className='gear-square';
  button.dataset.gearSlot=key;
  button.setAttribute('aria-label',gearLabels[key]+' · '+(item ? itemSpecs[item].name : '空'));
  button.classList.toggle('empty-gear',!item);
  if (cargo) markIssued(button, cargo);
  if(item) button.style.setProperty('--gear-color',itemSpecs[item].color);
  const icon=item ?? emptyGear[key];
  if(icon) button.append(itemIcon(icon));
  else {
    const silhouette=document.createElement('span');
    silhouette.className='primary-silhouette';
    silhouette.setAttribute('aria-hidden','true');
    button.append(silhouette);
    button.disabled=true;
  }
  return button;
}
