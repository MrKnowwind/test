import * as THREE from 'three';
import { batchRigid, block, curvedSkin, oval, part, pivot, rod, surface } from './modelParts.ts';
import type { Point } from './modelParts.ts';
import { applyFinish } from './finishes.ts';
import { fingerGeometry, palmGeometry } from './handGeometry.ts';

const slideSteel = surface(0x30383d, 0.37, 0.72);
const wornSteel = surface(0x68716d, 0.38, 0.78);
const blueSteel = surface(0x20272b, 0.44, 0.56);
const polymer = surface(0x2a2e2c, 0.74);
const gunRubber = surface(0x191c1e, 0.86);
const bore = surface(0x0a0d0f, 0.95);
const brass = surface(0xb5914e, 0.42, 0.63);
const sightPaint = surface(0xb9d0a3, 0.78);
sightPaint.emissiveIntensity = 0.16;
sightPaint.emissive.setHex(0x778d60);

const sleeve = surface(0x526052, 0.91);
const cloth = surface(0x697466, 0.86);
const webbing = surface(0x414636, 0.88);
const glove = surface(0x34342e, 0.86);
const gloveSeam = surface(0x3e4037, 0.89);
const knuckle = surface(0x252b29, 0.75);
for (const material of [sleeve, cloth, webbing]) applyFinish(material, 'fabric');
for (const material of [glove, gloveSeam]) applyFinish(material, 'rubber');
for (const material of [knuckle, polymer, gunRubber]) applyFinish(material, 'polymer');
for (const material of [slideSteel, wornSteel, blueSteel]) applyFinish(material, 'metal');

function slideSection(parent: THREE.Object3D, length: number, z: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-.0195, -.0195);
  shape.lineTo(.0195, -.0195);
  shape.lineTo(.0195, .011);
  shape.quadraticCurveTo(.0185, .014, .016, .016);
  shape.lineTo(.0105, .0235);
  shape.lineTo(-.0105, .0235);
  shape.lineTo(-.016, .016);
  shape.quadraticCurveTo(-.0185, .014, -.0195, .011);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: true,
    bevelSize: .0014, bevelThickness: .0012, bevelSegments: 4, steps: 1, curveSegments: 16 });
  geometry.translate(0, .002, z - length / 2);
  return part(parent, geometry, slideSteel, [0, 0, 0]);
}

