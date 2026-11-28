import * as THREE from 'three';
import type { EnemyState, WeaponState } from '../src/contracts/demo.ts';
import { createEnemyVisual } from '../src/presentation/enemyVisuals.ts';
import { createViewmodel } from '../src/presentation/viewmodel.ts';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { presentationMaterialsReady } from '../src/presentation/finishes.ts';

const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('canvas')!, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.autoClear = false;
renderer.info.autoReset = false;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const generator = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
const environment = generator.fromScene(room, .025);
room.dispose();
generator.dispose();
const context = renderer.getContext();
const debugRenderer = context.getExtension('WEBGL_debug_renderer_info');
const gpu = debugRenderer ? context.getParameter(debugRenderer.UNMASKED_RENDERER_WEBGL) : 'unavailable';
const world = new THREE.Scene();
world.environment = environment.texture;
world.environmentIntensity = .8;
world.background = new THREE.Color(0x44575a);
world.fog = new THREE.Fog(0x44575a, 11, 27);
const sky = new THREE.HemisphereLight(0xc6d7e1, 0x3a342a, 1.2);
const daylight = new THREE.DirectionalLight(0xc9dce4, 1.55);
daylight.position.set(-5, 14, 8);
daylight.castShadow = true;
daylight.shadow.mapSize.set(2048, 2048);
daylight.shadow.camera.left = daylight.shadow.camera.bottom = -10;
daylight.shadow.camera.right = daylight.shadow.camera.top = 10;
daylight.shadow.normalBias = .015;
const workLamp = new THREE.PointLight(0xf9a95c, 19, 9);
workLamp.position.set(2.3, 2.8, -5.5);
world.add(sky, daylight, workLamp);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.035, 120);
const foreground = new THREE.Scene();
foreground.environment = environment.texture;
foreground.environmentIntensity = .8;
foreground.add(camera, new THREE.HemisphereLight(0xc9e0e8, 0x514133, 1.7));
const key = new THREE.DirectionalLight(0xffdfae, 1.7);
key.position.set(-3, 5, -1);
key.target.position.set(0, 0, -1);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = key.shadow.camera.bottom = -.65;
key.shadow.camera.right = key.shadow.camera.top = .65;
key.shadow.camera.near = .1;
key.shadow.camera.far = 12;
key.shadow.bias = -.00003;
key.shadow.normalBias = .0003;
camera.add(key, key.target);

function box(size: [number, number, number], at: [number, number, number], color: number, roughness = 0.88) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color, roughness }));
  mesh.position.set(...at);
  mesh.receiveShadow = true;
  world.add(mesh);
  return mesh;
}

box([17, 0.2, 19], [0, -0.1, -4], 0x586365);
box([14, 4.1, 0.16], [0, 2.04, -8.4], 0x435257);
box([14, 0.17, 0.15], [0, 0.36, -8.27], 0x818880);
box([14, 0.06, 0.06], [0, 3.24, -8.25], 0xa09873);
for (let panel = -6; panel <= 6; panel += 2) {
  box([0.11, 3.92, 0.075], [panel, 2.05, -8.28], 0x313d41);
  box([0.022, 0.002, 10], [panel, 0.002, -3.2], 0x414f50);
}
for (const x of [-3.1, 3.1]) {
  box([1.4, 1.4, 1.2], [x, 0.7, -6.9], x < 0 ? 0x67746a : 0x857353, 0.72);
  for (const d of [-0.55, 0.55]) {
    box([0.10, 1.40, 0.051], [x + d, 0.70, -6.28], 0x393e3d);
    box([1.41, 0.09, 0.044], [x, 0.70 + d, -6.274], 0x444a45);
  }
}
const target = new THREE.Group();
target.position.set(0, 1.65, -6.9);
world.add(target);
for (const [radius, color] of [[0.37, 0xaba087], [0.295, 0x343d3b], [0.224, 0xbeb095], [0.146, 0x343d3b], [0.060, 0xbf6239]]) {
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), new THREE.MeshStandardMaterial({ color }));
  disc.position.z = (0.37 - radius) * 0.02;
  target.add(disc);
}
const viewmodel = createViewmodel();
camera.add(viewmodel.group);
const actors = [createEnemyVisual('infected'), createEnemyVisual('security-bot')];
world.add(...actors.map(actor => actor.group));
const weapon: WeaponState = { id: 'pistol', aiming: false, action: 'ready', actionProgress: 0, loaded: 5, magazineCapacity: 8, reserve: 6 };

export interface ArtShot {
  weapon?: Partial<WeaponState>;
  enemyAction?: EnemyState['action'];
  progress?: number;
  dark?: boolean;
  side?: boolean;
  fov?: number;
  moving?: boolean;
}

function pose(shot: ArtShot) {
  camera.aspect = innerWidth / innerHeight;
  renderer.setSize(innerWidth, innerHeight);
  camera.fov = shot.fov ?? 62;
  camera.updateProjectionMatrix();
  camera.position.set(0, 1.65, 0);
  camera.rotation.set(0, 0, 0);
  target.visible = !shot.enemyAction;
  viewmodel.group.visible = !shot.enemyAction;
  sky.intensity = shot.dark ? 0.49 : 1.2;
  daylight.intensity = shot.dark ? 0.23 : 1.55;
  key.intensity = shot.dark ? 0.72 : 1.7;
  world.background = new THREE.Color(shot.dark ? 0x172627 : 0x44575a);

  if (shot.enemyAction) {
    camera.position.set(0, 1.20, 0);
    camera.lookAt(0, 0.87, -3.9);
    for (const [index, actor] of actors.entries()) {
      const enemy: EnemyState = {
        id: `preview-${index}`, kind: index === 0 ? 'infected' : 'security-bot',
        yaw: Math.PI + (shot.side ? 0.95 : index === 0 ? 0.17 : -0.26),
        position: [index === 0 ? -0.81 : 0.81, 0, -3.42],
        health: shot.enemyAction === 'dead' ? 0 : index === 0 ? 90 : 60,
        action: shot.enemyAction, actionProgress: shot.progress ?? 0,
      };
      actor.group.position.set(...enemy.position);
      actor.group.rotation.y = enemy.yaw;
      actor.group.visible = true;
      for (let frame = 0; frame < 37; frame += 1) actor.update(1 / 60, enemy);
    }
  } else {
    for (const actor of actors) actor.group.visible = false;
    const state = { ...weapon, ...shot.weapon };
    for (let frame = 0; frame < 37; frame += 1) {
      viewmodel.update(1 / 60, state, shot.moving ?? false);
    }
  }

  renderer.info.reset();
  renderer.clear();
  renderer.render(world, camera);
  const worldRender = { ...renderer.info.render };
  if (!shot.enemyAction) {
    renderer.clearDepth();
    renderer.render(foreground, camera);
  }
  const { calls, triangles } = renderer.info.render;
  return { calls, triangles, worldCalls: worldRender.calls, worldTriangles: worldRender.triangles, gpu };
}

Object.assign(window, { artPose: pose, artMaterialsReady: presentationMaterialsReady() });
pose({});
