import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import type { MapInteraction, SpawnPoint, Vec3, WorldQueries } from '../contracts/demo.ts';
import type { createInput } from './input.ts';

const eyeHeight = 1.65;
const sensitivity = 0.0022;
type InputFrame = ReturnType<ReturnType<typeof createInput>['sample']>;

export function createPlayer(camera: PerspectiveCamera, world: WorldQueries, spawn: SpawnPoint) {
  let feet = spawn.position;
  let yaw = spawn.yaw;
  let pitch = 0;
  let recoil = 0;
  let verticalSpeed = 0;
  let climbing: { start: Vec3; target: Vec3; elapsed: number } | undefined;
  const forwardRay = new Vector3();

  function syncCamera() {
    camera.position.set(feet[0], feet[1] + eyeHeight, feet[2]);
    camera.rotation.set(pitch + recoil, yaw, 0, 'YXZ');
    camera.updateMatrixWorld(true);
    camera.getWorldDirection(forwardRay);
  }

  syncCamera();
  return {
    get feet() { return feet; },
    get eye(): Vec3 { return [feet[0], feet[1] + eyeHeight, feet[2]]; },
    get direction(): Vec3 { return [forwardRay.x, forwardRay.y, forwardRay.z]; },
    get yaw() { return yaw; },
    get pitch() { return pitch + recoil; },
    get climbing() { return !!climbing; },
    get grounded() { const floor = world.groundHeight?.(feet, .36); return floor != null && Math.abs(feet[1] - floor) < .04; },
    kick(amount: number) { recoil = Math.min(.07, recoil + amount); },
    pose(position: Vec3, angle: number, tilt = 0) {
      feet = position; yaw = angle; pitch = tilt; recoil = verticalSpeed = 0; climbing = undefined; syncCamera();
    },
    move(dt: number, input: InputFrame, aiming: boolean) {
      recoil = MathUtils.damp(recoil, 0, 9, dt);
      const lookScale = aiming ? 0.72 : 1;
      yaw -= input.lookX * sensitivity * lookScale;
      pitch = MathUtils.clamp(pitch - input.lookY * sensitivity * lookScale, -1.45, 1.45);
      const { strafe, forward } = input;
      const speed = input.quiet ? 2 : aiming ? 2.55 : input.running && forward > 0 ? 6.25 : 4.15;
      const scale = speed * dt / Math.max(1, Math.hypot(strafe, forward));
      const previous = feet;
      if (world.moveBody && world.groundHeight) {
        const floor = world.groundHeight(feet, .36);
        const grounded = floor !== null && Math.abs(feet[1] - floor) < .04 && verticalSpeed <= 0;
        if (input.jumpPressed && !climbing) {
          const target = !grounded && world.climbTarget?.(feet, [-Math.sin(yaw), 0, -Math.cos(yaw)], .36, 1.8);
          if (target) climbing = { start: feet, target, elapsed: 0 };
          else if (grounded) verticalSpeed = 6.1;
        }
        if (climbing) {
          climbing.elapsed += dt;
          const t = Math.min(1, climbing.elapsed / .48);
          const lift = MathUtils.smoothstep(t, 0, .6);
          const reach = MathUtils.smoothstep(t, .6, 1);
          const to: Vec3 = [MathUtils.lerp(climbing.start[0], climbing.target[0], reach),
            MathUtils.lerp(climbing.start[1], climbing.target[1] + .04, lift),
            MathUtils.lerp(climbing.start[2], climbing.target[2], reach)];
          feet = world.moveBody(feet, to[0] - feet[0], to[1] - feet[1], to[2] - feet[2], .36, 1.8);
          verticalSpeed = 0;
          if (t === 1) climbing = undefined;
        } else {
          verticalSpeed = grounded && verticalSpeed <= 0 ? 0 : Math.max(-24, verticalSpeed - 18 * dt);
          const expectedY = feet[1] + verticalSpeed * dt;
          feet = world.moveBody(feet,
            (Math.cos(yaw) * strafe - Math.sin(yaw) * forward) * scale, verticalSpeed * dt,
            (-Math.sin(yaw) * strafe - Math.cos(yaw) * forward) * scale, .36, 1.8);
          if (Math.abs(feet[1] - expectedY) > .002) verticalSpeed = 0;
        }
      } else if (strafe || forward) {
        feet = world.moveGrounded(feet,
          (Math.cos(yaw) * strafe - Math.sin(yaw) * forward) * scale,
          (-Math.sin(yaw) * strafe - Math.cos(yaw) * forward) * scale,
          0.36, 1.8);
      }
      syncCamera();
      return Math.hypot(feet[0] - previous[0], feet[2] - previous[2]) > 0.0001;
    },
    setAim(dt: number, aiming: boolean) {
      const fov = MathUtils.damp(camera.fov, aiming ? 48 : 62, 14, dt);
      if (Math.abs(fov - camera.fov) > 0.001) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    },
  };
}

export function findInteraction(
  world: WorldQueries, interactions: readonly MapInteraction[], consumed: ReadonlySet<string>,
  eye: Vec3, aim: Vec3,
) {
  let best: MapInteraction | undefined;
  let bestScore = 0;
  for (const interaction of interactions) {
    if (consumed.has(interaction.id)) continue;
    const [x, y, z] = interaction.position;
    const dx = x - eye[0], dy = y - eye[1], dz = z - eye[2];
    const distance = Math.hypot(dx, dy, dz);
    if (distance < 0.01 || distance > 3) continue;
    const direction: Vec3 = [dx / distance, dy / distance, dz / distance];
    const alignment = direction[0] * aim[0] + direction[1] * aim[1] + direction[2] * aim[2];
    const score = alignment - distance * 0.08;
    if (alignment < 0.72 || score <= bestScore) continue;
    if (world.blockedDistance(eye, direction, Math.max(0, distance - 0.24)) !== null) continue;
    best = interaction;
    bestScore = score;
  }
  return best;
}
