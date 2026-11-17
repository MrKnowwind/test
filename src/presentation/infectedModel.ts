import * as THREE from 'three';
import { batchRigid, block, curvedSkin, ease, oval, part, pivot, rod, surface } from './modelParts.ts';
import { applyFinish, faceAlbedo } from './finishes.ts';
import { infectedHeadGeometry, tornClothGeometry } from './infectedGeometry.ts';
import type { Point } from './modelParts.ts';
import type { EnemyState } from '../contracts/demo.ts';

const coveralls = surface(0x3e5153, 0.91);
const trousers = surface(0x3a403f, 0.95);
const leather = surface(0x282b28, 0.88);
const skin = surface(0x8a8773, 0.81);
const lesions = surface(0x5d4540, 0.76);
const tendon = surface(0x8d7867, 0.76);
const dirtyTape = surface(0x8c805c, 0.91);
const socket = new THREE.MeshStandardMaterial({ color: 0x221f1d, roughness: .96 });
for (const material of [coveralls, trousers, dirtyTape]) applyFinish(material, 'fabric');
for (const material of [skin, tendon, lesions]) applyFinish(material, 'skin');
applyFinish(leather, 'leather');

// Project the generated facial albedo onto the actual head surface; the sides fade to the shared skin.
const faceSkin = skin.clone();
if (faceAlbedo) {
  faceSkin.onBeforeCompile = shader => {
    shader.uniforms.infectedFaceColor = { value: faceAlbedo };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      varying vec2 vInfectedFaceUv;
      varying float vInfectedFaceBlend;`);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float y = position.y;
      float v;
      if (y >= .129) v = mix(.61, 1.0, (y - .129) / .106);
      else if (y >= .093) v = mix(.395, .61, (y - .093) / .036);
      else if (y >= .043) v = mix(.21, .395, (y - .043) / .05);
      else v = mix(0.0, .21, (y + .029) / .072);
      float x = position.x - .003 * exp(-pow((y - .07) / .09, 2.0));
      vInfectedFaceUv = clamp(vec2(x / .17 + .5, v), 0.002, .998);
      vInfectedFaceBlend = smoothstep(.005, .055, -position.z);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform sampler2D infectedFaceColor;
      varying vec2 vInfectedFaceUv;
      varying float vInfectedFaceBlend;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec4 sampledSkin = texture2D(map, vMapUv);
        vec4 sampledFace = texture2D(infectedFaceColor, vInfectedFaceUv);
        diffuseColor *= mix(sampledSkin, sampledFace, vInfectedFaceBlend);
      #endif`);
  };
  faceSkin.customProgramCacheKey = () => 'infected-facial-projection-v1';
}

type Ring = readonly [height: number, x: number, z: number, radiusX: number, radiusZ: number, blend: number];

function bone(parent: THREE.Object3D, at: Point) {
  const joint = new THREE.Bone();
  joint.position.set(...at);
  parent.add(joint);
  return joint;
}

function scarTissue(parent: THREE.Object3D, material: THREE.MeshStandardMaterial, size: Point, at: Point) {
  const geometry = new THREE.SphereGeometry(1, 32, 24);
  const p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const distortion = 1 + .06 * Math.sin(x * 9 + y * 11) * Math.cos(z * 13 - x * 4);
    p.setXYZ(i, x * size[0] * distortion, y * size[1] * distortion, z * size[2] * distortion);
  }
  geometry.computeVertexNormals();
  return part(parent, geometry, material, at);
}

