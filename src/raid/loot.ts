import { itemSpecs, tagLabels, type Tag, type ItemId, type PackId } from './catalog.ts';
export type Risk = 'outer' | 'district' | 'high';
export const tiers: Record<Risk, number[]> = {
  outer: [4025, 3600, 1500, 600, 200, 70, 5],
  district: [3635, 3200, 1700, 900, 400, 150, 15],
  high: [2965, 2700, 2000, 1300, 700, 300, 35],
};
export function roll(seed: number, id: string, draw: number) {
  let h = (seed ^ 0x51c3b1a9) >>> 0;
  for (const ch of 'cel-port/loot-v1/' + id + '/' + draw) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function tier(weights: readonly number[], u: number) {
  let n = u * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    n -= weights[i];
    if (n < 0) return i;
  }
  return weights.length - 1;
}
const entries = Object.keys(itemSpecs) as ItemId[];
export const pools = Object.fromEntries(Object.keys(tagLabels).map(tag => [
  tag, entries.filter(item => itemSpecs[item].tag === tag && ![
    'service-card', 'research-sample', 'rail', 'pump',
  ].includes(item) && !['carry','weapon','protection'].includes(tag)),
])) as Record<Tag, ItemId[]>;

export function drawLoose(
  seed: number,
  id: string,
  tag: Tag,
  risk: Risk,
  allowed: readonly ItemId[] = pools[tag],
) {
  const rank = tier(tiers[risk], roll(seed, id, 0)) - 1;
  const candidates = [...new Set(allowed)].filter((i) => itemSpecs[i].rank === rank);
  return candidates[Math.floor(roll(seed, id, 1) * candidates.length)];
}
export const caseTypes = {
  tin: [4, 2, 2, 3],
  medical: [4, 3, 2, 3],
  tool: [5, 3, 3, 5],
  drawers: [3, 4, 3, 5],
  crate: [6, 4, 5, 8],
  locker: [5, 4, 3, 5],
  cold: [4, 3, 2, 3],
  panel: [4, 2, 2, 3],
  files: [3, 4, 3, 5],
  cage: [6, 4, 5, 8],
  carrier: [5, 4, 3, 5],
} as const;
export type CaseKind = keyof typeof caseTypes;
export type CaseContents = { kind: CaseKind; tags: readonly Tag[]; risk?: Risk };
type Profile = CaseContents & {
  bags?: readonly PackId[];
  chance?: number;
  task?: ItemId;
  extra?: readonly ItemId[];
};
export const caseLabels: Record<CaseKind,string> = {
  tin:'军械箱', medical:'医疗柜', tool:'工具箱', drawers:'储物抽屉', crate:'货运箱',
  locker:'储物柜', cold:'冷藏柜', panel:'仪器柜', files:'档案柜', cage:'周转笼', carrier:'样品保存柜',
};

