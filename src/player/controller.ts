import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import type { ClimbPose, Ledge, MapInteraction, SpawnPoint, Vec3, WorldQueries } from '../contracts/demo.ts';
import type { createInput } from './input.ts';

const radius = .36;
const standingHeight = 1.8;
const crouchingHeight = 1.12;
const climbDuration = .62;
const sensitivity = .0022;
type InputFrame = ReturnType<ReturnType<typeof createInput>['sample']>;

export function createPlayer(camera: PerspectiveCamera, world: WorldQueries, spawn: SpawnPoint) {
  let feet = spawn.position, yaw = spawn.yaw, pitch = 0, recoil = 0, verticalSpeed = 0;
  let crouchRequested = false, crouched = false, eyeHeight = 1.65, sprintTime = 0;
  let slide: { x: number; z: number; speed: number } | undefined;
  let climb: { from: Vec3; ledge: Ledge; elapsed: number } | undefined;
  const forwardRay = new Vector3();

  function syncCamera() {
    camera.position.set(feet[0], feet[1] + eyeHeight, feet[2]);
    const brace = climb ? MathUtils.smoothstep(climb.elapsed / climbDuration, 0, .20) *
      (1 - MathUtils.smoothstep(climb.elapsed / climbDuration,.64,1)) : 0;
    camera.rotation.set(pitch + recoil - brace * .17, yaw, 0, 'YXZ');
    camera.updateMatrixWorld(true);
    camera.getWorldDirection(forwardRay);
  }
  function grounded() {
    const floor = world.groundHeight?.(feet, radius);
    return floor != null && Math.abs(feet[1] - floor) < .04 && verticalSpeed <= 0;
  }
  function interrupt() {
    climb = slide = undefined;
    sprintTime = 0;
  }
  syncCamera();
  return {
    get feet() { return feet; },
    get eye(): Vec3 { return [feet[0], feet[1] + eyeHeight, feet[2]]; },
    get direction(): Vec3 { return [forwardRay.x, forwardRay.y, forwardRay.z]; },
    get yaw() { return yaw; },
    get pitch() { return pitch + recoil; },
    get climbing() { return !!climb; },
    get sliding() { return !!slide; },
    get crouched() { return crouched; },
    get busy() { return !!climb || !!slide; },
    get grounded() { return grounded(); },
    get climbPose(): ClimbPose | undefined {
      return climb && { left: climb.ledge.left, right: climb.ledge.right, progress: climb.elapsed / climbDuration };
    },
    interrupt,
    kick(amount: number) { recoil = Math.min(.07, recoil + amount); },
    pose(position: Vec3, angle: number, tilt = 0) {
      interrupt(); feet = position; yaw = angle; pitch = tilt; recoil = verticalSpeed = 0;
      crouchRequested = crouched = false; eyeHeight = 1.65; syncCamera();
    },
    move(dt: number, input: InputFrame, aiming: boolean, creative?:{flight:boolean;speed:number}) {
      recoil = MathUtils.damp(recoil, 0, 9, dt);
      const lookScale = aiming ? .72 : 1;
      yaw -= input.lookX * sensitivity * lookScale;
      pitch = MathUtils.clamp(pitch - input.lookY * sensitivity * lookScale, -1.45, 1.45);
      const { strafe, forward } = input;
      const previous = feet, onGround = grounded();
      const direction: Vec3 = [-Math.sin(yaw), 0, -Math.cos(yaw)];
      const wantsSprint = input.running && forward > 0 && !aiming && !input.quiet;
      if (creative?.flight) { interrupt(); crouchRequested = false; }
      else if (input.stancePressed && !climb) {
        if (slide) slide = undefined;
        else if (wantsSprint && onGround && sprintTime >= .13) {
          slide = { x: direction[0], z: direction[2], speed: 7.15 };
          crouchRequested = true;
        } else crouchRequested = !crouchRequested;
      }
      crouched = crouchRequested || (crouched && world.bodyClear?.(feet, radius, standingHeight) === false);
      const height = crouched ? crouchingHeight : standingHeight;
      const speed = crouched ? 2.15 : input.quiet ? 2 : aiming ? 2.55 : wantsSprint ? 6.25 : 4.15;
      const scale = speed * (creative?.speed ?? 1) * dt / Math.max(1, Math.hypot(strafe, forward));
      let dx = (Math.cos(yaw) * strafe + direction[0] * forward) * scale;
      let dz = (-Math.sin(yaw) * strafe + direction[2] * forward) * scale;
      if (creative?.flight && world.moveBody) {
        const lift = input.lift ?? 0;
        const travel = 6 * creative.speed * dt / Math.max(1, Math.hypot(strafe, forward, lift));
        feet = world.moveBody(feet, (Math.cos(yaw)*strafe + direction[0]*forward)*travel, lift*travel,
          (-Math.sin(yaw)*strafe + direction[2]*forward)*travel, radius, height);
        verticalSpeed = 0;
      } else if (world.moveBody && world.groundHeight) {
        if (input.jumpPressed && !climb && !slide && !crouched) {
          const ledge = !onGround && world.climbLedge?.(feet, direction, radius, standingHeight);
          if (ledge) climb = { from: feet, ledge, elapsed: 0 };
          else if (onGround) verticalSpeed = 6.1;
        }
        if (climb) {
          climb.elapsed += dt;
          const t = Math.min(1, climb.elapsed / climbDuration);
          const lift = MathUtils.smoothstep(t, .17, .72), reach = MathUtils.smoothstep(t, .68, 1);
          const to = climb.ledge.landing, start = climb.from;
          feet = world.moveBody(feet, MathUtils.lerp(start[0], to[0], reach)-feet[0],
            MathUtils.lerp(start[1], to[1]+.04, lift)-feet[1], MathUtils.lerp(start[2], to[2], reach)-feet[2], radius,height);
          verticalSpeed = 0;
          if (t === 1) climb = undefined;
        } else {
          if (slide) { dx = slide.x * slide.speed * dt; dz = slide.z * slide.speed * dt; }
          verticalSpeed = onGround && verticalSpeed <= 0 ? 0 : Math.max(-24, verticalSpeed - 18 * dt);
          const expectedY = feet[1] + verticalSpeed * dt;
          feet = world.moveBody(feet, dx, verticalSpeed * dt, dz, radius, height);
          if (Math.abs(feet[1]-expectedY) > .002) verticalSpeed = 0;
          if (slide) {
            const progress = (feet[0]-previous[0])*slide.x + (feet[2]-previous[2])*slide.z;
            slide.speed -= 8.8 * dt;
            if (!onGround || progress < Math.hypot(dx,dz)*.65 || slide.speed <= 2.15) slide = undefined;
          }
        }
      } else if (strafe || forward) feet = world.moveGrounded(feet, dx, dz, radius, height);
      const travel = Math.hypot(feet[0] - previous[0], feet[2] - previous[2]);
      sprintTime = wantsSprint && onGround && !crouched && travel > dt*5 ? Math.min(.2,sprintTime+dt) : 0;
      eyeHeight = MathUtils.damp(eyeHeight, slide ? .78 : crouched ? .98 : climb ? 1.30 : 1.65, 14, dt);
      if (crouched && eyeHeight > .98) {
        const ceiling = world.blockedDistance([feet[0],feet[1]+.1,feet[2]], [0,1,0], eyeHeight);
        if (ceiling !== null) eyeHeight = Math.min(eyeHeight, Math.max(.3, ceiling+.065));
      }
      syncCamera();
      return travel > .0001;
    },
    setAim(dt: number, aiming: boolean) {
      const fov = MathUtils.damp(camera.fov, aiming ? 48 : 62, 14, dt);
      if (Math.abs(fov - camera.fov) > .001) { camera.fov = fov; camera.updateProjectionMatrix(); }
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
