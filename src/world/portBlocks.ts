import * as THREE from 'three';
import type { Vec3 } from '../contracts/demo.ts';
import { box, cylinder, mesh } from './detail/geometry.ts';
import { emissive, enamel, type Materials } from './detail/materialLibrary.ts';
import { streetLots, type DistrictName, type Fixture, type Roof, type Side, type StreetLot } from './portLots.ts';
import { buildRoomFixture, doorHeight, doorWidth, roomCase, type BuildSolid, type FixtureSite, type ShopRooms } from './shopRooms.ts';

type Room = 'a' | 'b' | 'c';
type Point = { x: number; z: number };
type Cell = Point & { col: number; row: number; room: Room };
type Edge = FixtureSite & { cell: Cell; other?: Cell; side: Side; span: number; alongX: boolean; passage?: 'open' | 'shutter' };
const sides = [
  { side:'north',nx:0,nz:-1 },{ side:'east',nx:1,nz:0 },
  { side:'south',nx:0,nz:1 },{ side:'west',nx:-1,nz:0 },
] as const;
const rooms = ['a','b','c'] as const;
const buildingColors: Record<DistrictName, number> = {
  harbor:0x448c95, logistics:0x7b8b73, industrial:0xa46543, research:0x616785, residential:0xa27162,
};
const companionFixture: Record<Fixture, Fixture> = {
  counter:'seating', rack:'packing', packing:'rack', files:'counter', bench:'rack', pump:'wash',
  switchboard:'testing', wash:'lockers', lockers:'seating', break:'seating', kitchen:'wash',
  bunks:'lockers', laundry:'rack', testing:'bench', dispatch:'seating', seating:'break',
};

function buildingPlan(lot: StreetLot) {
  const [id,x,z,width,depth,district,name,use] = lot;
  if (typeof use === 'string') return { id,x,z,width,depth,district,name, yard:use } as const;
  const [roof,entry,grid,functionList] = use;
  const cellW=width/3, cellD=depth/3;
  const cells: Cell[] = [];
  for (let index=0;index<grid.length;index++) {
    const room=grid[index];
    if (room==='.') continue;
    const col=index%3,row=Math.floor(index/3);
    cells.push({col,row,x:x+(col-1)*cellW,z:z+(row-1)*cellD,room:room as Room});
  }
  const findCell=(col:number,row:number)=>cells.find(cell=>cell.col===col&&cell.row===row);
  const edges: Edge[] = [];
  for(const cell of cells) for (const direction of sides) {
    const {side,nx,nz}=direction;
    const other=findCell(cell.col+nx,cell.row+nz);
    if (other?.room===cell.room || (other && nx+nz<0)) continue;
    edges.push({
      side,nx,nz,cell,other,alongX:nx===0,span:nx===0?cellW:cellD,
      x:cell.x+nx*cellW/2,z:cell.z+nz*cellD/2, passage:other?'open':undefined,
    });
  }

  // Disconnected wings open separately onto public space. Each connected wing
  // has an open route from outside, so a closed utility shutter never seals its loot.
  const pending = new Set(cells);
  const entries: Edge[] = [];
  while(pending.size) {
    const component=[pending.values().next().value!];
    pending.delete(component[0]);
    for (const cell of component) for (const {nx,nz} of sides) {
      const neighbor=findCell(cell.col+nx,cell.row+nz);
      if(neighbor && pending.delete(neighbor))component.push(neighbor);
    }
    const outside=edges.filter(edge=>!edge.other&&component.includes(edge.cell));
    const outer=outside.filter(edge=>edge.cell.col+edge.nx<0||edge.cell.col+edge.nx>2||edge.cell.row+edge.nz<0||edge.cell.row+edge.nz>2);
    const primary=outer.find(edge=>edge.side===entry&&edge.cell.room==='a')
      ?? outer.find(edge=>edge.side===entry) ?? outer.find(edge=>edge.cell.room==='a') ?? outer[0] ?? outside[0];
    primary.passage='open';
    entries.push(primary);
    const secondary=outer.find(edge=>edge.cell.room==='c'&&edge.side!==primary.side&&edge.cell!==primary.cell);
    if(secondary)secondary.passage='shutter';
  }

  const fixtures = rooms.map((room,index)=>{
    const role:Fixture=functionList[index];
    const walls=edges.filter(edge=>!edge.passage&&edge.cell.room===room);
    const wall=walls.find(edge=>edge.side!==entry)??walls[0];
    if(!wall)throw new Error(`Street lot ${id}, room ${room} has no wall space for its fixture`);
    return {room,role,wall,cell:wall.cell,id:'street-'+id+'-'+room};
  });
  const fittings=fixtures.flatMap(({room,role,cell})=>{
    const wall=edges.find(edge=>!edge.passage&&edge.cell.room===room&&edge.cell!==cell);
    return wall?[{role:companionFixture[role],wall}]:[];
  });
  return {id,x,z,width,depth,district,name,roof,grid,cells,cellW,cellD,edges,entries,fixtures,fittings} as const;
}

