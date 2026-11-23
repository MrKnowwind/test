import * as THREE from 'three';
import type { ShotTrace } from '../contracts/demo.ts';

// A short luminous streak travels over the resolved shot. Impact fragments share one draw call.
export function createShotEffects(root: THREE.Group) {
  const streak = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.022, 1, 5),
    new THREE.MeshBasicMaterial({ color: 0xffdf97, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  const glow = new THREE.MeshBasicMaterial({ color: 0xffbc73, transparent: true, depthWrite: false });
  const fragments = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), glow, 7);
  fragments.frustumCulled = false;
  root.add(streak, fragments);
  const from = new THREE.Vector3(),
    end = new THREE.Vector3(),
    dir = new THREE.Vector3();
  const tangent = new THREE.Vector3(),
    side = new THREE.Vector3(),
    up = new THREE.Vector3(0, 1, 0);
  const transform = new THREE.Object3D();
  let age = 1,
    length = 0,
    travel = 0,
    surface: ShotTrace['surface'] = 'air';
  streak.visible = fragments.visible = false;
  function update(dt: number) {
    if (age > 0.34) return;
    age += dt;
    const head = Math.min(length, 0.45 + age * 530);
    const fade = 1 - THREE.MathUtils.clamp((age - travel) / 0.055, 0, 1);
    const tail = Math.max(0, head - Math.min(8, length * 0.65) * fade);
    streak.material.opacity = 0.9 * fade;
    streak.visible = tail < head && length > 0.18;
    if (streak.visible) {
      streak.position.copy(from).addScaledVector(dir, (head + tail) / 2);
      streak.scale.y = head - tail;
    }
    const t = age - travel;
    fragments.visible = surface !== 'air' && t >= 0 && t < 0.23;
    if (!fragments.visible) return;
    glow.opacity = 1 - t / 0.23;
    for (let i = 0; i < fragments.count; i++) {
      const angle = i * 2.4,
        spread = (1.3 + (i % 3) * 0.67) * t;
      transform.position
        .copy(end)
        .addScaledVector(dir, -0.045 - t * (0.65 + (i % 2)))
        .addScaledVector(tangent, Math.cos(angle) * spread)
        .addScaledVector(side, Math.sin(angle) * spread);
      transform.position.y -= 2.8 * t * t;
      transform.scale.set(0.019, 0.04 + (i % 3) * 0.018, 0.019).multiplyScalar(1 - t / 0.26);
      transform.rotation.set(i + t * 6, angle, t * 8);
      transform.updateMatrix();
      fragments.setMatrixAt(i, transform.matrix);
    }
    fragments.instanceMatrix.needsUpdate = true;
  }
  return {
    update,
    fire(trace: ShotTrace) {
      age = 0;
      surface = trace.surface;
      from.set(...trace.from);
      end.set(...trace.to);
      dir.subVectors(end, from);
      length = dir.length();
      dir.normalize();
      travel = length / 530;
      streak.quaternion.setFromUnitVectors(up, dir);
      tangent
        .set(Math.abs(dir.y) > 0.9 ? 1 : 0, Math.abs(dir.y) > 0.9 ? 0 : 1, 0)
        .cross(dir)
        .normalize();
      side.crossVectors(dir, tangent);
      glow.color.set(surface === 'infected' ? 0x83f3d6 : surface === 'security-bot' ? 0x97dfff : 0xffb15f);
      update(0);
    },
  };
}
