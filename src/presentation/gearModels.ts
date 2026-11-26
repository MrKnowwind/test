import * as THREE from 'three';
import { block, oval, rod } from './modelParts.ts';
import { pigment } from './shell.ts';
import { styleCharacter } from './celShading.ts';
import { makePistol, makeKnife } from './viewmodelModels.ts';
import { isShield, itemSpecs, shields, headDevices, type ShieldId, type HeadId, type ItemId } from '../raid/catalog.ts';
import { setModelIcon } from '../ui/itemArt.ts';

// One shared asset for the equipment portrait, recharge prop and inventory thumbnail.
export function makeGearModel(item:ShieldId|HeadId|'shield-cell') {
  const root=new THREE.Group(),ink=pigment(0x263c50),steel=pigment(0x97b5bc),white=pigment(0xe3ece2);
  if(isShield(item)){
    const color=new THREE.Color(itemSpecs[item].color),shell=pigment(color.getHex()),glow=pigment(color.getHex(),.65);
    block(root,ink,[.36,.36,.075],[0,0,0],.035);
    for(const s of [-1,1]){
      block(root,ink,[.055,.28,.078],[s*.14,.18,-.014],.022).rotation.z=s*.14;
      block(root,shell,[.155,.17,.06],[s*.094,.076,.042],.027).rotation.z=s*.11;
      block(root,steel,[.125,.032,.012],[s*.095,.026,.079],.009);
      for(let j=0;j<3;j++)block(root,glow,[.024,.009,.008],[s*(.044+j*.037),.105,.081],.003);
      block(root,ink,[.082,.105,.07],[s*.135,-.104,.041],.017);
      block(root,shell,[.066,.08,.016],[s*.135,-.104,.083],.013);
    }
    block(root,steel,[.111,.205,.067],[0,-.025,.049],.025);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.037,.009,10,6),glow);ring.position.set(0,.01,.09);root.add(ring);
    oval(root,ink,[.025,.025,.011],[0,.01,.094]);oval(root,glow,[.014,.014,.008],[0,.01,.106]);
    for(let j=0;j<shields[item]/25;j++)block(root,glow,[.015,.031,.009],[(j-(shields[item]/25-1)/2)*.018,-.095,.089],.003);
  }else if(item==='head-scout'||item==='head-survey'){
    const mine=item==='head-survey',shell=pigment(mine?0xeabc54:0xe3a650),band=pigment(0x41596a);
    const dome=new THREE.Mesh(new THREE.SphereGeometry(1,32,16,0,Math.PI*2,0,Math.PI*.51),shell);dome.scale.set(.159,.14,.161);root.add(dome);
    oval(root,shell,[.174,.014,.187],[0,0,.024]);
    block(root,shell,[.045,.024,.29],[0,.108,-.018],.018);
    for(const s of [-1,1])block(root,band,[.035,.021,.063],[s*.149,.018,-.021],.007);
    if(mine){
      block(root,band,[.20,.044,.033],[0,.045,.139],.012);
      const glint=pigment(0xffedb5,.8);rod(root,ink,[0,.058,.151],[0,.058,.202],.045,.038,20);rod(root,steel,[0,.058,.198],[0,.058,.21],.037,.032,20);rod(root,glint,[0,.058,.211],[0,.058,.215],.026,.029,20);
    }
  }else{
    const cyan=pigment(0x6de5cf,.6);block(root,ink,[.065,.125,.057],[0,0,0],.013);block(root,steel,[.061,.089,.052],[0,0,0],.009);
    block(root,cyan,[.04,.067,.009],[0,0,.031],.006);for(const y of [-.05,.05])block(root,white,[.063,.017,.055],[0,y,0],.004);block(root,ink,[.027,.016,.036],[0,.071,0],.004);
    for(let i=0;i<3;i++)block(root,white,[.025,.006,.005],[0,-.019+i*.017,.038],.002);
  }
  styleCharacter(root);return root;
}

export async function renderModelIcons(renderer:THREE.WebGLRenderer,progress?:(completed:number,total:number)=>Promise<void>){
  const scene=new THREE.Scene(),light=new THREE.DirectionalLight(0xfff0de,2.5);light.position.set(-2,4,5);
  scene.add(light,new THREE.HemisphereLight(0xffffff,0x9fb9d4,2));
  const rim=new THREE.DirectionalLight(0x8cdadf,1.3);rim.position.set(3,2,-3);scene.add(rim);
  const size=192,target=new THREE.WebGLRenderTarget(size,size,{samples:2}),pixels=new Uint8Array(size*size*4);
  target.texture.colorSpace=THREE.SRGBColorSpace;
  const before=renderer.getRenderTarget(),color=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();
  try{
    const items=['pistol','knife',...Object.keys(shields),...Object.keys(headDevices),'shield-cell'] as ItemId[];
    let completed=0;
    for(const item of items){
      const model=new THREE.Group();let direction=new THREE.Vector3(.7,.43,3);
      if(item==='pistol'){const p=makePistol(model);p.right.root.removeFromParent();p.left.root.removeFromParent();p.flash.removeFromParent();direction.set(3,.35,.45);styleCharacter(model);}
      else if(item==='knife'){const k=makeKnife(model);k.right.wrist.parent?.removeFromParent();model.rotation.y=Math.PI/2;direction.set(.15,3,.3);styleCharacter(model);}
      else model.add(makeGearModel(item as ShieldId|HeadId|'shield-cell'));
      scene.add(model);model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),dimensions=box.getSize(new THREE.Vector3()),span=Math.max(dimensions.x,dimensions.y,dimensions.z)*.64;
      const camera=new THREE.OrthographicCamera(-span,span,span,-span,.001,20);camera.position.copy(center).add(direction.normalize().multiplyScalar(4));camera.lookAt(center);
      renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.clear();renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,size,size,pixels);
      const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d')!,img=ctx.createImageData(size,size);for(let y=0;y<size;y++)img.data.set(pixels.subarray((size-1-y)*size*4,(size-y)*size*4),y*size*4);ctx.putImageData(img,0,0);setModelIcon(item,canvas);scene.remove(model);
      completed++;if(progress&&completed%2===0)await progress(completed,items.length);
    }
  }finally{renderer.setRenderTarget(before);renderer.setClearColor(color,alpha);target.dispose();}
}
