import * as THREE from 'three';
import type { MapInteraction, Vec3 } from '../contracts/demo.ts';
import type { Tag } from '../raid/catalog.ts';
import type { Risk } from '../raid/loot.ts';
import { box, cylinder } from './detail/geometry.ts';
import type { Materials } from './detail/materialLibrary.ts';
import { createWorldQueries, dock, type Solid } from './worldQueries.ts';
import { terrainHeight } from './terrainPlan.ts';
import { roads, footpaths } from './roads.ts';
import { isLandAt } from './landPlan.ts';
import { shipLevels, sunDeck } from './harborPlan.ts';

type Support = 'pallet'|'bench'|'cart';
type Plan = readonly [id:string,x:number,z:number,tag:Tag,risk:Risk,kind:Support,deck?:boolean];
export type OutdoorLootSite={id:string;position:Vec3;tag:Tag;risk:Risk;kind:Support};
// Surveyed locations are alongside activity areas, not on road or entrance centre lines.
const plans:readonly Plan[]=[
  ['quay-north',-158,-63,'shipping','outer','pallet'],['quay-crane',-153,-20,'mechanical','district','cart'],
  ['quay-cargo',-152,10,'shipping','district','pallet'],['quay-workshop',-148,25,'mechanical','district','bench'],
  ['terminal-plaza',-130,-60,'personal','outer','cart'],['container-yard',-142,20,'shipping','district','pallet'],
  ['sundeck-forward',-217,25,'personal','district','cart',true],['sun-deck-aft',-197,30,'provisions','district','bench',true],
  ['sun-deck-service',-209,22,'nautical','district','cart',true],
  ['sort-yard',-97,3,'shipping','district','pallet'],['freight-apron',-59,21,'shipping','district','pallet'],
  ['vehicle-spares',-31,-27,'mechanical','district','cart'],['logistics-court',-18,36,'shipping','outer','bench'],
  ['office-delivery',23,-18,'documents','outer','cart'],
  ['repair-apron',73,-8,'mechanical','district','bench'],['plant-spares',108,-58,'electronics','district','cart'],
  ['plant-service',134,-50,'mechanical','district','pallet'],['east-delivery',183,16,'shipping','outer','pallet'],
  ['control-court',212,-29,'electronics','district','bench'],
  ['research-yard',20,-110,'medical','district','cart'],['observatory-work',94,-151,'nautical','district','bench'],
  ['archive-service',191,-165,'documents','district','cart'],
  ['housing-garden',-146,121,'personal','outer','bench'],['market-delivery',-81,116,'provisions','outer','pallet'],
  ['pharmacy-supplies',-79,140,'medical','outer','cart'],['inn-yard',108,124,'personal','outer','cart'],
  ['transit-plaza',166,124,'provisions','outer','bench'],['parking-service',202,141,'electronics','outer','cart'],
  ['north-customs-court',-121,-190,'documents','district','bench'],['north-coast-service',-157,-202,'nautical','district','cart'],
];

export function buildOutdoorLoot(root:THREE.Group,m:Materials,solids:Solid[],anchors:readonly MapInteraction[]):OutdoorLootSite[]{
  const queries=createWorldQueries(solids),sites:OutdoorLootSite[]=[];
  const hardware=new THREE.Group();hardware.name='outdoor-resource-supports';root.add(hardware);
  const offsets=[[0,0],[1.6,0],[-1.6,0],[0,1.6],[0,-1.6],[2.8,0],[-2.8,0],[0,2.8],[0,-2.8],[2.4,2.4],[-2.4,2.4],[2.4,-2.4],[-2.4,-2.4]];
  for(const [id,cx,cz,tag,risk,kind,deck] of plans){
    for(const [dx,dz] of offsets){
      const x=cx+dx,z=cz+dz;
      if(deck ? x<sunDeck.minX+1 || x>sunDeck.maxX-1 || z<sunDeck.minZ+1 || z>sunDeck.maxZ-1 : !isLandAt(x,z))continue;
      if(!deck&&[...roads,...footpaths].some(r=>x>r.x1-1.15&&x<r.x2+1.15&&z>r.z1-1.15&&z<r.z2+1.15))continue;
      const y=deck?shipLevels.sun:terrainHeight(x,z)??(x>dock.minX&&x<dock.maxX&&z>dock.minZ&&z<dock.maxZ?dock.y:0);
      if(anchors.some(t=>Math.abs(t.position[1]-y)<2&&Math.hypot(t.position[0]-x,t.position[2]-z)<2.1)||sites.some(t=>Math.abs(t.position[1]-y)<2&&Math.hypot(t.position[0]-x,t.position[2]-z)<2.1))continue;
      if(![[-.55,-.38],[.55,-.38],[-.55,.38],[.55,.38],[0,0]].every(([a,b])=>{
        const h=queries.groundHeight?.([x+a,y+.15,z+b],.06);return h!=null&&Math.abs(h-y)<.09;
      }))continue;
      if(!queries.bodyClear?.([x,y+.025,z],.68,1.5)||queries.blockedDistance([x,y+1.55,z],[0,1,0],5)!==null)continue;
      // Leave a clear approach from at least one side.
      if(![[1.2,0],[-1.2,0],[0,1.2],[0,-1.2]].some(([a,b])=>queries.bodyClear?.([x+a,y+.02,z+b],.32,1.75)))continue;
      const h=kind==='pallet'?.22:kind==='cart'?.62:.86,w=1.12,d=.76;
      if(kind==='pallet'){
        for(const sx of [-.42,0,.42])box(hardware,m.timber,.14,.15,d,x+sx,y+.075,z,.012);
        for(let i=0;i<5;i++)box(hardware,m.timber,w,.07,.135,x,y+.185,z-.30+i*.15,.009);
      }else{
        for(const sx of [-.47,.47])for(const sz of [-.29,.29]){
          box(hardware,m.steel,.065,h-.09,.065,x+sx,y+(h-.09)/2,z+sz,.008);
          if(kind==='cart')cylinder(hardware,m.rubber,.074,.055,x+sx,y+.075,z+sz,10).rotation.z=Math.PI/2;
        }
        box(hardware,kind==='bench'?m.timber:m.zinc,w,.065,d,x,y+h-.0325,z,.014);
        if(kind==='cart'){box(hardware,m.steel,.04,.20,d,x-.54,y+h+.065,z,.008);box(hardware,m.zinc,.04,.035,d,x-.54,y+h+.18,z);}
        else box(hardware,m.steel,w-.12,.055,d-.10,x,y+.21,z,.008);
      }
      solids.push({min:[x-w/2,y,z-d/2],max:[x+w/2,y+h,z+d/2]});
      sites.push({id:'outdoor-'+id,position:[x,y+h+.12,z],tag,risk,kind});break;
    }
  }
  return sites;
}
