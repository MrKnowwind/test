import * as THREE from 'three';
import { batchRigid, block, curvedSkin, ease, oval, pivot, rod } from './modelParts.ts';
import { pigment, shell } from './shell.ts';
import type { Point } from './modelParts.ts';
import type { EnemyState } from '../contracts/demo.ts';

const coveralls=pigment(0x364277), trousers=pigment(0x394061), leather=pigment(0x222940);
const skin=pigment(0xa884cc), tendon=pigment(0xff9e96), lesions=pigment(0xad4c99);
const ivory=pigment(0xe9dee3), visor=pigment(0x35244e), core=pigment(0xff676d,.65);
type Ring = readonly [height: number, x: number, z: number, radiusX: number, radiusZ: number, blend: number];

function bone(parent: THREE.Object3D, at: Point) {
  const joint = new THREE.Bone();
  joint.position.set(...at);
  parent.add(joint);
  return joint;
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
  // Fractured diving helmet and a bioluminescent jaw on the animated face bones.
  shell(head,ivory,[0,0,0],[[-.005,.077,.072,0],[.06,.138,.117,0],[.183,.148,.122,.009],[.244,.096,.087,.024]]);
  shell(head,visor,[0,.045,-.055],[[0,.069,.059,-.016],[.048,.130,.091,-.009],[.114,.132,.082,0],[.14,.099,.053,0]]);
  for(const side of [-1,1]) {
    const eye=block(head,core,[.078,.02,.012],[side*.064,.134,-.153],.006);
    eye.rotation.z=side*.24;
    const fang=shell(jaw,lesions,[side*.075,0,-.073],[[-.043,.009,.013,-.018],[.047,.042,.043,0],[.077,.031,.034,0]]);
    fang.rotation.z=side*.19;
  }
  for(const [x,y,h,lean] of [[-.10,.17,.19,.38],[.10,.16,.092,-.26],[-.034,.21,.12,.20]]) {
    const shard=shell(head,lesions,[x,y,.022],[[0,.052,.044,0],[h*.37,.044,.042,.015],[h,.005,.006,.054]]);
    shard.rotation.z=lean;
  }
  shell(chest,ivory,[0,.09,-.015],[[0,.114,.125,0],[.13,.207,.135,0],[.207,.188,.108,.005]]);
  shell(chest,core,[0,.12,-.155],[[0,.018,.013,0],[.069,.047,.026,0],[.113,.026,.017,0]]);
  shell(hips,leather,[0,.01,0],[[0,.173,.109,0],[.058,.185,.119,0]]);
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
    const armor=index===1?lesions:ivory;
    const cap=shell(shoulder,armor,[side*.011,0,0],[[-.123,.078,.087,0],[-.012,.115,.112,0],[.064,.067,.070,.009]]);
    cap.rotation.z=side*.24;
    if(index===1) {
      for(const [y,h] of [[-.045,.17],[-.14,.12]]) {
        const spur=shell(elbow,lesions,[.055,y,.012],[[0,.047,.046,0],[h*.4,.033,.037,0],[h,.004,.005,.024]]);
        spur.rotation.z=-.78;
      }
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
    shell(knee,ivory,[0,0,-.032],[[-.14,.046,.046,0],[-.03,.079,.062,-.006],[.045,.063,.050,0]]);
    block(foot, leather, [0.119, 0.091, 0.214], [0, -0.024, -0.049], 0.025);
    block(foot, leather, [.085, .062, .135], [0, .009, -.054], .022);
    for (let tread = 0; tread < 5; tread++) block(foot, visor, [.103,.009,.017], [0,-.083,-.132+tread*.038], .003);
    block(foot, visor, [0.121, 0.021, 0.217], [0, -0.073, -0.049], 0.007);
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
    rig.rotation.set(0, dead * Math.PI / 2, -dead * Math.PI / 2, 'ZYX');
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

