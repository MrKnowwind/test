import type { MapInteraction, Vec3 } from '../contracts/demo.ts';
import { drawLoose, type Risk } from '../raid/loot.ts';
import { itemSpecs, type Tag, type ItemId } from '../raid/catalog.ts';
import type { OutdoorLootSite } from './outdoorLoot.ts';

// Offsets along existing benches keep loose goods distinct from the search case.
const sites: readonly [string, Tag, Risk, number, (readonly ItemId[])?][] = [
  ['triage-stock', 'medical', 'outer', 0.85],
  ['freight-stock', 'shipping', 'district', 0.87],
  ['customs-stock', 'shipping', 'district', 0.87],
  ['depot-stock', 'ammo', 'outer', 0.85],
  ['pump-stock', 'mechanical', 'district', 0.85],
  ['clinic-stock', 'medical', 'district', 0.85],
  ['archive-stock', 'electronics', 'high', 0.85],
  ['relay-stock', 'electronics', 'high', 0.85],
  ['factory-salvage', 'electronics', 'district', -0.66, ['core']],
  ['lab-research', 'research', 'high', -0.78],
  ['lab-medkit', 'research', 'high', 0.78],
  ['yard-salvage', 'shipping', 'district', 0, ['rail', 'sealbag', 'lens']],
];
export function loosePoints(
  seed: number,
  anchors: readonly MapInteraction[],
  support: (p: Vec3) => number | null,
  outdoor:readonly OutdoorLootSite[] = [],
) {
  const result: MapInteraction[] = [];
  for (const [anchor, tag, risk, offset, pool] of sites) {
    const target = anchors.find((t) => t.id === anchor);
    if (!target) continue;
    const id = 'open-' + anchor,
      item = drawLoose(seed, id, tag, risk, pool);
    if (!item) continue;
    const [x, y, z] = target.position;
    const top: Vec3 = [x + offset, y + 0.8, z + (offset === 0 ? 1.05 : 0)];
    const distance = support(top);
    if (distance === null) continue;
    result.push({
      kind: 'loose',
      id,
      label: itemSpecs[item].name,
      item,
      quantity: item === 'pistol-ammo' ? 6 : 1,
      position: [top[0], top[1] - distance + 0.12, top[2]],
    });
  }
  for(const site of outdoor){
    const item=drawLoose(seed,site.id,site.tag,site.risk);
    if(item)result.push({kind:'loose',id:site.id,label:itemSpecs[item].name,item,quantity:item==='pistol-ammo'?6:1,position:site.position});
  }
  return result;
}
