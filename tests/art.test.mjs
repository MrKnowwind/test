import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { createViewmodel } from '../src/presentation/viewmodel.ts';
import { createEnemyVisual } from '../src/presentation/enemyVisuals.ts';

const pistol = { id: 'pistol', aiming: false, action: 'ready', actionProgress: 0, loaded: 6, reserve: 6 };

test('the sights line up with the camera ray while moving in ADS', () => {
  const viewmodel = createViewmodel();
  const camera = new PerspectiveCamera(62, 16 / 9, 0.04, 100);
  camera.position.set(7, 1.7, -12);
  camera.rotation.set(-0.24, 1.16, 0);
  camera.add(viewmodel.group);
  viewmodel.update(0.016, pistol, false);
  const hipMuzzle = viewmodel.muzzle.getWorldPosition(new Vector3());
  for (let frame = 0; frame < 36; frame += 1) {
    viewmodel.update(1 / 60, { ...pistol, aiming: true }, true);
  }
  camera.updateMatrixWorld(true);
  for (const [fov, aspect] of [[62, 16 / 9], [47, 4 / 3]]) {
    camera.fov = fov;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    for (const sight of ['front-sight', 'rear-sight']) {
      const point = viewmodel.group.getObjectByName(sight).getWorldPosition(new Vector3()).project(camera);
      assert.ok(Math.hypot(point.x, point.y) < 0.001);
    }
  }
  const adsMuzzle = viewmodel.muzzle.getWorldPosition(new Vector3());
  assert.ok(adsMuzzle.distanceTo(hipMuzzle) > 0.1);
  assert.ok(camera.worldToLocal(adsMuzzle).z < -0.45);
});

test('the shot exposes a short muzzle flash and the reload returns the magazine to its original seat', () => {
  const { group, update } = createViewmodel();
  const flash = group.getObjectByName('muzzle-flash');
  const magazine = group.getObjectByName('magazine');
  const support = group.getObjectByName('pistol-support-hand');
  const position = node => node.getWorldPosition(new Vector3());
  update(0, pistol, false);
  const seated = magazine.position.clone();
  update(1 / 60, { ...pistol, action: 'firing', actionProgress: 0 }, false);
  assert.equal(flash.visible, true);
  update(1 / 60, { ...pistol, action: 'firing', actionProgress: 0.22 }, false);
  assert.equal(flash.visible, false);
  for (const actionProgress of [0.34, 0.5, 0.71]) {
    update(1 / 60, { ...pistol, action: 'reloading', actionProgress }, false);
    assert.ok(magazine.position.distanceTo(seated) > 0.08);
    assert.ok(position(support).distanceTo(position(magazine)) < 0.042);
  }
  update(1 / 60, { ...pistol, id: 'knife' }, false);
  assert.equal(group.getObjectByName('pistol').visible, false);
  update(1 / 60, pistol, false);
  assert.equal(group.getObjectByName('pistol').visible, true);
  assert.ok(magazine.position.distanceTo(seated) < 0.0001);
});

test('the infected raises its striking hand before lunging, with the root left to the caller', () => {
  const infected = createEnemyVisual('infected');
  const state = {
    id: 'test', kind: 'infected', position: [10, -4, 3], yaw: 0.7, health: 90,
    action: 'idle', actionProgress: 0,
  };
  infected.group.position.set(...state.position);
  infected.group.rotation.y = state.yaw;
  const claw = infected.group.getObjectByName('infected-strike-hand');
  const location = () => infected.group.worldToLocal(claw.getWorldPosition(new Vector3()));
  infected.update(0.016, state);
  const idle = location();
  for(let i=0;i<12;i++) infected.update(0.016, { ...state, action: 'windup', actionProgress: 0.95 });
  const raised = location();
  assert.ok(raised.y > idle.y + 0.30);
  for(let i=0;i<12;i++) infected.update(0.016, { ...state, action: 'attacking', actionProgress: 0.10 });
  assert.ok(location().z < raised.z - 0.18);
  assert.deepEqual(infected.group.position.toArray(), state.position);
  assert.equal(infected.group.rotation.y, state.yaw);
});

test('the infected settles on the local floor when it falls at a translated and rotated spawn', () => {
  const infected = createEnemyVisual('infected');
  const state = {
    id: 'test', kind: 'infected', position: [10, -4, 3], yaw: 1.37, health: 0,
    action: 'dead', actionProgress: 0,
  };
  infected.group.position.set(...state.position);
  infected.group.rotation.y = state.yaw;
  for (let frame = 0; frame < 36; frame += 1) infected.update(1 / 60, state);
  infected.group.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(infected.group, true);
  assert.ok(Math.abs(bounds.min.y - state.position[1]) < 0.01);
  assert.ok(bounds.max.y - bounds.min.y < 0.62);
});

test('the security bot fans out its shields and lights the sensor while locking on', () => {
  const bot = createEnemyVisual('security-bot');
  const state = {
    id: 'test', kind: 'security-bot', position: [0, -4, 0], yaw: 0, health: 60,
    action: 'idle', actionProgress: 0,
  };
  const shield = bot.group.getObjectByName('security-right-shield');
  const sensor = bot.group.getObjectByName('security-sensor');
  bot.update(1 / 60, state);
  const idleAngle = shield.rotation.z;
  const idleLight = sensor.material.emissiveIntensity;
  bot.update(1 / 60, { ...state, action: 'windup', actionProgress: 0.85 });
  assert.ok(shield.rotation.z - idleAngle > 0.75);
  assert.ok(sensor.material.emissiveIntensity > idleLight * 2);
  for (let frame = 0; frame < 32; frame += 1) {
    bot.update(1 / 60, { ...state, action: 'dead', health: 0 });
  }
  assert.equal(sensor.material.emissiveIntensity, 0);
});

test('the infected keeps a planted sole during moving turns and has no attack transition teleport', () => {
 const infected=createEnemyVisual('infected');
 const state={id:'moving',kind:'infected',position:[0,0,0],yaw:0,health:90,action:'windup',actionProgress:0};
 for(let frame=0;frame<40;frame++) infected.update(1/60,{...state,actionProgress:frame/40});
 const hand=infected.group.getObjectByName('infected-strike-hand');
 const before=hand.getWorldPosition(new Vector3());
 infected.update(1/60,{...state,action:'attacking',actionProgress:0});
 assert.ok(hand.getWorldPosition(new Vector3()).distanceTo(before)<.18,'the shoulder should carry momentum into the strike');
 for(let frame=0;frame<90;frame++) {
  const position=[frame*.035,0,frame*.012];
  infected.group.position.set(...position);infected.group.rotation.y=frame*.01;
  infected.update(1/60,{...state,position,action:'moving',actionProgress:0});
  const soles=[0,1,2,3].map(i=>infected.group.getObjectByName('infected-sole-'+i).getWorldPosition(new Vector3()).y);
  assert.ok(Math.abs(Math.min(...soles))<.006);
 }
});
