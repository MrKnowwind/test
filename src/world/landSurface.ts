import * as THREE from 'three';
import { landOutline } from './landPlan.ts';

type GroundPatch = { minX: number; maxX: number; minZ: number; maxZ: number };
type Point = readonly [number, number];

function clip(points: readonly Point[], axis: 0 | 1, limit: number, side: 1 | -1) {
  const result: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const da = side * (a[axis] - limit), db = side * (b[axis] - limit);
    if (da >= 0) result.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return result;
}

export function landSurface(patches: readonly GroundPatch[]) {
  const outline = landOutline.map(([x, z]) => new THREE.Vector2(x, z));
  const triangles = THREE.ShapeUtils.triangulateShape(outline, []);
  const vertices: number[] = [];
  for (const patch of patches) for (const indices of triangles) {
    const triangle = indices.map(i => landOutline[i]);
    const west = clip(triangle, 0, patch.minX, 1);
    const east = clip(west, 0, patch.maxX, -1);
    const north = clip(east, 1, patch.minZ, 1);
    const polygon = clip(north, 1, patch.maxZ, -1);
    if (polygon.length < 3) continue;
    const [x, z] = polygon[0];
    for (let i = 1; i + 1 < polygon.length; i++) {
      const [ax, az] = polygon[i], [bx, bz] = polygon[i + 1];
      const area = (ax - x) * (bz - z) - (az - z) * (bx - x);
      if (Math.abs(area) < 1e-8) continue;
      if (area < 0) vertices.push(x, 0, z, ax, 0, az, bx, 0, bz);
      else vertices.push(x, 0, z, bx, 0, bz, ax, 0, az);
    }
  }
  return groundGeometry(vertices);
}

export function landBank() {
  const vertices: number[] = [];
  for (let i = 0; i < landOutline.length; i++) {
    const [ax, az] = landOutline[i], [bx, bz] = landOutline[(i + 1) % landOutline.length];
    vertices.push(ax, 0, az, bx, 0, bz, ax, -2.55, az);
    vertices.push(bx, 0, bz, bx, -2.55, bz, ax, -2.55, az);
  }
  return groundGeometry(vertices);
}

function groundGeometry(vertices: number[]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(vertices.length / 3 * 2), 2));
  geometry.computeVertexNormals();
  return geometry;
}
