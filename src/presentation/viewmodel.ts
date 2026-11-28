import * as THREE from 'three';
import type { ClimbPose, WeaponState } from '../contracts/demo.ts';
import { makeMedicalActions } from './medicalActions.ts';
import type { TreatmentPose } from '../combat/treatment.ts';
import { ease } from './modelParts.ts';
import { makeForearm, makeGlove, makeKnife, makePistol } from './viewmodelModels.ts';

const up = new THREE.Vector3(0, 1, 0);
const sightHeight = 0.032;

export function createViewmodel() {
  const group = new THREE.Group();
  group.name = 'first-person-viewmodel';
  const pistol = makePistol(group);
  const firearms = { pistol };
  const medical=makeMedicalActions(group);
  const knife = makeKnife(group);
  const freeHand = makeGlove(group, [-0.20, -0.19, -0.33], true, false, 'knife-free-hand');
  const climbHands = [
    makeGlove(group, [0,0,0], true, false, 'ledge-left'),
    makeGlove(group, [0,0,0], false, false, 'ledge-right'),
  ];
  const gripPoint = new THREE.Vector3();
  let climbingLastFrame = false, slideBlend = 0, crouchBlend = 0;
  const rightArm = makeForearm(group);
  const leftArm = makeForearm(group);
  const rightBase = new THREE.Vector3(0.26, -0.38, -0.15);
  const leftBase = new THREE.Vector3(-0.27, -0.37, -0.16);
  const wrist = new THREE.Vector3();
  const forearm = new THREE.Vector3();
  const magazinePoint = new THREE.Vector3();
  let aimBlend = 0;
  let walkBlend = 0, stepPhase=0, pickupTime=0, flashAngle=0;
  let firing=false, pendingFlash=false, sprintBlend=0;
  let lowReady = 0;
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
    motion: { climb?:ClimbPose; crouched?:boolean; sliding?:boolean; treatment?:TreatmentPose; lowered?:boolean; running?: boolean; lookX?: number; lookY?: number; speed?:number; airborne?:boolean; vertical?:number; landing?:number; intensity?:number } = {}) {
    const climb = motion.climb;
    if (climbingLastFrame && !climb) switchBlend = .65;
    climbingLastFrame = !!climb;
    slideBlend = THREE.MathUtils.damp(slideBlend, Number(!!motion.sliding), 14, dt);
    crouchBlend = THREE.MathUtils.damp(crouchBlend, Number(!!motion.crouched), 12, dt);
    const firearm = weapon.id === 'pistol' ? pistol : undefined;
    const reloading = Boolean(firearm) && weapon.action === 'reloading';
    const aiming = Boolean(firearm) && weapon.aiming && !reloading;
    const p = THREE.MathUtils.clamp(weapon.actionProgress, 0, 1);
    const reload = reloading ? ease(p, 0, 0.19) * (1 - ease(p, 0.84, 1)) : 0;
    const shot = Boolean(firearm) && weapon.action === 'firing';
    const recoil = shot ? Math.exp(-p*8)*Math.cos(p*8) : 0;
    if(shot && !firing)flashAngle+=2.40;
    firing=shot;
    pickupTime=Math.max(0,pickupTime-dt);
    const reachDown=Math.sin(Math.PI*pickupTime/.23);
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
    lowReady = THREE.MathUtils.damp(lowReady,Number(motion.lowered??false),13,dt);
    group.position.set(-swayX, -switchBlend * .19 + swayY - lowReady*.10 - reachDown*.035, lowReady*.13);
    group.rotation.set(switchBlend * -.27 - lowReady*.43, swayX * 1.8, swayX);
    aimBlend = THREE.MathUtils.damp(aimBlend, Number(aiming), 22, dt);
    if (aimBlend > 0.999) aimBlend = 1;
    if (aimBlend < 0.001) aimBlend = 0;
    const intensity = motion.intensity ?? 1;
    const speedBlend = motion.speed === undefined ? Number(moving) : Math.min(1, motion.speed / 4.5);
    walkBlend = THREE.MathUtils.damp(walkBlend, motion.airborne || motion.sliding ? 0 : speedBlend, 10, dt);
    sprintBlend=THREE.MathUtils.damp(sprintBlend,Number(!!motion.running && moving && !aiming && !shot && !reloading),10,dt);
    const cadence = motion.running ? 13 : motion.crouched ? 4.5 : 7;
    stepPhase+=dt*cadence*walkBlend;
    const bobX = Math.sin(stepPhase) * (.007 + sprintBlend*.008) * walkBlend * intensity;
    const bobY = (Math.cos(stepPhase * 2) * (.0045 + sprintBlend*.009) * walkBlend + Math.sin(time * 2.1) * .0012) * intensity;
    group.position.y -= (1-aimBlend) * intensity * ((motion.airborne ? (motion.vertical ?? 0) * .028 : 0) + (motion.landing ?? 0) * .052);
    group.rotation.x -= (1-aimBlend) * intensity * (motion.landing ?? 0) * .09;

    for (const [id, gun] of Object.entries(firearms)) gun.body.visible = weapon.id === id;
    knife.body.visible = freeHand.root.visible = weapon.id === 'knife';

    for (const hand of climbHands) hand.root.visible = !!climb;
    if (climb) {
      const t = climb.progress;
      const lower = ease(t, 0, .15);
      if (t < .15 && firearm) {
        firearm.body.position.set(.15, -.10 - lower*.32, -.46 + lower*.16);
        firearm.body.rotation.set(-lower*.65, .10, -lower*.28);
      } else if (firearm) firearm.body.visible = false;
      if (t < .15 && !firearm) knife.body.position.set(.19, -.18-lower*.34, -.36);
      else knife.body.visible = false;
      freeHand.root.visible = false;
      medical.root.visible = false;
      group.updateWorldMatrix(true,false);
      for (let i = 0; i < climbHands.length; i++) {
        const hand = climbHands[i], side = i === 0 ? -1 : 1;
        const anchor = i === 0 ? climb.left : climb.right;
        const grip = ease(t, .01 + i*.045, .23 + i*.035) * (1-ease(t,.63+i*.04,.96));
        gripPoint.set(...anchor);
        group.worldToLocal(gripPoint);
        hand.root.position.set(side*.16, -.17, -.36).lerp(gripPoint, grip);
        hand.root.rotation.set(-.16 + grip*.20, side*.12, side*(.22+grip*1.24));
        fitArm(i === 0 ? leftArm : rightArm, hand.wrist, i === 0 ? leftBase : rightBase);
      }
      return;
    }
    if(medical.update(dt,motion.treatment) && (motion.treatment || weapon.action==='ready')){
      pistol.body.visible=knife.body.visible=freeHand.root.visible=false;
      fitArm(rightArm,medical.right.wrist,rightBase);fitArm(leftArm,medical.left.wrist,leftBase);
      return;
    }
    medical.root.visible=false;
    const hip = 1 - aimBlend;
    group.position.y -= hip * (crouchBlend*.012 + slideBlend*.055);
    group.rotation.z += hip * slideBlend*.13;
    group.rotation.x -= hip * slideBlend*.22;
    if (firearm) {
      firearm.body.position.set(.145 * hip + bobX * hip - reload * .065,
        -sightHeight - .065 * hip + bobY * hip + reload * .024 + recoil * .015 - sprintBlend*.032,
        -.467 - aimBlend * .037 - reload * .075 + recoil * .039 + sprintBlend*.036);
      firearm.body.rotation.set(.047 * hip + recoil * .137 - sprintBlend*.22 + reload * .21,
        .13 * hip - reload * .52, -.065 * hip - reload * .69 - sprintBlend*.23 + recoil*.032);
      const lockBack=weapon.loaded===0 && !shot && (!reloading || p<.83);
      firearm.slide.position.z=shot?.035*(1-ease(p,.05,.32)):lockBack?.032:0;
      firearm.flash.visible = shot && p < .12;
      firearm.flash.rotation.z=flashAngle;
      firearm.flash.scale.setScalar(Math.max(.18, 1.12 - p * 7));
      const removed = reloading ? ease(p, 0.22, 0.43) * (1 - ease(p, 0.60, 0.83)) : 0;
      const turnOut=removed*(1-ease(p,.63,.8));
      firearm.magazine.position.set(-.027*turnOut,-.090-removed*.171,.028*turnOut);
      firearm.magazine.rotation.z=turnOut*.20;
      firearm.topRound.visible=weapon.loaded>0 || reloading && p>.52;
      const seat=reloading?Math.sin(Math.PI*ease(p,.73,.85)):0;
      firearm.body.position.y+=seat*.017;
      firearm.body.rotation.z+=seat*.045;
      const settle=reloading?Math.sin(Math.PI*ease(p,.84,.99)):0;
      firearm.body.rotation.x-=settle*.046;
      const release=reloading && weapon.loaded===0?Math.sin(Math.PI*ease(p,.79,.93)):0;
      const reach = reloading ? ease(p, 0.08, 0.22) * (1 - ease(p, 0.84, 0.98)) : 0;
      magazinePoint.copy(firearm.magazine.position);
      magazinePoint.applyMatrix4(firearm.grip.matrix);
      firearm.left.root.position.set(
        THREE.MathUtils.lerp(-.036, magazinePoint.x - .036, reach),
        THREE.MathUtils.lerp(-.116, magazinePoint.y + .001, reach)+release*.044,
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
  update(0, { id: 'knife', action: 'ready', actionProgress: 0, aiming: false, loaded: 0, magazineCapacity: 0, reserve: 0 }, false);
  return { group,ejection:pistol.ejection, markShot(){pendingFlash=true;}, present(){
    if(pendingFlash && pistol.body.visible){pistol.flash.visible=true;pistol.flash.scale.setScalar(1);pendingFlash=false;}
  }, pickup(){pickupTime=.23;}, get muzzle() { return lastWeapon === 'knife' ? knifeMuzzle : firearms[lastWeapon as keyof typeof firearms].muzzle; }, update };
}
