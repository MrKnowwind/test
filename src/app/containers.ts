import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { FirstMap } from '../contracts/demo.ts';

export function addSearchContainers(map: FirstMap & { scene: THREE.Group }) {
  const shell = new THREE.MeshStandardMaterial({ color: 0x48534b, roughness: .57, metalness: .34 });
  const band = new THREE.MeshStandardMaterial({ color: 0x9b9b84, roughness: .5, metalness: .66 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x202828, roughness: .87 });
  const panels = new Map<string, THREE.Group>();
  const geometry = new RoundedBoxGeometry(.64, .24, .4, 2, .025);
  for (const interaction of map.interactions) {
    if (interaction.kind !== 'loot') continue;
    const item = map.scene.getObjectByName(interaction.id);
    if (item) item.visible = false;
    const root = new THREE.Group();
    root.position.set(...interaction.position);
    root.position.y -= .05;
    root.name = `container-${interaction.id}`;
    const body = new THREE.Mesh(geometry, shell);
    body.castShadow = body.receiveShadow = true;
    root.add(body);
    for (const x of [-.24, .24]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(.043, .263, .421), band);
      strap.position.x = x; root.add(strap);
      const latch = new THREE.Mesh(new RoundedBoxGeometry(.075, .071, .035, 1, .006), rubber);
      latch.position.set(x, .03, .218); root.add(latch);
    }
    const handle = new THREE.Mesh(new THREE.TorusGeometry(.066, .011, 8, 14, Math.PI), band);
    handle.position.set(0, .075, .221);
    root.add(handle);
    map.scene.add(root);
    panels.set(interaction.id, root);
  }
  return { searched(id: string) {
    const root = panels.get(id);
    if (root) root.rotation.z = -.07;
  } };
}