// Build a smooth skin around the rest skeleton. Each ring blends between two adjacent bones.
function skinLoft(parent: THREE.Group, skeleton: THREE.Skeleton, material: THREE.Material, joints: [THREE.Bone, THREE.Bone], rings: Ring[]) {
  const sections = 32;
  const position: number[] = [];
  const uv: number[] = [];
  const skinIndex: number[] = [];
  const skinWeight: number[] = [];
  const faces: number[] = [];
  const [first, second] = joints.map(joint => skeleton.bones.indexOf(joint));
  const fabric = material === coveralls || material === trousers;
  const circumference = Math.max(...rings.map(ring => Math.PI * 2 * Math.sqrt((ring[3] ** 2 + ring[4] ** 2) / 2)));
  const repeatU = fabric ? circumference / .15 : 1;
  const repeatV = fabric ? 1 / .15 : .78;
  const samples: Ring[] = [];
  for (let ring = 0; ring < rings.length - 1; ring++) {
    for (let step = 0; step < 4; step++) {
      const t = step / 4;
      samples.push(rings[ring].map((v, axis) => THREE.MathUtils.lerp(v, rings[ring + 1][axis], t)) as unknown as Ring);
    }
  }
  samples.push(rings.at(-1)!);
  for (const [height, x, z, radiusX, radiusZ, blend] of samples) {
    for (let section = 0; section <= sections; section += 1) {
      const angle = (section / sections) * Math.PI * 2;
      const compression = Math.exp(-(((height - 1.22) / .09) ** 2)) + Math.exp(-(((height - .49) / .1) ** 2));
      const fold = fabric ? 1 + Math.sin(height * 49 + angle * 3) * .025 + Math.sin(height * 78 + angle * 2) * .025 * compression
        : 1 + Math.sin(height * 36 + angle * 4) * .004;
      position.push(x + Math.cos(angle) * radiusX * fold, height, z + Math.sin(angle) * radiusZ * fold);
      uv.push(section / sections * repeatU, height * repeatV);
      skinIndex.push(first, second, 0, 0);
      skinWeight.push(1 - blend, blend, 0, 0);
    }
  }
  for (let ring = 0; ring < samples.length - 1; ring += 1) {
    for (let section = 0; section < sections; section += 1) {
      const a = ring * (sections + 1) + section;
      const b = a + 1;
      faces.push(a, b, a + sections + 1, b, b + sections + 1, a + sections + 1);
    }
  }
  // Close the cloth at the neck, shoulder and cuff: open rings read as floating tubes in close views.
  for (const ring of [0, samples.length - 1]) {
    const [height, x, z, , , blend] = samples[ring];
    const center = position.length / 3;
    position.push(x, height, z);
    uv.push(.5 * repeatU, height * repeatV);
    skinIndex.push(first, second, 0, 0);
    skinWeight.push(1 - blend, blend, 0, 0);
    for (let section = 0; section < sections; section++) {
      const a = ring * (sections + 1) + section;
      if (ring === 0) faces.push(center, a + 1, a);
      else faces.push(center, a, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  mesh.bind(skeleton);
}

export function makeInfected(group: THREE.Group) {
  const rig = pivot(group);
  const hips = bone(rig, [0, 0.91, 0]);
  const chest = bone(hips, [0, 0.30, 0]);
  const head = bone(chest, [0.018, 0.40, -0.032]);
  const jaw = bone(head, [0.013, 0.008, -0.023]);
  const arms = [-1, 1].map(side => {
    const shoulder = bone(chest, [side * 0.226, 0.282, -0.005]);
    const elbow = bone(shoulder, [side * 0.030, -0.281, -0.014]);
    const hand = bone(elbow, [side * 0.022, -0.268, -0.014]);
    return { shoulder, elbow, hand };
  });
  const legs = [-1, 1].map(side => {
    const thigh = bone(hips, [side * 0.108, -0.020, 0.002]);
    const knee = bone(thigh, [side * 0.023, -0.395, -0.027]);
    const foot = bone(knee, [0, -0.411, 0.012]);
    return { thigh, knee, foot };
  });
  rig.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([
    hips, chest, head, jaw,
    ...arms.flatMap(arm => [arm.shoulder, arm.elbow, arm.hand]),
    ...legs.flatMap(leg => [leg.thigh, leg.knee, leg.foot]),
  ]);

  skinLoft(rig, skeleton, coveralls, [hips, chest], [
    [1.60, 0.018, -0.014, 0.074, 0.077, 1],
    [1.54, 0.010, 0.004, 0.188, 0.113, 1],
    [1.49, 0.010, 0.010, 0.241, 0.125, 1],
    [1.37, 0.010, 0.019, 0.218, 0.143, 0.96],
    [1.22, 0, 0.014, 0.164, 0.124, 0.66],
    [1.07, -0.009, 0.005, 0.153, 0.099, 0.23],
    [0.96, 0, 0.002, 0.177, 0.113, 0],
    [0.84, 0, 0.002, 0.136, 0.084, 0],
  ]);
  rod(chest, skin, [.017, .286, -.022], [.017, .423, -.032], .068, .050, 28);
  const tornPocket = part(chest, tornClothGeometry(.143, .135), coveralls, [-.105, .126, -.128]);
  tornPocket.rotation.set(-.09, -.18, -.09);
  block(chest, dirtyTape, [.068, .013, .003], [-.121, .174, -.139], .001);
  block(chest, leather, [.009, .287, .006], [.006, .127, -.133], .002).rotation.x = -.08;
  block(chest, dirtyTape, [.006, .018, .005], [.006, .152, -.143], .001);
  scarTissue(chest, lesions, [.037, .083, .007], [.127, .137, -.124]);
  const tornFront = part(chest, tornClothGeometry(.082, .171, .011), coveralls, [.098, .175, -.140]);
  tornFront.rotation.set(-.14, .45, -.20);
  rod(chest, leather, [-.170, .287, -.075], [-.073, -.065, -.119], .013, .010, 12);
  block(chest, leather, [.084, .102, .028], [-.114, -.009, .119], .010).rotation.z = .12;
  for (let stitch = 0; stitch < 17; stitch++) {
    const y = -.09 + stitch * .022;
    block(chest, dirtyTape, [.001, .004, .001], [-.062, y, -.129 + Math.abs(y) * .07]);
  }
  // A distorted respirator strap and split industrial collar connect the face to its former workwear.
  for (const side of [-1, 1]) {
    const collar = block(chest, coveralls, [.081, .047, .016], [side * .066, .297, -.073], .006);
    collar.rotation.z = side * -.31;
  }
  block(hips, leather, [0.329, 0.047, 0.192], [0, 0.028, 0], 0.02);
  block(hips, dirtyTape, [.038, .025, .009], [-.043, .027, -.110], .004);

  const skull = part(head, infectedHeadGeometry(), faceSkin, [0, 0, 0]);
  skull.name = 'infected-head';
  const sclera = surface(0x9d9d84, .38);
  const iris = surface(0x494c3b, .46);
  for (const side of [-1, 1]) {
    // Flattened eyes seated inside the sculpted socket, with a narrow lid opening.
    oval(head, socket, [.014, .005, .004], [side * .033 + .003, .128, -.066]);
    oval(head, sclera, [.0105, .0032, .004], [side * .033 + .003, .128, -.070]);
    oval(head, iris, [.0035, .0034, .0018], [side * .033 + .002, .128, -.074]);
    oval(head, socket, [.0016, .0021, .001], [side * .033 + .002, .128, -.0758]);
    for (const lid of [-1, 1]) curvedSkin(head, skin,
      [[side * .033 - .012, .128, -.069], [side * .033 + .003, .128 + lid * .005, -.074],
        [side * .033 + .017, .128, -.067]], [.001, .0025, .001], 12);
    oval(head, socket, [.0037, .002, .002], [side * .010, .085, -.102]);
  }
  curvedSkin(head, socket, [[-.025, .043, -.078], [.004, .042, -.083], [.030, .045, -.074]],
    [.0006, .0016, .0006], 16);
  for (const side of [-1, 1]) {
    const ear = new THREE.SphereGeometry(1, 16, 16);
    ear.scale(.012, .027, .016);
    part(head, ear, skin, [side * .083, .112, .003]).rotation.z = side * -.10;
    curvedSkin(head, lesions, [[side * .090, .13, -.005], [side * .094, .109, -.010], [side * .087, .092, -.005]],
      [.0015, .002, .001, .0005], 8);
  }
  const respirator = surface(0x2b332f, .86);
  // The torn respirator hangs below the chin from a thin woven strap.
  curvedSkin(head, leather, [[-.077, .13, .004], [-.083, .026, -.027], [-.035, -.031, -.052], [.071, .015, -.009]],
    [.003, .003, .003, .001], 10);
  const mask = oval(head, respirator, [.040, .023, .020], [-.033, -.023, -.059]);
  mask.rotation.z = -.35;
  const filter = rod(head, respirator, [-.049, -.023, -.066], [-.059, -.028, -.092], .012, .015, 24);
  filter.rotation.z = -.25;
  for (let slit = -2; slit <= 2; slit++) {
    block(head, socket, [.015, .0013, .002], [-.059, -.028 + slit * .004, -.093], .0004);
  }

  for (const [index, { shoulder, elbow, hand }] of arms.entries()) {
    const side = index === 0 ? -1 : 1;
    const bulk = index === 0 ? .073 : .077;
    skinLoft(rig, skeleton, index === 0 ? coveralls : skin, [shoulder, elbow], [
      [1.535, side * .198, 0, .016, .018, 0],
      [1.520, side * .213, 0, .053, .054, 0],
      [1.508, side * .226, 0, bulk * .91, bulk * .81, 0],
      [1.46, side * 0.229, 0, bulk, bulk * 0.85, 0],
      [1.32, side * 0.244, -0.012, 0.063, 0.068, 0.08],
      [1.22, side * 0.255, -0.018, 0.057, 0.059, 0.64],
      [1.10, side * 0.266, -0.023, 0.063, 0.058, 1],
      [1.01, side * 0.272, -0.028, 0.046, 0.045, 1],
      [0.93, side * 0.278, -0.033, 0.034, 0.032, 1],
    ]);
    if (index === 1) {
      const sleeve = part(shoulder, tornClothGeometry(.125, .15, .008), coveralls, [.009, -.052, -.060]);
      sleeve.rotation.set(.04, .1, -.10);
      for (let node = 0; node < 4; node += 1) {
        scarTissue(shoulder, lesions,
          [.006, .027, .003], [.009 + node * .011, -.096 - node * .023, -.068 + node * .003]);
      }
    } else {
      block(shoulder, dirtyTape, [0.020, 0.044, 0.076], [-0.067, -0.095, -0.008], 0.006);
    }
    oval(hand, skin, [.034, .060, .023], [0, -.039, -.001]);
    for (let finger = 0; finger < 4; finger += 1) {
      const x = -0.029 + finger * 0.019;
      const reach = [0.137, .148, .141, .122][finger];
      curvedSkin(hand, index === 1 ? tendon : skin,
        [[x, -.061, -.001], [x * 1.18, -.091, -.012], [x * 1.45, -reach + .033, -.027],
          [x * 1.50, -reach, -.045]],
        [.010, .0095, .009, .008, .0075, .005, .0002], 16);
    }
    rod(hand, tendon, [side * -0.022, -0.013, 0], [side * -0.048, -0.067, -0.025], 0.017, 0.009, 8);
    if (index === 1) pivot(hand, [0, -0.12, -0.032], 'infected-strike-hand');
  }

  const soles: THREE.Object3D[] = [];
  // A continuous trouser yoke overlaps both thigh openings, including during turns.
  skinLoft(rig, skeleton, trousers, [hips, chest], [
    [.977, 0, .002, .167, .102, 0], [.93, 0, .002, .181, .112, 0],
    [.84, 0, .004, .178, .103, 0], [.78, 0, .004, .151, .086, 0],
  ]);
  for (const [index, { thigh, knee, foot }] of legs.entries()) {
    const side = index === 0 ? -1 : 1;
    skinLoft(rig, skeleton, trousers, [thigh, knee], [
      [0.925, side * 0.106, 0, 0.093, 0.086, 0],
      [0.825, side * 0.112, 0.002, 0.103, 0.102, 0],
      [0.675, side * 0.118, 0.003, 0.090, 0.079, 0.09],
      [0.548, side * 0.128, -0.023, 0.075, 0.073, 0.43],
      [0.461, side * 0.133, -0.026, 0.068, 0.077, 0.90],
      [0.338, side * 0.134, -0.010, 0.076, 0.073, 1],
      [0.210, side * 0.133, 0.005, 0.058, 0.053, 1],
      [0.108, side * 0.130, -0.009, 0.049, 0.052, 1],
    ]);
    const pocket = part(thigh, tornClothGeometry(.112, .163), trousers, [side * .046, -.173, -.083]);
    pocket.rotation.y = side * -.35;
    rod(thigh, leather, [side * .071, -.052, .028], [side * .056, -.30, .025], .0025, .002, 8);
    block(knee, leather, [.099, .101, .022], [0, .004, -.061], .023).rotation.z = side * .11;
    block(knee, trousers, [.074, .073, .006], [0, .005, -.077], .014).rotation.z = side * .11;
    rod(knee, leather, [-.068, .034, 0], [.068, .034, 0], .009, .009, 12);
    for (let lace = 0; lace < 4; lace++) {
      const z = -.10 + lace * .026;
      rod(foot, dirtyTape, [-.035, .025, z], [.035, .023, z + .02], .0024, .0024, 6);
    }
    block(foot, leather, [0.119, 0.091, 0.214], [0, -0.024, -0.049], 0.025);
    block(foot, leather, [.085, .062, .135], [0, .009, -.054], .022);
    for (let tread = 0; tread < 5; tread++) block(foot, socket, [.103,.009,.017], [0,-.083,-.132+tread*.038], .003);
    block(foot, socket, [0.121, 0.021, 0.217], [0, -0.073, -0.049], 0.007);
    rod(foot, leather, [0, -.011, .016], [0, .079, .016], .054, .045, 24);
    curvedSkin(foot, trousers, [[-.048, -.038, -.137], [0, -.023, -.149], [.048, -.038, -.137]],
      [.001, .0015, .0015, .001], 8);
    for (const side of [-1, 1]) {
      curvedSkin(foot, trousers, [[side * .049, -.057, .043], [side * .055, -.057, -.056], [side * .045, -.057, -.143]],
        [.0013, .0013, .0013, .001], 8);
    }
    for (const z of [-0.15, 0.05]) soles.push(pivot(foot, [0, -0.0875, z], 'infected-sole-'+soles.length));
  }
  for (const joint of skeleton.bones) batchRigid(joint);

  const sample = new THREE.Vector3();
  const bounds = new THREE.Box3();
  let time = 0;
  let gait = 0;
  let death = 0;
  let damage = 0;
  let health: number | undefined;
  let lastPosition: readonly number[] | undefined;
  let phase = 0;
  let initialized = false;
  function pose(node: THREE.Object3D, x: number, y: number, z: number, dt: number) {
    const damping = initialized ? 1 - Math.exp(-12 * dt) : 1;
    node.rotation.set(THREE.MathUtils.lerp(node.rotation.x,x,damping),
      THREE.MathUtils.lerp(node.rotation.y,y,damping),THREE.MathUtils.lerp(node.rotation.z,z,damping));
  }

  return (dt: number, enemy: EnemyState) => {
    if (enemy.action === 'dead' && death >= 1) return;
    time += dt;
    gait = THREE.MathUtils.damp(gait, Number(enemy.action === 'moving'), 12, dt);
    death = enemy.action === 'dead' ? Math.min(1, death + dt / 0.55) : 0;
    damage = health !== undefined && enemy.health < health ? 1 : Math.max(0, damage - dt * 5);
    health = enemy.health;
    const dead = ease(death, 0, 1);
    const p = enemy.actionProgress;
    const windup = enemy.action === 'windup' ? ease(p, 0, 0.85) : 0;
    const attack = enemy.action === 'attacking' ? 1 - ease(p, 0.42, 1) : 0;
    const recover = enemy.action === 'recovering' ? (1 - ease(p, 0, 1)) * 0.22 : 0;
    const travel = lastPosition ? Math.hypot(enemy.position[0]-lastPosition[0],enemy.position[2]-lastPosition[2]) : 0;
    lastPosition = [...enemy.position];
    phase += Math.min(travel,.2) * 7.8;
    const stride = Math.sin(phase) * gait;

    rig.position.set(0, 0, 0);
    rig.rotation.set(dead * -0.09, dead * 1.35, dead * -1.55, 'ZYX');
    pose(chest,-0.18 + windup * 0.24 - attack * 0.49 - recover + damage * 0.25,
      windup * 0.42 - attack * 0.24 + stride * 0.075, -0.09 - dead * 0.15, dt);
    chest.position.z = THREE.MathUtils.damp(chest.position.z, -attack * .12, 12, dt);
    pose(head,0.04 + windup * 0.22 + attack * 0.29 - damage * 0.28,
      -0.10 - windup * 0.28 - stride * 0.09, 0.11 + Math.sin(time * 1.9) * 0.03, dt);
    jaw.rotation.x = 0.14 + windup * 0.44 + attack * 0.38;
    pose(arms[0].shoulder,0.17 + stride * 0.35 + windup * 0.49 + attack * 1.20, 0, -0.14 - windup * 0.43, dt);
    pose(arms[1].shoulder,0.33 - stride * 0.35 + windup * 1.24 + attack * 1.12, windup * -0.30, 0.19 + windup * 0.72, dt);
    pose(arms[0].elbow,0.32 + windup * 0.29 - dead * 0.23,0,0,dt);
    pose(arms[1].elbow,0.22 + windup * 1.09 - attack * 0.17 - dead * 0.14,0,0,dt);
    pose(arms[1].hand,0.07 + windup * 0.32 - attack * 0.24,0,0,dt);
    for (const [index, leg] of legs.entries()) {
      const step = index === 0 ? stride : -stride;
      leg.thigh.rotation.set(step * 0.53 + attack * (index === 0 ? 0.45 : -0.28) + dead * 0.05, 0, index === 0 ? -0.02 : 0.06);
      leg.knee.rotation.x = -0.13 - Math.max(0, step) * 0.58 - dead * 0.15;
      leg.foot.rotation.x = -leg.thigh.rotation.x - leg.knee.rotation.x;
    }
    initialized = true;
    if (dead > 0) {
      // Settle the visible body onto the floor even with a rotated or translated spawn.
      group.updateWorldMatrix(true, false);
      rig.updateMatrixWorld(true);
      rig.position.y = group.getWorldPosition(sample).y - bounds.setFromObject(rig, true).min.y;
    } else {
      rig.position.y = -Math.min(...soles.map(sole => group.worldToLocal(sole.getWorldPosition(sample)).y));
    }
  };
}

