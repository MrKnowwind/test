import * as THREE from 'three';
import { box } from './detail/geometry.ts';
import { siteApproaches } from './supplySites.ts';
import { enamel } from './detail/materialLibrary.ts';

type Rect = { x1: number; x2: number; z1: number; z2: number };
function rectangle(x: number, z: number, w: number, d: number): Rect {
  return { x1: x-w/2, x2: x+w/2, z1:z-d/2, z2:z+d/2 };
}

// Through roads and spurs share this plan with the player's map.
export const roads = [
  [10,155,340,12],[20,95,360,10],[-115,-3,10,316],[60,-3,10,316],[175,-3,10,316],
  [-24,125,8,60],[-151,121,7,59],[-4,59,9,75],[-66,27,100,9],[-66,-42,100,9],
  [116,-100,130,10],[40.5,-113,9,38],[183,-90,25,9],[149,2,10,186],
  [50,-120,19,7],[162,-60,26,7],
  [-78,41,8,26],[-72,-52,82,6],[-55,-109,6,110],[-5,-93,120,6],
].map(([x,z,w,d])=>rectangle(x,z,w,d));

const walkWidth = 3.4;
// This pedestrian lane links the transit shed to the southern arterial through the freight court.
export const freightWalk = [[-78,51],[-72,51],[-72,75],[-91,75]] as const;
const walkLines = [...siteApproaches.map(route=>route.points), freightWalk, [[-72,75],[-72,95]] as const];
export const footpaths = walkLines.flatMap(points => points.slice(1).map(([x,z],i)=>{
  const [lastX,lastZ]=points[i];
  return rectangle((lastX+x)/2,(lastZ+z)/2,Math.abs(x-lastX)+walkWidth,Math.abs(z-lastZ)+walkWidth);
}));

function overlaps(a: Rect, b: Rect) {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.z1 < b.z2 && a.z2 > b.z1;
}

function subtract(a: Rect, b: Rect) {
  const x1=Math.max(a.x1,b.x1), x2=Math.min(a.x2,b.x2);
  const z1=Math.max(a.z1,b.z1), z2=Math.min(a.z2,b.z2);
  if (x1>=x2 || z1>=z2) return [a];
  return [{...a,x2:x1},{...a,x1:x2},{x1,x2,z1:a.z1,z2:z1},{x1,x2,z1:z2,z2:a.z2}]
    .filter(r=>r.x2-r.x1>.001 && r.z2-r.z1>.001);
}

export function buildRoads(root: THREE.Group, asphalt: THREE.Material) {
  const paint = enamel(0xbad5df);
  function surface(r: Rect, y: number, material: THREE.Material) {
    box(root,material,r.x2-r.x1,.012,r.z2-r.z1,(r.x1+r.x2)/2,y,(r.z1+r.z2)/2);
  }
  const walkway = enamel(0x8299ab);
  // Cut intersections out of the pavement before batching. A path can meet either
  // the long or short edge of a road without laying two top faces at the same height.
  footpaths.forEach((path,i)=>{
    let patches=[path];
    for(const cut of [...roads,...footpaths.slice(0,i)]) patches=patches.flatMap(r=>subtract(r,cut));
    for(const patch of patches) surface(patch,.029,walkway);
  });
  const arrowPaint=enamel(0xe1f5e9);
  for(const {points} of siteApproaches) {
    // Point toward the entrance at the middle of each long approach segment.
    for(let i=1;i<points.length;i++) {
      const [ax,az]=points[i-1], [bx,bz]=points[i];
      const distance=Math.hypot(bx-ax,bz-az);
      if(distance<8) continue;
      const x=(ax+bx)/2,z=(az+bz)/2;
      if(roads.some(r=>x>r.x1-1 && x<r.x2+1 && z>r.z1-1 && z<r.z2+1)) continue;
      const direction=Math.atan2(bx-ax,bz-az);
      for(const side of [-1,1]) {
        const slash=box(root,arrowPaint,.14,.012,.72,x+side*.22*Math.cos(direction),.052,z-side*.22*Math.sin(direction));
        slash.rotation.y=direction-side*.68;
      }
    }
  }
  roads.forEach((road,i)=>{
    let patches=[road];
    for(const earlier of roads.slice(0,i)) patches=patches.flatMap(r=>subtract(r,earlier));
    for(const patch of patches) surface(patch,.025,asphalt);
    const horizontal=road.x2-road.x1>road.z2-road.z1;
    const start=horizontal?road.x1:road.z1, end=horizontal?road.x2:road.z2;
    const mid=horizontal?(road.z1+road.z2)/2:(road.x1+road.x2)/2;
    for(let t=start+1;t<end-3;t+=7) {
      const dash=horizontal?rectangle(t+1.5,mid,3,.14):rectangle(mid,t+1.5,.14,3);
      if (!roads.some((other,j)=>j!==i && overlaps(dash,other))) surface(dash,.039,paint);
    }
  });
}
