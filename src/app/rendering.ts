import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { createSky } from './sky.ts';

export function createRendering(renderer: THREE.WebGLRenderer, world: THREE.Scene,
  camera: THREE.PerspectiveCamera, weapons: THREE.Scene) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04);
  room.dispose();
  pmrem.dispose();
  world.environment = weapons.environment = environment.texture;
  world.environmentIntensity = .22;
  weapons.environmentIntensity = .65;
  world.add(createSky());
  const sky = new THREE.HemisphereLight(0xd9f5ff, 0x9d9dc4, 1.2);
  const sun = new THREE.DirectionalLight(0xffecd0, 2.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -38;
  sun.shadow.camera.right = sun.shadow.camera.top = 38;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 155;
  sun.shadow.bias = -.00018;
  sun.shadow.normalBias = .035;
  sun.position.set(-38, 68, 22);
  world.add(sky, sun, sun.target);
  const toolCamera = new THREE.PerspectiveCamera();
  toolCamera.layers.set(1);
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 2 });
  const composer = new EffectComposer(renderer, target);
  const worldPass = new RenderPass(world, camera);
  composer.addPass(worldPass);
  const occlusion = new SSAOPass(world, camera, 1, 1);
  occlusion.enabled = false;
  occlusion.kernelRadius = .44;
  occlusion.minDistance = .001;
  occlusion.maxDistance = .065;
  composer.addPass(occlusion);
  const weaponPass = new RenderPass(weapons, toolCamera);
  weaponPass.clear = false;
  weaponPass.clearDepth = true;
  composer.addPass(weaponPass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .15, .3, 1.5);
  composer.addPass(bloom);
  const output = new OutputPass();
  composer.addPass(output);
  let quality = 'balanced';
  // Fixture meshes stay emissive. A fixed-size light pool avoids recompiling the scene's shaders on movement.
  let lamps:THREE.PointLight[]=[];
  const localLights=Array.from({length:6},()=>new THREE.PointLight(0xffffff,0,17,2));
  world.add(...localLights);
  let details:THREE.Object3D[]=[];
  const last=new THREE.Vector3(Infinity,0,0);
  function localScene(){
    if(camera.position.distanceToSquared(last)<2.25)return;
    last.copy(camera.position);
    const reach=quality==='high'?115:quality==='low'?38:65;
    for(const o of details){
      const distance=reach+o.userData.detailRadius;
      o.visible=camera.position.distanceToSquared(o.userData.detailCenter)<distance*distance;
    }
    lamps.sort((a,b)=>a.position.distanceToSquared(last)-b.position.distanceToSquared(last));
    for(const [i,slot] of localLights.entries()){
      const lamp=lamps[i];
      if(!lamp){slot.intensity=0;continue;}
      slot.position.copy(lamp.position);slot.color.copy(lamp.color);
      slot.intensity=lamp.intensity*(1-THREE.MathUtils.smoothstep(lamp.position.distanceTo(last),19,33));
    }
  }
  return {
    bindMap(map:THREE.Group){
      lamps=[];details=[];
      map.traverse(o=>{
        if(o instanceof THREE.PointLight){lamps.push(o);o.visible=false;}
        if(o.userData.detailCenter)details.push(o);
      });
      last.x=Infinity;
    },
    resize(width: number, height: number) {
      const cap = quality === 'high' ? 1.5 : quality === 'low' ? .8 : 1.1;
      const ratio = Math.min(devicePixelRatio, cap);
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height, false);
      composer.setPixelRatio(ratio);
      composer.setSize(width, height);
    },
    setQuality(next: string) {
      quality = next;last.x=Infinity;
      renderer.shadowMap.enabled = next !== 'low';
      bloom.enabled = next === 'high';
      occlusion.enabled = next === 'high';
    },
    render(underground: boolean) {
      // A roof suppresses directional sky and sun underground. Indoor fixtures provide local light.
      sun.visible = !underground;
      sky.intensity = underground ? .65 : 1.2;
      world.environmentIntensity = underground ? .10 : .22;
      sun.target.position.set(camera.position.x, 0, camera.position.z);
      sun.position.set(camera.position.x - 38, 68, camera.position.z + 22);
      sun.target.updateMatrixWorld();
      toolCamera.copy(camera, false);
      toolCamera.layers.set(1);
      toolCamera.updateMatrixWorld();
      localScene();
      if(quality==='high')composer.render();
      else{
        renderer.setRenderTarget(null);renderer.clear();
        renderer.render(world,camera);
        renderer.clearDepth();renderer.render(weapons,toolCamera);
      }
    },
    dispose() { composer.dispose(); occlusion.dispose(); bloom.dispose(); output.dispose(); environment.dispose(); },
  };
}
