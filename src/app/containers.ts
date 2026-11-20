import * as THREE from 'three';
import type { FirstMap, ItemId } from '../contracts/demo.ts';
import { box } from '../world/detail/geometry.ts';
import { enamel, emissive } from '../world/detail/materialLibrary.ts';

export function addSearchContainers(map: FirstMap & { scene: THREE.Group }) {
  const shell=enamel(0xdde9eb), seal=enamel(0x263957);
  const colors: Record<ItemId,number> = {
    'service-card':0xf3bc5a, 'medkit':0x56d7cc, 'salvage':0x87acc1,
    'research-sample':0xb399ef, 'pistol-ammo':0xff875f,
  };
  const bands = new Map(Object.entries(colors).map(([k,v])=>[k,enamel(v)]));
  const live = emissive(0x8affdc,.6), idle=enamel(0x486079);
  const indicators = new Map<string,THREE.Mesh>();
  for(const item of map.interactions) {
    if(item.kind!=='loot') continue;
    const loose=map.scene.getObjectByName(item.id);
    if(loose) loose.visible=false;
    const root=new THREE.Group();
    root.name='container-'+item.id;
    root.position.set(...item.position);
    const support=map.blockedDistance(item.position,[0,-1,0],1);
    if(support!==null) root.position.y-=support;
    const accent=bands.get(item.item)!;
    box(root,seal,.64,.07,.4,0,.035,0,.023);
    box(root,shell,.67,.18,.42,0,.146,0,.045).castShadow=true;
    box(root,accent,.69,.072,.435,0,.236,0,.026);
    for(const x of [-.24,.24]) box(root,seal,.059,.1,.035,x,.194,.21,.009);
    indicators.set(item.id,box(root,live,.17,.035,.025,0,.153,.211,.007));
    map.scene.add(root);
  }
  return {searched(id:string) {
    const indicator=indicators.get(id);
    if(indicator) indicator.material=idle;
  }};
}
