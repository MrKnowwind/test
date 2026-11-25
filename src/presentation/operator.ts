import * as THREE from 'three';
import { batchRigid, block, curvedSkin, oval, pivot, rod } from './modelParts.ts';
import { sweptPlate, tailoring } from './sculpt.ts';
import { makeGlove } from './viewmodelModels.ts';
import { pigment } from './shell.ts';
import { styleCharacter } from './celShading.ts';

// The face is painted directly onto the head surface so eyelids and the mouth
// follow the cheek curve when the portrait is turned to either side.
function operatorFace() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const tone=ctx.createLinearGradient(0,50,0,498);tone.addColorStop(0,'#f6b69d');tone.addColorStop(.48,'#ffdec3');tone.addColorStop(1,'#f8c5ad');ctx.fillStyle=tone;
  ctx.fillRect(0, 0, 1024, 512);
  function fill(path: string, color: string) {
    ctx.fillStyle = color;
    ctx.fill(new Path2D(path));
  }
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(512, 0);
    ctx.scale(side, 1);
    const blush=ctx.createRadialGradient(117,288,2,117,288,57);
    blush.addColorStop(0,'rgba(228,121,111,.26)');blush.addColorStop(1,'rgba(238,145,127,0)');
    ctx.fillStyle=blush;ctx.fillRect(54,247,113,76);
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
    for(const [x,y] of [[88,287],[104,295],[117,285],[136,289]]){ctx.fillStyle='#ca9786';ctx.beginPath();ctx.arc(x,y,1.55,0,Math.PI*2);ctx.fill();}
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
  const profile = [[0,.021,.034,.047],[.015,.048,.062,.046],[.039,.076,.089,.034],[.068,.096,.103,.023],
    [.113,.117,.115,.017],[.163,.123,.117,.010],[.216,.114,.103,0],[.259,.080,.076,0],[.279,.025,.042,0]];
  const vertices: number[] = [], uvs: number[] = [], faces: number[] = [];
  const segments = 40;
  profile.forEach(([y, rx, rz, offset], row) => {
    for (let i = 0; i <= segments; i++) {
      const u = i / segments, angle = (u - .5) * Math.PI * 2;
      const x=rx*Math.sin(angle),front=Math.max(0,Math.cos(angle));
      const nose=.018*Math.exp(-((x/.021)**2)-(((y-.11)/.040)**2));
      const cheek=.006*Math.exp(-(((Math.abs(x)-.067)/.033)**2)-(((y-.11)/.043)**2));
      vertices.push(x,y,offset+rz*Math.cos(angle)+(nose+cheek)*front**4);
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
  const ink=pigment(0x28374f), suit=pigment(0x306b80), ivory=pigment(0xe1e7dc);
  const skin=pigment(0xffceb2), coral=pigment(0xe77453), trim=pigment(0x92cfc7);
  const hair=pigment(0x233b53), fringe=pigment(0x34566a), sheen=pigment(0x51778a);
  const face=pivot(body,[0,1.455,.012]);face.rotation.set(.026,-.08,.025);
  face.add(operatorFace());
  // The part runs across a rounded cap. The locks follow the skull before tapering past the temples.
  oval(face,hair,[.129,.127,.118],[0,.175,-.023]);
  sweptPlate(face,hair,[[-.057,.196,-.087,.070,.050],[-.096,.122,-.089,.065,.046],[-.111,.035,-.087,.044,.047],[-.077,-.071,-.09,.005,.010]],[-.7,0,-1]);
  for(const side of [-1,1]){
    const sx=side*.115;
    oval(face,skin,[.018,.032,.014],[sx,.114,.011]);
    rod(face,ink,[sx,.126,-.009],[side*.141,.126,-.009],.037,.034,16);
    rod(face,trim,[side*.14,.126,-.009],[side*.144,.126,-.009],.023,.024,16);
    sweptPlate(face,fringe,[[side*.083,.242,.032,.040,.021],[side*.120,.180,.041,.033,.019],[side*.120,.106,.055,.026,.017],[side*.098,.042,.082,.003,.004]],[side*.55,0,1]);
  }
  const bang=(pts:Parameters<typeof sweptPlate>[2],mat=fringe)=>sweptPlate(face,mat,pts);
  bang([[.046,.257,.023,.039,.026],[.016,.245,.085,.049,.024],[-.044,.214,.115,.046,.020],[-.098,.167,.091,.024,.014],[-.109,.109,.072,.002,.003]]);
  bang([[.024,.265,.011,.040,.023],[-.044,.251,.053,.044,.023],[-.085,.212,.085,.035,.021],[-.122,.151,.061,.003,.007]],hair);
  bang([[.023,.259,.043,.027,.017],[.015,.241,.100,.029,.017],[-.009,.207,.122,.023,.012],[-.054,.181,.126,.002,.003]]);
  bang([[.049,.258,.029,.032,.020],[.069,.239,.083,.033,.020],[.092,.206,.103,.027,.017],[.106,.165,.093,.003,.005]]);
  bang([[.038,.257,.063,.005,.004],[.002,.240,.111,.009,.004],[-.048,.209,.134,.006,.003],[-.079,.188,.116,.001,.001]],sheen);
  oval(face,coral,[.042,.034,.037],[-.099,.179,-.103]);
  sweptPlate(face,hair,[[-.104,.190,-.10,.032,.029],[-.154,.154,-.121,.044,.042],[-.178,.075,-.117,.047,.038],[-.160,-.023,-.105,.032,.030],[-.186,-.085,-.092,.003,.005]],[-.7,0,-1]);
  // Rescue goggles rest on the hairline; two curved lenses sit inside a single textile band.
  curvedSkin(face,ink,[[-.119,.202,.013],[-.113,.220,.083],[-.063,.243,.114],[.005,.254,.123],[.066,.245,.107],[.116,.211,.064],[.124,.191,-.027]],[.011,.013,.011,.012],10);
  for(const side of [-1,1]){
    const lens=pivot(face,[side*.054,.240,.112-Math.abs(side)*.004]);
    lens.rotation.set(-.30,side*.44,-side*.08);
    block(lens,coral,[.090,.046,.024],[0,0,0],.011);
    block(lens,ink,[.081,.037,.016],[0,.001,.009],.008);
    block(lens,suit,[.069,.028,.008],[0,.001,.017],.006);
    block(lens,trim,[.041,.005,.003],[-.006,.006,.022],.001).rotation.z=.09;
    block(lens,ivory,[.012,.004,.003],[.021,.008,.022],.001);
  }
  rod(face,ink,[-.012,.244,.123],[.012,.244,.123],.006,.006,8);
  for(const dy of [0,.012])rod(face,coral,[.085,.193+dy,.098],[.111,.210+dy,.073],.0027,.003,8);
  rod(body,skin,[0,1.389,.006],[0,1.494,.016],.047,.044,20);
  tailoring(body,ink,[0,.83,0],[[0,.130,.095,0],[.11,.132,.09,0],[.22,.104,.078,0],[.36,.133,.094,.008],[.49,.164,.091,0],[.555,.08,.061,0]]);
  // Short storm jacket with soft shoulders, an open collar, a diagonal webbing harness and jacket hem.
  tailoring(body,suit,[0,1.015,0],[[0,.126,.093,0],[.028,.138,.102,0],[.065,.136,.103,0],[.145,.145,.114,.004],[.205,.157,.118,.006],[.242,.168,.111,.006]]);
  tailoring(body,ivory,[0,1.015,0],[[.242,.168,.111,.006],[.288,.179,.103,.003],[.316,.174,.10,0],[.357,.136,.080,-.002],[.39,.075,.058,0]]);
  tailoring(body,ink,[0,1.015,0],[[0,.129,.097,0],[.020,.139,.104,0],[.031,.139,.104,0]]);
  for(const side of [-1,1]){
    sweptPlate(body,ivory,[[side*.119,1.356,.052,.045,.018],[side*.081,1.358,.091,.045,.018],[side*.061,1.304,.123,.027,.014],[side*.040,1.255,.123,.002,.004]]);
    sweptPlate(body,ink,[[side*.072,1.393,.037,.029,.014],[side*.064,1.379,.076,.026,.014],[side*.028,1.325,.108,.011,.010],[side*.017,1.31,.117,.003,.003]]);
  }
  sweptPlate(body,coral,[[-.132,1.342,.080,.017,.010],[-.083,1.272,.128,.017,.009],[.003,1.172,.135,.017,.008],[.087,1.067,.097,.016,.010],[.124,.976,.061,.013,.008]]);
  block(body,ink,[.045,.031,.014],[-.07,1.256,.138],.004).rotation.z=.70;
  const patch=pivot(body,[.080,1.283,.110]);patch.rotation.y=.29;
  block(patch,ink,[.058,.032,.010],[0,0,0],.004);
  for(const d of [-.009,.006])block(patch,trim,[.014,.017,.004],[d,.001,.006],.002).rotation.z=-.40;
  curvedSkin(body,trim,[[.125,1.199,.094],[.107,1.191,.111],[.080,1.181,.119],[.049,1.171,.124]],[.0025,.003,.0025],8);
  tailoring(body,ink,[0,.93,0],[[0,.136,.098,0],[.033,.139,.103,0],[.055,.130,.098,0]]);
  block(body,ivory,[.051,.034,.018],[0,.96,.107],.005);
  const pouch=block(body,suit,[.120,.133,.070],[.126,.912,.064],.018);pouch.rotation.z=.10;
  block(body,coral,[.104,.034,.013],[.126,.953,.107],.005);
  for(const side of [-1,1]){
    const shoulder=side*.162,elbow=side*.203,hand=side*(side>0?.204:.223);
    tailoring(body,ivory,[shoulder,1.215,0],[[0,.042,.057,0],[.036,.062,.071,0],[.084,.070,.074,-.006],[.124,.052,.060,-.009],[.137,.023,.036,-.01]]);
    rod(body,suit,[shoulder,1.254,.001],[elbow,1.041,.026],.056,.044,18);
    tailoring(body,ink,[elbow,1.008,.026],[[0,.044,.049,0],[.039,.047,.049,0],[.062,.046,.048,0]]);
    rod(body,ivory,[elbow,1.025,.026],[hand,.868,.061],.052,.040,18);
    const glove=makeGlove(body,[hand,.835,.067],side<0,false,'operator-glove');glove.root.rotation.x=-1.05;
    const hx=side*.077,kx=side*(side>0?.107:.090),fx=side*(side>0?.123:.10);
    rod(body,ink,[hx,.87,0],[kx,.47,.011],.082,.058,18);
    tailoring(body,suit,[hx,.576,.001],[[0,.068,.075,0],[.064,.075,.082,0],[.179,.081,.088,0],[.245,.080,.083,0]]);
    rod(body,ink,[kx,.47,.008],[fx,.105,-.005],.056,.039,18);
    tailoring(body,suit,[fx,.121,0],[[0,.047,.060,.007],[.056,.053,.061,0],[.161,.060,.067,-.005],[.243,.050,.057,.006]]);
    sweptPlate(body,ivory,[[kx,.51,.058,.047,.013],[kx,.47,.078,.055,.016],[kx,.40,.067,.032,.011],[fx,.36,.060,.009,.005]]);
    block(body,ink,[.103,.115,.188],[fx,.071,.042],.025);
    block(body,ivory,[.106,.027,.196],[fx,.019,.043],.009);
  }
  curvedSkin(body,trim,[[-.150,1.28,.092],[-.158,1.23,.096],[-.152,1.18,.101]],[.003,.004,.003],8);
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

export function createOperatorPreview(renderer: THREE.WebGLRenderer) {
  const canvases = [...document.querySelectorAll<HTMLCanvasElement>('.outpost-operator')];
  const scene = new THREE.Scene(), actor = createOperator();
  scene.add(actor, new THREE.HemisphereLight(0xfff4e3, 0x819bb8, 1.8));
  const key = new THREE.DirectionalLight(0xffead3, 2.4);
  key.position.set(-2, 4, 3);
  const rim = new THREE.DirectionalLight(0x83c7cf, 1.1);
  rim.position.set(2, 2, -3);
  scene.add(key, rim);
  const w = 320, h = 576;
  const camera = new THREE.OrthographicCamera(-.58,.58,1.044,-1.044,.1,15);
  camera.position.set(0,1.17,4);
  camera.lookAt(0,.88,0);
  const target = new THREE.WebGLRenderTarget(w,h,{samples:2});
  target.texture.colorSpace=THREE.SRGBColorSpace;
  const pixels = new Uint8Array(w*h*4);
  actor.rotation.y = .29;
  let frame = 0;
  for (const canvas of canvases) {
    canvas.width=w; canvas.height=h;
    let lastX: number | undefined;
    canvas.addEventListener('pointerdown', event => {
      lastX=event.clientX;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
      if (lastX===undefined) return;
      actor.rotation.y+=(event.clientX-lastX)*.012;
      lastX=event.clientX;
      schedule();
    });
    canvas.addEventListener('lostpointercapture', () => {lastX=undefined;});
    canvas.addEventListener('keydown', event => {
      if(event.key!=='ArrowLeft' && event.key!=='ArrowRight') return;
      event.preventDefault();
      actor.rotation.y+=event.key==='ArrowRight'?.25:-.25;
      schedule();
    });
  }
  function schedule() {
    if (!frame) frame=requestAnimationFrame(()=>{frame=0; render();});
  }
  function render() {
    const oldTarget=renderer.getRenderTarget(), old=renderer.getClearColor(new THREE.Color()), alpha=renderer.getClearAlpha();
    try {
      renderer.setRenderTarget(target); renderer.setClearColor(0,0); renderer.clear();
      renderer.render(scene,camera);
      renderer.readRenderTargetPixels(target,0,0,w,h,pixels);
      for(const canvas of canvases){
        const ctx=canvas.getContext('2d')!,img=ctx.createImageData(w,h);
        for(let y=0;y<h;y++)img.data.set(pixels.subarray((h-1-y)*w*4,(h-y)*w*4),y*w*4);
        ctx.putImageData(img,0,0);
      }
    } finally {
      renderer.setRenderTarget(oldTarget); renderer.setClearColor(old,alpha);
    }
  }
  return { render, dispose() {
    cancelAnimationFrame(frame);
    target.dispose();
    const materials=new Set<THREE.Material>();
    scene.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();for(const material of [object.material].flat())materials.add(material);}});
    for(const material of materials)material.dispose();
  } };
}
