import * as THREE from 'three';
import type { Vec3 } from '../contracts/demo.ts';
import type { Materials } from './detail/materialLibrary.ts';
import { box, cable, cylinder, mesh, strut, label } from './detail/geometry.ts';

type SolidBuilder = (at: Vec3, size: Vec3, material: THREE.Material, bevel?: number) => THREE.Mesh;

/** Built-space modules shared by the freight sample and subsequent districts. Units are metres. */
export function addDistrictDetails(root: THREE.Group, m: Materials, solid: SolidBuilder) {
  const paint = m.steel, trim = m.zinc;
  const glass = new THREE.MeshStandardMaterial({ color: 0x587276, metalness: .2, roughness: .28 });
  const b = (at: Vec3, size: Vec3, mat: THREE.Material = paint, bevel = .015) => box(root, mat, ...size, ...at, bevel);
  const beam = (a: Vec3, c: Vec3, width = .12) => strut(root, trim, new THREE.Vector3(...a), new THREE.Vector3(...c), width);
  function sign(x: number, y: number, z: number, title: string, note: string) {
    const plate = label(root, 4.8, 1.15, (ctx,w,h) => {
      ctx.fillStyle='#233632';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#9ea58d';ctx.strokeRect(5,5,w-10,h-10);
      ctx.fillStyle='#ded6ad';ctx.font='bold 38px Microsoft YaHei';ctx.fillText(title,18,52);
      ctx.font='18px sans-serif';ctx.fillText(note,18,88);
    },.08);plate.position.set(x,y,z);
  }
  function pallet(x: number, y: number, z: number, loaded = true) {
    for (const dx of [-.48,0,.48]) b([x+dx,y+.07,z],[.12,.14,1.05],m.timber,.006);
    for(let i=0;i<6;i++) b([x,y+.17,z-.48+i*.19],[1.22,.07,.15],m.timber,.004);
    if(loaded) {
      solid([x,y+.65,z],[1.1,.9,.94],m.ceramic,.035);
      for(const dx of [-.4,.4]) b([x+dx,y+.66,z],[.035,.94,.96],m.rubber,.003);
      b([x,y+1.12,z],[1.12,.025,.96],m.timber);
    }
  }
  function rack(x: number, z: number, seed: number) {
    for(const dx of [-2,2]) for(const dz of [-.7,.7]) {
      solid([x+dx,2.3,z+dz],[.09,4.6,.09],paint,.008);
      b([x+dx,.035,z+dz],[.3,.07,.28],trim);
      for(let y=.4;y<4.3;y+=.25)b([x+dx,y,z+dz],[.095,.035,.095],m.rubber,.002);
    }
    for(const y of [.3,1.9,3.5]) {
      b([x,y,z],[4.2,.14,1.5],m.safety);
      for(let n=0;n<3;n++) pallet(x-1.35+n*1.35,y+.08,z,(seed+n+Math.floor(y))%4!==0);
    }
    beam([x-2,.1,z-.7],[x+2,4.4,z-.7],.04);
    beam([x+2,.1,z-.7],[x-2,4.4,z-.7],.04);
  }
  function shed(x: number, z: number, w: number, d: number) {
    for(const side of [-1,1]) {
      solid([x+side*w/2,1.1,z],[.25,2.2,d],m.concrete,.025);
      solid([x+side*w/2,4.1,z],[.14,3.8,d],paint,.02);
      for(let dz=-d/2;dz<=d/2;dz+=5) {
        solid([x+side*w/2,3.1,z+dz],[.22,6.2,.24],trim,.012);
        if (dz + 3.35 < d/2) b([x+side*(w/2+.1),3.6,z+dz+2],[.05,.9,2.7],glass);
      }
      for(const y of [2.3,5.9]) b([x+side*(w/2+.15),y,z],[.09,.1,d+.5],trim);
      const roof=b([x+side*w/4,6.5,z],[w/2+.6,.17,d+.9],paint);
      roof.rotation.z=-side*.08;
      for(let dz=-d/2;dz<d/2;dz+=5) {
        const rib=b([x+side*w/4,6.61,z+dz],[w/2+.5,.08,.12],trim);
        rib.rotation.z=roof.rotation.z;
      }
      // Two generous openings: loading at either end of the same aisle.
      for(const dz of [-d/2,d/2]) solid([x+side*(w/4+2),2.9,z+dz],[w/2-4,5.8,.25],paint,.02);
    }
    for(let dz=-d/2;dz<=d/2;dz+=5) {
      beam([x-w/2,6,z+dz],[x,7,z+dz],.16);beam([x,7,z+dz],[x+w/2,6,z+dz],.16);
      beam([x-w/2,5.7,z+dz],[x+w/2,5.7,z+dz],.11);
    }
    for(const dz of [-d/2,d/2]) {
      b([x,5.3,z+dz],[8.1,1.25,.22],paint);
      for(const dx of [-4,4]) b([x+dx,2.5,z+dz],[.16,5,.4],trim);
      b([x,.045,z+dz],[8,.08,.8],m.safety);
    }
  }
  function bench(x: number, z: number) {
    solid([x,.96,z],[3.4,.12,1],m.timber,.018);
    for(const dx of [-1.5,1.5]) for(const dz of [-.4,.4]) b([x+dx,.46,z+dz],[.08,.92,.08],trim);
    b([x,1.7,z-.47],[3.4,1.25,.045],paint);
    // Pegboard, wrench silhouettes and sockets follow an actual maintenance station.
    for(let i=0;i<9;i++) {
      const tx=x-1.4+i*.35;
      cylinder(root,trim,.026,.3,tx,1.7,z-.42,8);
      b([tx,1.87,z-.42],[.11,.09,.035],trim,.02);
      b([tx,1.91,z-.40],[.035,.06,.045],m.rubber,.006);
    }
    solid([x+1,.65,z],[.65,.6,.8],paint,.04);
    for(const y of [.5,.7,.9]) b([x+1,y,z+.42],[.18,.025,.025],trim);
    cylinder(root,trim,.09,.32,x-.8,1.2,z,12);
    cable(root,m.rubber,[[x+.1,1.04,z],[x-.2,1.03,z+.2],[x-.45,.4,z+.7],[x+.2,.03,z+.9]],.025);
  }
  function cabinet(x: number,z: number) {
    solid([x,1,z],[.85,2,.55],paint,.04);
    b([x,1.05,z+.29],[.76,1.75,.025],trim);
    b([x+.25,1.2,z+.32],[.035,.2,.045],m.rubber);
    for(let y=.3;y<.7;y+=.09)b([x,y,z+.31],[.5,.025,.015],m.rubber,.003);
    cable(root,m.rubber,[[x,2,z],[x,2.4,z-.1],[x+1.5,2.4,z-.1],[x+1.5,.05,z]],.027);
  }
  // 80m freight sample: paired loading entrances, storage aisles and a separate workshop.
  shed(-78,3,32,40);

  for(const x of [-89,-67]) for(const [i,z] of [-9,2,13].entries()) rack(x,z,i);
  for(const z of [-10,10]) {
    const light = new THREE.PointLight(0xffd1a0, 100, 25, 2);
    light.position.set(-78,5.4,z);root.add(light);
    b([-78,5.6,z],[1.5,.15,.35],trim);
    const lens = new THREE.MeshStandardMaterial({color:0xffd3a0,emissive:0xffd3a0,emissiveIntensity:2});
    b([-78,5.51,z],[1.3,.03,.28],lens);
  }
  bench(-84,-13); cabinet(-92,17); cabinet(-64,14);
  for(const [x,z] of [[-97,36],[-100,38],[-64,38],[-58,-25],[-104,-28]]) pallet(x,0,z);
  // Workshop lean-to opens toward the transfer road, with real structural support.
  solid([-48,1.7,7],[.2,3.4,14],m.concrete,.03);
  solid([-41,1.7,0],[14,3.4,.2],paint,.02);
  for(const x of [-47,-35]) solid([x,1.7,14],[.16,3.4,.16],trim,.01);
  b([-41,3.5,7],[14.6,.17,14.8],paint);
  bench(-42,2);cabinet(-47,3);sign(-41,2.7,14.2,'维修工棚','TOOLS / KEEP AISLE CLEAR');
  for(const z of [5,9]) {
    cylinder(root,paint,.36,.95,-45,.48,z,24);
    for(const y of [.08,.85]) cylinder(root,trim,.38,.06,-45,y,z,24);
  }
  // Pipe bridge and drainage give the transfer yard a purpose and a scale reference.
  for(const x of [-108,-34]) solid([x,3.4,-28],[.25,6.8,.32],trim,.01);
  beam([-108,6.8,-28],[-34,6.8,-28],.22);
  for(const y of [7,7.35]) cable(root,trim,[[-110,y,-28],[-80,y,-28],[-55,y,-28],[-32,y,-28]],.12);
  for(const x of [-110,-100,-90,-80,-70,-60,-50,-40]) {
    b([x,.025,34],[1.4,.04,.46],m.rubber);
    for(let i=0;i<9;i++) b([x-.6+i*.15,.05,34],[.035,.025,.43],trim,.002);
  }
  // Shared modules are also used inside the original warehouse.
  for(const z of [1,10]) rack(3,z,Math.round(z));
  cabinet(6,17);bench(-7,-2);
  return { shed, rack, bench, cabinet, pallet };
}

