import * as THREE from 'three';
import type { ShotTrace } from '../contracts/demo.ts';

// Keep consecutive impacts alive independently. Nothing in this visual pool changes the resolved hit.
export function createShotEffects(root:THREE.Group){
  const ribbon=new THREE.CylinderGeometry(.55,1,1,6),chip=new THREE.OctahedronGeometry(1,0);
  const disc=new THREE.RingGeometry(.60,1,14),mark=new THREE.CircleGeometry(1,8);
  const up=new THREE.Vector3(0,1,0),front=new THREE.Vector3(0,0,1),pose=new THREE.Object3D();
  const ink=(color:number,add=false)=>new THREE.MeshBasicMaterial({color,transparent:true,depthWrite:false,
    blending:add?THREE.AdditiveBlending:THREE.NormalBlending});
  function emitter(){
    const streak=new THREE.Mesh(ribbon,ink(0xffe9ab,true)),flare=new THREE.Mesh(disc,ink(0xffc889,true));
    const chips=new THREE.InstancedMesh(chip,ink(0xffc889),9),scuff=new THREE.Mesh(mark,ink(0x42495a));
    chips.frustumCulled=false;
    root.add(streak,flare,chips,scuff);
    const start=new THREE.Vector3(),end=new THREE.Vector3(),dir=new THREE.Vector3(),normal=new THREE.Vector3();
    const u=new THREE.Vector3(),v=new THREE.Vector3();
    let age=0,length=0,travel=0,active=false,angle=0,surface:ShotTrace['surface']='air';
    function hide(){streak.visible=flare.visible=chips.visible=scuff.visible=false;}
    hide();
    function update(dt:number){
      if(!active)return;
      age+=dt;
      const head=Math.min(length,age*410+.26),tail=Math.max(0,head-Math.min(7,length*.74));
      const t=age-travel;
      streak.visible=length>.15 && t<.050;
      if(streak.visible){
        streak.position.copy(start).addScaledVector(dir,(head+tail)*.5);
        const width=.011+Math.min(.026,head*.00065);
        streak.scale.set(width,Math.max(.001,head-tail),width);
        streak.material.opacity=.96*(1-THREE.MathUtils.clamp(t/.050,0,1));
      }
      const metal=surface==='security-bot',organic=surface==='infected';
      flare.visible=surface!=='air' && t>=0 && t<.115;
      if(flare.visible){flare.scale.setScalar((organic?.055:.04)+t*(metal?1.9:1.15));flare.material.opacity=.88*(1-t/.115);}
      const life=organic?.21:metal?.31:.27;
      chips.visible=surface!=='air' && t>=0 && t<life;
      if(chips.visible){
        chips.material.opacity=1-t/life;
        for(let i=0;i<chips.count;i++){
          const a=i*2.4+angle,k=(1.1+i%4*.48)*t;
          pose.position.copy(end).addScaledVector(normal,.022+t*(1.3+i%3*.52)).addScaledVector(u,Math.cos(a)*k).addScaledVector(v,Math.sin(a)*k);
          pose.position.y-=3.4*t*t;pose.rotation.set(a+t*6,a*.6,t*9);
          pose.scale.set(organic?.036:.018,metal?.095:organic?.047:.040,.021).multiplyScalar(1-.66*t/life);
          pose.updateMatrix();chips.setMatrixAt(i,pose.matrix);
        }
        chips.instanceMatrix.needsUpdate=true;
      }
      scuff.visible=surface==='cover' && !!traceNormal && t>=0 && t<.72;
      if(scuff.visible)scuff.material.opacity=.52*Math.min(1,(.72-t)/.24);
      if(t>=.74){active=false;hide();}
    }
    let traceNormal=false;
    return {update,fire(trace:ShotTrace,rotation:number){
      active=true;age=0;angle=rotation;surface=trace.surface;traceNormal=!!trace.normal;
      start.set(...trace.from);end.set(...trace.to);dir.subVectors(end,start);length=dir.length();dir.normalize();
      travel=length/410;normal.copy(dir).negate();if(trace.normal)normal.set(...trace.normal);
      streak.quaternion.setFromUnitVectors(up,dir);
      u.copy(Math.abs(normal.y)<.9?up:front).cross(normal).normalize();v.crossVectors(normal,u);
      const color=surface==='infected'?0x76e9c9:surface==='security-bot'?0xa3dcff:0xffbd77;
      chips.material.color.setHex(color);flare.material.color.setHex(color);
      flare.position.copy(end).addScaledVector(normal,.014);flare.quaternion.setFromUnitVectors(front,normal);
      scuff.position.copy(flare.position);scuff.quaternion.copy(flare.quaternion);scuff.rotateZ(angle);scuff.scale.set(.065,.052,1);
      update(0);
    }};
  }
  const pool=Array.from({length:4},emitter);
  const brass=new THREE.CylinderGeometry(.006,.007,.025,7),metal=new THREE.MeshBasicMaterial({color:0xffb95e});
  const cases=Array.from({length:3},()=>{
    const mesh=new THREE.Mesh(brass,metal);mesh.visible=false;root.add(mesh);
    return {mesh,age:1,velocity:new THREE.Vector3()};
  });
  let serial=0;
  return {
    update(dt:number){
      for(const e of pool)e.update(dt);
      for(const c of cases){
        if(!c.mesh.visible)continue;
        c.age+=dt;c.mesh.visible=c.age<.28;
        c.velocity.y-=7*dt;c.mesh.position.addScaledVector(c.velocity,dt);
        c.mesh.rotation.x+=dt*18;c.mesh.rotation.z+=dt*11;
      }
    },
    fire(trace:ShotTrace,port?:THREE.Vector3,yaw=0){
      if(port){
        const c=cases[serial%cases.length];c.age=0;c.mesh.visible=true;c.mesh.position.copy(port);
        c.mesh.rotation.set(.7,0,serial*2.4);c.velocity.set(Math.cos(yaw)*1.5,1.1,-Math.sin(yaw)*1.5);
      }
      pool[serial%pool.length].fire(trace,serial++*2.39996);
    },
  };
}
