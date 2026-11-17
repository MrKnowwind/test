import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyFinish } from './finishes.ts';

export type Point = readonly [number, number, number];
type Material = THREE.MeshStandardMaterial;

export function surface(color: number, roughness: number, metalness = 0) {
  return applyFinish(new THREE.MeshStandardMaterial({
    color, roughness, metalness, emissive: 0x000000,
  }), metalness > .1 ? 'metal' : 'polymer');
}

export function pivot(parent: THREE.Object3D, at: Point = [0, 0, 0], name = '') {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(...at);
  parent.add(group);
  return group;
}

export function part(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: Material, at: Point) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...at);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function block(parent: THREE.Object3D, material: Material, size: Point, at: Point, radius = 0) {
  const geometry = radius > 0
    ? new RoundedBoxGeometry(...size, 2, radius)
    : new THREE.BoxGeometry(...size);
  return part(parent, geometry, material, at);
}

export function oval(parent: THREE.Object3D, material: Material, size: Point, at: Point) {
  const geometry = new THREE.SphereGeometry(1, 24, 16);
  geometry.scale(...size);
  return part(parent, geometry, material, at);
}

export function rod(parent: THREE.Object3D, material: Material, start: Point, end: Point, base: number, tip = base, sides = 10) {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const axis = to.clone().sub(from);
  const center = from.lerp(to, 0.5);
  const mesh = part(parent, new THREE.CylinderGeometry(tip, base, axis.length(), sides), material, [center.x, center.y, center.z]);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
  return mesh;
}

/** Continuous tapered skin around a curved finger, tendon or cloth seam. */
export function curvedSkin(parent: THREE.Object3D, material: Material, points: readonly Point[], radii: readonly number[], sides = 16) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)), false, 'catmullrom', .35);
  const steps = Math.max(12, points.length * 8);
  const frames = curve.computeFrenetFrames(steps, false);
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const point = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const segment = t * (radii.length - 1);
    const a = Math.min(radii.length - 2, Math.floor(segment));
    const radius = THREE.MathUtils.lerp(radii[a], radii[a + 1], segment - a);
    curve.getPoint(t, point);
    for (let j = 0; j <= sides; j++) {
      const angle = j / sides * Math.PI * 2;
      const offset = frames.normals[i].clone().multiplyScalar(Math.cos(angle) * radius)
        .addScaledVector(frames.binormals[i], Math.sin(angle) * radius);
      positions.push(point.x + offset.x, point.y + offset.y, point.z + offset.z);
      uvs.push(j / sides, t);
      if (i < steps && j < sides) {
        const vertex = i * (sides + 1) + j;
        indices.push(vertex, vertex + 1, vertex + sides + 1, vertex + 1, vertex + sides + 2, vertex + sides + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return part(parent, geometry, material, [0, 0, 0]);
}

// Each call only bakes direct mesh children. Moving pivots and named attachment points stay intact.
export function batchRigid(group: THREE.Object3D) {
  const batches = new Map<Material, THREE.BufferGeometry[]>();
  for (const child of [...group.children]) {
    if (!(child instanceof THREE.Mesh) || !(child.material instanceof THREE.MeshStandardMaterial)) continue;
    child.updateMatrix();
    const transformed = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
    transformed.applyMatrix4(child.matrix);
    const geometries = batches.get(child.material) ?? [];
    geometries.push(transformed);
    batches.set(child.material, geometries);
    child.geometry.dispose();
    group.remove(child);
  }
  for (const [material, geometries] of batches) {
    const geometry = mergeGeometries(geometries);
    geometries.forEach(source => source.dispose());
    part(group, geometry, material, [0, 0, 0]);
  }
}

export function ease(progress: number, from: number, to: number) {
  return THREE.MathUtils.smoothstep(progress, from, to);
}
