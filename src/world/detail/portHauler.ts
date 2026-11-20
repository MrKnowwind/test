import * as THREE from 'three';
import { bevelShape, box, cylinder, label } from './geometry.ts';
import { enamel, emissive, type Materials } from './materialLibrary.ts';

type Load = 'medical' | 'cells' | 'freight';

/** Six-wheel port tractor with an interchangeable load cassette. Origin is the tyre contact plane. */
export function portHauler(m: Materials, load: Load) {
  const root = new THREE.Group();
  const accent = enamel(load === 'medical' ? 0xe7694d : load === 'cells' ? 0x7771b4 : 0x279ea7);
  const glass = enamel(0x234d66), lens = emissive(0x9ffff3,.65);
  const part = (material: THREE.Material, profile: [number,number][], depth: number) =>
    bevelShape(root, material, profile, depth, .035);
  // Taper in the side elevation. The inset visor follows the rake of the nose.
  part(m.steel, [[-3.13,.60],[-2.9,.42],[2.8,.42],[3.15,.76],[3.12,.92],[-3.13,.92]],1.76);
  part(m.ceramic, [[.91,.83],[3.12,.83],[3.06,1.52],[2.36,2.34],[1.2,2.36],[.94,2.11]],2.0);
  part(glass, [[1.15,1.61],[3.00,1.61],[2.38,2.31],[1.29,2.31],[1.15,2.13]],2.045);
  part(accent, [[1.14,2.31],[2.44,2.31],[2.29,2.52],[1.22,2.52],[1.07,2.43]],2.10);
  box(root,m.steel,.18,.24,2.16,3.08,.88,0,.06);
  for(const side of [-1,1]) {
    box(root,lens,.075,.10,.55,3.08,1.35,side*.66,.029);
    box(root,accent,1.46,.16,.10,1.97,1.35,side*1.01,.034);
    box(root,m.steel,.29,.055,.052,1.39,1.51,side*1.04,.012);
    const reflection=part(enamel(0x47758a),[[1.36,1.77],[1.57,1.77],[1.91,2.16],[1.70,2.16]],.012);
    reflection.position.z=side*1.054;
    box(root,m.steel,.085,.56,.038,1.98,1.96,side*1.05,.012);
    for(const dx of [-2.27,-.88,2.13]) {
      const wheel=cylinder(root,m.rubber,.48,.35,dx,.48,side*.94,20);
      wheel.rotation.x=Math.PI/2;
      cylinder(root,m.steel,.34,.04,dx,.48,side*1.13,12).rotation.x=Math.PI/2;
      cylinder(root,m.zinc,.22,.045,dx,.48,side*1.16,8).rotation.x=Math.PI/2;
      cylinder(root,accent,.105,.04,dx,.48,side*1.19,8).rotation.x=Math.PI/2;
      for(let i=0;i<6;i++) {
        const angle=i*Math.PI/3;
        cylinder(root,m.steel,.027,.02,dx+.157*Math.cos(angle),.48+.157*Math.sin(angle),side*1.19,6).rotation.x=Math.PI/2;
      }
      const arch=part(accent,[[-.63,.04],[-.48,.35],[-.29,.46],[.30,.46],[.51,.32],[.62,.04],[.48,.04],[.34,.24],[-.34,.24],[-.49,.04]],.22);
      arch.position.set(dx,.66,side*1.02);
    }
  }
  box(root,m.steel,3.82,.18,2.04,-1.08,1.02,0,.06);
  if(load==='cells') {
    for(const side of [-1,1]) {
      const tube=cylinder(root,m.ceramic,.43,3.42,-1.06,1.59,side*.48,12);
      tube.rotation.z=Math.PI/2;
      for(const dx of [-2.66,-1.89,-.21,.54]) {
        cylinder(root,accent,.46,.14,dx,1.59,side*.48,12).rotation.z=Math.PI/2;
      }
      box(root,m.steel,3.22,.12,.49,-1.06,1.17,side*.48,.04);
    }
  } else {
    const pod=part(load==='medical'?m.ceramic:accent,[[-2.88,1.11],[.71,1.11],[.71,2.03],[.46,2.34],[-2.60,2.34],[-2.88,2.06]],1.86);
    pod.castShadow=true;
    for(const side of [-1,1]) {
      for(const dx of [-2.53,.32]) box(root,m.steel,.11,1.08,.10,dx,1.68,side*.94,.02);
      for(const dx of [-2.15,-.06]) {
        box(root,m.steel,.34,.11,.07,dx,1.31,side*.959,.028);
        box(root,m.zinc,.23,.035,.082,dx,1.324,side*.967,.014);
      }
      const decal=label(root,2.15,.7,(ctx,w,h)=>{
        ctx.fillStyle='#253d57';ctx.fillRect(0,0,w,h);
        ctx.fillStyle=load==='medical'?'#76ffe4':'#ffbd64';
        ctx.fillRect(14,18,72,h-36);
        ctx.fillStyle='#253d57';
        if(load==='medical') {ctx.fillRect(27,h/2-7,45,14);ctx.fillRect(43,h/2-23,14,46);}
        ctx.fillStyle='#effaf4';ctx.font='bold 53px sans-serif';
        ctx.fillText(load==='medical'?'MED / 07':'CARGO / 12',105,h*.64,w-116);
      },.12);
      decal.position.set(-1.1,1.77,side*.974);
      decal.rotation.y=side<0?Math.PI:0;
    }
  }
  root.traverse(object=>{if(object instanceof THREE.Mesh) object.castShadow=true;});
  return root;
}
