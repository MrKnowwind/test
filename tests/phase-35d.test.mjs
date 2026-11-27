import assert from 'node:assert/strict';
import {test} from 'node:test';
import {itemSpecs, packs, pockets} from '../src/raid/catalog.ts';
import {itemDescriptions} from '../src/raid/itemDescriptions.ts';
import {defaultLoadout, loadoutRequests} from '../src/raid/loadout.ts';
import {createRaid} from '../src/raid/raid.ts';
import {mapFloor, centerOf, fitMap, layerBounds, mapProjection} from '../src/ui/mapGeometry.ts';
import {harborInteractions, shipLevels} from '../src/world/harborPlan.ts';
import {civicInteractions} from '../src/world/terrainPlan.ts';
import {labLift, researchInteractions} from '../src/world/researchPlan.ts';
import {worksiteInteractions} from '../src/world/worksitePlan.ts';

test('each item has an individual short inspection description', () => {
  assert.deepEqual(Object.keys(itemDescriptions).sort(),Object.keys(itemSpecs).sort());
  const all=Object.values(itemDescriptions);
  assert.equal(new Set(all).size,all.length);
  assert.ok(all.every(text=>text.length>=12&&text.length<=64));
});

test('the smallest pack comes with the free kit and does not become resale stock', () => {
  const exit={id:'road',label:'road',position:[0,0,0],radius:2,requirements:[]};
  const map={spawnPoints:[{id:'test',position:[0,0,5],yaw:0}],interactions:[],exits:[exit]};
  const total=parts=>parts.reduce((n,{w,h})=>n+w*h,0);
  assert.deepEqual(loadoutRequests(defaultLoadout),[]);
  const raid=createRaid('kit',42,map);
  assert.equal(raid.backpack.equipped.item,'sling');
  assert.equal(raid.backpack.equipped.issued,1);
  assert.equal(total(raid.backpack.sections),total(pockets)+Math.min(...Object.values(packs).map(total)));
  raid.update(0,exit.position,100);
  raid.update(5,exit.position,100);
  assert.equal(raid.result.outcome,'extracted');
  assert.deepEqual(raid.result.items,{});
  assert.deepEqual(raid.result.instances,[]);
  const ownedPlan={...defaultLoadout,pack:'sling'}, paid={item:'sling',quantity:1,instance:'owned'};
  assert.deepEqual(loadoutRequests(ownedPlan),[['sling',1]]);
  const owned=createRaid('owned',42,map,ownedPlan,[paid]);
  owned.update(0,exit.position,100);
  owned.update(5,exit.position,100);
  assert.deepEqual(owned.result.items,{sling:1});
  assert.equal(owned.result.instances[0].instance,'owned');
});

test('the map projection has equal axis scales and separates real upper and underground contacts', () => {
  const bounds=layerBounds('ground'), p=mapProjection(centerOf(bounds),900,540,fitMap(bounds,900,540,24));
  assert.equal(bounds.minX,-232);
  const [x,y]=p.project(bounds.minX,bounds.minZ);
  assert.ok(x>=24&&y>=23.99);
  assert.deepEqual(p.unproject(...p.project(-202,20)).map(Math.round),[-202,20]);
  assert.equal(mapFloor(labLift),'b1');
  for(const [y,layer] of [[shipLevels.cabin,'cabin'],[shipLevels.upper,'deck'],[shipLevels.sun,'sun']]){
    assert.equal(mapFloor([-213,y,31]),layer);
  }
  assert.deepEqual(civicInteractions.filter(i=>i.id.startsWith('residential-')).map(i=>mapFloor(i.position)),
    ['ground','upper','ground','upper','ground','upper']);
  for(const [list,id,floor] of [
    [harborInteractions,'harbor-dispatch-office','upper'],
    [civicInteractions,'north-observatory-upper','upper'],
    [worksiteInteractions,'control-observation','upper'],
    [worksiteInteractions,'duty-card','upper'],
    [worksiteInteractions,'office-archive','ground'],
  ]){
    assert.equal(mapFloor(list.find(i=>i.id===id).position),floor,id);
  }
  assert.ok(researchInteractions.some(i=>mapFloor(i.position)==='upper'));
});
