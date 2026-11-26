import * as THREE from 'three';
import {box,cylinder,mesh,strut} from './detail/geometry.ts';
import {enamel,emissive,type Materials} from './detail/materialLibrary.ts';
import {northTerrace,terrainHeight,houses} from './terrainPlan.ts';
import type {Solid,Slope} from './worldQueries.ts';

// Constructed north-west relief and differentiated civic/household buildings.
// Rendered surfaces, collision and search locations share the authored dimensions.
export function buildNorthTerrace(root:THREE.Group,m:Materials,solids:Solid[]){
  const p=northTerrace,w=p.maxX-p.minX,flatDepth=p.crestZ-p.minZ,slopeDepth=p.maxZ-p.crestZ;
  const cx=(p.minX+p.maxX)/2,soil=enamel(0x819889),face=enamel(0x9ba7ab);
  box(root,soil,w,p.height+.36,flatDepth,cx,(p.height-.36)/2,(p.minZ+p.crestZ)/2).castShadow=true;
  solids.push({min:[p.minX,-.36,p.minZ],max:[p.maxX,p.height,p.crestZ],floor:true,walkSurface:true});
  const g=new THREE.BoxGeometry(w,1,slopeDepth);g.translate(cx,0,(p.crestZ+p.maxZ)/2);
  const a=g.getAttribute('position');for(let i=0;i<a.count;i++)a.setY(i,a.getY(i)>0?terrainHeight(a.getX(i),a.getZ(i))??0:-.36);
  g.computeVertexNormals();mesh(root,g,soil).castShadow=true;
  const profile:Slope={axis:2,start:p.maxZ,height:0,gradient:-p.height/slopeDepth};
  solids.push({min:[p.minX,-p.height-.36,p.crestZ],max:[p.maxX,0,p.maxZ],floor:true,walkSurface:true,slope:profile});
  // Retaining wall caps and articulated facing, grounded against the hillside.
  for(const x of [p.minX,p.maxX])for(let z=p.minZ+2;z<p.maxZ-1;z+=4){
    const h=terrainHeight(x,z)??0;if(h<.3)continue;
    box(root,face,.22,h,3.96,x,h/2,z,.015);
    box(root,m.steel,.28,.13,3.93,x,h-.22,z);
  }
  box(root,m.concrete,w,.48,.35,cx,p.height-.24,p.minZ);
  const railMat=enamel(0x4e716f);
  // Guard physical crest and steep sides, leaving the southern graded entrance open.
  const rail=(x1:number,z1:number,x2:number,z2:number)=>{
    const d=Math.hypot(x2-x1,z2-z1),steps=Math.ceil(d/2.5);
    for(let i=0;i<steps;i++){
      const t=i/steps,u=(i+1)/steps,ax=x1+(x2-x1)*t,az=z1+(z2-z1)*t,bx=x1+(x2-x1)*u,bz=z1+(z2-z1)*u;
      const ay=terrainHeight(ax,az)??0,by=terrainHeight(bx,bz)??0;
      box(root,m.zinc,.09,1.05,.09,ax,ay+.52,az);
      strut(root,railMat,new THREE.Vector3(ax,ay+1,az),new THREE.Vector3(bx,by+1,bz),.075);
      strut(root,m.zinc,new THREE.Vector3(ax,ay+.55,az),new THREE.Vector3(bx,by+.55,bz),.05);
      solids.push({min:[Math.min(ax,bx)-.04,Math.min(ay,by),Math.min(az,bz)-.04],max:[Math.max(ax,bx)+.04,Math.max(ay,by)+1.03,Math.max(az,bz)+.04]});
    }
  };
  rail(p.minX+.4,p.minZ+.5,p.maxX-.4,p.minZ+.5);
  rail(p.minX+.4,p.minZ+.5,p.minX+.4,-119);rail(p.maxX-.4,p.minZ+.5,p.maxX-.4,-119);
  // Graded shoulders follow the same physical surface, and coastal vegetation
  // breaks the large slope into clear visual distances without bending the road.
  for(const x of [-120.66,-109.34])for(const [a,c] of [[p.minZ,p.crestZ],[p.crestZ,p.maxZ]]){
    const g=new THREE.BoxGeometry(1.19,.027,c-a);g.translate(x,.018,(a+c)/2);const v=g.getAttribute('position');for(let i=0;i<v.count;i++)v.setY(i,v.getY(i)+(terrainHeight(v.getX(i),v.getZ(i))??0));g.computeVertexNormals();mesh(root,g,m.concrete);
  }
  const leaf=enamel(0x517f67),tip=enamel(0x8fb28b),stone=enamel(0x7d9292),foliage=new THREE.IcosahedronGeometry(1,1);
  const tree=(x:number,z:number,h:number)=>{const yy=terrainHeight(x,z)??0;cylinder(root,m.timber,.12,h*.72,x,yy+h*.36,z,9);solids.push({min:[x-.15,yy,z-.15],max:[x+.15,yy+h*.73,z+.15]});for(const [dx,dz,dy,r] of [[0,0,.72,.39],[-.65,.25,.57,.29],[.56,-.24,.84,.28]]){const o=mesh(root,foliage,dy>.8?tip:leaf,x+dx,yy+h*dy,z+dz);o.scale.set(h*r,h*r*.8,h*r*.95);}};
  for(const [x,z,h] of [[-150,-120,3.8],[-139,-129,4.4],[-151,-142,4.8],[-135,-151,3.1],[-148,-163,4.3],[-106,-149,2.7],[-155,-195,3.5],[-155,-209,4.3]])tree(x,z,h);
  for(const [i,[x,z]] of [[-145,-125],[-153,-133],[-132,-137],[-144,-146],[-158,-157],[-129,-162],[-106,-125],[-106,-177],[-155,-199]].entries()){
    const yy=terrainHeight(x,z)??0;for(let j=0;j<3;j++){const dx=(j-1)*.85,r=.46+(i+j)%3*.16;const s=mesh(root,foliage,j===0?stone:leaf,x+dx,yy+r*.40,z+j*.46);s.scale.set(r,r*.65,r*.85);}
  }
  for(const z of [-123,-146,-164,-193,-208]){const x=-121.9,yy=terrainHeight(x,z)??0;box(root,m.steel,.17,5.5,.18,x,yy+2.75,z);box(root,m.steel,1.38,.10,.16,x+.58,yy+5.4,z);box(root,m.zinc,.43,.15,.32,x+1.18,yy+5.28,z,.045);solids.push({min:[x-.10,yy,z-.10],max:[x+.10,yy+5.5,z+.10]});}
}

