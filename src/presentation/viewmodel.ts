import * as THREE from 'three';
import type { WeaponState } from '../contracts/demo.ts';
import { ease } from './modelParts.ts';
import { makeForearm, makeGlove, makeKnife, makePistol } from './viewmodelModels.ts';

const up = new THREE.Vector3(0, 1, 0);
const sightHeight = 0.032;

export function createViewmodel() {
  const group = new THREE.Group();
  group.name = 'first-person-viewmodel';
  const pistol = makePistol(group);
  const firearms = { pistol };
  const knife = makeKnife(group);
  const freeHand = makeGlove(group, [-0.20, -0.19, -0.33], true, false, 'knife-free-hand');
  const rightArm = makeForearm(group);
  const leftArm = makeForearm(group);
  const rightBase = new THREE.Vector3(0.26, -0.38, -0.15);
  const leftBase = new THREE.Vector3(-0.27, -0.37, -0.16);
  const wrist = new THREE.Vector3();
  const forearm = new THREE.Vector3();
  const magazinePoint = new THREE.Vector3();
  let aimBlend = 0;
  let walkBlend = 0;
  let time = 0;
  let lastWeapon = 'pistol';
  let switchBlend = 0;
  let swayX = 0;
  let swayY = 0;
  const knifeMuzzle = new THREE.Object3D();
  knifeMuzzle.position.set(0, 0, -.24);
  knife.body.add(knifeMuzzle);

  function fitArm(arm: THREE.Group, end: THREE.Object3D, base: THREE.Vector3) {
    group.worldToLocal(end.getWorldPosition(wrist));
    forearm.subVectors(wrist, base);
    arm.position.copy(base);
    arm.scale.y = forearm.length();
    arm.quaternion.setFromUnitVectors(up, forearm.normalize());
  }

  function update(dt: number, weapon: WeaponState, moving: boolean,
    motion: { running?: boolean; lookX?: number; lookY?: number } = {}) {
    const firearm = weapon.id === 'pistol' ? pistol : undefined;
    const reloading = Boolean(firearm) && weapon.action === 'reloading';
    const aiming = Boolean(firearm) && weapon.aiming && !reloading;
    const p = THREE.MathUtils.clamp(weapon.actionProgress, 0, 1);
    const reload = reloading ? ease(p, 0, 0.19) * (1 - ease(p, 0.84, 1)) : 0;
    const shot = Boolean(firearm) && weapon.action === 'firing';
    const recoil = shot ? (1 - ease(p, 0, .75)) ** 2 : 0;
    const slash = weapon.id === 'knife' && weapon.action === 'slashing';

    time += dt;
    if (weapon.id !== lastWeapon) {
      switchBlend = 1;
      aimBlend = 0;
      lastWeapon = weapon.id;
    }
    switchBlend = THREE.MathUtils.damp(switchBlend, 0, 15, dt);
    const lookScale = aiming ? .12 : 1;
    swayX = THREE.MathUtils.damp(swayX, THREE.MathUtils.clamp((motion.lookX ?? 0) * .0008, -.018, .018) * lookScale, 12, dt);
    swayY = THREE.MathUtils.damp(swayY, THREE.MathUtils.clamp((motion.lookY ?? 0) * .0008, -.015, .015) * lookScale, 12, dt);
    group.position.set(-swayX, -switchBlend * .19 + swayY, 0);
    group.rotation.set(switchBlend * -.27, swayX * 1.8, swayX);
    aimBlend = THREE.MathUtils.damp(aimBlend, Number(aiming), 22, dt);
    if (aimBlend > 0.999) aimBlend = 1;
    if (aimBlend < 0.001) aimBlend = 0;
    walkBlend = THREE.MathUtils.damp(walkBlend, Number(moving), 10, dt);
    const cadence = motion.running ? 11 : 7;
    const bobX = Math.sin(time * cadence) * .007 * walkBlend;
    const bobY = Math.cos(time * cadence * 2) * .0045 * walkBlend + Math.sin(time * 2.1) * .0012;

    for (const [id, gun] of Object.entries(firearms)) gun.body.visible = weapon.id === id;
    knife.body.visible = freeHand.root.visible = weapon.id === 'knife';

    const hip = 1 - aimBlend;
    if (firearm) {
      firearm.body.position.set(.145 * hip + bobX * hip - reload * .065,
        -sightHeight - .065 * hip + bobY * hip + reload * .024 + recoil * .009,
        -.467 - aimBlend * .037 - reload * .075 + recoil * .022);
      firearm.body.rotation.set(.047 * hip + recoil * .094 + reload * .21,
        .13 * hip - reload * .52, -.065 * hip - reload * .69);
      firearm.slide.position.z = recoil * .031;
      firearm.flash.visible = shot && p < .14;
      firearm.flash.scale.setScalar(Math.max(.1, 1 - p * 2));
      const removed = reloading ? ease(p, 0.22, 0.43) * (1 - ease(p, 0.60, 0.83)) : 0;
      firearm.magazine.position.y = -.090 - removed * .154;
      const reach = reloading ? ease(p, 0.08, 0.22) * (1 - ease(p, 0.84, 0.98)) : 0;
      magazinePoint.copy(firearm.magazine.position);
      magazinePoint.applyMatrix4(firearm.grip.matrix);
      firearm.left.root.position.set(
        THREE.MathUtils.lerp(-.036, magazinePoint.x - .036, reach),
        THREE.MathUtils.lerp(-.116, magazinePoint.y + .001, reach),
        THREE.MathUtils.lerp(.011, magazinePoint.z + .006, reach),
      );
      firearm.left.root.rotation.set(-reach * .40, reach * .20, -.10 + reach * .52);
      fitArm(rightArm, firearm.right.wrist, rightBase);
      fitArm(leftArm, firearm.left.wrist, leftBase);
      return;
    }

    const drawBack = slash ? ease(p, 0, .14) * (1 - ease(p, .14, .31)) : 0;
    const strike = slash ? ease(p, .16, .36) * (1 - ease(p, .42, 1)) : 0;
    knife.body.position.set(0.185 + bobX + drawBack * 0.083 - strike * 0.24,
      -0.183 + bobY - drawBack * 0.046 + strike * 0.102,
      -0.356 + drawBack * 0.075 - strike * 0.086);
    knife.body.rotation.set(0.44 - drawBack * 0.26 - strike * 0.13,
      0.28 - drawBack * 0.81 + strike * 1.30, -0.38 - drawBack * 0.42 + strike * 0.58);
    freeHand.root.position.set(-0.213 - bobX - strike * 0.062, -0.205 + bobY - strike * 0.040, -0.325);
    freeHand.root.rotation.set(-0.43, -0.41, -0.39);
    fitArm(rightArm, knife.right.wrist, rightBase);
    fitArm(leftArm, freeHand.wrist, leftBase);
  }

  pistol.grip.updateMatrix();
  update(0, { id: 'knife', action: 'ready', actionProgress: 0, aiming: false, loaded: 0, reserve: 0 }, false);
  return { group, get muzzle() { return lastWeapon === 'knife' ? knifeMuzzle : firearms[lastWeapon as keyof typeof firearms].muzzle; }, update };
}
