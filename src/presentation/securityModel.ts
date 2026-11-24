import * as THREE from 'three';
import { batchRigid, block, curvedSkin, ease, oval, part, pivot, rod, surface } from './modelParts.ts';
import { sweptPlate, tailoring } from './sculpt.ts';
import { shell, pigment } from './shell.ts';
import type { Point } from './modelParts.ts';
import type { EnemyState } from '../contracts/demo.ts';

const armor=pigment(0x709ab0), rim=pigment(0xc7e1d9), frame=pigment(0x374468);
const rubber=pigment(0x29334e), piston=pigment(0x90e4eb), stripe=pigment(0xfd8067), steel=pigment(0x586e95);
const up = new THREE.Vector3(0, 1, 0);
const axis = new THREE.Vector3();

function positionLink(group: THREE.Group, start: Point, end: Point) {
  group.position.set(...start);
  axis.set(...end).sub(group.position);
  group.scale.y = axis.length();
  group.quaternion.setFromUnitVectors(up, axis.normalize());
}

function makeLeg(root: THREE.Group, side: number, end: number) {
  const upper = pivot(root);
  const lower = pivot(root);
  const foot = pivot(root);
  const knee = pivot(root);
  block(upper, armor, [0.119, 0.69, 0.138], [0, 0.47, 0], 0.022);
  block(upper, steel, [0.130, 0.39, 0.070], [0, 0.49, 0.063 * end], 0.011);
  block(upper, stripe, [0.123, 0.12, 0.004], [0, 0.62, 0.071 * end], 0.002);
  sweptPlate(upper,rim,[[0,.11,0,.054,.042],[side*.032,.29,end*.025,.089,.061],[side*.061,.62,end*.018,.088,.065],[side*.048,.86,-end*.014,.027,.032]],[side,0,-end*.36]);
  rod(lower, steel, [0, 0.02, 0], [0, 0.95, 0], 0.043, 0.037, 8);
  rod(lower, frame, [0, 0.38, 0], [0, 0.84, 0], 0.056, 0.052, 8);
  rod(lower, piston, [0.034 * side, 0.05, 0.037], [0.035 * side, 0.95, 0.037], 0.013, 0.013, 8);
  rod(knee, frame, [-0.072, 0, 0], [0.072, 0, 0], 0.079, 0.079, 12);
  rod(knee, piston, [0.065 * side, 0, 0], [0.077 * side, 0, 0], 0.043, 0.043, 10);
  curvedSkin(upper, rubber, [[.046 * side, .22, -.031], [.065 * side, .36, -.061], [.057 * side, .62, -.038], [.03 * side, .79, .016]],
    [.009, .009, .008, .008], 10);
  for (const y of [.35, .65]) {
    block(upper, frame, [.134, .023, .164], [0, y, 0], .006);
  }
  block(foot, frame, [0.143, 0.062, 0.195], [0, 0.038, 0], 0.015);
  block(foot, rubber, [0.154, 0.028, 0.202], [0, 0.014, 0], 0.007);
  for (const x of [-0.044, 0.044]) block(foot, rim, [0.037, 0.040, 0.043], [x, 0.032, -0.084], 0.007);
  for (const piece of [upper, lower, knee, foot]) batchRigid(piece);

  return (height: number, stride: number, lift: number, lock: number, down: number) => {
    const shoe: Point = [side * (0.375 + lock * 0.030), lift, end * 0.332 + stride];
    const hip: Point = [side * 0.197, height - 0.025, end * 0.198];
    const bend: Point = [side * (0.388 + down * 0.025), height * 0.58 + lift * 0.24, end * (0.333 + down * 0.067) + stride * 0.48];
    knee.position.set(...bend);
    foot.position.set(...shoe);
    positionLink(upper, hip, bend);
    positionLink(lower, bend, [shoe[0], shoe[1] + 0.055, shoe[2]]);
  };
}