/** Visual-only world beyond the walkable boundary. No downloaded maps or models. */
export function addPortHorizon(root: THREE.Group,m: Materials) {
  const ocean = new THREE.MeshStandardMaterial({ color:0x46a8b5, metalness:.32, roughness:.32 });
  const water = new THREE.PlaneGeometry(900,1800,100,150);
  water.rotateX(-Math.PI/2);
  const p=water.getAttribute('position');
  for(let i=0;i<p.count;i++) p.setY(i,Math.sin(p.getX(i)*.12+p.getZ(i)*.17)*.13+Math.sin(p.getZ(i)*.43)*.055);
  water.computeVertexNormals();mesh(root,water,ocean,-622,-2.1,-30);
  for(let z=-220;z<180;z+=8) {
    if([-48,0].some(g=>Math.abs(z-g)<6))continue;
    box(root,m.concrete,2.3,1.4,7.6,-171,-.7,z,.08);
    cylinder(root,m.steel,.19,.8,-167,.4,z,12);
  }
  // A cargo hull made by extrusion, with bow, bridge, holds and deck fittings.
  const ship=new THREE.Group();ship.position.set(-350,-1.9,-125);root.add(ship);
  const outline=new THREE.Shape();outline.moveTo(-10,-42);outline.lineTo(10,-42);outline.lineTo(12,30);outline.lineTo(0,48);outline.lineTo(-12,30);outline.closePath();
  const hull=new THREE.ExtrudeGeometry(outline,{depth:7,bevelEnabled:true,bevelSize:.8,bevelThickness:.4,bevelSegments:2,steps:1});
  hull.rotateX(-Math.PI/2);mesh(ship,hull,m.steel);
  box(ship,m.concrete,17,10,12,0,12,30,.15);
  box(ship,m.zinc,19,.5,14,0,17.2,30,.08);
  for(let x=-6;x<=6;x+=6) for(let z=-28;z<20;z+=13) for(let y=0;y<2;y++) {
    box(ship,(x+z)%3?m.steel:m.safety,5.7,2.7,12,x,8+y*2.8,z,.07);
    for(let dz=-5;dz<=5;dz+=1)box(ship,m.zinc,5.75,2.3,.025,x,8+y*2.8,z+dz);
  }
  cylinder(ship,m.steel,.14,12,0,21,31,12);
  for(let z=-180;z<=110;z+=85) {
    for(const x of [-300,-280]) {
      strut(root,m.steel,new THREE.Vector3(x,0,z),new THREE.Vector3(x+6,42,z),.85);
      strut(root,m.steel,new THREE.Vector3(x,0,z+13),new THREE.Vector3(x+6,42,z),.85);
    }
    strut(root,m.safety,new THREE.Vector3(-302,42,z),new THREE.Vector3(-206,49,z),.8);
    strut(root,m.safety,new THREE.Vector3(-302,45,z),new THREE.Vector3(-206,52,z),.45);
    for(let i=0;i<12;i++)strut(root,m.steel,new THREE.Vector3(-302+i*8,42+i*.58,z),new THREE.Vector3(-294+i*8,45+(i+1)*.58,z),.2);
    cable(root,m.rubber,[[-218,48,z],[-218,27,z],[-218,12,z]],.065);
  }
  const rock=new THREE.MeshStandardMaterial({color:0x8496b8,roughness:1});
  for(const [cx,cz,yaw] of [[25,-320,0],[328,-20,Math.PI/2],[20,285,0]]) {
    const terrain=new THREE.PlaneGeometry(680,210,80,24);terrain.rotateX(-Math.PI/2);
    const points=terrain.getAttribute('position');
    for(let i=0;i<points.count;i++) {
      const x=points.getX(i),z=points.getZ(i),t=(z+105)/210;
      const ridge=Math.sin(Math.PI*t)**1.3;
      const height=ridge*(38+22*Math.sin(x*.017)+12*Math.sin(x*.043+z*.024)+8*Math.cos(x*.079-z*.03));
      points.setY(i,Math.max(0,height));
    }
    terrain.computeVertexNormals();
    const object=mesh(root,terrain,rock,cx,-5,cz);object.rotation.y=yaw;
  }
}
