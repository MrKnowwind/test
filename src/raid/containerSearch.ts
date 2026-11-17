import type { ItemId, MapInteraction } from '../contracts/demo.ts';
import { createBackpack, type BagEntry } from './backpack.ts';
export interface SearchEntry extends BagEntry { progress: number; duration: number; revealed: boolean; }
export interface SearchContainer { id: string; width: number; height: number; entries: SearchEntry[]; }

export function createContainerSearch(seed: number, interactions: readonly MapInteraction[]) {
  const containers = new Map<string,SearchContainer>();
  for(const source of interactions) {
    if(source.kind!=='loot') continue;
    let hash=seed>>>0;
    for(const char of source.id) hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
    const grid=createBackpack(6,4);
    grid.add(source.item,source.quantity);
    // Fixed on raid creation. Reopening never rolls the contents again.
    const extra: ItemId = source.item==='pistol-ammo'?'medkit':'pistol-ammo';
    grid.add(extra,extra==='medkit'?1:3+hash%4);
    if(hash%3===0) grid.add('salvage',1);
    containers.set(source.id,{id:source.id,width:6,height:4,entries:grid.entries.map((entry,i)=>({
      ...entry,progress:0,duration:1+(hash+i*13)%5*.12,revealed:false,
    }))});
  }
  function search(id: string, dt: number) {
    const container=containers.get(id);
    if(!container || !Number.isFinite(dt) || dt<=0) return 0;
    let completed=0;
    for(const entry of container.entries) {
      if(entry.revealed) continue;
      const elapsed=Math.min(dt,entry.duration-entry.progress);
      entry.progress+=elapsed;dt-=elapsed;
      if(entry.progress>=entry.duration-1e-9) {entry.revealed=true;completed++;}
      if(dt<=0) break;
    }
    return completed;
  }
  return {containers,search};
}
export type Placement = {x:number;y:number;rotated:boolean};
