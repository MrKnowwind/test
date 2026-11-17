import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const cube = new THREE.BoxGeometry();
const round = new Map<string, THREE.BufferGeometry>();
const cylinders = new Map<number, THREE.CylinderGeometry>();

export function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

export function box(parent: THREE.Object3D, material: THREE.Material, w: number, h: number, d: number,
  x = 0, y = 0, z = 0, bevel = 0) {
  if (!bevel) {
    const object = mesh(parent, cube, material, x, y, z);
    object.scale.set(w, h, d);
    return object;
  }
  const key = [w, h, d, bevel].join('/');
  let geometry = round.get(key);
  if (!geometry) {
    geometry = new RoundedBoxGeometry(w, h, d, 1, bevel);
    round.set(key, geometry);
  }
  return mesh(parent, geometry, material, x, y, z);
}

export function cylinder(parent: THREE.Object3D, material: THREE.Material, radius: number, height: number,
  x: number, y: number, z: number, sides = 16) {
  let geometry = cylinders.get(sides);
  if (!geometry) {
    geometry = new THREE.CylinderGeometry(1, 1, 1, sides);
    cylinders.set(sides, geometry);
  }
  const object = mesh(parent, geometry, material, x, y, z);
  object.scale.set(radius, height, radius);
  return object;
}

export function strut(parent: THREE.Object3D, material: THREE.Material, a: THREE.Vector3, b: THREE.Vector3,
  width: number, depth = width) {
  const mid = a.clone().lerp(b, .5);
  const beam = box(parent, material, width, a.distanceTo(b), depth, mid.x, mid.y, mid.z);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return beam;
}

export function cable(parent: THREE.Object3D, material: THREE.Material, points: [number, number, number][], radius = .02) {
  const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return mesh(parent, new THREE.TubeGeometry(path, points.length * 6, radius, 6), material);
}

export function label(parent: THREE.Object3D, width: number, height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, emissiveStrength = 0) {
  if (typeof document === 'undefined') {
    return mesh(parent, new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ color: 0xc5c2b0 }));
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.max(32, Math.round(512 * height / width));
  const ctx = canvas.getContext('2d')!;
  draw(ctx, canvas.width, canvas.height);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return mesh(parent, new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({
    map, transparent: true, alphaTest: .15, roughness: .85,
    emissiveMap: emissiveStrength ? map : null,
    emissive: emissiveStrength ? 0xffffff : 0x000000, emissiveIntensity: emissiveStrength,
  }));
}

export function bevelShape(parent: THREE.Object3D, material: THREE.Material, outline: [number, number][],
  depth: number, bevel: number) {
  const shape = new THREE.Shape();
  outline.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return mesh(parent, geometry, material);
}

// Merge rigid details per prop so distant props still cull independently.
export function mergeRigidDetails(root: THREE.Group, keep: readonly THREE.Object3D[] = []) {
  const batches = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.Material>[]>();
  for (const child of root.children) {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material) || child.material.transparent || keep.includes(child)) continue;
    const key = `${child.material.id}/${child.castShadow}/${child.receiveShadow}`;
    const batch = batches.get(key) ?? [];
    batch.push(child);
    batches.set(key, batch);
  }
  for (const batch of batches.values()) {
    if (batch.length < 4) continue;
    const geometries = batch.map(child => {
      child.updateMatrix();
      const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
      return geometry.applyMatrix4(child.matrix);
    });
    const combined = mergeGeometries(geometries);
    geometries.forEach(geometry => geometry.dispose());
    if (!combined) continue;
    const sample = batch[0];
    const merged = mesh(root, combined, sample.material);
    merged.castShadow = sample.castShadow;
    merged.receiveShadow = sample.receiveShadow;
    root.remove(...batch);
  }
}
