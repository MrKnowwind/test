import * as THREE from 'three';
import {createMedicineWheel} from '../ui/medicineWheel.ts';
import {createTreatment} from '../combat/treatment.ts';
import {soundPath} from '../enemies/perception.ts';
import { createCombat } from '../combat/createCombat.ts';
import type { EnemyState, MapInteraction } from '../contracts/demo.ts';
import { createPlayer, findInteraction } from '../player/controller.ts';
import { createInput } from '../player/input.ts';
import { createRaidEnemy } from '../presentation/enemyVisuals.ts';
import { createShotEffects } from '../presentation/shotEffects.ts';
import { createCreativeView } from '../ui/creativeView.ts';
import { createViewmodel } from '../presentation/viewmodel.ts';
import { createRaid } from '../raid/raid.ts';
import { createWarehouse } from '../raid/warehouse.ts';
import {isPack} from '../raid/catalog.ts';
import { itemIcon } from '../ui/itemArt.ts';
import { createGameView, itemName } from '../ui/gameView.ts';
import { createFirstMap } from '../world/firstMap.ts';
import { createRendering } from './rendering.ts';
import { createAudio } from './audio.ts';
import { createTacticalMap } from '../ui/tacticalMap.ts';
import { createBackpackView } from '../ui/backpackView.ts';
import { addSearchContainers } from './containers.ts';
import type { ItemId } from '../contracts/demo.ts';
import { itemSpecs } from '../raid/backpack.ts';
import { renderOperatorPortrait } from '../presentation/operator.ts';
import { styleCharacter } from '../presentation/celShading.ts';
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
  worldScene.background = new THREE.Color(0xb2cde1);
  worldScene.fog = new THREE.FogExp2(0xb2cde1, 0.0042);

  const weaponScene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.035, 1100);
  const weaponFill = new THREE.HemisphereLight(0xc9e0e8, 0x514133, .9);
  weaponFill.layers.set(1);
  weaponScene.add(camera, weaponFill);
  const weaponLight = new THREE.DirectionalLight(0xffdfae, 1.7);
  weaponLight.position.set(-3, 5, -1);
  weaponLight.target.position.set(0, 0, -1);
  weaponLight.castShadow = false;
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
  const medicineWheel=createMedicineWheel();
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
  const meter=document.querySelector<HTMLOutputElement>('#frame-meter')!;
  window.addEventListener('keydown',ev=>{
    if(ev.code==='F3'){ev.preventDefault();if(!ev.repeat){meter.hidden=!meter.hidden;meter.value='帧率采样中';}}
  });
  const creativeView=createCreativeView(on=>{
    run.raid.setCreative(on);run.combat.setCreative(on);
    run.frame=run.combat.snapshot();run.treatment.cancel();hurtTime=0;dirty=true;
  },(item,qty,ground)=>{
    const at=ground?dropPoint(true):undefined;
    const generated=run.raid.generateItem(item,qty,at);
    if(!generated)return ground?'附近地面已满，请移动后再试':run.raid.backpack.failure(item);
    if(typeof generated==='object')run.containers.spawn(generated);
    dirty=true;
    return itemName(item)+' ×'+qty+(ground?' 已生成在脚边':' 已放入背包');
  });
  const receipt=document.querySelector<HTMLElement>('#pickup-receipt')!;
  let receiptTimer=0;
  function pickedUp(item:ItemId,count:number){
    audio.pickup();run.viewmodel.pickup();
    receipt.hidden=false;receipt.style.setProperty('--receipt-color',itemSpecs[item].color);
    receipt.replaceChildren(itemIcon(item),document.createTextNode('已拾取　'+itemName(item)+' ×'+count));
    receipt.getAnimations().forEach(a=>a.cancel());
    receipt.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:130});
    window.clearTimeout(receiptTimer);
    receiptTimer=window.setTimeout(()=>{receipt.hidden=true;},1400);
  }
  const bag = createBackpackView({
    close() {
      bag.hide();
      void canvas.requestPointerLock()?.catch(() => view.showPaused());
    },
    take(id,entry,placement,quantity) {
      if(!reachable(id))return false;
      const source=run.raid.containers.get(id)?.entries.find(e=>e.id===entry);
      const amount=quantity??source?.quantity??0;
      const taken=run.raid.takeContainerItem(id,entry,placement,quantity);
      if(taken && source)pickedUp(source.item,amount);
      return taken;
    },
    equip(from,id) {
      if(from!=='carried'&&!reachable(from))return false;
      const changed=run.raid.equipPack(from,id,dropPoint());if(!changed)return false;
      if(changed.dropped)run.containers.spawn(changed.dropped);
      if(id===undefined)run.containers.remove(from);
      if(run.raid.backpack.equipped)pickedUp(run.raid.backpack.equipped.item,1);
      return true;
    },
    fold(id){
      const cargo=run.raid.ground.get(id);
      if(!cargo||!reachable(id)||!run.raid.collect(id))return false;
      run.containers.remove(id);pickedUp(cargo.item,cargo.quantity);return true;
    },
    unpack(){const t=run.raid.unpack(dropPoint());if(!t)return false;run.containers.spawn(t);return true;},
    stow:(slot,p)=>run.raid.stow(slot,p),holster:id=>run.raid.holster(id),
    use(id) {
      if(!run.treatment.start(id,run.frame.health,run.raid.creative))return false;
      bag.hide();void canvas.requestPointerLock()?.catch(()=>view.showPaused());
      return true;
    },
    put:(id,entry)=>reachable(id,true) && run.raid.putContainerItem(id,entry),
    discard(s,container) {
      if(s.from==='source' && (!container || !reachable(container)))return false;
      const at=dropPoint();
      const t=s.from==='bag'?run.raid.dropCarried(s.id,at)
        :s.from==='slot'?run.raid.dropSlot(s.entry.item as 'pistol'|'knife',at)
        :run.raid.discardSource(container!,s.id,at);
      if(t)run.containers.spawn(t);return !!t;
    },
  });
  renderOperatorPortrait(renderer);
  let run = prepareRun();

  function prepareRun() {
    medicineWheel.reset();creativeView.reset();receipt.hidden=true;
    const seed = nextSeed();
    const map = createFirstMap(seed);
    const containers = addSearchContainers(map);
    map.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.receiveShadow = true;
    });
    const raid = createRaid(crypto.randomUUID(), seed, map);
    const combat = createCombat(map, map.enemies,raid.backpack);
    const player = createPlayer(camera, map, raid.spawn);
    camera.fov = 62;
    camera.updateProjectionMatrix();
    const viewmodel = createViewmodel();
    viewmodel.group.traverse((object) => object.layers.set(1));
    styleCharacter(viewmodel.group);
    camera.add(viewmodel.group);
    const frame = combat.snapshot();
    const enemies = new Map<string, ReturnType<typeof createRaidEnemy>>();
    for (const enemy of frame.enemies) {
      const visual = createRaidEnemy(enemy.kind);
      visual.group.traverse(object => {
        if (object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = true;
      });
      styleCharacter(visual.group);
      enemies.set(enemy.id, visual);
      map.scene.add(visual.group);
      updateEnemy(visual, enemy, 0,player.feet);
    }
    viewmodel.update(0, frame.weapon, false);
    worldScene.add(map.scene);
    rendering.bindMap(map.scene);
    view.setRoutes(map.exits);
    notice = '';
    accumulator = noticeTime = hitTime = hurtTime = 0;
    dirty = true;
    return { effects:createShotEffects(map.scene), treatment:createTreatment(raid.backpack), nearWall:false, damageNotice:'', discovered:new Set<string>(), nextSurvey:0, map, raid, combat, player, viewmodel, enemies, frame, containers, searched: new Set<string>() };
  }

  function reachable(id:string,allowEmpty=false){
    if(run.raid.result||(!allowEmpty && run.raid.consumed.has(id)))return false;
    const t=run.raid.targets.find(t=>t.id===id);if(!t)return false;
    const eye=run.player.eye,d=new THREE.Vector3(...t.position).sub(new THREE.Vector3(...eye));
    const distance=d.length();d.normalize();
    return distance<=3 && run.map.blockedDistance(eye,[d.x,d.y,d.z],Math.max(0,distance-.24))===null;
  }
  function dropPoint(settle=false):readonly [number,number,number]{
    const [x,feetY,z]=run.player.feet;
    const y=settle?(run.map.groundHeight?.(run.player.feet,.2)??feetY):feetY;
    const near=run.raid.targets.filter(t=>t.id.startsWith('drop-') && run.raid.ground.has(t.id) && Math.hypot(t.position[0]-x,t.position[2]-z)<3);
    for(const radius of [.8,1.25,1.55]){
      for(const offset of [0,-.42,.42,-.85,.85,-1.4,1.4,Math.PI]){
        const a=run.player.yaw+offset;
        const pos=run.map.moveGrounded([x,y,z],-Math.sin(a)*radius,-Math.cos(a)*radius,.22,.65);
        if(near.every(t=>Math.hypot(t.position[0]-pos[0],t.position[2]-pos[2])>.4))
          return [pos[0],pos[1]+.15,pos[2]];
      }
    }
    return [x,y+.15,z];
  }
  function disposeRun() {
    for(const visual of run.enemies.values())visual.restore();
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

  function updateEnemy(visual: ReturnType<typeof createRaidEnemy>, enemy: EnemyState, dt: number, eye:readonly number[]) {
    visual.group.position.set(...enemy.position);
    visual.group.rotation.y = enemy.yaw;
    visual.update(dt, enemy, Math.hypot(eye[0]-enemy.position[0],eye[1]-enemy.position[1],eye[2]-enemy.position[2]));
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
      run.treatment.cancel();
      view.showPaused();
      refreshMarket();
    }
  });
  document.addEventListener('pointerlockerror', () => view.setError('无法捕获鼠标。请点击按钮继续。'));
  window.addEventListener('resize', resize);
  window.addEventListener('storage', refreshMarket);
  document.querySelector<HTMLSelectElement>('#quality')!.addEventListener('change', (event) => {
    const quality=(event.target as HTMLSelectElement).value;
    weaponLight.castShadow=quality==='high';
    rendering.setQuality(quality);
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
      button.textContent = `变卖 ${itemName(item)} ×1 · ${warehouse.price(item)} 券（持有 ${quantity}）`;
      button.prepend(itemIcon(item));
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
      notify('货梯已呼叫 · 请前往 B1 梯内');
      return true;
    }
    return false;
  }

  function step(dt: number) {
    const { player, raid, map, combat, viewmodel } = run;
    const control = input.sample();
    const chosen=medicineWheel.update(control,run.treatment.available());
    if(control.healPressed||control.medicineRelease==='quick'){
      if(run.treatment.remaining)run.treatment.cancel();
      else {
        if(chosen===undefined||!run.treatment.start(chosen,run.frame.health,raid.creative))notify(chosen===undefined?'未携带药物':'当前无法治疗');
      }
    }
    if(control.backpackPressed||control.switchTo)run.treatment.cancel();
    if(control.quiet||run.treatment.remaining)control.running=false;
    if (control.mapPressed) tacticalMap.toggle();
    if (control.backpackPressed) {
      bag.show(raid.backpack);
      document.exitPointerLock();
    }
    if (control.switchTo === 'rifle' || control.switchTo === 'shotgun') notify('该主武器槽为空');
    map.doors.update(dt,player.feet,run.frame.enemies);
    run.effects.update(dt);
    const moving = player.move(dt, control, run.frame.weapon.aiming,raid.creative?creativeView.settings:undefined);
    const target = findInteraction(map, raid.targets, raid.consumed, player.eye, player.direction);
    if (control.interactPressed && target) {
      run.treatment.cancel();
      if(target.kind==='door'){
        if(map.doors.toggle(target.id,player.feet,run.frame.enemies))audio.door(map.doors.isOpen(target.id));
        else notify('门口有人，请让开后关门');
      }else if (target.kind === 'switch') use(target);
      else if(target.kind==='loose'&&!isPack(target.item)){
        if(raid.collect(target.id)){run.containers.remove(target.id);pickedUp(target.item,target.quantity);}
        else notify(raid.backpack.failure(target.item));
      }else {
        const contents=target.kind==='loose'?raid.groundContainer(target.id):raid.containers.get(target.id);
        raid.visited.add(target.id);
        bag.show(raid.backpack,target,contents);
        document.exitPointerLock();
      }
    }
    if(bag.open && bag.activeContainer) {
      const id=bag.activeContainer;
      const paused=!reachable(id);
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
    footstepTime-=dt;
    const sprinting=control.running && control.forward>0 && !previousWeapon.aiming;
    const stepping=moving && player.grounded && footstepTime<=0;
    if(stepping){
      audio.footstep(player.feet[1]>2?'metal':player.feet[1]<-2.5?'concrete':'gravel');
      footstepTime=control.quiet?.58:sprinting?.29:.44;
    }
    run.nearWall=previousWeapon.id==='pistol'&&!previousWeapon.unarmed && map.blockedDistance(player.eye,player.direction,.78)!==null;
    run.frame = combat.update(dt, {
      playerFeet: player.feet, eye: player.eye, aimDirection: player.direction,
      muzzle: [muzzlePosition.x, muzzlePosition.y, muzzlePosition.z],
      ...control, treating:!!run.treatment.remaining,stepRadius:stepping?(control.quiet?3:sprinting?12:6):undefined,
    });
    const currentWeapon = run.frame.weapon;
    if (run.frame.shot) {
      run.effects.fire(run.frame.shot,viewmodel.ejection.getWorldPosition(muzzlePosition),player.yaw);
      viewmodel.markShot();
      if(run.frame.shot.surface==='cover'){
        const {from,to}=run.frame.shot;audio.cover(Math.hypot(to[0]-from[0],to[1]-from[1],to[2]-from[2]));
      }
      raid.log.shots++;
      audio.shot(currentWeapon.id);
      player.kick(currentWeapon.aiming?.009:.016);
    }
    if (currentWeapon.action === 'reloading' && previousWeapon.action !== 'reloading') audio.reload();
    if(currentWeapon.action==='reloading' && currentWeapon.actionProgress>=.76 && previousWeapon.actionProgress<.76)audio.magazineSeat();
    if (currentWeapon.action === 'slashing' && previousWeapon.action !== 'slashing') audio.slash();
    const damaged=run.frame.health<previousHealth;
    if(damaged) {
      hurtTime=1.25;
      const from=run.frame.hitOrigin??player.feet;
      const angle=Math.atan2(-(from[0]-player.feet[0]),-(from[2]-player.feet[2]))-player.yaw;
      const side=Math.round(angle/(Math.PI/2));
      run.damageNotice=['前方','左侧','后方','右侧'][((side%4)+4)%4]+'受击';
      raid.hitBy(run.frame.lastHit==='security-bot'?'地下安保机':'感染体');
    }
    const treatmentPose=run.treatment.pose;
    const treating=!!treatmentPose;
    if(treatmentPose && (treatmentPose.elapsed===0 || (treatmentPose.item==='healing-injector' &&
      Math.floor(treatmentPose.elapsed+dt+1e-8)>Math.floor(treatmentPose.elapsed+1e-8))))audio.treat(treatmentPose.item==='medkit');
    const recovered=run.treatment.advance(dt,damaged,run.frame.health);
    if(recovered){combat.heal(recovered);run.frame=combat.snapshot();if(!run.treatment.remaining)notify('治疗完成');}
    if(recovered && treating && !run.treatment.remaining)raid.log.heals++;
    if(bag.open)bag.risk(hurtTime>0?run.damageNotice+' · 按 Esc 返回':run.frame.enemies.some(e=>e.action==='windup')?'附近有攻击预警 · 按 Esc 返回':'搜刮时周围敌人仍会行动');
    const message = raid.update(dt, player.feet, run.frame.health);
    if (message?.includes('取消') || message?.includes('离站')) notify(message);
    if (run.frame.feedback === 'empty') notify('空仓 · 按 R 换弹');
    if (run.frame.feedback === 'blocked') notify('攻击被掩体阻挡');
    if (run.frame.feedback === 'hit') { raid.log.hits++;hitTime = 0.17; audio.hit(run.frame.shot?.surface==='security-bot'); }
    noticeTime = Math.max(0, noticeTime - dt);
    hitTime = Math.max(0, hitTime - dt);
    hurtTime = Math.max(0, hurtTime - dt);
    for (const enemy of run.frame.enemies) {
      if(enemy.action==='dead' && previousActions.get(enemy.id)!=='dead')raid.log.kills++;
      if(enemy.action==='windup' && previousActions.get(enemy.id)!=='windup') {
        const dx=enemy.position[0]-player.feet[0],dz=enemy.position[2]-player.feet[2];
        audio.warning(enemy.kind==='security-bot',soundPath(map,enemy.position,player.feet),(dx*Math.cos(player.yaw)-dz*Math.sin(player.yaw))/Math.max(.01,Math.hypot(dx,dz)));
      }
      updateEnemy(run.enemies.get(enemy.id)!, enemy, dt,player.feet);
    }
    viewmodel.group.visible=!run.frame.weapon.unarmed || !!run.treatment.remaining;
    viewmodel.update(dt, run.frame.weapon, moving, {
      treatment:run.treatment.pose,lowered:run.nearWall && !run.treatment.remaining, running: control.running, lookX: control.lookX, lookY: control.lookY,
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
    run.viewmodel.present();
    rendering.render(underground);
    const countdown = raid.countdown;
    const target = findInteraction(map, raid.targets, raid.consumed, player.eye, player.direction);
    const exit = raid.exitAt(player.feet);
    const reason = exit && raid.blockedReason(exit);
    const prompt = target ? `E · ${target.kind === 'loot' ? '搜索容器 / ' : target.kind==='loose'?'拾取 / ':target.kind==='door'?(map.doors.isOpen(target.id)?'关门 / ':'开门 / '):''}${target.label}`
      : exit && reason ? exit.label + ' · ' + reason : '';
    const region = map.regions?.filter((entry) => Math.abs(entry.center[1] - player.feet[1]) < 4)
      .sort((a, b) => Math.hypot(a.center[0] - player.feet[0], a.center[2] - player.feet[2]) -
        Math.hypot(b.center[0] - player.feet[0], b.center[2] - player.feet[2]))[0];
    view.updateRoutes(map.exits, raid.exitStatus, player.feet);
    map.updateExitLights(exit => raid.exitStatus(exit).kind);
    view.updateHud(frame, raid.spawn.id, underground, raid.items, region?.label,run.treatment.pose);
    const now=performance.now();
    if(entered && now>=run.nextSurvey){
      run.nextSurvey=now+250;
      for(const t of map.interactions){
        if(t.kind!=='loot'||run.discovered.has(t.id))continue;
        const [x,y,z]=player.eye,dx=t.position[0]-x,dy=t.position[1]-y,dz=t.position[2]-z,d=Math.hypot(dx,dy,dz);
        if(d>.01 && d<=12 && map.blockedDistance(player.eye,[dx/d,dy/d,dz/d],Math.max(0,d-.24))===null)run.discovered.add(t.id);
      }
    }
    tacticalMap.update(map, player.feet, player.yaw, now,run.discovered,raid.consumed,raid.exitStatus);
    const timerText = [countdown, raid.liftWindow].filter((t, i, both) => t && both.indexOf(t) === i)
      .map(t => (t!.exit.remote ? '货梯离站' : '撤离') + ' · ' + Math.ceil(t!.remaining) + ' 秒').join('　');
    view.feedback(run.treatment.pose?(run.treatment.pose.preview?'演示 · ':'')+itemName(run.treatment.pose.item)+' '+run.treatment.remaining.toFixed(1)+' 秒 · H 取消':hurtTime>0?run.damageNotice:noticeTime?notice:run.nearWall?'枪口接近掩体':'', prompt, timerText, hitTime > 0, Math.min(1,hurtTime/.65), frame.weapon.aiming);
  }

  let previous = performance.now();
  renderer.setAnimationLoop((now) => {
    const elapsed = (now - previous) / 1000;
    previous = now;
    if((input.locked()||bag.open) && !document.hidden && !run.raid.result){
      sampledFrames++;statsTime+=elapsed;
      if(statsTime>=1){
        fps=Math.round(sampledFrames/statsTime);
        if(!meter.hidden)meter.value=fps+' FPS · '+(1000*statsTime/sampledFrames).toFixed(1)+' ms';
        statsTime=0;sampledFrames=0;
      }
    }else{statsTime=0;sampledFrames=0;if(!meter.hidden)meter.value='已暂停';}
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
