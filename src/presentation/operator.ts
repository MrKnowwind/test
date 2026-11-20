import * as THREE from 'three';
import { batchRigid, block, oval, pivot, rod } from './modelParts.ts';
import { pigment, shell } from './shell.ts';
import { styleCharacter } from './celShading.ts';

// The face is painted directly onto the head surface so eyelids and the mouth
// follow the cheek curve when the portrait is turned to either side.
function operatorFace() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffd1b5';
  ctx.fillRect(0, 0, 1024, 512);
  function fill(path: string, color: string) {
    ctx.fillStyle = color;
    ctx.fill(new Path2D(path));
  }
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(512, 0);
    ctx.scale(side, 1);
    const eye = 'M35 247Q73 196 133 222Q123 248 109 258Q76 277 40 257Z';
    const lashes = '#354055';
    fill('M40 192Q80 163 126 181L133 187Q82 178 40 199Z', '#685156');
    fill(eye, '#fff5e7');
    ctx.save();
    ctx.clip(new Path2D(eye));
    ctx.fillStyle = '#235768';
    ctx.beginPath(); ctx.ellipse(81, 241, 24, 30, 0, 0, Math.PI * 2); ctx.fill();
    fill('M60 243Q79 253 103 236Q101 265 79 265Q66 264 60 256Z', '#56b9b0');
    fill('M73 221Q83 214 89 222L85 248Q80 254 75 248Z', '#283c52');
    ctx.fillStyle = '#fffcee';
    ctx.beginPath(); ctx.ellipse(73, 226, 6, 8, .2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    fill('M33 248Q64 195 115 211Q133 217 145 206L139 219L149 216Q135 232 125 231Q81 207 33 248Z', lashes);
    fill('M80 265Q112 258 128 235Q117 259 98 264Z', '#946f6c');
    fill('M108 291Q132 280 153 282L139 287Z', '#edac9a');
    ctx.restore();
  }
  fill('M511 289Q505 309 514 313L505 316Q497 312 501 307Z', '#de9985');
  fill('M487 371Q503 367 512 369Q525 368 534 365Q525 375 511 375Q502 373 487 371Z', '#a46668');
  fill('M510 381Q518 382 525 377L520 384Z', '#ffe6ce');
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const skin = pigment(0xffffff);
  skin.map = map;
  const profile = [[0,.019,.050,.035],[.022,.059,.080,.032],[.062,.092,.101,.025],
    [.113,.117,.115,.017],[.163,.123,.117,.010],[.216,.114,.103,0],[.259,.080,.076,0],[.279,.025,.042,0]];
  const vertices: number[] = [], uvs: number[] = [], faces: number[] = [];
  const segments = 40;
  profile.forEach(([y, rx, rz, offset], row) => {
    for (let i = 0; i <= segments; i++) {
      const u = i / segments, angle = (u - .5) * Math.PI * 2;
      vertices.push(rx * Math.sin(angle), y, offset + rz * Math.cos(angle));
      uvs.push(u, y / .279);
      if (row && i) {
        const d = row * (segments + 1) + i, a = d - segments - 2;
        faces.push(a, a + 1, d, a, d, d - 1);
      }
    }
  });
  const shape = new THREE.BufferGeometry();
  shape.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  shape.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  shape.setIndex(faces);
  shape.computeVertexNormals();
  return new THREE.Mesh(shape, skin);
}

