import type { MapInteraction, Vec3 } from '../contracts/demo.ts';

// Authored roadside stops connect the four districts without blocking their through roads.
export const supplySites = [
  { id: 'triage', label: '南侧救护站', x: -48, z: 119, item: 'medkit', risk: '低', height: 3.2 },
  { id: 'freight', label: '货运中转站', x: -91, z: 61, item: 'salvage', risk: '中', height: 4.8 },
  { id: 'customs', label: '海关检查站', x: -104, z: -67, item: 'pistol-ammo', risk: '中', height: 3.2 },
  { id: 'depot', label: '东侧补给站', x: 159, z: 59, item: 'pistol-ammo', risk: '低', height: 3.2 },
  { id: 'pump', label: '泵房维修站', x: 73, z: -73, item: 'salvage', risk: '中', height: 4.8 },
  { id: 'clinic', label: '研究医疗站', x: -27, z: -73, item: 'medkit', risk: '中', height: 3.2 },
  { id: 'archive', label: '隔离档案站', x: 106, z: -128, item: 'research-sample', risk: '高', height: 6.4 },
  { id: 'relay', label: '北侧观测站', x: -54, z: -170, item: 'research-sample', risk: '高', height: 6.4 },
] as const;

export const siteInteractions: readonly MapInteraction[] = supplySites.flatMap(site => [
  { id: site.id + '-stock', label: site.label + '储备箱', kind: 'loot' as const, item: site.item,
    quantity: site.item === 'pistol-ammo' ? 6 : 1, position: [site.x - 3, 1.12, site.z + 2] as Vec3 },
  { id: site.id + '-tools', label: site.label + '工具箱', kind: 'loot' as const, item: 'salvage' as const,
    quantity: 2, position: [site.x + 3, 1.12, site.z + 2] as Vec3 },
  { id: site.id + '-upper', label: site.label + '高台储备', kind: 'loot' as const, item: site.item,
    quantity: site.item === 'pistol-ammo' ? 6 : 1, position: [site.x, site.height + .72, site.z - 8] as Vec3 },
]);