const profiles: Partial<Record<string, Profile>> = {
  'triage-stock': { kind:'medical', tags:['medical'], risk:'outer', task:'medkit' },
  'depot-stock': { kind:'tin', tags:['ammo','tactical'], risk:'outer', task:'pistol-ammo' },
  'duty-card': { kind:'files', tags:['documents','shipping'], task:'service-card' },
  'plant-workshop': { kind:'panel', tags:['electronics','mechanical'] },
  'transit-tools': { kind:'cage', tags:['mechanical','shipping'], extra:['pump'], bags:['tube','longpack'], chance:.42 },
  'lab-research': { kind:'carrier', tags:['research','electronics'], risk:'high' },
  'lab-medkit': { kind:'medical', tags:['medical','research'], risk:'high' },
  'triage-tools': { kind:'locker', tags:['medical','personal'], bags:['daypack','sling'], chance:.8, risk:'outer' },
  'depot-tools': { kind:'locker', tags:['tactical','personal'], bags:['daypack','sling'], chance:.8, risk:'outer' },
  'pump-tools': { kind:'tool', tags:['mechanical','electronics'], bags:['repairpack'], chance:.85 },
  'customs-tools': { kind:'locker', tags:['shipping','personal'], bags:['alpine'], chance:.55 },
  'relay-tools': { kind:'locker', tags:['electronics','tactical'], bags:['alpine'], chance:.55 },
  'research-office': { kind:'locker', tags:['documents','electronics'], bags:['school'], chance:.5 },
  'workshop-supplies': { kind:'locker', tags:['mechanical','medical'], bags:['school'], chance:.5 },
  'yard-salvage': { kind:'crate', tags:['shipping','mechanical'], bags:['longpack','tube'], chance:.55 },
  'yard-ammo': { kind:'tin', tags:['ammo','tactical'], risk:'outer' },
  'factory-ammo': { kind:'tin', tags:['ammo','tactical'] },
  'inn-reception': { kind:'files', tags:['documents','personal'], risk:'outer' },
  'inn-luggage': { kind:'locker', tags:['personal','documents'], bags:['daypack','sling'], chance:.18, risk:'outer' },
  'inn-crew': { kind:'locker', tags:['personal','provisions'], bags:['daypack','sling'], chance:.18, risk:'outer' },
  'inn-linen': { kind:'drawers', tags:['personal','medical'], risk:'outer' },
  'inn-twin': { kind:'drawers', tags:['personal','provisions'], risk:'outer' },
  'inn-corner': { kind:'drawers', tags:['documents','personal'], risk:'outer' },
  'market-convenience': { kind:'drawers', tags:['provisions','personal'], risk:'outer' },
  'market-kitchen': { kind:'cold', tags:['provisions'], risk:'outer' },
  'market-hardware': { kind:'tool', tags:['mechanical','electronics'], risk:'outer' },
  'transit-catering': { kind:'cold', tags:['provisions'], risk:'outer' },
  'transit-luggage': { kind:'locker', tags:['personal','shipping'], risk:'outer' },
  'transit-dispatch': { kind:'files', tags:['documents','electronics'] },
  'community-reception': { kind:'files', tags:['documents','personal'], risk:'outer' },
  'community-activity': { kind:'locker', tags:['personal','provisions'], risk:'outer' },
  'pharmacy-cold': { kind:'cold', tags:['medical'] },
  'pharmacy-treatment': { kind:'medical', tags:['medical'], risk:'district' },
  'room-clinic-8': { kind:'medical', tags:['medical'], risk:'outer' },
  'cold-chain-medical': { kind:'cold', tags:['medical'] },
  'cold-chain-calibration': { kind:'panel', tags:['electronics','research'] },
  'switchgear-tools': { kind:'tool', tags:['mechanical','electronics'] },
  'harbor-cargo-cold': { kind:'cold', tags:['medical','provisions','shipping'] },
  'harbor-cargo-tools': { kind:'tool', tags:['mechanical','shipping'] },
  'harbor-repair-tools': { kind:'tool', tags:['mechanical','nautical'] },
  'harbor-cargo-luggage': { kind:'crate', tags:['personal','shipping'], bags:['school','daypack'], chance:.20 },
  'harbor-terminal-luggage': { kind:'crate', tags:['personal','shipping'], bags:['school','daypack'], chance:.20 },
  'harbor-dispatch-office': { kind:'files', tags:['documents','nautical'] },
  'harbor-dispatch-kit': { kind:'tool', tags:['nautical','electronics'] },
  'ship-luggage': { kind:'crate', tags:['personal','shipping'], bags:['school','daypack'], chance:.20 },
  'ship-medical': { kind:'medical', tags:['medical'] },
  'ship-galley': { kind:'cold', tags:['provisions'] },
  'ship-upper-cafe': { kind:'cold', tags:['provisions','personal'] },
  'ship-laundry': { kind:'locker', tags:['personal','mechanical'] },
  'ship-bulk-storage': { kind:'crate', tags:['shipping','provisions'] },
  'ship-upper-fitness': { kind:'locker', tags:['personal','medical'] },
  'ship-theater': { kind:'panel', tags:['electronics','personal'] },
  'ship-upper-ballroom': { kind:'panel', tags:['electronics','documents'] },
  'ship-aft-office': { kind:'files', tags:['nautical','documents'], risk:'high' },
  'observation-intake': { kind:'files', tags:['documents','research'] },
  'quarantine-samples': { kind:'cold', tags:['research','medical'], risk:'high' },
  'annex-archive-files': { kind:'files', tags:['documents','research'], risk:'high' },
  'annex-archive-reading': { kind:'files', tags:['documents','research'] },
  'annex-archive-chart': { kind:'files', tags:['documents','nautical'], risk:'high' },
  'annex-archive-server': { kind:'panel', tags:['electronics','research'], risk:'high' },
  'annex-archive-index': { kind:'panel', tags:['electronics','documents'], risk:'high' },
  'research-intake': { kind:'files', tags:['documents','research'] },
  'research-bench': { kind:'cold', tags:['research','medical'], risk:'high' },
  'research-upper': { kind:'panel', tags:['electronics','research'], risk:'high' },
  'office-archive': { kind:'files', tags:['documents','shipping'] },
  'sort-dispatch': { kind:'cage', tags:['shipping','documents'] },
};

const defaultCases = {
  mechanical:{ kind:'crate', tags:['mechanical','shipping'] },
  electronics:{ kind:'panel', tags:['electronics'] },
  shipping:{ kind:'drawers', tags:['shipping','documents'] },
  research:{ kind:'cold', tags:['research'], risk:'high' },
  medical:{ kind:'medical', tags:['medical'] },
  ammo:{ kind:'tin', tags:['ammo','tactical'] },
  carry:{ kind:'locker', tags:['personal'] },
  weapon:{ kind:'tin', tags:['ammo','tactical'] },
  protection:{ kind:'locker', tags:['tactical','protection'] },
  provisions:{ kind:'cold', tags:['provisions'] },
  personal:{ kind:'drawers', tags:['personal'] },
  documents:{ kind:'files', tags:['documents'] },
  nautical:{ kind:'panel', tags:['nautical','electronics'] },
  tactical:{ kind:'tin', tags:['ammo','tactical'] },
} as const satisfies Record<Tag,CaseContents>;

export function caseProfile(id: string, item: ItemId, authored?: CaseContents): Profile {
  const profile = authored ?? profiles[id];
  if (profile) return profile;
  if (id.startsWith('ship-cabin-')) return { kind:'locker', tags:['personal','provisions'], bags:['daypack','sling'], chance:.22 };
  if (id.startsWith('ship-')) return { kind:'drawers', tags:['personal','nautical','documents'] };
  if (id.startsWith('residential-')) return { kind:'drawers', tags:['personal','provisions'], bags:['daypack','sling'], chance:.12, risk:'outer' };
  if (id.startsWith('north-observatory-')) return { kind:'panel', tags:['nautical','electronics'] };
  if (id.startsWith('north-customs-')) return { kind:'files', tags:['documents','shipping'] };
  if (id.startsWith('freight-loft-')) return { kind:'crate', tags:['shipping','mechanical','electronics'] };
  return defaultCases[itemSpecs[item].tag];
}

export const containerRanks: Record<Risk, readonly number[]> = {
  outer: [670,230,76,19,4,1],
  district: [605,249,101,35,8,2],
  high: [475,265,162,68,24,6],
};
