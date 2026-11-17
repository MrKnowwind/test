import * as THREE from 'three';

type HeadRing = readonly [y: number, radiusX: number, radiusZ: number, centerZ: number];

const headRings: readonly HeadRing[] = [
  [-.029, .020, .025, -.028], [-.018, .040, .042, -.024],
  [.004, .055, .056, -.017], [.031, .067, .065, -.009],
  [.068, .075, .074, -.002], [.104, .083, .078, .002],
  [.140, .084, .080, .005], [.176, .079, .082, .010],
  [.205, .059, .064, .012], [.235, .0002, .0002, .012],
];

function gaussian(x: number, center: number, width: number) {
  return Math.exp(-(((x - center) / width) ** 2));
}

function profile(y: number) {
  if (y >= .14) {
    const cap = Math.sqrt(Math.max(.000001, 1 - ((y - .14) / .095) ** 2));
    return [.084 * cap, .080 * cap, .005 + (y - .14) * .1];
  }
  const index = Math.max(0, headRings.findIndex(ring => ring[0] >= y) - 1);
  const a = headRings[index], b = headRings[index + 1];
  const prev = headRings[Math.max(0, index - 1)], next = headRings[Math.min(headRings.length - 1, index + 2)];
  const t = THREE.MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1), t2 = t * t, t3 = t2 * t;
  return [1, 2, 3].map(axis => {
    const m0 = (b[axis] - prev[axis]) / (b[0] - prev[0]) * (b[0] - a[0]);
    const m1 = (next[axis] - a[axis]) / (next[0] - a[0]) * (b[0] - a[0]);
    return (2 * t3 - 3 * t2 + 1) * a[axis] + (t3 - 2 * t2 + t) * m0 +
      (-2 * t3 + 3 * t2) * b[axis] + (t3 - t2) * m1;
  });
}

function faceRelief(x: number, y: number) {
  const eyeSockets = gaussian(Math.abs(x), .033, .018) * gaussian(y, .128, .017) * .011;
  const brow = gaussian(Math.abs(x), .032, .030) * gaussian(y, .152, .013) * .007;
  const cheek = gaussian(Math.abs(x), .055, .022) * gaussian(y, .095, .025) * .009;
  const bridge = gaussian(x, -.001, .010) * gaussian(y, .119, .037) * .012;
  const nose = gaussian(x, -.002, .013) * gaussian(y, .093, .015) * .025;
  const upperLip = gaussian(x, .003, .030) * gaussian(y, .051, .007) * .007;
  const lowerLip = gaussian(x, .003, .029) * gaussian(y, .035, .009) * .006;
  const hollow = gaussian(Math.abs(x), .053, .022) * gaussian(y, .054, .026) * .008;
  const asymmetry = .0015 * Math.sin(y * 34 + x * 29);
  return eyeSockets + hollow - brow - cheek - bridge - nose - upperLip - lowerLip + asymmetry;
}

/** A single head shell: facial planes are part of the silhouette, not separate spheres. */
export function infectedHeadGeometry() {
  const sections = 64, rows = 56;
  const vertices: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const y = THREE.MathUtils.lerp(headRings[0][0], headRings.at(-1)![0], t);
    const [rx, rz, center] = profile(y);
    for (let section = 0; section <= sections; section++) {
      const theta = section / sections * Math.PI * 2;
      const x = Math.cos(theta) * rx;
      const front = Math.max(0, -Math.sin(theta)) ** 3;
      const z = center + Math.sin(theta) * rz + front * faceRelief(x, y);
      vertices.push(x + .003 * gaussian(y, .07, .09), y, z);
      uv.push(section / sections * 2, t * 1.4);
      if (row < rows && section < sections) {
        const i = row * (sections + 1) + section;
        indices.push(i, i + sections + 1, i + 1, i + 1, i + sections + 1, i + sections + 2);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Flat but irregular cloth edge, including an actual torn silhouette and shallow folds. */
export function tornClothGeometry(width: number, height: number, curl = .007) {
  const columns = 12, rows = 10;
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
    const u = column / columns, v = row / rows;
    const tear = (1 - v) * (.005 * Math.sin(column * 4.7) + .006 * Math.sin(column * 2.2));
    positions.push((u - .5) * width, (v - .5) * height + tear,
      Math.sin(u * 15 + v * 5) * curl * (1 - v) + .003 * Math.sin(v * 9));
    uv.push(u, v);
    if (row < rows && column < columns) {
      const i = row * (columns + 1) + column;
      indices.push(i, i + columns + 1, i + 1, i + 1, i + columns + 1, i + columns + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
