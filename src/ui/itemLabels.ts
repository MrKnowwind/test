import { itemSpecs, qualityLabels, tagLabels, type ItemId } from '../raid/catalog.ts';

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
