import * as THREE from 'three';
import { createCombat } from '../combat/createCombat.ts';
import type { EnemyState, MapInteraction } from '../contracts/demo.ts';
import { createPlayer, findInteraction } from '../player/controller.ts';
import { createInput } from '../player/input.ts';
import { createEnemyVisual } from '../presentation/enemyVisuals.ts';
import { createViewmodel } from '../presentation/viewmodel.ts';
import { createRaid } from '../raid/raid.ts';
import { createWarehouse } from '../raid/warehouse.ts';
import { createGameView, itemName } from '../ui/gameView.ts';
import { createFirstMap } from '../world/firstMap.ts';
import { createRendering } from './rendering.ts';
import { createAudio } from './audio.ts';
import { createTacticalMap } from '../ui/tacticalMap.ts';
import { createBackpackView } from '../ui/backpackView.ts';
import { addSearchContainers } from './containers.ts';
import type { ItemId } from '../contracts/demo.ts';
import { itemSpecs } from '../raid/backpack.ts';
import { createPuddles } from './puddles.ts';
import { presentationMaterialsReady } from '../presentation/finishes.ts';
import '../ui/game.css';

const view = createGameView();
try {
  startGame();
} catch (error) {
  view.setError('启动失败。请确认浏览器支持 WebGL 2 后刷新。');
  console.error(error);
}

