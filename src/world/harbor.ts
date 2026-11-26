import * as THREE from 'three';
import {box,cylinder,label,mesh,strut} from './detail/geometry.ts';
import {enamel,emissive,type Materials} from './detail/materialLibrary.ts';
import {gangways,shipDeck,shipLevels} from './harborPlan.ts';
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
  const sign=(x:number,y:number,z:number,w:number,title:string,note:string,yaw=0)=>{const o=label(group,w,w*.25,(c,cw,ch)=>{c.fillStyle='#214452';c.fillRect(0,0,cw,ch);c.fillStyle='#82d4c9';c.fillRect(14,12,7,ch-24);c.fillStyle='#edf6e8';c.font='bold 47px sans-serif';c.fillText(title,34,59,cw-50);c.fillStyle='#b0d9d8';c.font='22px sans-serif';c.fillText(note,34,94,cw-48);},.2);o.position.set(x,y,z);o.rotation.y=yaw;};
  const wallX=(x:number,z1:number,z2:number,base:number,h:number,mat=white)=>{if(z2-z1>.01)solid(x,base+h/2,(z1+z2)/2,.18,h,z2-z1,mat);};
  const wallZ=(z:number,x1:number,x2:number,base:number,h:number,mat=white)=>{if(x2-x1>.01)solid((x1+x2)/2,base+h/2,z,x2-x1,h,.18,mat);};
  function openingX(x:number,z1:number,z2:number,base:number,h:number,doors:readonly number[],width=1.8,mat=white){let cursor=z1;for(const door of doors){wallX(x,cursor,door-width/2,base,h,mat);solid(x,base+2.35+(h-2.35)/2,door,.18,h-2.35,width,mat);for(const dz of [-width/2,width/2])b(x,base+1.15,door+dz,.24,2.3,.11,teal);cursor=door+width/2;}wallX(x,cursor,z2,base,h,mat);}
  function openingZ(z:number,x1:number,x2:number,base:number,h:number,door:number,width=2.6,mat=white){wallZ(z,x1,door-width/2,base,h,mat);wallZ(z,door+width/2,x2,base,h,mat);solid(door,base+2.35+(h-2.35)/2,z,width,h-2.35,.18,mat);for(const dx of [-width/2,width/2])b(door+dx,base+1.15,z,.12,2.3,.24,teal);}
  function rail(x1:number,z1:number,x2:number,z2:number,y:number){const len=Math.hypot(x2-x1,z2-z1);if(len<.01)return;const a=new THREE.Vector3(x1,y+1.04,z1),c=new THREE.Vector3(x2,y+1.04,z2);strut(group,m.zinc,a,c,.08);strut(group,teal,a.clone().add(new THREE.Vector3(0,-.42,0)),c.clone().add(new THREE.Vector3(0,-.42,0)),.065);const n=Math.ceil(len/1.85);for(let i=0;i<=n;i++){const t=i/n;b(x1+(x2-x1)*t,y+.52,z1+(z2-z1)*t,.075,1.04,.075,m.zinc);}solids.push({min:[(x1+x2)/2-Math.max(.09,Math.abs(x2-x1))/2,y,(z1+z2)/2-Math.max(.09,Math.abs(z2-z1))/2],max:[(x1+x2)/2+Math.max(.09,Math.abs(x2-x1))/2,y+1.06,(z1+z2)/2+Math.max(.09,Math.abs(z2-z1))/2]});}
  function bench(x:number,y:number,z:number,w=2.0,d=.65,back=true){solid(x,y+.38,z,w,.40,d,navy,.035);b(x,y+.62,z,w+.04,.15,d+.02,carpet,.045);if(back)solid(x,y+.86,z-d*.43,w,.58,.16,teal,.025);}
  function counter(x:number,y:number,z:number,w=1.8,d=.75){solid(x,y+.48,z,w,.96,d,navy,.035);b(x,y+.98,z,w+.10,.045,d+.09,wood,.02);for(let i=0;i<3;i++)b(x+(i-1)*w*.27,y+.49,z+d/2+.008,w*.23,.45,.026,teal,.02);}
  function bed(x:number,y:number,z:number,mat=carpet){solid(x,y+.28,z,1.35,.56,2.10,navy,.025);b(x,y+.61,z,1.30,.15,2.04,white,.04);b(x,y+.74,z-.64,1.21,.14,.51,white,.04);b(x,y+.70,z+.31,1.28,.07,1.17,mat,.025);}
  function lamp(x:number,y:number,z:number,color=0xd8fff0){b(x,y,z,1.15,.07,.17,light,.015);const l=new THREE.PointLight(color,28,8,1.6);l.position.set(x,y-.16,z);group.add(l);}
  function stripes(x:number,y:number,z:number,w:number,d:number){for(let i=0;i<Math.floor(w/.7);i++)b(x-w/2+.35+i*.7,y+.012,z,.24,.013,d,safety);}

  // WEST SHORE. The narrow quay apron is still connected to the legacy 0m land.
  b(-166, .012,-20,11,.026,116,teal);b(-166,.035,-20,7,.014,116,m.concrete);
  for(const z of [-56,-40,-27,-14,12,26,42]){cylinder(group,navy,.22,.68,-170.45,.34,z,14);b(-170.45,.68,z,.62,.10,.42,navy,.03);}
  for(const z of [-48,0]){b(-166,.035,z,7.5,.018,3.8,white);stripes(-166,.045,z,6.5,.35);sign(-165.5,2.75,z+2.3,3.2,'登船通道','PASSENGER SHIP',Math.PI/2);}
  // Rail only along the shoreline between the two actual gateway apertures.
  for(const [a,c] of [[-78,-50],[-46,-2],[2,18],[36,54]])rail(-171.5,a,-171.5,c,0);

  // The hull is modelled with a taper and bow rather than an inaccessible cuboid.
  const {minX:x1,maxX:x2,minZ:z1,maxZ:z2}=shipDeck,base=shipLevels.cabin,upper=shipLevels.upper,H=upper-base-.20;
  const outline=[[-196.5,-77],[-190.8,-73],[-186,-68],[-186,5],[-189,10],[-204,10],[-207,5],[-207,-68],[-202,-73]];
  const shape=new THREE.Shape();outline.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
  const hull=new THREE.ExtrudeGeometry(shape,{depth:base-shipLevels.sea-.22,bevelEnabled:false});hull.rotateX(-Math.PI/2);hull.translate(0,shipLevels.sea-.06,0);mesh(group,hull,navy).castShadow=true;
  // Visible cap follows the actual hull; the playable support is the inset deck.
  const cap=new THREE.ShapeGeometry(shape);cap.rotateX(-Math.PI/2);cap.translate(0,base-.035,0);mesh(group,cap,white);slab(x1,x2,z1,z2,base,wood);
  for(const x of [-207,-186]){b(x,base-.42,-31.5,.10,.35,70,teal);b(x,base-.09,-31.5,.12,.07,70,white);}
  // Two true world-space bridges with physical slopes and railings.
  for(const g of gangways){const slope=(base-0)/(g.minX-g.maxX);incline(g.minX,g.maxX,g.minZ,g.maxZ,0,g.maxX,0,slope,m.zinc);
    for(let i=1;i<Math.floor((g.maxX-g.minX)/.65);i++){const x=g.maxX-i*.65;b(x,(x-g.maxX)*slope+.013,g.z,.045,.018,2.9,navy);}
    for(const dz of [-1.53,1.53]){const a=new THREE.Vector3(g.minX,base+1.03,g.z+dz),c=new THREE.Vector3(g.maxX,1.03,g.z+dz);strut(group,teal,a,c,.09);strut(group,m.zinc,a.clone().add(new THREE.Vector3(0,-.48,0)),c.clone().add(new THREE.Vector3(0,-.48,0)),.065);for(let x=g.minX;x<=g.maxX;x+=1.8){const y=(x-g.maxX)*slope;b(x,y+.49,g.z+dz,.075,.98,.075,m.zinc);}solids.push({min:[g.minX,.0,g.z+dz-.045],max:[g.maxX,base+1.05,g.z+dz+.045]});}
  }
  // Cabin outer walls, with uninterrupted east-side walking passage and two openings.
  wallX(x1,z1,z2,base,H,white);openingX(x2,z1,z2,base,H,[-48,0],3.0,white);wallZ(z1,x1,x2,base,H);wallZ(z2,x1,x2,base,H);
  for(const x of [x1,x2])for(let z=-65;z<3;z+=3.6){if(x===x2&&[-48,0].some(g=>Math.abs(z-g)<2.6))continue;b(x+(x===x1?-.105:.105),base+1.95,z,.025,.68,2.0,blue,.01);b(x+(x===x1?-.125:.125),base+2.06,z,.014,.29,1.78,glass);}
  b(x2+.09,base+.34,-32,.08,.20,72,teal);b(x1-.09,base+.34,-32,.08,.20,72,teal);
  // Interior wall finish follows the exterior porthole rhythm. Low rails,
  // framed glazed panels and colored room bands distinguish the passenger deck.
  b(x1+.105,base+.46,-32,.045,.88,73.7,teal);b(x1+.14,base+.92,-32,.12,.065,73.7,wood);
  for(let z=-65;z<3;z+=3.6){b(x1+.12,base+1.95,z,.055,.82,2.14,navy,.045);b(x1+.16,base+1.96,z,.027,.65,1.91,blue,.025);b(x1+.181,base+2.11,z,.016,.20,1.76,glass,.02);}
  for(const [a,c] of [[-68,-50],[-46,-2],[2,4.7]]){b(x2-.11,base+.44,(a+c)/2,.04,.84,c-a,teal);b(x2-.15,base+.88,(a+c)/2,.12,.06,c-a,wood);}
  sign(x2+.14,base+2.78,-31,8.4,'盐港 · 海湾号','SALTPORT  /  BAY LINE',Math.PI/2);
  // Physical divider wall faces the long passage. All room entries align to this corridor.
  const partition=-190.7;openingX(partition,z1,-14,base,H,[-61,-50,-42,-34,-22],2.05,white);
  for(const z of [-54,-46,-38,-30,-14])wallZ(z,x1,partition,base,H,white);
  // Reception, three distinct cabins, and a shared lounge.
  counter(-202,base,-62,3.5,.82);bench(-201,base,-66,3.2);b(-197.4,base+.02,-59,5,.025,6,carpet);sign(partition+.11,base+2.55,-61,2.5,'接待大厅','RECEPTION',Math.PI/2);
  for(const [i,z] of [-51,-43,-35].entries()){
    bed(-202.3,base,z+1.55,i===1?blue:i===2?coral:carpet);
    counter(-203.6,base,z,1.48,.64);solid(-204.85,base+1.0,z+2.25,.8,2,.9,wood,.025);
    if(i===0)bench(-196,base,z+2.3,2.0);else if(i===1)counter(-196.7,base,z+2.25,2.1,.58);else{bed(-197.7,base,z+1.48,blue);b(-196.8,base+.56,z+1.48,.35,.09,1.92,light);}
    b(-198.7,base+.014,z,.8,.018,2.8,carpet);sign(partition+.11,base+2.58,z-0.7,1.8,`客房 ${String(i+1).padStart(2,'0')}`,'CABIN',Math.PI/2);
  }
  counter(-203,base,-24,2.8,.8);bench(-202,base,-27,3.8);bench(-196,base,-16,3.2);for(const z of [-20,-25]){solid(-197,base+.46,z,1.35,.92,.90,wood,.07);bench(-198.8,base,z,.65,1.25,false);bench(-195.2,base,z,.65,1.25,false);}b(-198.5,base+.018,-22,7.5,.023,12,carpet);sign(partition+.11,base+2.55,-22,3,'公共休息厅','LOUNGE',Math.PI/2);
  for(const z of [-29.87,-14.13]){b(-198.2,base+.52,z,15.1,.96,.035,teal);b(-198.2,base+1.01,z,15.1,.06,.11,wood);}
  sign(-205.80,base+2.77,-21.5,2.8,'海湾客运','BAY LINE  /  LOUNGE',Math.PI/2);
  for(const z of [-26,-21,-16])b(-198,upper-.23,z,10.2,.065,.13,teal);
  // Medical and luggage service rooms are separated from the landing staircase.
  openingX(-192,-14,3,base,H,[-9,1.5],1.9);wallZ(-14,-199.6,-192,base,H);wallZ(-5,-199.6,-192,base,H);wallX(-199.6,-14,3,base,H);counter(-198,base,-9,1.65,.8);bed(-196.6,base,-11.8,white);counter(-197.8,base,1.6,2.2,.68);for(const [x,z] of [[-196,-2.8],[-198,-2.5]])solid(x,base+.63,z,.84,1.26,.71,blue,.04);
  // Upper deck slab has a true stair well. The stair is a single graded walk surface;
  // tread strips add geometry without changing the continuous collision.
  const stairX1=-204,stairX2=-200,stairLow=1,stairHigh=-13;
  slab(x1,x2,z1,stairHigh,upper,m.concrete);slab(x1,stairX1,stairHigh,stairLow,upper,m.concrete);slab(stairX2,x2,stairHigh,stairLow,upper,m.concrete);slab(x1,x2,stairLow,z2,upper,m.concrete);
  const g=(upper-base)/(stairHigh-stairLow);incline(stairX1,stairX2,stairHigh,stairLow,2,stairLow,base,g,navy);
  for(let z=stairHigh+.22;z<stairLow;z+=.52)b(-202,base+(z-stairLow)*g+.025,z,3.65,.025,.10,safety);for(const x of [stairX1+.07,stairX2-.07]){strut(group,teal,new THREE.Vector3(x,upper+.87,stairHigh),new THREE.Vector3(x,base+.87,stairLow),.075);}
  for(const x of [stairX1,stairX2])rail(x,stairHigh+.1,x,stairLow,upper);rail(stairX1,stairLow,stairX2,stairLow,upper);
  for(const x of [x1,x2])rail(x+.03*(x===x1?1:-1),z1,x+.03*(x===x1?1:-1),z2,upper);for(const z of [z1,z2])rail(x1,z,x2,z,upper);
  for(let z=-65;z<4;z+=5){b(-188.75,upper+.009,z,.075,.018,3.8,teal);if(z%2===0)lamp(-188.6,upper-.26,z);}
  // Upper lookout, shaded service room, deck seats and a closed bridge silhouette.
  const ux1=-203,ux2=-193,uz1=-65,uz2=-54;wallX(ux1,uz1,uz2,upper,2.85);openingX(ux2,uz1,uz2,upper,2.85,[-59],2.2);wallZ(uz1,ux1,ux2,upper,2.85);wallZ(uz2,ux1,ux2,upper,2.85);slab(ux1-.15,ux2+.15,uz1-.15,uz2+.15,upper+2.95,white);counter(-199,upper,-59,2.0,.7);lamp(-198.5,upper+2.67,-59);sign(ux2+.13,upper+2.47,-59,2.7,'甲板服务室','DECK SERVICE',Math.PI/2);
  counter(-192.8,upper,-19,1.8,.74);for(const z of [-44,-38,-32,-26])bench(-197,upper,z,3.1,.74);for(const z of [-47,-23]){solid(-204.9,upper+1.27,z,.15,2.54,.15,teal);solid(-190.5,upper+1.27,z,.15,2.54,.15,teal);}
  for(const z of [-59,-35,-9]){const ring=mesh(group,new THREE.TorusGeometry(.36,.08,8,24),coral);ring.rotation.y=Math.PI/2;ring.position.set(x2-.16,upper+.72,z);for(const dz of [-.32,.32])b(x2-.16,upper+.72,z+dz,.18,.12,.12,white,.02);}
  b(-197.7,upper+2.66,-35,14.7,.18,24.5,white,.05);for(let z=-45;z<-24;z+=3.8)b(-197.7,upper+2.54,z,14.3,.06,.12,teal);
  solid(-197.7,upper+1.9,-67.2,10.9,3.7,3.0,white,.13);b(-197.7,upper+2.65,-65.65,9.7,.86,.08,blue,.04);b(-197.7,upper+3.79,-67.2,12,.17,3.4,teal,.08);cylinder(group,navy,.13,5.6,-197.7,upper+6.5,-67.2,12);b(-197.7,upper+8.1,-67.2,2.4,.17,.2,white);sign(-197.5,upper+3.12,-65.6,5,'海湾号','BAY LINE');
  for(let z=-65;z<5;z+=6){lamp(-188.7,upper-.27,z);if(z<-14)lamp(-198,upper-.27,z);}

  // Landside terminal: distinctive glass-fronted waiting hall with two portals.
  const tx1=-153,tx2=-122,tz1=-96,tz2=-73;
  wallX(tx1,tz1,tz2,0,3.8,white);wallX(tx2,tz1,tz2,0,3.8,white);openingZ(tz1,tx1,tx2,0,3.8,-137.5,4.5,white);openingZ(tz2,tx1,tx2,0,3.8,-137.5,4.5,white);
  b(-137.5,.016,-84.5,30.6,.035,22.7,carpet);solid(-137.5,4.0,-84.5,32,.4,24.0,white,.055);b(-137.5,4.36,-84.5,33,.3,24.7,teal,.08);for(const z of [tz1,tz2]){for(const x of [-149,-145,-130,-126])b(x,2.35,z+(z===tz1?-.105:.105),3.1,1.8,.035,blue);sign(-137.5,3.24,z+(z===tz1?-.22:.22),7,'客运候船厅','PASSENGER TERMINAL',z===tz1?Math.PI:0);}
  counter(-149,0,-83,3.3,.9);counter(-128,0,-90,3.6,.9);for(const z of [-90,-86,-80,-77]){bench(-144,0,z,3.1);bench(-131,0,z,3.1);}for(const x of [-147,-128])for(const z of [-91,-79])lamp(x,3.75,z);
  for(const x of [-150,-146,-129,-125])b(x,.02,-71.7,.18,.025,2.5,safety);
  // Repair shed has open frontage and an independent work surface.
  const rx1=-169,rx2=-158,rz1=19,rz2=35;wallX(rx1,rz1,rz2,0,3.2,navy);wallX(rx2,rz1,rz2,0,3.2,navy);wallZ(rz2,rx1,rx2,0,3.2,navy);for(const x of [rx1+.25,rx2-.25])solid(x,1.6,rz1,.27,3.2,.30,navy);solid(-163.5,3.34,27,11.8,.25,16.7,teal);sign(-163.5,2.96,18.78,4.3,'装卸维修工棚','MAINTENANCE',Math.PI);counter(-166,0,31.4,2.4,.95);for(const z of [24,27,33])solid(-168.25,.62,z,.82,1.24,.85,navy,.045);
  // Dispatch office: ground floor and an open two-storey stair/landing.
  const dx1=-154,dx2=-130,dz1=37,dz2=54,dy=3.48;wallX(dx1,dz1,dz2,0,3.28,white);wallX(dx2,dz1,dz2,0,3.28,white);openingZ(dz1,dx1,dx2,0,3.28,-141,3.2);openingZ(dz2,dx1,dx2,0,3.28,-141,3.2);counter(-150,0,49.5,2.6,.76);bench(-134,0,41,3.0);sign(-141,2.88,36.81,4.5,'港务调度','DISPATCH',Math.PI);
  const sx=-152,ex=-148,lo=39,hi=51,grad=dy/(hi-lo);incline(sx,ex,lo,hi,2,lo,0,grad,navy);for(let z=lo+.25;z<hi;z+=.55)b(-150,(z-lo)*grad+.025,z,3.65,.025,.095,safety);
  slab(dx1,dx2,hi,dz2,dy,m.concrete);slab(dx1,sx,dz1,hi,dy,m.concrete);slab(ex,dx2,dz1,hi,dy,m.concrete);slab(sx,ex,dz1,lo,dy,m.concrete);rail(sx,lo,sx,hi-.05,dy);rail(ex,lo,ex,hi-.05,dy);rail(sx,lo,ex,lo,dy);
  wallX(dx1,dz1,dz2,dy,3.0,teal);wallX(dx2,dz1,dz2,dy,3.0,white);wallZ(dz1,dx1,dx2,dy,3.0,teal);wallZ(dz2,dx1,dx2,dy,3.0,white);solid(-142,dy+3.13,45.5,24.6,.26,17.6,white);counter(-137,dy,49.8,2.9,.8);bench(-138,dy,42,3.2);for(const x of [-150,-146,-138,-134]){b(x,dy+1.76,dz1-.105,3.1,1.2,.035,blue);b(x,dy+1.76,dz2+.105,3.1,1.2,.035,blue);}lamp(-139,dy+2.8,49);
}
