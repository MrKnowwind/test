import * as THREE from 'three';
import { box, cylinder, label, mergeRigidDetails, mesh } from './geometry.ts';
import type { Materials } from './materialLibrary.ts';
import { enamel } from './materialLibrary.ts';
import { randomSequence } from './noise.ts';

export const containerSize = { w: 2.44, h: 2.59, d: 6.06 };
type Options = { code: string; seed: number; tint: [number, number, number]; doors?: boolean };
const neutral = new THREE.MeshStandardMaterial({ color: 0x7b8285, metalness: .29, roughness: .56 });

// A trapezoidal corrugation profile, with a small bevel between the web and the crown.
export function foldedSheet(width: number, height: number, ribs: number, rise: number) {
  const profile = [[0, 0], [.17, 0], [.205, .12], [.32, .91], [.35, 1],
    [.65, 1], [.68, .91], [.795, .12], [.83, 0], [1, 0]];
  const positions: number[] = [], uvs: number[] = [];
  for (let i = 0; i < ribs; i++) {
    for (let j = 0; j < profile.length - 1; j++) {
      const [a, az] = profile[j], [b, bz] = profile[j + 1];
      const l = (i + a) / ribs, r = (i + b) / ribs;
      const x0 = (l - .5) * width, x1 = (r - .5) * width, y = height / 2;
      const z0 = az * rise, z1 = bz * rise;
      positions.push(x0, -y, z0, x1, -y, z1, x1, y, z1, x0, -y, z0, x1, y, z1, x0, y, z0);
      uvs.push(l, 0, r, 0, r, 1, l, 0, r, 1, l, 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

const sideSheet = foldedSheet(5.84, 2.31, 5, .037);
const backSheet = foldedSheet(2.22, 2.31, 8, .035);
const doorSheet = foldedSheet(1.02, 2.04, 3, .022);
const roofSheet = foldedSheet(5.83, 2.22, 21, .028);
const cornerSlot = new THREE.MeshStandardMaterial({ color: 0x11191b, roughness: .88 });

export function createShippingContainer(materials: Materials, { code, seed, tint, doors = true }: Options) {
  const root = new THREE.Group();
  const { w, h, d } = containerSize;
  const skin = enamel(new THREE.Color(`rgb(${tint.join(',')})`));
  const frame = materials.steel;
  const panels: THREE.Mesh[] = [];
  const body = box(root, frame, w - .151, h - .13, d - .12, 0, h / 2, 0);
  body.castShadow = true;
  for (const side of [-1, 1]) {
    const panel = mesh(root, sideSheet, skin, side * (w / 2 - .062), h / 2, 0);
    panel.rotation.y = side * Math.PI / 2;
    panels.push(panel);
    for (const z of [-2.1, 2.1]) {
      const rib = box(root, materials.ceramic, .12, 2.24, .23, side * 1.19, 1.29, z, .04);
      rib.rotation.x = z < 0 ? -.18 : .18;
    }
    box(root, frame, .13, .45, 2.3, side * 1.17, 1.44, 0, .07);
    box(root, materials.safety, .025, .085, 1.78, side * 1.245, 1.47, 0);

    for (const y of [.107, h - .098]) {
      box(root, frame, .108, .15, d - .17, side * (w / 2 - .061), y, 0, .009);
      box(root, skin, .021, .024, d - .22, side * (w / 2 - .006), y + .052, 0, .004);
    }
    for (const end of [-1, 1]) {
      const x = side * (w / 2 - .075), z = end * (d / 2 - .076);
      box(root, frame, .155, h - .08, .163, x, h / 2, z, .012);
      for (const y of [.095, h - .095]) {
        box(root, frame, .184, .182, .196, x, y, z, .019);
        box(root, cornerSlot, .065, .079, .012, x, y, z + end * .101, .007);
      }
    }
  }
  panels.push(mesh(root, backSheet, skin, 0, h / 2, -d / 2 + .043));
  panels.at(-1)!.rotation.y = Math.PI;
  const roof = mesh(root, roofSheet, skin, 0, h - .066, 0);
  roof.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  panels.push(roof);
  for (const end of [-1, 1]) {
    for (const y of [.105, h - .103]) box(root, frame, w - .28, .163, .14, 0, y, end * (d / 2 - .072), .012);
  }
  if (doors) {
    const face = d / 2 - .015;
    box(root, materials.rubber, .037, 2.32, .032, 0, 1.29, face);
    for (const side of [-1, 1]) {
      const x = side * .547;
      box(root, frame, 1.057, 2.25, .071, x, 1.29, face - .03, .012);
      panels.push(mesh(root, doorSheet, skin, x, 1.29, face + .008));
      for (const y of [.198, 2.382]) box(root, frame, 1.05, .092, .06, x, y, face + .022, .008);
      for (const offset of [-.33, .31]) {
        const rod = x + offset;
        cylinder(root, materials.zinc, .018, 2.16, rod, 1.29, face + .067, 12);
        for (const y of [.29, .96, 1.64, 2.28]) {
          box(root, frame, .094, .082, .053, rod, y, face + .037, .007);
          cylinder(root, materials.steel, .025, .039, rod, y, face + .067, 12);
        }
        box(root, materials.zinc, .163, .024, .032, rod - side * .064, .81, face + .084, .005);
        box(root, materials.steel, .054, .071, .041, rod - side * .142, .81, face + .052, .005);
      }
      for (const y of [.44, 1.26, 2.08]) {
        box(root, frame, .185, .089, .051, side * 1.037, y, face + .024, .006);
        cylinder(root, materials.zinc, .023, .116, side * 1.094, y, face + .055, 12);
      }
    }
    const id = label(root, .59, .31, (ctx, w, h) => {
      ctx.fillStyle = '#d4d3be';
      ctx.font = 'bold 91px monospace';
      ctx.fillText(code, 8, 100);
      ctx.font = '31px monospace';
      ctx.fillText('22G1  /  MAX GROSS', 8, 150);
      ctx.fillText('30 480 KG', 8, 194);
      const rand = randomSequence(seed);
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 390; i++) ctx.fillRect(rand() * w, rand() * h, rand() * 8, 1 + rand() * 4);
    });
    id.position.set(.59, 1.94, face + .032);
    const plate = label(root, .34, .18, (ctx, w, h) => {
      ctx.fillStyle = '#bb9f64'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#282821'; ctx.font = 'bold 64px monospace'; ctx.fillText('CSC', 24, 84);
      ctx.font = '30px monospace'; ctx.fillText('SAFETY APPROVAL', 24, 149);
      for (let y = 182; y < h - 16; y += 22) ctx.fillRect(26, y, w - 52, 2);
    });
    plate.position.set(-.52, .58, face + .038);
  } else {
    panels.push(mesh(root, backSheet, skin, 0, h / 2, d / 2 - .043));
  }
  mergeRigidDetails(root, panels);
  return { root, compare(simple: boolean) { for (const panel of panels) panel.material = simple ? neutral : skin; } };
}