function startGame() {
  const canvas = document.querySelector<HTMLCanvasElement>('#world')!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.autoClear = false;
  renderer.info.autoReset = false;
  const worldScene = new THREE.Scene();
  worldScene.background = new THREE.Color(0x3a505c);
  worldScene.fog = new THREE.FogExp2(0x3a505c, 0.003);

  const weaponScene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.035, 1100);
  const weaponFill = new THREE.HemisphereLight(0xc9e0e8, 0x514133, .9);
  weaponFill.layers.set(1);
  weaponScene.add(camera, weaponFill);
  const weaponLight = new THREE.DirectionalLight(0xffdfae, 1.7);
  weaponLight.position.set(-3, 5, -1);
  weaponLight.target.position.set(0, 0, -1);
  weaponLight.castShadow = true;
  weaponLight.shadow.mapSize.set(1024, 1024);
  weaponLight.shadow.camera.left = weaponLight.shadow.camera.bottom = -.65;
  weaponLight.shadow.camera.right = weaponLight.shadow.camera.top = .65;
  weaponLight.shadow.camera.near = .1;
  weaponLight.shadow.camera.far = 12;
  weaponLight.shadow.camera.layers.set(1);
  weaponLight.shadow.bias = -.00003;
  weaponLight.shadow.normalBias = .0003;
  weaponLight.layers.set(1);
  camera.add(weaponLight, weaponLight.target);
  const rendering = createRendering(renderer, worldScene, camera, weaponScene);
  const audio = createAudio();
  const tacticalMap = createTacticalMap();

  const input = createInput(canvas);
  const warehouse = createWarehouse(() => window.localStorage);
  const parameters = new URLSearchParams(location.search);
  const suppliedSeed = parameters.get('seed');
  const seedNumber = Number(suppliedSeed);
  const nextSeed = () => suppliedSeed !== null && Number.isInteger(seedNumber)
    ? seedNumber >>> 0 : crypto.getRandomValues(new Uint32Array(1))[0];
  const muzzlePosition = new THREE.Vector3();
  let entered = false;
  let saved = true;
  let accumulator = 0;
  let notice = '';
  let noticeTime = 0;
  let hitTime = 0;
  let hurtTime = 0;
  let dirty = true;
  let footstepTime = 0;
  let statsTime = 0;
  let sampledFrames = 0;
  let fps = 0;
  const bag = createBackpackView({
    close() {
      bag.hide();
      void canvas.requestPointerLock()?.catch(() => view.showPaused());
    },
    take(id, entry, placement) {
      const target=run.map.interactions.find(target=>target.id===id);
      if(!target || Math.hypot(...target.position.map((v,i)=>v-run.player.eye[i]))>3) return false;
      const taken=run.raid.takeContainerItem(id,entry,placement);
      if(taken) audio.pickup();
      return taken;
    },
    use(id) {
      const entry = run.raid.backpack.entries.find(entry => entry.id === id);
      if (!entry) return false;
      if (entry.item === 'medkit' && run.combat.snapshot().health < 100) run.combat.heal(40);
      else if (entry.item === 'pistol-ammo') run.combat.addReserve(entry.quantity);
      else return false;
      run.raid.backpack.remove(id);
      return true;
    },
    discard(id) { run.raid.backpack.remove(id); },
  });
  let run = prepareRun();

  function prepareRun() {
    const seed = nextSeed();
    const map = createFirstMap(seed);
    const puddles = createPuddles();
    map.scene.add(puddles);
    const containers = addSearchContainers(map);
    map.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.receiveShadow = true;
    });
    const raid = createRaid(crypto.randomUUID(), seed, map);
    const combat = createCombat(map, map.enemies);
    const player = createPlayer(camera, map, raid.spawn);
    camera.fov = 62;
    camera.updateProjectionMatrix();
    const viewmodel = createViewmodel();
    viewmodel.group.traverse((object) => object.layers.set(1));
    camera.add(viewmodel.group);
    const frame = combat.snapshot();
    const enemies = new Map<string, ReturnType<typeof createEnemyVisual>>();
    for (const enemy of frame.enemies) {
      const visual = createEnemyVisual(enemy.kind);
      visual.group.traverse(object => {
        if (object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = true;
      });
      enemies.set(enemy.id, visual);
      map.scene.add(visual.group);
      updateEnemy(visual, enemy, 0);
    }
    viewmodel.update(0, frame.weapon, false);
    worldScene.add(map.scene);
    view.setRoutes(map.exits);
    notice = '';
    accumulator = noticeTime = hitTime = hurtTime = 0;
    dirty = true;
    puddles.castShadow = puddles.receiveShadow = false;
    puddles.visible = document.querySelector<HTMLSelectElement>('#quality')!.value === 'high';
    return { map, raid, combat, player, viewmodel, enemies, frame, containers, puddles, searched: new Set<string>() };
  }

  function disposeRun() {
    const roots = [run.map.scene, run.viewmodel.group];
    const resources = new Set<{ dispose(): void }>();
    for (const root of roots) {
      root.removeFromParent();
      root.traverse((object) => {
        if ('getRenderTarget' in object) (object as unknown as { getRenderTarget(): THREE.WebGLRenderTarget }).getRenderTarget().dispose();
        if (object instanceof THREE.SkinnedMesh) resources.add(object.skeleton);
        if (!(object instanceof THREE.Mesh)) return;
        resources.add(object.geometry);
        for (const material of [object.material].flat() as THREE.Material[]) {
          resources.add(material);
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) resources.add(value);
        }
      });
    }
    for (const resource of resources) resource.dispose();
  }

  function updateEnemy(visual: ReturnType<typeof createEnemyVisual>, enemy: EnemyState, dt: number) {
    visual.group.position.set(...enemy.position);
    visual.group.rotation.y = enemy.yaw;
    visual.update(dt, enemy);
  }

  function resize() {
    rendering.resize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    dirty = true;
  }

  function showResult() {
    const result = run.raid.result;
    if (!result) return;
    bag.hide();
    saved = warehouse.commit(result);
    refreshMarket();
    const exit = result.outcome === 'extracted' ? run.map.exits.find((zone) => zone.id === result.exitId) : undefined;
    view.showResult(result, saved, exit?.label);
    view.setError(saved ? '' : '战利品尚未保存，请重试入库。');
    if (input.locked()) document.exitPointerLock();
  }

  view.primary.addEventListener('click', () => {
    audio.ready();
    if (run.raid.result && !saved) {
      showResult();
      return;
    }
    if (run.raid.result) {
      disposeRun();
      run = prepareRun();
    }
    view.setError();
    canvas.requestPointerLock()?.catch(() => {
      view.setError('无法捕获鼠标。请点击按钮继续。');
    });
  });
  view.abandon.addEventListener('click', () => {
    run.raid.abandon();
    showResult();
  });
  document.addEventListener('pointerlockchange', () => {
    accumulator = 0;
    if (run.raid.result) return;
    if (input.locked()) {
      entered = true;
      view.showPlaying();
    } else if (bag.open) {
      view.showPlaying();
    } else if (entered) {
      view.showPaused();
      refreshMarket();
    }
  });
  document.addEventListener('pointerlockerror', () => view.setError('无法捕获鼠标。请点击按钮继续。'));
  window.addEventListener('resize', resize);
  window.addEventListener('storage', refreshMarket);
  document.querySelector<HTMLSelectElement>('#quality')!.addEventListener('change', (event) => {
    rendering.setQuality((event.target as HTMLSelectElement).value);
    run.puddles.visible = (event.target as HTMLSelectElement).value === 'high';
    resize();
  });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    if (input.locked()) document.exitPointerLock();
    view.setError('图形上下文中断，请刷新页面恢复。');
  });
  function refreshMarket() {
    const inventory = warehouse.read();
    view.setWarehouse(inventory);
    const shop = document.querySelector<HTMLElement>('#market-stock')!;
    document.querySelector('#credits')!.textContent = String(warehouse.credits());
    shop.replaceChildren();
    for (const [id, quantity] of Object.entries(inventory ?? {})) {
      const item = id as ItemId;
      const button = document.createElement('button');
      button.textContent = `变卖 ${itemName(item)} ×1 · ${itemSpecs[item].price} 券（持有 ${quantity}）`;
      button.dataset.sell = item;
      button.onclick = async () => {
        button.disabled = true;
        const sold = await warehouse.sell(item);
        view.setError(sold ? '' : '交易未完成，库存或存储状态发生变化');
        refreshMarket();
      };
      shop.append(button);
    }
  }
  refreshMarket();
  void presentationMaterialsReady().then(() => {
    view.primary.disabled = false;
    dirty = true;
  }).catch(error => {
    view.setError('角色材质加载失败，请刷新后重试。');
    console.error(error);
  });
  resize();

  function notify(message: string) {
    notice = message;
    noticeTime = 1.65;
  }

  function use(target: MapInteraction) {
    const pickup = run.raid.interact(target.id);
    if (!pickup) return false;
    if (pickup.kind === 'switch') {
      notify('实验室货梯已通电');
      return true;
    }
    return false;
  }

  function step(dt: number) {
    const { player, raid, map, combat, viewmodel } = run;
    const control = input.sample();
    if (control.mapPressed) tacticalMap.toggle();
    if (control.backpackPressed) {
      bag.show(raid.backpack);
      document.exitPointerLock();
    }
    if (control.switchTo === 'rifle' || control.switchTo === 'shotgun') notify('该主武器槽为空');
    const moving = player.move(dt, control, run.frame.weapon.aiming);
    const target = findInteraction(map, map.interactions, raid.consumed, player.eye, player.direction);
    if (control.interactPressed && target) {
      if (target.kind === 'switch') use(target);
      else {
        bag.show(raid.backpack, target, raid.containers.get(target.id));
        document.exitPointerLock();
      }
    }
    if(bag.open && bag.activeContainer) {
      const id=bag.activeContainer;
      const source=map.interactions.find(t=>t.id===id)!;
      const paused=Math.hypot(...source.position.map((v,i)=>v-player.eye[i]))>3;
      if(!paused) {
        const completed=raid.searchContainer(id,dt);
        if(completed) {audio.reveal();run.containers.searched(id);}
        const contents=raid.containers.get(id)!;
        if(contents.entries.every(e=>e.revealed)) run.searched.add(id);
      }
      bag.updateSearch(paused);
    }
    viewmodel.muzzle.getWorldPosition(muzzlePosition);
    const previousActions = new Map(run.frame.enemies.map(enemy=>[enemy.id,enemy.action]));
    const previousHealth = run.frame.health;
    const previousWeapon = run.frame.weapon;
    run.frame = combat.update(dt, {
      playerFeet: player.feet, eye: player.eye, aimDirection: player.direction,
      muzzle: [muzzlePosition.x, muzzlePosition.y, muzzlePosition.z],
      ...control,
    });
    const currentWeapon = run.frame.weapon;
    if (currentWeapon.id === previousWeapon.id && currentWeapon.loaded < previousWeapon.loaded) {
      audio.shot(currentWeapon.id);
      player.kick(currentWeapon.id === 'shotgun' ? .024 : .011);
    }
    if (currentWeapon.action === 'reloading' && previousWeapon.action !== 'reloading') audio.reload();
    if (currentWeapon.action === 'slashing' && previousWeapon.action !== 'slashing') audio.slash();
    footstepTime -= dt;
    if (moving && footstepTime <= 0) {
      audio.footstep(player.feet[1]>2?'metal':player.feet[1]<-2.5?'concrete':'gravel');
      footstepTime = control.running && !currentWeapon.aiming ? .29 : .44;
    }
    const message = raid.update(dt, player.feet, run.frame.health, control.interactPressed && !target);
    if (message) notify(message);
    if (run.frame.feedback === 'empty') notify('空仓 · 按 R 换弹');
    if (run.frame.feedback === 'blocked') notify('攻击被掩体阻挡');
    if (run.frame.feedback === 'hit') { hitTime = 0.16; audio.hit(); }
    if (run.frame.health < previousHealth) hurtTime = 0.38;
    noticeTime = Math.max(0, noticeTime - dt);
    hitTime = Math.max(0, hitTime - dt);
    hurtTime = Math.max(0, hurtTime - dt);
    for (const enemy of run.frame.enemies) {
      if(enemy.action==='windup' && previousActions.get(enemy.id)!=='windup') {
        audio.warning(enemy.kind==='security-bot', Math.hypot(...enemy.position.map((v,i)=>v-player.feet[i])));
      }
      updateEnemy(run.enemies.get(enemy.id)!, enemy, dt);
    }
    viewmodel.update(dt, run.frame.weapon, moving, {
      running: control.running, lookX: control.lookX, lookY: control.lookY,
    });
    player.setAim(dt, run.frame.weapon.aiming);
    if (raid.result) showResult();
  }

  function draw() {
    const { player, raid, map, frame } = run;
    const underground = player.feet[1] < -2.5;
    audio.environment(entered && (input.locked() || bag.open) && !raid.result, underground, player.feet[0]<-120);
    weaponLight.intensity = underground ? 0.72 : 1.7;
    renderer.info.reset();
    camera.layers.set(0);
    rendering.render(underground);
    const countdown = raid.countdown;
    const target = findInteraction(map, map.interactions, raid.consumed, player.eye, player.direction);
    const exit = raid.exitAt(player.feet);
    const reason = exit && raid.blockedReason(exit);
    const prompt = countdown ? `${countdown.exit.label} · ${countdown.remaining.toFixed(1)} 秒`
      : target ? `E · ${target.kind === 'loot' ? '搜索容器 / ' : ''}${target.label}`
      : exit ? `${exit.label} · ${reason ?? '按 E 撤离'}` : '';
    const region = map.regions?.filter((entry) => Math.abs(entry.center[1] - player.feet[1]) < 4)
      .sort((a, b) => Math.hypot(a.center[0] - player.feet[0], a.center[2] - player.feet[2]) -
        Math.hypot(b.center[0] - player.feet[0], b.center[2] - player.feet[2]))[0];
    view.updateRoutes(map.exits, raid.blockedReason, player.feet);
    view.updateHud(frame, raid.spawn.id, underground, raid.items, region?.label);
    tacticalMap.update(map, player.feet, player.yaw, performance.now());
    view.feedback(noticeTime ? notice : '', prompt, countdown?.remaining, hitTime > 0, hurtTime / 0.38, frame.weapon.aiming);
  }

  let previous = performance.now();
  renderer.setAnimationLoop((now) => {
    const elapsed = (now - previous) / 1000;
    previous = now;
    sampledFrames++;
    statsTime += elapsed;
    if (statsTime > 1) { fps = Math.round(sampledFrames / statsTime); statsTime = 0; sampledFrames = 0; }
    if ((input.locked() || bag.open) && !run.raid.result) {
      accumulator = Math.min(accumulator + elapsed, 0.1);
      while (accumulator >= 1 / 60 && !run.raid.result) {
        step(1 / 60);
        accumulator -= 1 / 60;
      }
      dirty = true;
    }
    if (dirty) {
      draw();
      dirty = false;
    }
  });

  if (parameters.get('qa') === '1') {
    Object.assign(window, {
      raidQA: {
        state: () => structuredClone({
          locked: input.locked(), seed: run.raid.seed, spawn: run.raid.spawn,
          feet: run.player.feet, eye: run.player.eye, yaw: run.player.yaw, pitch: run.player.pitch, fov: camera.fov,
          health: run.frame.health, weapon: run.frame.weapon, enemies: run.frame.enemies,
          exits: run.map.exits, interactions: run.map.interactions,
          items: run.raid.items, consumed: [...run.raid.consumed], flags: [...run.raid.flags],
          backpack: run.raid.backpack.entries, containers: [...run.raid.containers.values()], searched: [...run.searched], credits: warehouse.credits(),
          countdown: run.raid.countdown, result: run.raid.result, warehouse: warehouse.read(),
          calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
          fps, regions: run.map.regions,
        }),
        pose: (feet: readonly [number, number, number], yaw: number, pitch = 0) => {
          run.player.pose(feet, yaw, pitch);
          dirty = true;
        },
      },
    });
  }
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) return;
    renderer.setAnimationLoop(null);
    disposeRun();
    rendering.dispose();
    renderer.dispose();
  });
}