export function buildCivicDistrict(root:THREE.Group,m:Materials,solids:Solid[]){
  const group=new THREE.Group();group.name='civic-3.5C-first';root.add(group);
  const cream=enamel(0xe0dac1),sand=enamel(0xc8b494),brick=enamel(0xb66f64),sage=enamel(0x7caa91),slate=enamel(0x455d70),glass=enamel(0x52798b),blue=enamel(0x627da5),purple=enamel(0x877bb1),wood=enamel(0xa78763),light=emissive(0xe7f3d3,.45),green=enamel(0x4b906e);
  const b=(x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material,bevel=0)=>box(group,mat,w,h,d,x,y,z,bevel);
  function solid(x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material,bevel=0){const o=b(x,y,z,w,h,d,mat,bevel);o.castShadow=true;solids.push({min:[x-w/2,y-h/2,z-d/2],max:[x+w/2,y+h/2,z+d/2]});return o;}
  function slab(x1:number,x2:number,z1:number,z2:number,y:number,mat=wood){b((x1+x2)/2,y-.11,(z1+z2)/2,x2-x1,.22,z2-z1,mat);solids.push({min:[x1,y-.22,z1],max:[x2,y,z2],floor:true,walkSurface:true,surface:'concrete'});}
  function wallX(x:number,z1:number,z2:number,y:number,h:number,mat:THREE.Material){if(z2-z1>.01)solid(x,y+h/2,(z1+z2)/2,.21,h,z2-z1,mat);}
  function wallZ(z:number,x1:number,x2:number,y:number,h:number,mat:THREE.Material){if(x2-x1>.01)solid((x1+x2)/2,y+h/2,z,x2-x1,h,.21,mat);}
  function entryX(x:number,z1:number,z2:number,y:number,h:number,z:number,w:number,mat:THREE.Material){wallX(x,z1,z-w/2,y,h,mat);wallX(x,z+w/2,z2,y,h,mat);solid(x,y+2.3+(h-2.3)/2,z,.23,h-2.3,w,mat);for(const dz of [-w/2,w/2])b(x,y+1.15,z+dz,.30,2.3,.12,slate);}
  function counter(x:number,y:number,z:number,w=2.4,d=.9,mat=slate){solid(x,y+.47,z,w,.94,d,mat,.045);b(x,y+.98,z,w+.08,.045,d+.07,wood,.02);for(const dx of [-w*.29,w*.29])b(x+dx,y+.54,z+d/2+.015,w*.24,.46,.025,cream,.025);}
  function seat(x:number,y:number,z:number,w=2.6,mat=sage){solid(x,y+.39,z,w,.78,.88,mat,.08);b(x,y+.63,z-.32,w,.47,.20,slate,.035);}
  function bed(x:number,y:number,z:number,mat=sage){solid(x,y+.26,z,1.4,.52,2.1,slate,.03);b(x,y+.60,z,1.35,.16,2.03,cream,.05);b(x,y+.72,z+.33,1.32,.08,1.26,mat,.03);b(x,y+.77,z-.62,1.24,.16,.52,cream,.04);}
  function lamp(x:number,y:number,z:number){b(x,y,z,1.3,.08,.22,light,.02);const l=new THREE.PointLight(0xe5f6dd,22,8,1.7);l.position.set(x,y-.15,z);group.add(l);}
  function ramp(x1:number,x2:number,z1:number,z2:number,axis:0|2,start:number,y:number,grade:number){const slope:Slope={axis,start,height:y,gradient:grade};const g=new THREE.BoxGeometry(x2-x1,.18,z2-z1);g.translate((x1+x2)/2,-.09,(z1+z2)/2);const p=g.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+y+((axis===0?p.getX(i):p.getZ(i))-start)*grade);g.computeVertexNormals();mesh(group,g,slate);solids.push({min:[x1,-.18,z1],max:[x2,0,z2],floor:true,walkSurface:true,slope,surface:'concrete'});}
  function rail(x1:number,z1:number,x2:number,z2:number,y:number){const a=new THREE.Vector3(x1,y+1,z1),c=new THREE.Vector3(x2,y+1,z2);strut(group,m.zinc,a,c,.07);const n=Math.max(1,Math.ceil(a.distanceTo(c)/2));for(let i=0;i<=n;i++){const p=a.clone().lerp(c,i/n);b(p.x,y+.5,p.z,.07,1,.07,m.zinc);}solids.push({min:[Math.min(x1,x2)-.04,y,Math.min(z1,z2)-.04],max:[Math.max(x1,x2)+.04,y+1,Math.max(z1,z2)+.04]});}

  // N1: inspection hall on the actual eight metre terrace, broad public entrances,
  // low glass clerestory and separated office furnishings.
  const y=northTerrace.height, nx1=-153,nx2=-127,nz1=-190,nz2=-168;
  b((nx1+nx2)/2,y+.014,(nz1+nz2)/2,26,.028,22,m.concrete);
  entryX(nx1,nz1,nz2,y,4.8,-179,3.6,slate);entryX(nx2,nz1,nz2,y,4.8,-179,3.6,cream);
  wallZ(nz1,nx1,nx2,y,4.8,cream);wallZ(nz2,nx1,nx2,y,4.8,cream);
  solid(-140,y+4.97,-179,27.1,.32,23.4,slate,.045);
  const canopy=b(-140,y+5.43,-179,27.8,.34,24.0,purple,.08);canopy.rotation.x=.045;
  for(const z of [-187,-181,-175]){b(nx2+.13,y+3.45,z,.045,1.1,4.7,glass,.035);b(nx1-.13,y+3.45,z,.045,1.1,4.7,glass,.03);}
  for(const x of [-149,-143,-137,-131])for(const z of [nz1,nz2])b(x,y+3.4,z+(z===nz1?-.13:.13),4.6,1.15,.045,glass,.04);
  for(const x of [nx1,nx2]){for(const [a,c] of [[nz1,-181],[-177,nz2]]){b(x+(x===nx1?-.13:.13),y+.49,(a+c)/2,.08,.88,c-a,slate);for(let z=a+1;z<c-.5;z+=2.8)b(x+(x===nx1?-.17:.17),y+1.94,z,.085,2.12,.13,slate);}b(x+(x===nx1?-.85:.85),y+3.54,-179,2.8,.18,5.1,purple,.06);}
  counter(-149,y,-179,3.5,1.1);counter(-136,y,-185,3.4,.95);for(const x of [-146,-138,-132])seat(x,y,-172.1,3.1,blue);
  for(const x of [-147,-140,-133])for(const z of [-185.7,-173.6])lamp(x,y+4.60,z);
  b(-140,y+.019,-179,18.4,.018,3.2,sage);for(const z of [-183.2,-175.1])b(-140,y+.025,z,19,.013,.12,m.safety);
  for(const z of [-184,-174])solid(-124.6,y+.48,z,.30,.96,.30,m.steel,.04);

  // N5 early exploration anchor: an observation station with a usable upper room.
  const ox1=-153,ox2=-129,oz1=-213,oz2=-196,top=y+3.4;
  wallZ(oz1,ox1,ox2,y,3.2,slate);wallZ(oz2,ox1,ox2,y,3.2,slate);wallX(ox1,oz1,oz2,y,3.2,cream);entryX(ox2,oz1,oz2,y,3.2,-204,3.0,cream);
  counter(-141,y,-204,3.1,.9);seat(-139,y,-199,3.0,blue);
  // Interior stair is along north wall and the second storey slab leaves a true well.
  const sx1=-150,sx2=-145,low=-198,high=-211,grade=(top-y)/(high-low);
  ramp(sx1,sx2,high,low,2,low,y,grade);for(let z=high+.26;z<low;z+=.55)b(-147.5,y+(z-low)*grade+.022,z,4.65,.026,.10,m.safety);
  slab(ox1,sx1,oz1,oz2,top,m.concrete);slab(sx2,ox2,oz1,oz2,top,m.concrete);slab(sx1,sx2,oz1,high,top,m.concrete);slab(sx1,sx2,low,oz2,top,m.concrete);
  rail(sx1,high,sx1,low,top);rail(sx2,high,sx2,low,top);rail(sx1,low,sx2,low,top);
  wallX(ox1,oz1,oz2,top,3.1,cream);wallX(ox2,oz1,oz2,top,3.1,cream);wallZ(oz1,ox1,ox2,top,3.1,slate);wallZ(oz2,ox1,ox2,top,3.1,slate);
  counter(-141,top,-204,3.2,.8,blue);for(const z of [-209,-201]){b(ox2+.12,top+1.9,z,.04,1.8,5.8,glass,.04);b(ox1-.12,top+1.9,z,.04,1.8,5.8,glass,.04);}
  for(const x of [-149,-142,-135])for(const z of [oz1,oz2])b(x,top+1.9,z+(z===oz1?-.13:.13),5.2,1.8,.045,glass,.04);
  solid(-141,top+3.25,-204.5,25.1,.3,18.1,purple,.08);const antenna=cylinder(group,slate,.15,5.7,-141,top+6.1,-204.5,12);antenna.castShadow=true;
  const disk=cylinder(group,cream,2.8,.28,-141,top+5.0,-204.5,32);disk.rotation.z=.27;
  for(const z of [-208,-201])lamp(-141,top+2.85,z);

  // S1: three attached houses share only the structure; interiors and roof lines are individual.
  for(const [i,h] of houses.entries()){
    const z=h.z,a=z-4.5,c=z+4.5,x1=-144,x2=-126,f=3.2,accent=[sage,brick,blue][i];
    const exterior=[cream,sand,cream][i];
    entryX(x2,a,c,0,3.0,z,2.4,exterior);wallX(x1,a,c,0,3.0,exterior);wallZ(a,x1,x2,0,3.0,exterior);if(i===houses.length-1)wallZ(c,x1,x2,0,3.0,exterior);
    b(-135,.016,z,17.6,.026,8.7,i===2?m.concrete:wood);b(-125.7,.03,z,1.2,.06,3.6,m.concrete);
    b(-127,2.76,z,2.8,.16,3.8,accent,.05);
    counter(-136,0,z,2.8,.85,accent);
    if(i===0){
      seat(-130,0,z+2.3,3.1,sage);for(const x of [-131.5,-128.5])b(x,.67,z+2.3,.24,.40,.86,sage,.08);solid(-137,.35,z+2.5,1.8,.7,1.1,wood,.04);b(-137,.72,z+2.5,1.7,.065,1.05,cream,.03);b(-132,.018,z+2.4,5.3,.024,3.3,accent);b(-143.84,1.6,z+.95,.085,1.1,2.05,slate,.045);b(-143.75,1.6,z+.95,.055,.92,1.88,glass,.03);
    }else if(i===1){
      counter(-130,0,z+2.65,3.8,1.0,cream);solid(-139,.4,z+2.2,2.0,.8,1.1,wood,.045);b(-130.7,1.015,z+2.65,.70,.065,.53,slate,.04);cylinder(group,m.zinc,.065,.36,-130.7,1.17,z+2.92,12);b(-130.7,1.33,z+2.77,.085,.075,.33,m.zinc,.025);for(const dx of [-.40,.38])cylinder(group,m.rubber,.16,.045,-129.15+dx,1.03,z+2.65,16);
      solid(-133.45,.98,z+3.25,.91,1.96,.92,cream,.07);b(-132.96,1.27,z+3.25,.08,.62,.07,m.zinc,.02);
    }else{
      counter(-136,0,z+2.5,3.1,.75,blue);seat(-130,0,z+2.35,2.3,brick);b(-136,1.27,z+2.49,.12,.56,.08,slate);b(-136,1.62,z+2.43,1.0,.65,.12,slate,.04);b(-136,1.62,z+2.35,.85,.51,.025,glass,.03);b(-135.8,1.03,z+2.09,.72,.06,.21,m.zinc,.02);
    }
    const stairA=a+.25,stairC=a+2.7,stairStart=-131,stairEnd=-142,grade=f/(stairEnd-stairStart);
    ramp(stairEnd,stairStart,stairA,stairC,0,stairStart,0,grade);for(let x=stairEnd+.25;x<stairStart;x+=.46)b(x,(x-stairStart)*grade+.025,(stairA+stairC)/2,.09,.026,2.19,m.safety);
    slab(x1,stairEnd,a,c,f);slab(stairStart,x2,a,c,f);slab(stairEnd,stairStart,stairC,c,f);slab(stairEnd,stairStart,a,stairA,f);
    rail(stairEnd,stairC,stairStart,stairC,f);rail(stairStart,stairA,stairStart,stairC,f);
    // Separate upstairs sleeping/study furnishings.
    wallX(x1,a,c,f,2.85,exterior);wallX(x2,a,c,f,2.85,exterior);wallZ(a,x1,x2,f,2.85,exterior);if(i===houses.length-1)wallZ(c,x1,x2,f,2.85,exterior);
    counter(-137,f,z,2.3,.8,accent);bed(-130.3,f,z+1.9,accent);if(i===1)bed(-134,f,z+2.05,sage);else if(i===2)seat(-130.5,f,z-1.8,2,blue);
    solid(-137.8,f+1.04,z+3.40,1.65,2.08,.67,wood,.045);for(const dx of [-.42,.42])b(-137.8+dx,f+1.24,z+3.04,.075,.36,.075,slate,.02);b(-130.2,f+.017,z+.3,3.2,.023,4.2,accent);
    // Distinct street-level windows, deep sills and upper facade framing.
    for(const dz of [-2.75,2.75]){b(x2+.12,1.64,z+dz,.05,1.42,2.1,slate,.045);b(x2+.16,1.65,z+dz,.024,1.21,1.91,glass,.035);b(x2+.19,1.64,z+dz,.07,1.23,.075,cream);b(x2+.21,.88,z+dz,.39,.12,2.23,accent,.04);}
    b(x2+.12,f+1.65,z,.045,1.6,4.3,glass,.035);for(const dz of [-1.38,1.38])b(x2+.19,f+1.65,z+dz,.09,1.65,.10,cream);
    b(x1-.12,f+1.65,z,.045,1.45,3.7,glass,.035);b(x2+.18,f+.83,z,.48,.16,4.7,accent,.04);
    slab(x1-.15,x2+.15,a-.13,c+.13,f+3.02,slate);
    if(i!==2){for(const side of [-1,1]){const roof=b(-135,f+3.77,z+side*2.35,18.7,.17,5.05,accent,.04);roof.rotation.x=side*.32;}b(-135,f+4.50,z,18.9,.18,.23,slate,.045);}else{b(-135,f+3.21,z,18.9,.32,9.5,blue,.08);solid(-139,f+3.91,z,2.0,1.40,1.8,slate,.07);}
    lamp(-135,2.78,z);lamp(-135,f+2.63,z);
    // Individual planters and porch equipment; leave central entries clear.
    for(const dz of [-3.2,3.2]){solid(-124.5,.35,z+dz,1.15,.7,.85,cream,.07);cylinder(group,green,.32,.78,-124.5,1.04,z+dz,10);}
  }
}