export const streetPlans=streetLots.map(buildingPlan);
export function isStreetBuilding(plan: (typeof streetPlans)[number]): plan is Extract<(typeof streetPlans)[number],{cells:Cell[]}> {
  return 'cells' in plan;
}

export const streetFootprints = streetPlans.flatMap(plan => isStreetBuilding(plan)
  ? plan.cells.map(cell => ({
    minX:cell.x-plan.cellW/2,maxX:cell.x+plan.cellW/2,minZ:cell.z-plan.cellD/2,maxZ:cell.z+plan.cellD/2,building:true,
  }))
  : [{ minX:plan.x-plan.width*.41,maxX:plan.x+plan.width*.41,minZ:plan.z-plan.depth*.41,maxZ:plan.z+plan.depth*.41,building:false }]);

export function streetArea([x,y,z]: Vec3) {
  if (y < -.09 || y > 3.15) return undefined;
  return streetPlans.find(plan => Math.abs(x-plan.x)<=plan.width/2 && Math.abs(z-plan.z)<=plan.depth/2 &&
    (!isStreetBuilding(plan) || plan.cells.some(cell=>Math.abs(x-cell.x)<=plan.cellW/2&&Math.abs(z-cell.z)<=plan.cellD/2)))?.name;
}

function ceiling(roof: Roof, room: Room) {
  if (roof==='monitor' || roof==='sawtooth') return room==='a'?4.40:3.25;
  if (roof==='stepped') return room==='b'?4.12:3.35;
  return roof==='gable'?3.45:3.2;
}

function buildYard(root: THREE.Group, m: Materials, solid: BuildSolid,
  plan: Exclude<(typeof streetPlans)[number],{cells:Cell[]}>, accent: THREE.Material) {
  const { x,z,width:w,depth:d,yard }=plan;
  const border=x-w*.31;
  const stone=new THREE.IcosahedronGeometry(1,0);
  const green=enamel(0x57775e);
  box(root,m.concrete,w*.82,.026,d*.82,x,.014,z);
  if (yard==='garden') {
    for(const dz of [-d*.28,d*.28]){
      solid([border,.34,z+dz],[1.47,.68,2.30],m.ceramic,.08);
      cylinder(root,m.timber,.10,1.64,border,1.35,z+dz,9);
      const top=mesh(root,stone,green,border,2.39,z+dz);top.scale.set(1.12,1.03,.99);
    }
    solid([x+w*.21,.28,z],[.58,.56,2.15],m.timber,.05);
  } else if (yard==='turning') {
    const bayX=x+w*.28;
    for(const dz of [-d*.24,d*.23]){
      solid([bayX,.22,z+dz],[2.25,.44,1.31],m.timber,.07);
      for (const dx of [-.64,0,.64]) box(root,m.zinc,.08,.035,1.24,bayX+dx,.46,z+dz);
    }
    for(const dz of [-d*.33,d*.33])box(root,m.safety,w*.42,.022,.14,x-w*.10,.043,z+dz);
  } else if(yard==='queue'){
    for (const dz of [-d*.29,d*.29])solid([border,1.29,z+dz],[.18,2.58,.23],m.steel);
    box(root,accent,2.4,.17,d*.69,border+.53,2.60,z);
    solid([border+.32,.37,z],[.58,.74,d*.47],m.timber,.055);
  } else if(yard==='drainage'){
    box(root,m.steel,1.26,.034,d*.72,border,.028,z);
    for(let dz=-d*.31;dz<d*.35;dz+=.55)box(root,m.zinc,1.18,.045,.09,border,.049,z+dz);
    solid([x+w*.22,.44,z+d*.25],[1.68,.88,1.32],accent,.075);
  } else {
    for(const dz of [-d*.25,0,d*.25]){
      solid([border,.36,z+dz],[1.16,.72,.07],m.steel);
      box(root,m.zinc,.16,.085,.09,border-.49,.72,z+dz);
    }
  }
}

