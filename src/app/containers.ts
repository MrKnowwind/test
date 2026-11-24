import * as THREE from 'three';
import type { FirstMap, MapInteraction, ItemId } from '../contracts/demo.ts';
import { box, cylinder } from '../world/detail/geometry.ts';
import { enamel, emissive } from '../world/detail/materialLibrary.ts';
import { itemSpecs, isPack } from '../raid/catalog.ts';
import { caseProfile } from '../raid/loot.ts';

export function addSearchContainers(map: FirstMap & { scene: THREE.Group }) {
  const shell = enamel(0xdde9eb),
    seal = enamel(0x263957),
    live = emissive(0x8affdc, 0.6),
    idle = enamel(0x486079);
  const indicators = new Map<string, THREE.Mesh>(),
    loose = new Map<string, THREE.Group>();
  const pigments = new Map<ItemId, THREE.Material>();
  function paint(id: ItemId) {
    let m = pigments.get(id);
    if (!m) {
      m = enamel(itemSpecs[id].color);
      pigments.set(id, m);
    }
    return m;
  }
  function spawn(t: MapInteraction) {
    if (t.kind !== 'loot' && t.kind !== 'loose') return;
    const root = new THREE.Group(),
      accent = paint(t.item);
    root.position.set(...t.position);
    const support = map.blockedDistance(t.position, [0, -1, 0], 1.6);
    root.position.y -= support ?? 0.12;
    root.userData.detailCenter=root.position;
    root.userData.detailRadius=1;
    map.scene.add(root);
    if (t.kind === 'loose') {
      root.name = 'goods-' + t.id;
      loose.set(t.id, root);
      const s = itemSpecs[t.item];
      const w = Math.min(0.96, 0.14 + 0.093 * s.w),
        d = 0.13 + 0.056 * s.h;
      if (isPack(t.item)) {
        box(root, accent, 0.42, 0.48, 0.28, 0, 0.24, 0, 0.06);
        box(root, seal, 0.27, 0.17, 0.09, 0, 0.17, 0.15, 0.022);
        for (const x of [-0.13, 0.13]) box(root, seal, 0.038, 0.39, 0.04, x, 0.25, -0.14, 0.013);
      } else if (
        ['turbine', 'coil', 'lens', 'valve', 'seals', 'spectrum', 'research-sample'].includes(t.item)
      ) {
        cylinder(root, seal, w * 0.48, 0.06, 0, 0.03, 0, 12);
        cylinder(root, accent, w * 0.42, 0.135, 0, 0.12, 0, 12);
        cylinder(root, live, w * 0.21, 0.03, 0, 0.2, 0, 12);
      } else {
        box(root, accent, w, 0.11, d, 0, 0.055, 0, 0.018);
        box(root, seal, w * 0.62, 0.012, d * 0.44, 0, 0.116, 0);
        for (let i = 0; i < 3; i++) box(root, shell, w * 0.08, 0.013, d * 0.24, (i - 1) * w * 0.15, 0.128, 0);
      }
      return;
    }
    root.name = 'container-' + t.id;
    const original = map.scene.getObjectByName(t.id);
    if (original) original.visible = false;
    const { kind } = caseProfile(t.id, t.item);
    const h =
      kind === 'files'
        ? 0.63
        : kind === 'panel'
          ? 0.49
          : kind === 'cage'
            ? 0.52
            : kind === 'locker'
              ? 0.58
              : 0.24;
    const w = kind === 'cage' ? 0.88 : kind === 'panel' ? 0.48 : 0.67;
    box(root, seal, w, 0.06, 0.42, 0, 0.03, 0, 0.016);
    box(root, shell, w - 0.03, h - 0.06, 0.4, 0, h / 2, 0, 0.03).castShadow = true;
    box(root, accent, w + 0.01, 0.05, 0.43, 0, h - 0.012, 0, 0.014);
    if (kind === 'files' || kind === 'panel' || kind === 'locker') {
      for (let i = 0; i < (kind === 'files' ? 3 : 2); i++) {
        const y = 0.13 + i * 0.155;
        box(root, seal, w * 0.84, 0.117, 0.024, 0, y, 0.204);
        box(root, accent, w * 0.27, 0.023, 0.028, 0, y, 0.224);
      }
    } else if (kind === 'cage') {
      for (const side of [-1, 1])
        for (let i = -2; i <= 2; i++) box(root, seal, 0.024, h, 0.023, i * w * 0.2, h / 2, side * 0.214);
      for (const y of [0.15, 0.33]) box(root, seal, w, 0.025, 0.028, 0, y, 0.217);
    } else if (kind === 'carrier' || kind === 'cold') {
      for (const x of [-0.22, 0.22]) box(root, seal, 0.045, h + 0.02, 0.44, x, h / 2, 0, 0.009);
      box(root, live, 0.19, 0.042, 0.027, 0, h * 0.62, 0.208);
    }
    indicators.set(t.id, box(root, live, 0.105, 0.035, 0.026, w * 0.32, 0.1, 0.217));
  }
  for (const t of map.interactions) spawn(t);
  return {
    spawn,
    remove(id: string) {
      const g = loose.get(id);
      if (g) {
        g.removeFromParent();
        loose.delete(id);
      }
    },
    searched(id: string) {
      const indicator = indicators.get(id);
      if (indicator) indicator.material = idle;
    },
  };
}