function pistolStamp(parent: THREE.Object3D) {
  if (typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#8b9690';
  ctx.font = '500 42px monospace'; ctx.fillText('SL-9  /  9×19', 12, 43);
  ctx.font = '24px monospace'; ctx.fillText('SALTLINE  S-01482', 12, 80);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  for (const side of [-1, 1]) {
    const label = new THREE.Mesh(new THREE.PlaneGeometry(.065, .0122),
      new THREE.MeshStandardMaterial({ map, transparent: true, roughness: .79, depthWrite: false }));
    label.position.set(side * .021, .001, -.119);
    label.rotation.y = side * Math.PI / 2;
    parent.add(label);
  }
}

export function makePistol(parent: THREE.Object3D) {
  const body = pivot(parent, [0, 0, 0], 'pistol');
  const slide = pivot(body, [0, 0, 0], 'pistol-slide');
  const grip = pivot(body, [0, -0.055, -0.006], 'grip');
  grip.rotation.x = -0.33;

  const frame = new THREE.Shape();
  frame.moveTo(-.028, -.019);
  frame.lineTo(.165, -.019);
  frame.quadraticCurveTo(.177, -.020, .177, -.029);
  frame.lineTo(.170, -.042);
  frame.lineTo(.094, -.046);
  frame.quadraticCurveTo(.064, -.049, .038, -.053);
  frame.lineTo(.020, -.066);
  frame.lineTo(-.013, -.063);
  frame.quadraticCurveTo(-.027, -.054, -.029, -.036);
  frame.closePath();
  const frameGeometry = new THREE.ExtrudeGeometry(frame, { depth: .033, bevelEnabled: true,
    bevelSize: .0022, bevelThickness: .001, bevelSegments: 4, curveSegments: 16 });
  frameGeometry.translate(0, 0, -.0165).rotateY(Math.PI / 2);
  part(body, frameGeometry, polymer, [0, 0, 0]);
  block(body, blueSteel, [0.034, 0.007, 0.124], [0, -0.020, -0.104], 0.0018);
  block(grip, polymer, [0.035, 0.094, 0.050], [0, -0.043, 0], 0.008);
  block(grip, gunRubber, [0.037, 0.067, 0.044], [0, -0.045, 0.003], 0.006);
  for (const side of [-1, 1]) {
    for (let notch = 0; notch < 7; notch += 1) {
      block(grip, polymer, [0.0013, 0.0025, 0.028], [side * 0.019, -0.019 - notch * 0.008, 0.005], 0.0007);
    }
    block(body, slideSteel, [0.003, 0.008, 0.022], [side * 0.019, -0.035, -0.026], 0.002);
    const pin = rod(body, wornSteel, [side * .017, -.029, -.053], [side * .020, -.029, -.053], .0029, .0029, 20);
    pin.rotation.z = .05;
  }

  // Trigger guard, safety and barrel are fixed to the frame.
  const guard = new THREE.Shape();
  guard.moveTo(.028, -.046);
  guard.lineTo(.085, -.046);
  guard.quadraticCurveTo(.098, -.052, .095, -.069);
  guard.quadraticCurveTo(.094, -.086, .080, -.088);
  guard.lineTo(.041, -.086);
  guard.quadraticCurveTo(.028, -.080, .028, -.046);
  const opening = new THREE.Path();
  opening.moveTo(.038, -.052);
  opening.quadraticCurveTo(.037, -.074, .045, -.077);
  opening.lineTo(.079, -.079);
  opening.quadraticCurveTo(.087, -.078, .087, -.065);
  opening.quadraticCurveTo(.088, -.054, .081, -.052);
  opening.closePath();
  guard.holes.push(opening);
  const guardGeometry = new THREE.ExtrudeGeometry(guard, { depth: .024, bevelEnabled: true,
    bevelSize: .0015, bevelThickness: .001, bevelSegments: 4, curveSegments: 20 });
  guardGeometry.translate(0, 0, -.012).rotateY(Math.PI / 2);
  part(body, guardGeometry, polymer, [0, 0, 0]);
  curvedSkin(body, blueSteel, [[0, -.048, -.046], [0, -.059, -.047], [0, -.071, -.052]], [.003, .003, .0025], 12);
  rod(body, slideSteel, [0, 0, 0.012], [0, 0, -0.185], 0.0098);
  part(body, new THREE.CircleGeometry(0.0078, 18), bore, [0, 0, -0.186]).rotation.y = Math.PI;
  part(body, new THREE.RingGeometry(0.0078, 0.0112, 18), wornSteel, [0, 0, -0.187]).rotation.y = Math.PI;
  const muzzle = pivot(body, [0, 0, -0.188], 'muzzle');

  // The shell is split around the ejection port so the barrel is visible through it.
  slideSection(slide, .119, -.124);
  slideSection(slide, .056, .002);
  pistolStamp(slide);
  // Separate the striker plate and rear dovetail from the machined slide shell.
  block(slide, blueSteel, [.026, .027, .0015], [0, -.001, .0328], .002);
  block(slide, wornSteel, [.020, .0008, .0016], [0, -.013, .034], .0003);
  part(slide, new THREE.CircleGeometry(.0023, 24), blueSteel, [0, .003, .0337]);
  block(slide, blueSteel, [0.037, 0.012, 0.040], [0, -0.012, -0.048], 0.002);
  block(slide, slideSteel, [0.006, 0.027, 0.041], [-0.0165, 0.007, -0.048], 0.002);
  block(slide, wornSteel, [0.031, 0.010, 0.036], [0, 0.013, -0.046], 0.002);
  for (const side of [-1, 1]) {
    for (let index = 0; index < 6; index += 1) {
      const serration = block(slide, blueSteel, [0.0015, 0.030, 0.0022], [side * 0.0205, 0.001, -0.020 + index * 0.007], 0.0006);
      serration.rotation.x = -0.22;
    }
    block(slide, wornSteel, [0.0006, 0.001, 0.074], [side * 0.0175, 0.016, -0.123], 0.0004);
    block(slide, blueSteel, [0.0008, 0.009, 0.069], [side * 0.0205, -0.001, -0.124], 0.0006);
    for (let scallop = 0; scallop < 4; scallop += 1) {
      block(slide, wornSteel, [0.0007, 0.001, 0.009], [side * 0.021, 0.001, -0.144 + scallop * 0.012]);
    }
    block(slide, gunRubber, [0.007, 0.011, 0.010], [side * 0.009, 0.030, 0.020], 0.0012);
    block(slide, sightPaint, [0.0021, 0.0022, 0.0006], [side * 0.009, 0.032, 0.0258], 0.0003);
  }
  block(slide, gunRubber, [0.025, 0.004, 0.012], [0, 0.025, 0.018], 0.0012);
  block(slide, gunRubber, [0.006, 0.010, 0.009], [0, 0.030, -0.159], 0.001);
  block(slide, sightPaint, [0.0025, 0.0025, 0.0007], [0, 0.032, -0.154], 0.0003);
  pivot(slide, [0, 0.032, -0.154], 'front-sight');
  pivot(slide, [0, 0.032, 0.026], 'rear-sight');

  const magazine = pivot(grip, [0, -0.090, 0], 'magazine');
  block(magazine, blueSteel, [0.027, 0.082, 0.036], [0, 0.038, 0], 0.003);
  block(magazine, gunRubber, [0.039, 0.009, 0.050], [0, -0.002, 0], 0.003);
  rod(magazine, brass, [0, 0.077, 0.013], [0, 0.077, -0.011], 0.0043);

  const flash = pivot(muzzle, [0, 0, -0.038], 'muzzle-flash');
  const flare = surface(0xffbb55, 1);
  flare.emissive.setHex(0xff8b27);
  flare.emissiveIntensity = 4;
  oval(flash, flare, [0.015, 0.014, 0.057], [0, 0, -0.01]);
  rod(flash, flare, [0, 0, 0], [0.028, 0.030, -0.026], 0.008, 0.001, 5);
  rod(flash, flare, [0, 0, 0], [-0.034, -0.027, -0.038], 0.008, 0.001, 5);
  flash.visible = false;

  const right = makeGlove(body, [0.027, -0.102, 0.018], false, true, 'pistol-grip-hand');
  const left = makeGlove(body, [-0.036, -0.116, 0.011], true, false, 'pistol-support-hand');
  left.root.rotation.z = -0.10;
  for (const group of [body, slide, grip, magazine, flash]) batchRigid(group);
  return { body, slide, muzzle, grip, magazine, flash, right, left };
}

export function makeKnife(parent: THREE.Object3D) {
  const body = pivot(parent, [0, 0, 0], 'knife');
  const blade = new THREE.Shape();
  blade.moveTo(-0.019, 0);
  blade.lineTo(0.022, 0);
  blade.lineTo(0.023, 0.117);
  blade.quadraticCurveTo(0.019, 0.160, -0.008, 0.201);
  blade.lineTo(-0.019, 0.133);
  blade.lineTo(-0.019, 0);
  const forged = new THREE.ExtrudeGeometry(blade, {
    depth: 0.004, bevelEnabled: true, bevelThickness: 0.002,
    bevelSize: 0.003, bevelSegments: 3, curveSegments: 16,
  });
  part(body, forged, wornSteel, [0, 0.001, -0.056]).rotation.x = -Math.PI / 2;
  block(body, slideSteel, [0.016, 0.002, 0.142], [-0.004, 0.006, -0.131], 0.0008);
  block(body, blueSteel, [0.064, 0.015, 0.017], [0, 0, -0.054], 0.004);
  block(body, gunRubber, [0.032, 0.026, 0.111], [0, 0, 0.012], 0.006);
  block(body, blueSteel, [0.035, 0.030, 0.012], [0, 0, 0.067], 0.004);
  for (const side of [-1, 1]) {
    block(body, polymer, [.003, .020, .084], [side * .016, 0, .012], .003);
    for (let notch = 0; notch < 8; notch++) {
      block(body, gunRubber, [.001, .016, .0015], [side * .018, 0, -.024 + notch * .010], .0005).rotation.x = .2;
    }
    for (const z of [-.023, .046]) {
      rod(body, wornSteel, [side * .0175, 0, z], [side * .019, 0, z], .0032, .0032, 20);
      block(body, blueSteel, [.0005, .0008, .0035], [side * .0193, 0, z], .0002);
    }
  }
  const hand = pivot(body, [0, 0, 0], 'knife-grip-hand');
  oval(hand, glove, [0.019, 0.026, 0.050], [0.027, -0.004, 0.019]);
  block(hand, knuckle, [0.009, 0.029, 0.060], [0.040, -0.001, 0.018], 0.004);
  for (let index = 0; index < 4; index += 1) {
    const z = -0.030 + index * 0.017;
    curvedSkin(hand, glove, [[.028, -.011, z], [.011, -.027, z], [-.012, -.025, z], [-.022, -.010, z]],
      [.0098, .009, .0088, .008, .0078, .0065, .002], 20);
    curvedSkin(hand, gloveSeam, [[.034, -.010, z], [.015, -.034, z], [-.012, -.032, z], [-.027, -.012, z]],
      [.0013, .0014, .0014, .0006], 8);
  }
  rod(hand, glove, [0.028, 0.009, 0.009], [0.015, 0.020, -0.020], 0.010, 0.009);
  oval(hand, glove, [0.009, 0.009, 0.010], [0.015, 0.020, -0.020]);
  rod(hand, glove, [0.015, 0.020, -0.020], [-0.008, 0.019, -0.030], 0.009, 0.006);
  oval(hand, glove, [0.007, 0.006, 0.007], [-0.008, 0.019, -0.030]);
  const wrist = pivot(hand, [0.033, -0.010, 0.055]);
  batchRigid(hand);
  batchRigid(body);
  return { body, right: { wrist } };
}

export function makeGlove(parent: THREE.Object3D, at: Point, left: boolean, trigger: boolean, name: string) {
  const gloveRoot = pivot(parent, at, name);
  gloveRoot.scale.x = left ? -1 : 1;
  part(gloveRoot, palmGeometry(), glove, [0, 0, 0]);
  const cuff = new THREE.LatheGeometry([
    new THREE.Vector2(.024, -.020), new THREE.Vector2(.023, -.006),
    new THREE.Vector2(.020, .015),
  ], 32);
  cuff.rotateX(Math.PI / 2);
  part(gloveRoot, cuff, glove, [.004, -.013, .066]);
  // The dorsal reinforcement follows the palm; it does not add a second palm volume.
  const reinforcement = block(gloveRoot, knuckle, [.004, .044, .033], [.020, .001, .024], .002);
  reinforcement.rotation.y = -.07;
  for (let stitch = 0; stitch < 11; stitch++) {
    block(gloveRoot, gloveSeam, [.0012, .002, .0018], [.023, -.020 + stitch * .004, .040]);
  }
  const relaxed = name === 'knife-free-hand';
  for (let finger = 0; finger < 4; finger++) {
    const height = .032 - finger * .018;
    const index = trigger && finger === 0;
    const reach = [.062, .067, .062, .052][finger];
    const points: Point[] = relaxed ? [
      [-.002, height, -.007], [-.005, height, -.035],
      [-.017, height - .004, -reach], [-.030, height - .009, -reach - .010],
    ] : [
      [-.001, height, -.007],
      [-.004, height + (index ? .004 : 0), index ? -.043 : -.034],
      [-.025, height - .002, index ? -.062 : -.043],
      [-.047 + finger * .001, height - .004, index ? -.045 : -.023],
    ];
    part(gloveRoot, fingerGeometry(points, .0095 - finger * .00045), glove, [0, 0, 0]);
    // Only a low profile pad on the proximal phalanx, leaving each joint readable.
    const pad = oval(gloveRoot, knuckle, [.0068, .0027, .011],
      [-.004, height + .0075, -.022]);
    pad.rotation.x = -.10;
  }
  const thumb: Point[] = relaxed ? [
    [.009, .012, .047], [.004, .034, .035], [-.015, .047, .010], [-.037, .046, -.012],
  ] : trigger ? [
    [.010, .017, .040], [.001, .039, .026], [-.024, .045, .007], [-.044, .043, -.018],
  ] : [
    [.010, .018, .039], [.002, .043, .013], [-.008, .049, -.025], [-.014, .047, -.054],
  ];
  part(gloveRoot, fingerGeometry(thumb, .0128), glove, [0, 0, 0]);
  const wrist = pivot(gloveRoot, [.004, -.013, .066]);
  batchRigid(gloveRoot);
  return { root: gloveRoot, wrist };
}

export function makeForearm(parent: THREE.Object3D) {
  const arm = pivot(parent);
  const radius = (t: number) => .049 - .024 * t + Math.sin(t * Math.PI) * .005;
  const sleeveGeometry = new THREE.LatheGeometry(Array.from({ length: 65 }, (_, i) => {
    const t = i / 64;
    const gathering = Math.exp(-(((t - .76) / .22) ** 2));
    const fold = Math.sin(t * 48 + .3) * .0025 * gathering;
    return new THREE.Vector2(radius(t) + fold, t * .90);
  }), 40);
  const sleeveUv = sleeveGeometry.getAttribute('uv');
  for (let i = 0; i < sleeveUv.count; i++) {
    sleeveUv.setXY(i, sleeveUv.getX(i) * 1.5, sleeveUv.getY(i) * 2);
  }
  const positions = sleeveGeometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const angle = Math.atan2(z, x);
    const wrinkle = Math.sin(y * 31 + angle * 3) * .035 + Math.sin(y * 19 - angle * 2) * .018;
    positions.setXYZ(i, x * (.94 + wrinkle), y, z * (1.06 + wrinkle));
  }
  sleeveGeometry.computeVertexNormals();
  part(arm, sleeveGeometry, sleeve, [0, 0, 0]);
  for (const side of [-1, 1]) {
    const points: Point[] = Array.from({ length: 12 }, (_, i) => {
      const t = .13 + i / 11 * .72;
      const r = radius(t) + .0008;
      return [side * r * .70, t * .90, r * .74];
    });
    curvedSkin(arm, webbing, points, [.0008, .0008, .0008, .0007], 8);
  }
  // A narrow gathered cuff closes the sleeve around the same wrist anchor as the glove.
  const cuff = new THREE.LatheGeometry([
    new THREE.Vector2(.028, .86), new THREE.Vector2(.029, .90),
    new THREE.Vector2(.027, .94), new THREE.Vector2(.023, .99),
    new THREE.Vector2(.022, 1.01),
  ], 40);
  part(arm, cuff, glove, [0, 0, 0]);
  const band = new THREE.LatheGeometry([
    new THREE.Vector2(.029, .89), new THREE.Vector2(.030, .895),
    new THREE.Vector2(.030, .93), new THREE.Vector2(.028, .935),
  ], 40);
  part(arm, band, webbing, [0, 0, 0]);
  block(arm, knuckle, [.026, .034, .006], [0, .913, .028], .003);
  block(arm, cloth, [.016, .020, .0018], [0, .913, .032], .001);
  for (const x of [-.006, .006]) {
    block(arm, webbing, [.001, .014, .001], [x, .913, .0332]);
  }
  batchRigid(arm);
  return arm;
}