export function makeSecurityBot(group: THREE.Group) {
  const deck = pivot(group, [0, 0.82, 0]);
  const turret = pivot(deck, [0, 0.31, -0.029]);
  const gun = pivot(turret, [0, 0, -0.18]);
  const lens = surface(0x89d9d2, 0.37, 0.18);
  const sensor = block(turret, lens, [0.187, 0.047, 0.021], [0, 0.018, -0.186], 0.012);
  sensor.name = 'security-sensor';
  const shields: THREE.Group[] = [];
  const legs: ReturnType<typeof makeLeg>[] = [];
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) legs.push(makeLeg(group, side, end));
    const shield = pivot(turret, [side * 0.202, 0.01, -0.011], side < 0 ? 'security-left-shield' : 'security-right-shield');
    sweptPlate(shield,frame,[[side*.009,-.045,-.161,.055,.046],[side*.054,.026,-.044,.132,.064],[side*.095,.060,.097,.137,.061],[side*.126,.120,.239,.066,.038],[side*.136,.164,.299,.009,.008]],[side*.85,.55,0]);
    sweptPlate(shield,armor,[[side*.014,-.012,-.171,.029,.032],[side*.099,.058,-.022,.092,.064],[side*.127,.098,.093,.105,.059],[side*.143,.152,.216,.052,.029],[side*.141,.179,.283,.004,.003]],[side*.8,.75,0]);
    sweptPlate(shield,stripe,[[side*.134,.095,-.082,.011,.010],[side*.162,.118,.009,.013,.009],[side*.178,.137,.098,.003,.003]],[side*.8,.7,0]);
    batchRigid(shield);
    shields.push(shield);
    block(deck, frame, [0.151, 0.147, 0.547], [side * 0.194, -0.030, 0.001], 0.023);
    block(deck, rim, [0.132, 0.089, 0.347], [side * 0.166, 0.081, 0.013], 0.019);
    for (let vent = 0; vent < 5; vent += 1) {
      block(deck, rubber, [0.098, 0.005, 0.013], [side * 0.151, 0.127, 0.052 + vent * 0.026], 0.001);
    }
  }
  shell(deck,frame,[0,0,.04],[[-.13,.17,.23,0],[.045,.314,.32,0],[.15,.23,.26,.021]]);
  for(const side of [-1,1]) {
    shell(deck,armor,[side*.22,.07,.13],[[0,.095,.15,0],[.12,.106,.155,.02],[.18,.073,.091,.05]]);

  }
  tailoring(deck,armor,[0,0,0],[[-.11,.17,.21,0],[-.045,.276,.292,-.01],[.059,.29,.291,.008],[.118,.22,.245,.02],[.142,.12,.16,.024]]);
  for(let n=0;n<3;n++){
    const z=.068+n*.075;
    sweptPlate(deck,rim,[[-.21,.084,z,.035,.025],[0,.153,z+.035,.044,.028],[.21,.084,z,.035,.025]],[0,1,0]);
  }
  block(deck, frame, [0.242, 0.091, 0.460], [0, -0.111, 0.003], 0.025);
  block(deck, stripe, [0.331, 0.031, 0.012], [0, 0.016, -0.265], 0.004);
  rod(deck, steel, [0, 0.069, -0.019], [0, 0.277, -0.019], 0.153, 0.123, 10);
  rod(deck, frame, [0, 0.174, -0.019], [0, 0.211, -0.019], 0.155, 0.155, 10);
  tailoring(turret,frame,[0,0,-.01],[[-.108,.13,.12,-.01],[-.057,.191,.171,-.022],[.060,.204,.168,-.015],[.123,.135,.135,0]]);
  sweptPlate(turret,armor,[[0,.028,-.21,.079,.035],[0,.112,-.142,.153,.046],[0,.142,-.014,.174,.049],[0,.105,.116,.125,.041],[0,.068,.194,.026,.014]],[0,1,0]);
  const opticalRing=new THREE.Mesh(new THREE.TorusGeometry(.059,.012,7,24),rim);
  opticalRing.position.set(0,.044,-.230);turret.add(opticalRing);
  sensor.scale.set(.57,1.46,1);sensor.position.set(0,.044,-.234);
  for(const side of [-1,1]){
    sweptPlate(turret,rim,[[side*.032,.050,-.213,.021,.012],[side*.113,.075,-.166,.027,.022],[side*.193,.065,-.064,.018,.015],[side*.211,.050,-.01,.004,.006]],[0,.65,-1]);
  }
  for (const side of [-1, 1]) {
    const cheek = block(turret, armor, [.043, .127, .142], [side * .211, .029, -.083], .013);
    cheek.rotation.z = side * -.18;
    for (const z of [-.102, -.021, .066]) {
      rod(turret, frame, [side * .235, -.003, z], [side * .239, -.003, z], .007, .007, 6);
    }
    curvedSkin(deck, rubber, [[side * .18, .08, .13], [side * .24, .14, .15], [side * .23, .25, .13], [side * .18, .32, .071]],
      [.010, .010, .009, .009], 12);
  }
  rod(turret, rubber, [-0.142, 0.133, 0.129], [-0.168, 0.337, 0.163], 0.015, 0.007, 8);
  block(turret, frame, [0.249, 0.085, 0.034], [0, 0.017, -0.165], 0.012);
  block(gun, steel, [0.125, 0.082, 0.101], [0, -0.072, -0.036], 0.013);
  rod(gun, steel, [0, -0.071, -0.065], [0, -0.071, -0.183], 0.027, 0.023, 12);
  rod(gun, frame, [0, -0.071, -0.141], [0, -0.071, -0.188], 0.034, 0.034, 12);
  part(gun, new THREE.CircleGeometry(0.022, 12), rubber, [0, -0.071, -0.189]).rotation.y = Math.PI;
  const flash = surface(0xffb546, 0.92);
  flash.emissive.setHex(0xffa038);
  flash.emissiveIntensity = 4;
  const fire = oval(gun, flash, [0.047, 0.036, 0.091], [0, -0.071, -0.233]);
  fire.visible = false;
  sensor.removeFromParent();
  fire.removeFromParent();
  for (const piece of [deck, turret, gun]) batchRigid(piece);
  turret.add(sensor);
  gun.add(fire);

  let time = 0;
  let walk = 0;
  let death = 0, previousHealth:number|undefined, flinch=0;
  return (dt: number, enemy: EnemyState) => {
    if(previousHealth!==undefined && enemy.health<previousHealth)flinch=1;
    previousHealth=enemy.health;
    flinch=Math.max(0,flinch-dt*5);
    time += dt;
    walk = THREE.MathUtils.damp(walk, Number(enemy.action === 'moving'), 12, dt);
    death = enemy.action === 'dead' ? Math.min(1, death + dt / 0.43) : 0;
    const collapsed = ease(death, 0, 1);
    const p = enemy.actionProgress;
    const firing = enemy.action === 'attacking';
    const windup = enemy.action === 'windup' ? ease(p, 0, 0.8) : 0;
    const recoil = firing ? 1 - ease(p, 0, 0.61) : 0;
    const recovering = enemy.action === 'recovering' ? 1 - ease(p, 0, 1) : 0;
    const opened = Math.max(windup, Number(firing), recovering);
    const height = 0.82 - opened * 0.071 - collapsed * 0.48 + Math.sin(time * 15) * walk * 0.021;
    deck.position.y = height;
    deck.rotation.set(recoil*.12-flinch*.09,0,collapsed*.18+flinch*.12*(1-collapsed));
    turret.rotation.set(-opened * 0.035 - collapsed * 0.49, Math.sin(time * 1.24) * 0.27 * (1 - opened) + collapsed * 0.36, collapsed * -0.20);
    gun.position.z = -0.18 - opened * 0.059 + recoil * 0.068;
    for (const [index, shield] of shields.entries()) {
      shield.rotation.z = (index === 0 ? -1 : 1) * (opened * 1.02 + collapsed * 0.28 + flinch*.22);
      shield.rotation.y = (index === 0 ? -1 : 1) * (opened * 0.36);
    }
    lens.color.setHex(collapsed > 0.35 ? 0x29312c : opened > 0.08 ? 0xf58e41 : 0x89d9d2);
    lens.emissive.copy(lens.color);
    lens.emissiveIntensity = (0.75 + opened * (1.7 + Math.sin(time * 35) * 0.50)) * (1 - collapsed);
    fire.visible = firing && p < 0.17;
    fire.scale.setScalar(1 - 2.5 * p);
    for (const [index, leg] of legs.entries()) {
      const cycle = Math.sin(time * 11 + (index === 1 || index === 2 ? Math.PI : 0));
      leg(height, cycle * walk * 0.091, Math.max(0, cycle) * walk * 0.070, opened, collapsed);
    }
  };
}
