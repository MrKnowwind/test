import * as THREE from 'three';
import type { Point } from './modelParts.ts';

/** A tapered palm with a narrow wrist and a broad, flattened metacarpal arch. */
export function palmGeometry() {
  const profiles = [
    [.074, .004, -.013, .015, .020],
    [.061, .004, -.010, .019, .025],
    [.041, .003, -.003, .021, .034],
    [.017, .001, .002, .0215, .040],
    [-.004, -.001, .002, .019, .039],
    [-.015, -.003, .002, .014, .035],
  ];
  const points: number[] = [], uv: number[] = [], indices: number[] = [];
  const sides = 32, rings = 30;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings * (profiles.length - 1);
    const a = Math.min(profiles.length - 2, Math.floor(t));
    const p = profiles[a].map((v, axis) => THREE.MathUtils.lerp(v, profiles[a + 1][axis], t - a));
    for (let j = 0; j <= sides; j++) {
      const angle = j / sides * Math.PI * 2;
      const seamFold = Math.sin(i / rings * Math.PI * 8 + angle) * .00055;
      points.push(p[1] + Math.cos(angle) * (p[3] + seamFold), p[2] + Math.sin(angle) * p[4], p[0]);
      uv.push(j / sides, i / rings);
      if (i < rings && j < sides) {
        const v = i * (sides + 1) + j;
        indices.push(v, v + sides + 1, v + 1, v + 1, v + sides + 1, v + sides + 2);
      }
    }
  }
  for (const end of [0, rings]) {
    const row = end * (sides + 1);
    const p = profiles[end === 0 ? 0 : profiles.length - 1];
    const center = points.length / 3;
    points.push(p[1], p[2], p[0]);
    uv.push(.5, end / rings);
    for (let j = 0; j < sides; j++) {
      if (end === 0) indices.push(center, row + j, row + j + 1);
      else indices.push(center, row + j + 1, row + j);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Finger pads flatten gently, with local joint creases rather than spherical joints. */
export function fingerGeometry(points: readonly Point[], radius: number) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)), false, 'catmullrom', .25);
  const steps = 36, sides = 20;
  const frames = curve.computeFrenetFrames(steps, false);
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const profile = [1, .98, 1.02, .89, .90, .84, .83, .80, .72, .57, 0];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = curve.getPoint(t);
    const f = t * (profile.length - 1);
    const a = Math.min(profile.length - 2, Math.floor(f));
    const r = radius * THREE.MathUtils.lerp(profile[a], profile[a + 1], f - a);
    const crease = 1 - .055 * Math.exp(-(((t - .34) / .028) ** 2)) - .045 * Math.exp(-(((t - .65) / .024) ** 2));
    for (let j = 0; j <= sides; j++) {
      const angle = j / sides * Math.PI * 2;
      const point = p.clone().addScaledVector(frames.normals[i], Math.cos(angle) * r * .91 * crease)
        .addScaledVector(frames.binormals[i], Math.sin(angle) * r);
      positions.push(point.x, point.y, point.z);
      uvs.push(j / sides, t);
      if (i < steps && j < sides) {
        const v = i * (sides + 1) + j;
        indices.push(v, v + 1, v + sides + 1, v + 1, v + sides + 2, v + sides + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
