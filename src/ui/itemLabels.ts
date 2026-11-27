import { itemSpecs, qualityLabels, tagLabels, type ItemId } from '../raid/catalog.ts';
import { itemDescriptions } from '../raid/itemDescriptions.ts';

export function itemLabels(item:ItemId) {
  const spec=itemSpecs[item], labels=document.createElement('div');
  labels.className='loot-labels';
  const type=document.createElement('span'), grade=document.createElement('span');
  type.dataset.itemTag=spec.tag;
  type.textContent=tagLabels[spec.tag];
  grade.className='loot-quality';
  grade.style.setProperty('--item-color',spec.color);
  grade.textContent=qualityLabels[spec.rank];
  labels.append(type,grade);
  return labels;
}

export function itemNameLabel(item: ItemId, suffix = '') {
  const name = document.createElement('strong');
  name.className = 'item-name';
  name.style.color = itemSpecs[item].color;
  name.textContent = itemSpecs[item].name + suffix;
  return name;
}

export function itemDescription(item: ItemId) {
  const text = document.createElement('p');
  text.className = 'item-description';
  text.textContent = itemDescriptions[item];
  return text;
}

export function itemProvenance({quantity, issued = 0}: {quantity: number; issued?: number}) {
  return issued ? '配发 ' + issued + ' · 自带 ' + (quantity - issued) : '';
}

export function markIssued(element: HTMLElement, entry: {quantity: number; issued?: number}) {
  if (!entry.issued) return;
  element.dataset.provenance = entry.issued === entry.quantity ? 'issued' : 'mixed';
  element.setAttribute('aria-description', itemProvenance(entry));
}