// The loadout portrait is rendered from this full-body mesh. Local +Z faces the camera.
export function createOperator() {
  const root=new THREE.Group(), body=pivot(root,[0,0,0]);
  const ink=pigment(0x293d60), suit=pigment(0x40889b), ivory=pigment(0xe4efea);
  const skin=pigment(0xffcaac), coral=pigment(0xff8468);
  const hair=pigment(0x2d5269), fringe=pigment(0x48778b), glow=pigment(0x86ffde,.27);
  const face=pivot(body,[0,1.47,0]); face.rotation.y=-.12;
  face.add(operatorFace());
  oval(face,hair,[.135,.145,.121],[0,.171,-.026]);
  oval(face,hair,[.097,.154,.085],[-.076,.052,-.079]);
  for(const side of [-1,1]) {
    const lock=shell(face,hair,[side*.106,.09,0],[[-.08,.006,.01,.056],[.024,.027,.036,.06],[.135,.038,.068,.005]]);
    lock.rotation.z=-side*.15;
    rod(face,ink,[side*.103,.12,-.021],[side*.143,.12,-.021],.051,.045,12);
    rod(face,coral,[side*.14,.12,-.021],[side*.152,.12,-.021],.038,.034,12);
  }
  for(const [x,length,tilt] of [[-.082,.121,-.31],[-.043,.099,-.40],[.002,.069,-.43],[.051,.054,-.33],[.086,.076,-.20]]) {
    const bang=shell(face,fringe,[x,.245,.062],[[-length,.003,.007,.074],[-length*.45,.022,.021,.060],[0,.033,.042,.015],[.026,.015,.020,-.01]]);
    bang.rotation.z=tilt;
  }
  // The swept rear knot and two enamel pins break up the headset silhouette.
  oval(face,hair,[.073,.083,.073],[-.097,.183,-.117]);
  rod(face,coral,[-.120,.143,-.101],[-.16,.104,-.114],.019,.010,10);
  rod(face,ivory,[.083,.184,.090],[.109,.194,.064],.004,.004,8);
  rod(face,coral,[.087,.197,.085],[.112,.206,.057],.005,.004,8);
  rod(body,skin,[0,1.39,0],[0,1.51,0],.051,.047,12);
  shell(body,suit,[0,.84,0],[[0,.117,.088,0],[.17,.107,.084,0],[.40,.161,.108,0],[.52,.182,.093,0],[.57,.092,.067,0]]);
  shell(body,ivory,[0,1.06,.004],[[0,.123,.092,.007],[.13,.164,.111,0],[.25,.187,.103,0],[.29,.123,.079,0]]);
  shell(body,ink,[0,1.353,0],[[0,.102,.086,0],[.065,.081,.066,0]]);
  block(body,coral,[.046,.265,.022],[-.044,1.2,.112],.007).rotation.z=-.43;
  const neckerchief=shell(body,coral,[0,1.37,.006],[[0,.078,.070,.003],[.024,.096,.079,0],[.050,.073,.066,-.005]]);
  neckerchief.rotation.z=-.10;
  shell(body,coral,[.049,1.32,.092],[[-.078,.010,.008,.020],[-.033,.029,.011,.015],[.026,.019,.016,0]]);
  block(body,suit,[.058,.024,.016],[-.097,1.292,.106],.004).rotation.z=.07;
  block(body,ink,[.075,.056,.015],[.081,1.265,.107],.004);
  block(body,glow,[.048,.012,.01],[.081,1.268,.118],.003);
  shell(body,ink,[0,.81,0],[[0,.133,.095,0],[.099,.146,.101,0],[.139,.121,.093,0]]);
  for(const side of [-1,1]) {
    const sx=side*.178, nx=side*.205;
    oval(body,ivory,[.077,.087,.09],[sx,1.306,0]);
    rod(body,suit,[sx,1.3,0],[nx,1.062,.016],.065,.044,10);
    const arm=shell(body,ivory,[nx,1.055,.028],[[-.207,.041,.041,.042],[-.17,.047,.053,.037],[-.042,.059,.061,0],[0,.049,.052,0]]);
    arm.rotation.z=side*.09;
    shell(body,coral,[nx,.891,.06],[[0,.047,.048,0],[.021,.047,.049,-.004]]);
    oval(body,ink,[.043,.069,.038],[nx,.813,.078]);
    const hx=side*.077,kx=side*.092,fx=side*.104;
    rod(body,ink,[hx,.85,0],[kx,.48,.008],.086,.058,12);
    shell(body,suit,[kx,.53,.009],[[-.02,.063,.064,0],[.16,.077,.078,0],[.26,.077,.079,0]]);
    rod(body,ink,[kx,.47,.008],[fx,.107,-.008],.06,.041,12);
    shell(body,ivory,[fx,.17,0],[[0,.046,.052,0],[.21,.061,.065,.002],[.28,.052,.052,.014]]);
    block(body,ink,[.108,.116,.20],[fx,.067,.047],.028);
    block(body,coral,[.109,.024,.205],[fx,.02,.047],.009);
  }
  batchRigid(face);batchRigid(body);styleCharacter(root);
  return root;
}

export function renderOperatorPortrait(renderer:THREE.WebGLRenderer) {
  const scene=new THREE.Scene(), actor=createOperator();
  scene.add(actor,new THREE.HemisphereLight(0xfff4e3,0xa9bfd5,1.7));
  actor.rotation.y=.39;
  const key=new THREE.DirectionalLight(0xffecd7,2.2);key.position.set(-2,4,3);scene.add(key);
  const w=352,h=448, cam=new THREE.OrthographicCamera(-.31,.31,.395,-.395,.1,15);
  cam.position.set(.08,1.52,4);cam.lookAt(0,1.417,0);
  const target=new THREE.WebGLRenderTarget(w,h,{samples:2});target.texture.colorSpace=THREE.SRGBColorSpace;
  const oldTarget=renderer.getRenderTarget(), old=renderer.getClearColor(new THREE.Color()), alpha=renderer.getClearAlpha();
  const pixels=new Uint8Array(w*h*4);
  try {
    renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.clear();
    renderer.render(scene,cam);renderer.readRenderTargetPixels(target,0,0,w,h,pixels);
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d')!,img=ctx.createImageData(w,h);
    for(let y=0;y<h;y++)img.data.set(pixels.subarray((h-1-y)*w*4,(h-y)*w*4),y*w*4);
    ctx.putImageData(img,0,0);
    for(const slot of document.querySelectorAll<HTMLCanvasElement>('.operator-portrait')) {
      slot.width=w;slot.height=h;slot.getContext('2d')!.drawImage(canvas,0,0);
    }
  } finally {
    renderer.setRenderTarget(oldTarget);renderer.setClearColor(old,alpha);target.dispose();
    const materials=new Set<THREE.Material>();
    scene.traverse(obj=>{if(obj instanceof THREE.Mesh){obj.geometry.dispose();for(const mat of [obj.material].flat()) materials.add(mat);}});
    for(const mat of materials) {
      if(mat instanceof THREE.MeshStandardMaterial) mat.map?.dispose();
      mat.dispose();
    }
  }
}
