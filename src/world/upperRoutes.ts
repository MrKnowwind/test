import * as THREE from 'three';
import type { MapInteraction, Vec3 } from '../contracts/demo.ts';
import { enamel, emissive, type Materials } from './detail/materialLibrary.ts';
import { box, cylinder, strut } from './detail/geometry.ts';
import type { Solid } from './worldQueries.ts';

type Builder = (at:Vec3,size:Vec3,material:THREE.Material,bevel?:number)=>THREE.Mesh;
export const freightHalls=[
  [-4,8,24,26,0],[90,-32,32,36,2],
  [7,-113,30,24,4],[-45,63,22,16,6],
] as const;

export function upperRoutes(root:THREE.Group,m:Materials,solid:Builder,solids:Solid[]){
  const scannerPaint=enamel(0x438e94), scannerLight=emissive(0xa2eee3,.5);
  function bar(a:Vec3,b:Vec3,w:number,mat=m.steel){
    return strut(root,mat,new THREE.Vector3(...a),new THREE.Vector3(...b),w,w);
  }
  function railing(x:number,z:number,y:number,span:number,alongX:boolean,mat=m.safety){
    if(span<.15)return;
    const dims=(l:number,h:number,t:number):Vec3=>alongX?[l,h,t]:[t,h,l];
    solid([x,y+.93,z],dims(span,.095,.09),mat,0);
    box(root,m.zinc,...dims(span,.055,.06),x,y+.49,z);
    const bays=Math.max(1,Math.ceil(span/2.55));
    for(let i=0;i<=bays;i++){
      const offset=span*(i/bays-.5);
      box(root,m.steel,.075,.92,.075,x+(alongX?offset:0),y+.46,z+(alongX?0:offset));
    }
  }
  function stair(x:number,lowZ:number,highZ:number,width:number,height:number){
    const direction=Math.sign(highZ-lowZ);
    const steps=Math.ceil(height/.185),dz=(highZ-lowZ)/steps;
    // A continuous collision slope lets ordinary walking follow the visible treads in both directions.
    solids.push({min:[x-width/2,-.16,Math.min(lowZ,highZ)],max:[x+width/2,0,Math.max(lowZ,highZ)],
      floor:true,walkSurface:true,surface:'metal',slope:{axis:2,start:lowZ,height:0,gradient:height/(highZ-lowZ)}});
    for(let i=0;i<steps;i++){
      const y=(i+.5)*height/steps,z=lowZ+(i+.5)*dz;
      box(root,m.steel,width,.135,Math.abs(dz)+.007,x,y-.06,z);
      box(root,i%4===0?m.safety:m.zinc,width-.08,.017,.047,x,y+.012,z-direction*(Math.abs(dz)/2-.025));
    }
    for(const side of [-1,1]){
      const sx=x+side*(width/2-.04);
      bar([sx,-.13,lowZ],[sx,height-.13,highZ],.18);
      bar([sx,.91,lowZ],[sx,height+.91,highZ],.08,m.safety);
      for(let i=0;i<=4;i++)box(root,m.zinc,.06,.89,.06,sx,height*i/4+.44,lowZ+(highZ-lowZ)*i/4);
    }
  }
  function floor(x:number,z:number,w:number,d:number,top:number){
    box(root,m.steel,w,.26,d,x,top-.13,z).castShadow=true;
    solids.push({min:[x-w/2,top-.26,z-d/2],max:[x+w/2,top,z+d/2],walkSurface:true,surface:'metal'});
    box(root,m.zinc,w-.07,.016,d-.07,x,top+.006,z);
  }
  function warehouse(x:number,z:number,w:number,d:number,index:number,cases:MapInteraction[]){
    const y=3.12,sideX=x+w/2-1.5,west=x-w/2+1.75,north=z-d/2,south=z+d/2;
    const low=north+1.2,high=low+6.85,bridge=south-2.1,sideW=2.4;
    stair(sideX,low,high,2.12,y);
    floor(sideX,(high+bridge)/2,sideW,bridge-high,y);
    floor((west+sideX)/2,bridge,sideX-west+sideW,2.55,y);
    railing(sideX-sideW/2,(bridge-1.275+high)/2,y,bridge-1.275-high,false);
    railing((west+sideX)/2,bridge+1.23,y,sideX-west+2.34,true);
    railing((west+sideX-2.4)/2,bridge-1.23,y,sideX-west-.03,true);
    for(const px of [west,sideX])for(const pz of [bridge-1.04,bridge+1.04])
      solid([px,.5*y,pz],[.17,y,.17],m.steel,0);
    railing(west-1.15,bridge,y,2.43,false);
    solid([west,y+.40,bridge],[1.44,.80,.78],m.ceramic,.045);
    cases.push({kind:'loot',id:'freight-loft-'+index,label:x > 75 ? '夹层设备验收台' : '夹层签收台',item:x > 75 ? 'board' : 'manual',quantity:1,position:[west,y+1.04,bridge]});
    // Separate cargo handling and inspection from the straight-through loading lane.
    const beltX=x-w*.24,beltZ=index===0?z+.1:z+.7;
    const beltL=index===0?3.5:Math.min(d*.32,6.8);
    solid([beltX,.59,beltZ],[1.45,.27,beltL],m.steel,.045);
    for(const end of [-1,1]){
      const pz=beltZ+end*(beltL/2-.25);
      solid([beltX,.23,pz],[1.18,.46,.19],m.safety,0);
    }
    for(let i=0;i<Math.floor(beltL/.26);i++){
      const roller=cylinder(root,m.zinc,.081,1.32,beltX,.79,beltZ-beltL/2+.17+i*.26,8);
      roller.rotation.z=Math.PI/2;
    }
    for(const dir of [-1,1]){
      const pz=beltZ+dir*beltL*.23;
      const h=dir>0?.55:.72;solid([beltX,.88+h/2,pz],[.87,h,.77],dir>0?m.ceramic:m.timber,.035);
      box(root,m.rubber,.094,h+.024,.79,beltX+.20,.88+h/2,pz);
    }
    const scanZ=beltZ-beltL*.43;
    for(const side of [-1,1]){
      const footX=beltX+side*.9;
      solid([footX,1.08,scanZ],[.28,2.16,.52],scannerPaint,.04);
      box(root,m.safety,.31,.25,.55,footX,.32,scanZ);
      box(root,m.rubber,.20,.56,.035,footX,1.53,scanZ-.276);
    }
    solid([beltX,2.22,scanZ],[2.09,.39,.60],scannerPaint,.055);
    box(root,scannerLight,1.44,.055,.12,beltX,2.015,scanZ);
    box(root,m.ceramic,.87,.135,.035,beltX,2.23,scanZ-.31);
    // A pair of returnable freight pods occupies a clear side bay when one fits.
    for(const fraction of [.18,-.20,.32,-.35]){
      const px=x+w*.24,pz=z+d*fraction;
      if(Math.abs(px-x)<3.7 || solids.some(s=>!s.floor && s.min[1]<2.55 && s.max[1]>.1 &&
        px-1.57<s.max[0] && px+1.57>s.min[0] && pz-1.48<s.max[2] && pz+1.48>s.min[2]))continue;
      solid([px,.11,pz],[2.67,.22,2.27],m.timber,.04);
      for(let level=0;level<2;level++){
        const cy=.76+level*1.05;
        solid([px,cy,pz],[2.48,1.03,1.88],level?m.ceramic:scannerPaint,.10);
        for(const dx of [-.86,.86])box(root,m.steel,.14,1.055,1.91,px+dx,cy,pz,.015);
        box(root,m.safety,.46,.22,.035,px,cy+.05,pz-.95);
      }
      break;
    }
    const beamZ=z-d*.13;
    box(root,m.safety,w-.85,.30,.42,x,5.43,beamZ);
    box(root,m.steel,w-.9,.11,.55,x,5.22,beamZ);
    const hoist=x+w*.22;
    box(root,m.zinc,1.34,.45,.79,hoist,5.02,beamZ,.06);
    for(const dx of [-.34,.34])box(root,m.steel,.045,.63,.045,hoist+dx,4.49,beamZ);
    box(root,m.safety,1.23,.17,.25,hoist,4.12,beamZ);
    for(const sx of [-1,1])for(let i=0;i<Math.floor(d/2.6);i++)
      box(root,m.safety,.09,.014,1.64,x+sx*2.2,.031,north+1.5+2.6*i);
  }
  return {warehouse};
}
