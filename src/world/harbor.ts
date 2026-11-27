import * as THREE from 'three';
import {box,cylinder,mesh,strut} from './detail/geometry.ts';
import {enamel,emissive,type Materials} from './detail/materialLibrary.ts';
import {dispatchOffice,dispatchUpperY,gangways,shipDeck,shipLevels,shipOutline} from './harborPlan.ts';
import type {Solid,Slope} from './worldQueries.ts';

// Fictional civil passenger terminal and ship. The same dimensions drive
// visible structure, support, walkable stairs and interior collision.
export function buildHarbor(root:THREE.Group,m:Materials,solids:Solid[]){
  const group=new THREE.Group();group.name='harbor-3.5B';root.add(group);
  const white=enamel(0xd8e8df),navy=enamel(0x244858),teal=enamel(0x4d9c9c),blue=enamel(0x416783),glass=enamel(0x7bc8cf),wood=enamel(0xa88063),carpet=enamel(0x567b78),safety=enamel(0xeabe72),light=emissive(0xe5f9e2,.7),coral=enamel(0xd47d65);
  const b=(x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material,bevel=0)=>box(group,mat,w,h,d,x,y,z,bevel);
  function solid(x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material,bevel=0){const o=b(x,y,z,w,h,d,mat,bevel);o.castShadow=true;solids.push({min:[x-w/2,y-h/2,z-d/2],max:[x+w/2,y+h/2,z+d/2]});return o;}
  function slab(x1:number,x2:number,z1:number,z2:number,y:number,mat=wood){const thickness=.19;const o=b((x1+x2)/2,y-thickness/2,(z1+z2)/2,x2-x1,thickness,z2-z1,mat);o.castShadow=true;solids.push({min:[x1,y-thickness,z1],max:[x2,y,z2],floor:true,walkSurface:true,surface:'metal'});}
  function incline(x1:number,x2:number,z1:number,z2:number,axis:0|2,start:number,height:number,gradient:number,mat=teal){
    const slope:Slope={axis,start,height,gradient};const g=new THREE.BoxGeometry(x2-x1,.16,z2-z1);g.translate((x1+x2)/2,-.08,(z1+z2)/2);const p=g.attributes.position;
    for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+height+((axis===0?p.getX(i):p.getZ(i))-start)*gradient);g.computeVertexNormals();mesh(group,g,mat).castShadow=true;
    solids.push({min:[x1,-.16,z1],max:[x2,0,z2],floor:true,walkSurface:true,surface:'metal',slope});
  }
  const wallX=(x:number,z1:number,z2:number,base:number,h:number,mat=white)=>{if(z2-z1>.01)solid(x,base+h/2,(z1+z2)/2,.18,h,z2-z1,mat);};
  const wallZ=(z:number,x1:number,x2:number,base:number,h:number,mat=white)=>{if(x2-x1>.01)solid((x1+x2)/2,base+h/2,z,x2-x1,h,.18,mat);};
  function openingX(x:number,z1:number,z2:number,base:number,h:number,doors:readonly number[],width=1.8,mat=white){let cursor=z1;for(const door of doors){wallX(x,cursor,door-width/2,base,h,mat);solid(x,base+2.35+(h-2.35)/2,door,.18,h-2.35,width,mat);for(const dz of [-width/2,width/2])b(x,base+1.15,door+dz,.24,2.3,.11,teal);cursor=door+width/2;}wallX(x,cursor,z2,base,h,mat);}
  function openingZ(z:number,x1:number,x2:number,base:number,h:number,door:number,width=2.6,mat=white){wallZ(z,x1,door-width/2,base,h,mat);wallZ(z,door+width/2,x2,base,h,mat);solid(door,base+2.35+(h-2.35)/2,z,width,h-2.35,.18,mat);for(const dx of [-width/2,width/2])b(door+dx,base+1.15,z,.12,2.3,.24,teal);}
  function rail(x1:number,z1:number,x2:number,z2:number,y:number){const len=Math.hypot(x2-x1,z2-z1);if(len<.01)return;const a=new THREE.Vector3(x1,y+1.04,z1),c=new THREE.Vector3(x2,y+1.04,z2);strut(group,m.zinc,a,c,.08);strut(group,teal,a.clone().add(new THREE.Vector3(0,-.42,0)),c.clone().add(new THREE.Vector3(0,-.42,0)),.065);const n=Math.ceil(len/1.85);for(let i=0;i<=n;i++){const t=i/n;b(x1+(x2-x1)*t,y+.52,z1+(z2-z1)*t,.075,1.04,.075,m.zinc);}solids.push({min:[(x1+x2)/2-Math.max(.09,Math.abs(x2-x1))/2,y,(z1+z2)/2-Math.max(.09,Math.abs(z2-z1))/2],max:[(x1+x2)/2+Math.max(.09,Math.abs(x2-x1))/2,y+1.06,(z1+z2)/2+Math.max(.09,Math.abs(z2-z1))/2]});}
  function bench(x:number,y:number,z:number,w=2.0,d=.65,back=true){solid(x,y+.38,z,w,.40,d,navy,.035);b(x,y+.62,z,w+.04,.15,d+.02,carpet,.045);if(back)solid(x,y+.86,z-d*.43,w,.58,.16,teal,.025);}
  function table(x:number,y:number,z:number,w:number,d:number){solid(x,y+.84,z,w,.14,d,wood,.045);for(const dx of [-w*.37,w*.37])for(const dz of [-d*.34,d*.34])solid(x+dx,y+.39,z+dz,.13,.78,.13,navy,.015);}
  function theaterRow(x:number,y:number,z:number){for(let i=-2;i<=2;i++){const zz=z+i*.93;solid(x,y+.29,zz,.77,.58,.82,navy,.05);b(x,y+.62,zz,.73,.16,.79,coral,.055);solid(x+.38,y+.86,zz,.18,.64,.81,coral,.045);b(x,y+.75,zz+.39,.65,.10,.10,navy,.02);}}
  function counter(x:number,y:number,z:number,w=1.8,d=.75){solid(x,y+.48,z,w,.96,d,navy,.035);b(x,y+.98,z,w+.10,.045,d+.09,wood,.02);for(let i=0;i<3;i++)b(x+(i-1)*w*.27,y+.49,z+d/2+.008,w*.23,.45,.026,teal,.02);}
  function bed(x:number,y:number,z:number,mat=carpet){solid(x,y+.28,z,1.35,.56,2.10,navy,.025);b(x,y+.61,z,1.30,.15,2.04,white,.04);b(x,y+.74,z-.64,1.21,.14,.51,white,.04);b(x,y+.70,z+.31,1.28,.07,1.17,mat,.025);}
  function lamp(x:number,y:number,z:number,color=0xd8fff0){b(x,y,z,1.15,.07,.17,light,.015);const l=new THREE.PointLight(color,28,8,1.6);l.position.set(x,y-.16,z);group.add(l);}
  function stripes(x:number,y:number,z:number,w:number,d:number){for(let i=0;i<Math.floor(w/.7);i++)b(x-w/2+.35+i*.7,y+.012,z,.24,.013,d,safety);}

  // WEST SHORE. The narrow quay apron is still connected to the legacy 0m land.
  b(-166, .012,-20,11,.026,116,teal);b(-166,.035,-20,7,.014,116,m.concrete);
  for(const z of [-56,-40,-27,-14,12,26,42]){cylinder(group,navy,.22,.68,-170.45,.34,z,14);b(-170.45,.68,z,.62,.10,.42,navy,.03);}
  for(const z of [-48,0]){b(-166,.035,z,7.5,.018,3.8,white);stripes(-166,.045,z,6.5,.35);}
  // Rail only along the shoreline between the two actual gateway apertures.
  for(const [a,c] of [[-78,-50],[-46,-2],[2,18],[36,54]])rail(-171.5,a,-171.5,c,0);

  // The hull is modelled with a taper and bow rather than an inaccessible cuboid.
  const {minX:x1,maxX:x2,minZ:z1,maxZ:z2}=shipDeck,base=shipLevels.cabin,upper=shipLevels.upper,H=upper-base-.20;
  const shape=new THREE.Shape();shipOutline.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
  // Tall dark hull with sloped waterline, layered sheer stripes and white bow cap.
  const hull=new THREE.ExtrudeGeometry(shape,{depth:base-shipLevels.sea-.22,bevelEnabled:false});hull.rotateX(-Math.PI/2);hull.translate(0,shipLevels.sea-.06,0);mesh(group,hull,navy).castShadow=true;
  // Visible cap follows the actual hull; the playable support is the inset deck.
  const cap=new THREE.ShapeGeometry(shape);cap.rotateX(-Math.PI/2);cap.translate(0,base-.035,0);mesh(group,cap,white);slab(x1,x2,z1,z2,base,wood);
  for(const x of [-230,-186]){b(x,base-.42,-25.5,.10,.35,135,teal);b(x,base-.09,-25.5,.12,.07,135,white);b(x,base-1.2,-25.5,.12,.23,135,coral);}
  // Two true world-space bridges with physical slopes and railings.
  for(const g of gangways){const slope=(base-0)/(g.minX-g.maxX);incline(g.minX,g.maxX,g.minZ,g.maxZ,0,g.maxX,0,slope,m.zinc);
    for(let i=1;i<Math.floor((g.maxX-g.minX)/.65);i++){const x=g.maxX-i*.65;b(x,(x-g.maxX)*slope+.013,g.z,.045,.018,2.9,navy);}
    for(const dz of [-1.53,1.53]){const a=new THREE.Vector3(g.minX,base+1.03,g.z+dz),c=new THREE.Vector3(g.maxX,1.03,g.z+dz);strut(group,teal,a,c,.09);strut(group,m.zinc,a.clone().add(new THREE.Vector3(0,-.48,0)),c.clone().add(new THREE.Vector3(0,-.48,0)),.065);for(let x=g.minX;x<=g.maxX;x+=1.8){const y=(x-g.maxX)*slope;b(x,y+.49,g.z+dz,.075,.98,.075,m.zinc);}solids.push({min:[g.minX,.0,g.z+dz-.045],max:[g.maxX,base+1.05,g.z+dz+.045]});}
  }
  // Cabin outer walls, with uninterrupted east-side walking passage and two openings.
  wallX(x1,z1,z2,base,H,white);openingX(x2,z1,z2,base,H,[-48,0],3.0,white);wallZ(z1,x1,x2,base,H);wallZ(z2,x1,x2,base,H);
  for(const x of [x1,x2])for(let z=z1+4;z<z2-3;z+=3.6){if(x===x2&&[-48,0].some(g=>Math.abs(z-g)<2.6))continue;b(x+(x===x1?-.105:.105),base+1.95,z,.025,.68,2.0,blue,.01);b(x+(x===x1?-.125:.125),base+2.06,z,.014,.29,1.78,glass);}
  for(const [a,c] of [[z1,-49.5],[-46.5,-1.5],[1.5,z2]])b(x2+.09,base+.34,(a+c)/2,.08,.20,c-a,teal);
  b(x1-.09,base+.34,(z1+z2)/2,.08,.20,z2-z1,teal);
  // Interior wall finish follows the exterior porthole rhythm. Low rails,
  // framed glazed panels and colored room bands distinguish the passenger deck.
  b(x1+.105,base+.46,(z1+z2)/2,.045,.88,z2-z1,teal);b(x1+.14,base+.92,(z1+z2)/2,.12,.065,z2-z1,wood);
  for(let z=z1+4;z<z2-3;z+=3.6){b(x1+.12,base+1.95,z,.055,.82,2.14,navy,.045);b(x1+.16,base+1.96,z,.027,.65,1.91,blue,.025);b(x1+.181,base+2.11,z,.016,.20,1.76,glass,.02);}
  for(const [a,c] of [[z1,-50],[-46,-2],[2,z2]]){b(x2-.11,base+.44,(a+c)/2,.04,.84,c-a,teal);b(x2-.15,base+.88,(a+c)/2,.12,.06,c-a,wood);}
  // Physical divider wall faces the long passage. All room entries align to this corridor.
  const partition=-190.7,oldWest=-206;openingX(partition,-69,-14,base,H,[-61,-50,-42,-34,-22],2.05,white);
  openingX(oldWest,-69,-14,base,H,[-61,-22],2.2,white);
  for(const z of [-69,-54,-46,-38,-30,-14])wallZ(z,oldWest,partition,base,H,white);
  // Reception, three distinct cabins, and a shared lounge.
  counter(-202,base,-62,3.5,.82);bench(-201,base,-66,3.2);b(-197.4,base+.02,-59,5,.025,6,carpet);
  for(const [i,z] of [-51,-43,-35].entries()){
    bed(-202.3,base,z+1.55,i===1?blue:i===2?coral:carpet);
    counter(-203.6,base,z,1.48,.64);solid(-204.85,base+1.0,z+2.25,.8,2,.9,wood,.025);
    if(i===0)bench(-196,base,z+2.3,2.0);else if(i===1)counter(-196.7,base,z+2.25,2.1,.58);else{bed(-197.7,base,z+1.48,blue);b(-196.8,base+.56,z+1.48,.35,.09,1.92,light);}
    b(-198.7,base+.014,z,.8,.018,2.8,carpet);
  }
  counter(-203,base,-24,2.8,.8);bench(-202,base,-27,3.8);bench(-196,base,-16,3.2);for(const z of [-20,-25]){solid(-197,base+.46,z,1.35,.92,.90,wood,.07);bench(-198.8,base,z,.65,1.25,false);bench(-195.2,base,z,.65,1.25,false);}b(-198.5,base+.018,-22,7.5,.023,12,carpet);
  for(const z of [-29.87,-14.13]){b(-198.2,base+.52,z,15.1,.96,.035,teal);b(-198.2,base+1.01,z,15.1,.06,.11,wood);}
  for(const z of [-26,-21,-16])b(-198,upper-.23,z,10.2,.065,.13,teal);
  // Medical and luggage service rooms are separated from the landing staircase.
  openingX(-192,-14,3,base,H,[-9,1.5],1.9);wallZ(-14,-199.6,-192,base,H);wallZ(-5,-199.6,-192,base,H);wallX(-199.6,-14,3,base,H);counter(-198,base,-9,1.65,.8);bed(-196.6,base,-11.8,white);counter(-197.8,base,1.6,2.2,.68);for(const [x,z] of [[-196,-2.8],[-198,-2.5]])solid(x,base+.63,z,.84,1.26,.71,blue,.04);

  // New west accommodation/service wing: genuine rooms, unobstructed central hall
  // and cross passages at both ends of the original east cabins.
  const westRooms=[[-92,-75,-84],[-75,-60,-67],[-60,-44,-51],[-44,-26,-34],[-26,-4,-16],[-4,17,7],[17,32,25],[32,42,37]] as const;
  openingX(-211,z1,z2,base,H,westRooms.map(r=>r[2]),2.4,white);
  for(const [i,[a,c,z]] of westRooms.entries()){
    if(i)wallZ(a,x1,-211,base,H);
    const accent=[navy,wood,carpet,coral,blue,teal,navy,safety][i];
    b(-220,base+.015,(a+c)/2,17.5,.02,c-a-.45,i===4?navy:i===0||i===5?m.zinc:carpet);
    for(const [lo,hi] of [[a+.15,z-1.2],[z+1.2,c-.15]])if(hi>lo)b(-211-.11,base+.63,(lo+hi)/2,.045,.85,hi-lo,accent);
    counter(-225,base,z,2.4,1.1);
    for(const dz of [-3.8,3.8])lamp(-218.5,upper-.29,Math.max(a+1,Math.min(c-1,z+dz)));
    if(i===0){ // Kitchen: galley runs, cold units, double preparation islands.
      for(const dz of [-4.5,4.5]){counter(-222.5,base,z+dz,6.2,1.1);for(const x of [-226,-224])solid(x,base+1.05,z+dz,.9,2.1,.86,white,.05);}
      for(const dz of [-4,4])counter(-215.5,base,z+dz,4.0,.95);
    }else if(i===1){ // Dining room with legged tables, place settings and individual booths.
      for(const x of [-222,-217])for(const dz of [-4.2,4.2]){const zz=z+dz;table(x,base,zz,2.0,1.35);bench(x,base,zz+1.3,1.8,.6);bench(x,base,zz-1.3,1.8,.6,false);for(const dx of [-.48,.48])for(const side of [-1,1]){cylinder(group,white,.17,.035,x+dx,base+.93,zz+side*.38,22);cylinder(group,glass,.07,.12,x+dx+.2,base+.96,zz+side*.16,12);}}
      for(const zz of [a+.3,c-.3]){b(-220,base+.86,zz,16.4,1.68,.035,wood);b(-220,base+1.70,zz,16.6,.075,.12,teal);}
      for(const x of [-221,-216])b(x,upper-.25,(a+c)/2,.09,.09,c-a-.8,teal);
    }else if(i===2||i===3){ // Two new guest layouts, not repeated copies of the east rooms.
      for(const [x,dz] of i===2?[[-223,-4.2],[-217,4.2]]:[[-224,-4.2],[-220,-4.2]])bed(x,base,z+dz,i===2?coral:blue);
      bench(-216,base,z-4.2,3.8);counter(-218,base,z+4.4,2.1,.76);
      solid(-227,base+1.1,z+3.7,1.1,2.2,1.1,wood,.055);
    }else if(i===4){ // Screening room: seats face the screen across an open aisle.
      b(-228.76,base+1.6,z,.10,3.0,c-a-.24,navy,.03);b(-228.65,base+1.86,z,.09,1.85,7.6,navy,.03);b(-228.56,base+1.88,z,.045,1.55,7.1,blue,.04);
      for(const x of [-221,-217,-214.5])for(const dz of [-5.0,5.0])theaterRow(x,base,z+dz);
      for(const zz of [a+.17,c-.17])for(const x of [-225,-222,-219,-216,-213]){b(x,base+1.8,zz,2.1,2.6,.09,blue,.04);b(x,base+.20,zz,1.6,.065,.12,light);}
      for(const dz of [-2.2,2.2])b(-220,base+.027,z+dz,15.2,.015,.075,coral);
    }else if(i===5){ // Laundry: individual drums, folded linen shelves and sorting table.
      for(const x of [-226,-223.8,-221.6,-219.4])for(const dz of [-4.5,4.5]){solid(x,base+.68,z+dz,1.55,1.36,1.25,white,.06);const disk=cylinder(group,blue,.42,.09,x,base+.72,z+dz+.66,24);disk.rotation.x=Math.PI/2;}
      counter(-215,base,z+4.5,3.5,1.0);
    }else if(i===6){ // Crew mess.
      for(const dz of [-4.0,4.0]){bench(-222,base,z+dz,3.6);counter(-216.5,base,z+dz,2.3,1.0);}
    }else{for(const x of [-223,-218,-215])for(const dz of [-2.8,2.8])solid(x,base+.55,z+dz,1.5,1.10,1.0,wood,.05);}
  }
  // Forward and aft rooms leave clear transverse links around the original block.
  openingX(-206,z1,-75,base,H,[-83],2.4);openingX(-191,z1,-75,base,H,[-83],2.2);wallZ(-75,-206,-191,base,H);
  counter(-202,base,-83,2.8,.9);for(const z of [-88,-78])bench(-198,base,z,4.0);b(-198.5,base+.018,-83,12,.025,13,carpet);
  wallX(-206,16,z2,base,H);openingX(-192,16,z2,base,H,[23,36],2.3);wallZ(16,-206,-192,base,H);wallZ(30,-206,-192,base,H);
  counter(-201,base,23,2.8,.86);bench(-197,base,19,3.1);counter(-201,base,36,2.5,.83);bed(-196.5,base,39,blue);bed(-196.5,base,32.3,carpet);
  for(const z of [23,36,-83])lamp(-198,upper-.29,z);

  // Upper deck slab has a true stair well. The stair is a single graded walk surface;
  // tread strips add geometry without changing the continuous collision.
  const stairX1=-204,stairX2=-200,stairLow=1,stairHigh=-13;
  // Two stair openings in one real slab plan. The second connects both decks at the bow.
  const bowStair={x1:-190.35,x2:-186.45,z1:-87,z2:-73};
  let patches=[{x1,x2,z1,z2}];
  for(const hole of [{x1:stairX1,x2:stairX2,z1:stairHigh,z2:stairLow},bowStair])patches=patches.flatMap(p=>{
    const a=Math.max(p.x1,hole.x1),c=Math.min(p.x2,hole.x2),d=Math.max(p.z1,hole.z1),e=Math.min(p.z2,hole.z2);
    return a>=c||d>=e?[p]:[{...p,x2:a},{...p,x1:c},{x1:a,x2:c,z1:p.z1,z2:d},{x1:a,x2:c,z1:e,z2:p.z2}].filter(q=>q.x2-q.x1>.01&&q.z2-q.z1>.01);
  });
  for(const p of patches)slab(p.x1,p.x2,p.z1,p.z2,upper,m.concrete);
  const g=(upper-base)/(stairHigh-stairLow);incline(stairX1,stairX2,stairHigh,stairLow,2,stairLow,base,g,navy);
  for(let z=stairHigh+.22;z<stairLow;z+=.52)b(-202,base+(z-stairLow)*g+.025,z,3.65,.025,.10,safety);for(const x of [stairX1+.07,stairX2-.07]){strut(group,teal,new THREE.Vector3(x,upper+.87,stairHigh),new THREE.Vector3(x,base+.87,stairLow),.075);}
  for(const x of [stairX1,stairX2])rail(x,stairHigh+.1,x,stairLow,upper);rail(stairX1,stairLow,stairX2,stairLow,upper);
  const bowGrade=(upper-base)/(bowStair.z1-bowStair.z2);incline(bowStair.x1,bowStair.x2,bowStair.z1,bowStair.z2,2,bowStair.z2,base,bowGrade,navy);
  for(let z=bowStair.z1+.22;z<bowStair.z2;z+=.52)b((bowStair.x1+bowStair.x2)/2,base+(z-bowStair.z2)*bowGrade+.025,z,3.6,.025,.10,safety);
  for(const x of [bowStair.x1,bowStair.x2])rail(x,bowStair.z1+.1,x,bowStair.z2,upper);rail(bowStair.x1,bowStair.z2,bowStair.x2,bowStair.z2,upper);
  for(const x of [x1,x2])rail(x+.03*(x===x1?1:-1),z1,x+.03*(x===x1?1:-1),z2,upper);for(const z of [z1,z2])rail(x1,z,x2,z,upper);
  for(let z=-65;z<4;z+=5){b(-188.75,upper+.009,z,.075,.018,3.8,teal);if(z%2===0)lamp(-188.6,upper-.26,z);}
  // Upper lookout, shaded service room, deck seats and a closed bridge silhouette.
  const ux1=-203,ux2=-193,uz1=-65,uz2=-54;wallX(ux1,uz1,uz2,upper,2.85);openingX(ux2,uz1,uz2,upper,2.85,[-59],2.2);wallZ(uz1,ux1,ux2,upper,2.85);wallZ(uz2,ux1,ux2,upper,2.85);slab(ux1-.15,ux2+.15,uz1-.15,uz2+.15,upper+2.95,white);counter(-199,upper,-59,2.0,.7);lamp(-198.5,upper+2.67,-59);
  counter(-192.8,upper,-19,1.8,.74);for(const z of [-44,-38,-32,-26])bench(-197,upper,z,3.1,.74);for(const z of [-47,-23]){solid(-204.9,upper+1.27,z,.15,2.54,.15,teal);solid(-190.5,upper+1.27,z,.15,2.54,.15,teal);}
  for(const z of [-59,-35,-9]){const ring=mesh(group,new THREE.TorusGeometry(.36,.08,8,24),coral);ring.rotation.y=Math.PI/2;ring.position.set(x2-.16,upper+.72,z);for(const dz of [-.32,.32])b(x2-.16,upper+.72,z+dz,.18,.12,.12,white,.02);}
  b(-197.7,upper+2.66,-35,14.7,.18,24.5,white,.05);for(let z=-45;z<-24;z+=3.8)b(-197.7,upper+2.54,z,14.3,.06,.12,teal);
  // Higher bridge and distinctive profile, with navigation glass rather than signage.
  solid(-209,upper+2.5,-86.5,27,4.9,8.0,white,.22);b(-209,upper+3.5,-90.53,23,1.55,.08,blue,.04);b(-209,upper+3.87,-82.44,23,1.4,.08,glass,.05);
  for(const x of [-220,-215,-210,-205,-200])b(x,upper+3.5,-90.6,.15,1.65,.09,white);
  b(-209,upper+5.03,-86.5,29,.24,8.6,teal,.08);cylinder(group,navy,.15,5.5,-210,upper+7.8,-86.5,12);b(-210,upper+9.35,-86.5,4.2,.19,.21,white);
  for(const x of [-215,-204]){solid(x,upper+2.8,-74,3.9,5.6,3.4,navy,.23);b(x,upper+4.95,-74,4.2,1.15,3.7,coral,.15);}
  // Long, separate port side rooms on the upper promenade.
  function upperRoom(a:number,c:number,z:number,kind:'library'|'cafe'){
    const ax=-227,cx=-208;wallX(ax,a,c,upper,3.05);openingX(cx,a,c,upper,3.05,[z],2.6);wallZ(a,ax,cx,upper,3.05);wallZ(c,ax,cx,upper,3.05);
    slab(ax-.22,cx+.22,a-.22,c+.22,upper+3.25,white);b((ax+cx)/2,upper+3.23,(a+c)/2,cx-ax+.6,.18,c-a+.6,teal,.055);
    counter(-224,upper,z,2.6,.9);b(-217.5,upper+.016,(a+c)/2,17.6,.022,c-a-.5,kind==='library'?carpet:wood);
    for(const zz of [a+3,c-3]){lamp(-217,upper+2.92,zz);if(kind==='library'){for(const x of [-224,-220,-216]){solid(x,upper+1.15,zz,2.8,2.3,.65,navy,.035);for(const h of [.65,1.25,1.85])b(x,upper+h,zz+.35,2.6,.14,.08,wood);}}else{for(const x of [-222,-215]){solid(x,upper+.47,zz,2.0,.94,1.25,wood,.07);bench(x,upper,zz+1.15,1.8,.6);}}}
    for(let zz=a+2;zz<c-1;zz+=4){b(ax-.10,upper+1.85,zz,.025,1.25,2.4,blue,.04);b(ax-.12,upper+2.12,zz,.02,.45,2.15,glass,.03);}
  }
  upperRoom(-70,-47,-64,'library');upperRoom(-43,-22,-33,'cafe');
  // Aft superstructure: two interior halls plus a true roof observation deck.
  const sun=shipLevels.sun,ax=-220,cx=-193,az=14,cz=39;
  wallX(ax,az,cz,upper,3.35);openingX(cx,az,cz,upper,3.35,[22,34],2.6);wallZ(az,ax,cx,upper,3.35);wallZ(28,ax,cx,upper,3.35);wallZ(cz,ax,cx,upper,3.35);
  for(let z=az+2;z<cz-1;z+=4){b(cx+.11,upper+2.0,z,.028,1.45,2.5,blue,.035);b(cx+.13,upper+2.27,z,.02,.52,2.25,glass,.025);}
  counter(-216,upper,22,3.1,1.0);b(-207,upper+.016,21,16,.02,11.4,wood);for(const x of [-211,-205,-198])bench(x,upper,17,3.0);for(const x of [-210,-203,-197])bench(x,upper,26,2.8,.8);
  counter(-216,upper,34,2.6,.95);for(const x of [-210,-205,-200])for(const z of [31,37]){solid(x,upper+.31,z,2.1,.62,.9,navy,.065);b(x,upper+.68,z,1.7,.13,.71,carpet,.045);}
  lamp(-206.5,upper+3.11,22);lamp(-207,upper+3.11,34);
  slab(ax,cx,az,cz,sun,m.concrete);slab(-224,ax,25,cz,sun,m.concrete);
  const sunGrade=(sun-upper)/15;incline(-224,ax,10,25,2,10,upper,sunGrade,navy);
  for(let z=10.25;z<25;z+=.52)b(-222,upper+(z-10)*sunGrade+.025,z,3.65,.025,.1,safety);
  for(const x of [-224,ax]){strut(group,teal,new THREE.Vector3(x,upper+1,10),new THREE.Vector3(x,sun+1,25),.08);}
  rail(-224,25,-224,cz,sun);rail(-224,cz,cx,cz,sun);rail(cx,az,cx,cz,sun);rail(ax,az,cx,az,sun);rail(ax,az,ax,25,sun);
  counter(-211,sun,33,2.4,.9);for(const x of [-216,-201])for(const z of [19,36])bench(x,sun,z,2.9,.8,false);
  for(const z of [18,37])for(const x of [-217,-196])solid(x,sun+1.25,z,.17,2.5,.17,navy);b(-206.5,sun+2.58,18,22,.17,2.3,white,.04);b(-206.5,sun+2.58,37,22,.17,2.3,white,.04);
  // Covered rescue craft hang outside the outer railing; deck equipment is real volume.
  for(const z of [-41,3,33]){b(x1-1.7,upper+.6,z,2.6,1.4,7.8,coral,.34);b(x1-1.7,upper+1.32,z,2.65,.25,7.5,white,.10);for(const dz of [-3,3])strut(group,m.zinc,new THREE.Vector3(x1,upper+2.6,z+dz),new THREE.Vector3(x1-1.7,upper+1.45,z+dz),.11);}
  for(const z of [-79,-31,29]){solid(-187.65,upper+3.0,z,2.45,1.23,6.7,coral,.31);b(-187.65,upper+3.67,z,2.5,.19,6.35,white,.09);for(const dz of [-2.7,2.7]){solid(-186.54,upper+2.25,z+dz,.12,4.5,.16,navy);strut(group,m.zinc,new THREE.Vector3(-186.54,upper+4.42,z+dz),new THREE.Vector3(-187.65,upper+3.71,z+dz),.09);}}
  for(let z=-65;z<5;z+=6){lamp(-188.7,upper-.27,z);if(z<-14)lamp(-198,upper-.27,z);}

  // Landside terminal: distinctive glass-fronted waiting hall with two portals.
  const tx1=-153,tx2=-122,tz1=-96,tz2=-73;
  wallX(tx1,tz1,tz2,0,3.8,white);wallX(tx2,tz1,tz2,0,3.8,white);openingZ(tz1,tx1,tx2,0,3.8,-137.5,4.5,white);openingZ(tz2,tx1,tx2,0,3.8,-137.5,4.5,white);
  b(-137.5,.016,-84.5,30.6,.035,22.7,carpet);solid(-137.5,4.0,-84.5,32,.4,24.0,white,.055);b(-137.5,4.36,-84.5,33,.3,24.7,teal,.08);for(const z of [tz1,tz2])for(const x of [-149,-145,-130,-126])b(x,2.35,z+(z===tz1?-.105:.105),3.1,1.8,.035,blue);
  counter(-149,0,-83,3.3,.9);counter(-128,0,-90,3.6,.9);for(const z of [-90,-86,-80,-77]){bench(-144,0,z,3.1);bench(-131,0,z,3.1);}for(const x of [-147,-128])for(const z of [-91,-79])lamp(x,3.75,z);
  for(const x of [-150,-146,-129,-125])b(x,.02,-71.7,.18,.025,2.5,safety);
  // Repair shed has open frontage and an independent work surface.
  const rx1=-169,rx2=-158,rz1=19,rz2=35;wallX(rx1,rz1,rz2,0,3.2,navy);wallX(rx2,rz1,rz2,0,3.2,navy);wallZ(rz2,rx1,rx2,0,3.2,navy);for(const x of [rx1+.25,rx2-.25])solid(x,1.6,rz1,.27,3.2,.30,navy);solid(-163.5,3.34,27,11.8,.25,16.7,teal);counter(-166,0,31.4,2.4,.95);for(const z of [24,27,33])solid(-168.25,.62,z,.82,1.24,.85,navy,.045);
  // Dispatch office: ground floor and an open two-storey stair/landing.
  const {minX:dx1,maxX:dx2,minZ:dz1,maxZ:dz2}=dispatchOffice,dy=dispatchUpperY;
  wallX(dx1,dz1,dz2,0,3.28,white);wallX(dx2,dz1,dz2,0,3.28,white);openingZ(dz1,dx1,dx2,0,3.28,-141,3.2);openingZ(dz2,dx1,dx2,0,3.28,-141,3.2);counter(-150,0,49.5,2.6,.76);bench(-134,0,41,3.0);
  wallX(-138.2,46.35,dz2,0,3.22,navy);
  openingZ(46.35,-138.2,dx2,0,3.22,-133.9,2.36,navy);
  counter(-132,0,51.1,1.95,.82);
  for(const z of [47.9,50.15,52.55]) {
    solid(-137.47,1.03,z,.86,2.06,1.57,teal,.055);
    for(const y of [.54,1.08,1.61])b(-136.99,y,z,.085,.16,1.31,navy);
  }
  lamp(-133.65,3.11,49.7);
  const sx=-152,ex=-148,lo=39,hi=51,grad=dy/(hi-lo);incline(sx,ex,lo,hi,2,lo,0,grad,navy);for(let z=lo+.25;z<hi;z+=.55)b(-150,(z-lo)*grad+.025,z,3.65,.025,.095,safety);
  slab(dx1,dx2,hi,dz2,dy,m.concrete);slab(dx1,sx,dz1,hi,dy,m.concrete);slab(ex,dx2,dz1,hi,dy,m.concrete);slab(sx,ex,dz1,lo,dy,m.concrete);rail(sx,lo,sx,hi-.05,dy);rail(ex,lo,ex,hi-.05,dy);rail(sx,lo,ex,lo,dy);
  const shoreWindow = new THREE.MeshStandardMaterial({ color: 0x9dd4e5, transparent: true, opacity: .23, depthWrite: false, roughness: .24 });
  wallX(dx1,dz1,dz2,dy,.89,teal);
  solid(dx1,dy+1.70,(dz1+dz2)/2,.09,1.62,dz2-dz1,shoreWindow);
  wallX(dx1,dz1,dz2,dy+2.51,.49,white);
  for(const z of [38.1,41.8,45.4,49.0,52.8])b(dx1,dy+1.70,z,.26,1.66,.14,teal);
  b(dx1+.12,dy+.92,45.5,.25,.085,16.8,wood);
  wallX(dx2,dz1,dz2,dy,3.0,white);wallZ(dz1,dx1,dx2,dy,3.0,teal);wallZ(dz2,dx1,dx2,dy,3.0,white);solid(-142,dy+3.13,45.5,24.6,.26,17.6,white);counter(-137,dy,49.8,2.9,.8);bench(-138,dy,42,3.2);for(const x of [-150,-146,-138,-134]){b(x,dy+1.76,dz1-.105,3.1,1.2,.035,blue);b(x,dy+1.76,dz2+.105,3.1,1.2,.035,blue);}lamp(-139,dy+2.8,49);
}