export function* buildPortBlocks(root:THREE.Group,m:Materials,solid:BuildSolid) {
  const result:ShopRooms={doors:[],cases:[],occupants:[]};
  const wallDepth=.19;
  const glass=enamel(0x466d83), lamp=emissive(0xbee9dd,.43);
  const palette=Object.fromEntries(Object.entries(buildingColors).map(([id,color])=>[id,enamel(color)]));
  for(const [visited,plan] of streetPlans.entries()) {
    const accent=palette[plan.district];
    if(!isStreetBuilding(plan)) {
      buildYard(root,m,solid,plan,accent);
    } else {
      const {id,roof,cellW,cellD}=plan;
      for (const cell of plan.cells) {
        const h=ceiling(roof,cell.room);
        box(root,cell.room==='a'?m.concrete:m.zinc,cellW,.022,cellD,cell.x,.017,cell.z);
        solid([cell.x,h+.13,cell.z],[cellW,.26,cellD],accent,.01);
        const width=cellW-.22,depth=cellD-.22;
        if(roof==='gable') {
          for(const side of [-1,1]){
            const piece=box(root,accent,width*.57,.14,depth,cell.x+side*width*.245,h+.62,cell.z,.02);
            piece.rotation.z=-side*.27;
          }
        } else if(roof==='sawtooth') {
          const panel=box(root,m.steel,width*1.04,.16,depth,cell.x,h+.79,cell.z,.03);
          panel.rotation.z=-.26;
          box(root,glass,.12,.74,depth,cell.x-width*.46,h+.58,cell.z);
        } else if(roof==='monitor' && cell.room==='a') {
          box(root,glass,width*.63,.54,depth*.62,cell.x,h+.48,cell.z,.025);
          box(root,m.steel,width*.73,.17,depth*.71,cell.x,h+.83,cell.z,.04);
        } else if(roof==='stepped') {
          box(root,cell.room==='b'?m.steel:accent,width,.18,depth,cell.x,h+.38,cell.z,.026);
        }
        box(root,lamp,Math.min(1.60,cellW*.51),.055,.14,cell.x,h-.042,cell.z);
      }

      for (const [edgeIndex,edge] of plan.edges.entries()) {
        const {x,z,alongX,span,passage,nx,nz}=edge;
        const h=Math.max(ceiling(roof,edge.cell.room),edge.other?ceiling(roof,edge.other.room):0);
        const at=(u:number,y:number):Vec3=>[x+(alongX?u:0),y,z+(alongX?0:u)];
        const size=(w:number,height:number,thickness:number):Vec3=>alongX?[w,height,thickness]:[thickness,height,w];
        const partition=(u:number,w:number,low:number,high:number,material:THREE.Material)=>
          solid(at(u,(low+high)/2),size(w,high-low,wallDepth),material,.013);
        if(passage){
          const wing=(span-doorWidth)/2;
          for(const side of [-1,1]) partition(side*(doorWidth+wing)/2,wing,0,h,m.ceramic);
          partition(0,doorWidth,doorHeight,h,m.steel);
          if(!edge.other) {
            box(root,accent,...size(doorWidth+.52,.15,.76),x+nx*.19,doorHeight+.24,z+nz*.19,.035);
            box(root,lamp,...size(doorWidth-.24,.068,.12),x+nx*.44,doorHeight+.15,z+nz*.44);
          }
          if(passage==='shutter')result.doors.push({id:'street-'+id+'-shutter-'+edgeIndex,x,z,alongX,label:'勤务卷门'});
        } else {
          partition(0,span,0,h,edge.other?m.steel:accent);
          if(!edge.other && edge.cell.room==='a') {
            box(root,glass,...size(span*.68,.82,.09),x+nx*.12,1.97,z+nz*.12,.032);
            box(root,m.zinc,...size(span*.75,.094,.27),x+nx*.15,1.51,z+nz*.15,.016);
          }
        }
      }
      for (const {room,role,wall,id:fixtureId} of plan.fixtures) {
        buildRoomFixture(root,m,solid,role,wall,accent);
        if(room!=='a')result.cases.push(roomCase(fixtureId,role,wall));
      }
      for(const {role,wall} of plan.fittings)buildRoomFixture(root,m,solid,role,wall,accent);
      const post=plan.fixtures[1].cell;
      result.occupants.push({id:'street-infected-'+id,kind:'infected',position:[post.x,0,post.z],yaw:Math.PI});
    }
    if((visited+1)%6===0)yield (visited+1)/streetPlans.length;
  }
  return result;
}
