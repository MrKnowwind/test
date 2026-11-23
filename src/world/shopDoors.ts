import * as THREE from 'three';
import type { EnemyState, MapInteraction, Vec3 } from '../contracts/demo.ts';
import { doorHeight, doorWidth, type Door } from './shopRooms.ts';
import type { Solid } from './worldQueries.ts';

export function createShopDoors(scene: THREE.Group, solids: Solid[], plans: Door[]) {
  // Both shutter sections telescope behind the lintel. Instance all leaves in one draw call.
  const textureData = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const rgb =
        y >= 21 && y <= 24 && x > 4 && x < 27
          ? [93, 214, 204]
          : y % 8 === 0 || x < 2 || x > 29
            ? [37, 62, 86]
            : y < 4 && x > 6 && x < 25 && (x + y) % 8 < 4
              ? [242, 166, 90]
              : [124, 152, 168];
      textureData.set([...rgb, 255], 4 * (32 * y + x));
    }
  const texture = new THREE.DataTexture(textureData, 32, 32);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const shutters = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshToonMaterial({ map: texture }),
    plans.length * 2,
  );
  shutters.name = '港区伸缩门';
  shutters.castShadow = true;
  scene.add(shutters);
  const transform = new THREE.Object3D();
  const moving = new Set<number>();
  const states = plans.map((plan, index) => {
    const bounds: Solid = { min: [0, 0, 0], max: [0, 0, 0] };
    solids.push(bounds);
    return { plan, index, bounds, progress: 0, open: false };
  });
  const byId = new Map(states.map((s) => [s.plan.id, s]));
  type State = (typeof states)[number];
  function pose(s: State) {
    const { x, z, alongX } = s.plan,
      half = doorHeight / 2,
      rise = s.progress;
    const low = doorHeight * rise;
    for (let leaf = 0; leaf < 2; leaf++) {
      const y = half / 2 + (leaf ? half + half * rise : low);
      transform.position.set(x + (alongX ? 0 : leaf * 0.065), y, z + (alongX ? leaf * 0.065 : 0));
      transform.scale.set(alongX ? doorWidth : 0.09, half, alongX ? 0.09 : doorWidth);
      transform.updateMatrix();
      shutters.setMatrixAt(s.index * 2 + leaf, transform.matrix);
    }
    const dx = alongX ? doorWidth / 2 : 0.11,
      dz = alongX ? 0.11 : doorWidth / 2;
    s.bounds.min = [x - dx, low, z - dz];
    s.bounds.max = [x + dx, doorHeight + half * rise, z + dz];
    shutters.instanceMatrix.needsUpdate = true;
  }
  for (const s of states) pose(s);
  shutters.computeBoundingSphere();
  function occupied(p: Door, feet: Vec3, enemies: readonly EnemyState[]) {
    function overlaps(at: Vec3, r: number) {
      const dx = Math.abs(at[0] - p.x),
        dz = Math.abs(at[2] - p.z);
      return (
        at[1] < doorHeight &&
        at[1] + 1.8 > 0 &&
        (p.alongX ? dx : dz) < doorWidth / 2 + r &&
        (p.alongX ? dz : dx) < 0.12 + r
      );
    }
    return overlaps(feet, 0.38) || enemies.some((e) => e.health > 0 && overlaps(e.position, 0.5));
  }
  return {
    targets: plans.map((p): MapInteraction => ({
      kind: 'door',
      id: p.id,
      label: p.label,
      position: [p.x, 1.58, p.z],
    })),
    isOpen: (id: string) => byId.get(id)?.open ?? false,
    toggle(id: string, feet: Vec3, enemies: readonly EnemyState[]) {
      const s = byId.get(id);
      if (!s || (s.open && occupied(s.plan, feet, enemies))) return false;
      s.open = !s.open;
      moving.add(s.index);
      return true;
    },
    update(dt: number, feet: Vec3, enemies: readonly EnemyState[]) {
      for (const index of moving) {
        const s = states[index];
        if (!s.open && occupied(s.plan, feet, enemies)) s.open = true;
        s.progress = THREE.MathUtils.clamp(s.progress + (s.open ? 1 : -1) * dt * 2.6, 0, 1);
        pose(s);
        if (s.progress === (s.open ? 1 : 0)) moving.delete(index);
      }
    },
  };
}
