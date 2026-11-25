import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import type { ClimbPose, Ledge, MapInteraction, SpawnPoint, Vec3, WorldQueries } from '../contracts/demo.ts';
import type { createInput } from './input.ts';

const radius = .36;
const standingHeight = 1.8;
const crouchingHeight = 1.12;
const climbDuration = .62;
const sensitivity = .0022;
export const movement = {
  walk: 4.5, sprint: 7.5, acceleration: 44, braking: 48, airControl: 8,
  slideBoost: 2.4, slideDrag: 7.2, slideEnd: 3.3,
  jumpSpeed: 6.4, gravity: 18,
  walkStep: 1.85, sprintStep: 2.05, quietStep: 1.05,
};
type InputFrame = ReturnType<ReturnType<typeof createInput>['sample']>;

export function createPlayer(camera: PerspectiveCamera, world: WorldQueries, spawn: SpawnPoint) {
  let feet = spawn.position, yaw = spawn.yaw, pitch = 0, recoil = 0, verticalSpeed = 0;
  let crouchRequested = false, crouched = false, eyeHeight = 1.65, sprintTime = 0;
  let holdConsumed = false, usesHold = false;
  let slide: { x: number; z: number; speed: number } | undefined;
  let climb: { from: Vec3; ledge: Ledge; elapsed: number } | undefined;
  let velocityX = 0, velocityZ = 0, groundSpeed = 0, sprinting = false;
  let stepPhase = 0, eyeOffset = 0, roll = 0, landing = 0;
  const forwardRay = new Vector3();

  function syncCamera() {
    camera.position.set(feet[0], feet[1] + eyeHeight + eyeOffset, feet[2]);
    let viewPitch = pitch + recoil;
    if (climb) {
      const t = climb.elapsed / climbDuration, hand = climb.ledge.left;
      const dy = hand[1] - camera.position.y;
      const distance = Math.hypot(hand[0]-feet[0], hand[2]-feet[2]);
      const focus = MathUtils.clamp(Math.atan2(dy,distance)+.19, pitch-.52, pitch);
      const brace = MathUtils.smoothstep(t,0,.23) * (1-MathUtils.smoothstep(t,.67,1));
      viewPitch = MathUtils.lerp(viewPitch,focus,brace);
    }
    camera.rotation.set(viewPitch, yaw, roll, 'YXZ');
    camera.updateMatrixWorld(true);
    camera.getWorldDirection(forwardRay);
  }
  function grounded() {
    const floor = world.groundHeight?.(feet, radius);
    return floor != null && Math.abs(feet[1] - floor) < .04 && verticalSpeed <= 0;
  }
  function interrupt() {
    climb = slide = undefined;
    velocityX = velocityZ = groundSpeed = 0;
    sprinting = false;
    sprintTime = 0;
  }
  syncCamera();
  return {
    get feet() { return feet; },
    get eye(): Vec3 { return [camera.position.x, camera.position.y, camera.position.z]; },
    get direction(): Vec3 { return [forwardRay.x, forwardRay.y, forwardRay.z]; },
    get yaw() { return yaw; },
    get pitch() { return pitch + recoil; },
    get climbing() { return !!climb; },
    get sliding() { return !!slide; },
    get crouched() { return crouched; },
    get speed() { return groundSpeed; },
    get sprinting() { return sprinting; },
    get landing() { return landing; },
    get verticalMotion() { return MathUtils.clamp(verticalSpeed / movement.jumpSpeed, -1, 1); },
    get busy() { return !!climb || !!slide; },
    get grounded() { return grounded(); },
    get climbPose(): ClimbPose | undefined {
      return climb && { left: climb.ledge.left, right: climb.ledge.right, progress: climb.elapsed / climbDuration };
    },
    interrupt,
    kick(amount: number) { recoil = Math.min(.07, recoil + amount); },
    pose(position: Vec3, angle: number, tilt = 0) {
      interrupt(); feet = position; yaw = angle; pitch = tilt; recoil = verticalSpeed = 0;
      crouchRequested = crouched = holdConsumed = false;
      stepPhase = eyeOffset = roll = landing = 0;
      eyeHeight = 1.65; syncCamera();
    },
    move(dt: number, input: InputFrame, aiming: boolean, creative?:{flight:boolean;speed:number}, motion = 1) {
      recoil = MathUtils.damp(recoil, 0, 9, dt);
      const lookScale = aiming ? .72 : 1;
      yaw -= input.lookX * sensitivity * lookScale;
      pitch = MathUtils.clamp(pitch - input.lookY * sensitivity * lookScale, -1.45, 1.45);
      const { strafe, forward } = input;
      const previous = feet, onGround = grounded();
      const direction: Vec3 = [-Math.sin(yaw), 0, -Math.cos(yaw)];
      const wantsSprint = input.running && forward > 0 && !aiming && !input.quiet;
      if (usesHold !== !!input.holdStance) { usesHold = !!input.holdStance; crouchRequested = false; }
      if (!input.stanceHeld) holdConsumed = false;
      if (creative?.flight) { interrupt(); crouchRequested = false; }
      else if (input.stancePressed && !climb) {
        if (slide) slide = undefined;
        else if (wantsSprint && onGround && sprintTime >= .13 && groundSpeed >= movement.walk) {
          const speed = Math.hypot(velocityX, velocityZ);
          slide = { x: velocityX / speed, z: velocityZ / speed, speed: speed + movement.slideBoost };
          crouchRequested = false;
          holdConsumed = true;
        } else if (!input.holdStance) crouchRequested = !crouchRequested;
      }
      if (input.holdStance) crouchRequested = input.stanceHeld && !holdConsumed && !creative?.flight;
      const standClear = !crouched || world.bodyClear?.(feet, radius, standingHeight) !== false;
      let launchedFromSlide = false;
      if (input.jumpPressed && slide && onGround && standClear && world.moveBody && world.groundHeight) {
        velocityX = slide.x * slide.speed;
        velocityZ = slide.z * slide.speed;
        slide = undefined;
        verticalSpeed = movement.jumpSpeed;
        launchedFromSlide = true;
      }
      if (input.holdStance && !input.stanceHeld) slide = undefined;
      crouched = !!slide || crouchRequested || !standClear;
      const height = crouched ? crouchingHeight : standingHeight;
      const speed = crouched ? (input.quiet ? 1.55 : 2.15) : input.quiet ? 2 : aiming ? 2.55 : wantsSprint ? movement.sprint : movement.walk;
      const scale = speed * (creative?.speed ?? 1) / Math.max(1, Math.hypot(strafe, forward));
      const targetX = (Math.cos(yaw) * strafe + direction[0] * forward) * scale;
      const targetZ = (-Math.sin(yaw) * strafe + direction[2] * forward) * scale;
      const hasInput = strafe !== 0 || forward !== 0;
      let impactSpeed = 0;
      if (slide) {
        if (hasInput && forward >= 0) {
          const heading = Math.atan2(slide.z, slide.x);
          const desired = Math.atan2(targetZ, targetX);
          const delta = Math.atan2(Math.sin(desired - heading), Math.cos(desired - heading));
          const turned = heading + MathUtils.clamp(delta, -dt, dt);
          slide.x = Math.cos(turned); slide.z = Math.sin(turned);
        }
        velocityX = slide.x * slide.speed;
        velocityZ = slide.z * slide.speed;
      } else if (!launchedFromSlide && !climb && (hasInput || !world.groundHeight || onGround && !input.jumpPressed)) {
        // Preserve horizontal momentum in the air, with limited steering.
        const deltaX = targetX - velocityX, deltaZ = targetZ - velocityZ;
        const acceleration = onGround || !world.groundHeight
          ? hasInput ? movement.acceleration : movement.braking
          : movement.airControl;
        const fraction = Math.min(1, acceleration * dt / Math.max(1e-8, Math.hypot(deltaX, deltaZ)));
        velocityX += deltaX * fraction;
        velocityZ += deltaZ * fraction;
      }
      const dx = velocityX * dt, dz = velocityZ * dt;
      if (creative?.flight && world.moveBody) {
        const lift = input.lift ?? 0;
        const travel = 6 * creative.speed * dt / Math.max(1, Math.hypot(strafe, forward, lift));
        feet = world.moveBody(feet, (Math.cos(yaw)*strafe + direction[0]*forward)*travel, lift*travel,
          (-Math.sin(yaw)*strafe + direction[2]*forward)*travel, radius, height);
        verticalSpeed = 0;
      } else if (world.moveBody && world.groundHeight) {
        if (input.jumpPressed && !climb && !slide && !launchedFromSlide && !crouched) {
          const ledge = !onGround && world.climbLedge?.(feet, direction, radius, standingHeight);
          if (ledge) climb = { from: feet, ledge, elapsed: 0 };
          else if (onGround) verticalSpeed = movement.jumpSpeed;
        }
        if (climb) {
          velocityX = velocityZ = 0;
          climb.elapsed += dt;
          const t = Math.min(1, climb.elapsed / climbDuration);
          const lift = MathUtils.smoothstep(t, .32, .77), reach = MathUtils.smoothstep(t, .68, 1);
          const to = climb.ledge.landing, start = climb.from;
          feet = world.moveBody(feet, MathUtils.lerp(start[0], to[0], reach)-feet[0],
            MathUtils.lerp(start[1], to[1]+.04, lift)-feet[1], MathUtils.lerp(start[2], to[2], reach)-feet[2], radius,height);
          verticalSpeed = 0;
          if (t === 1) climb = undefined;
        } else {
          verticalSpeed = onGround && verticalSpeed <= 0 ? 0 : Math.max(-24, verticalSpeed - movement.gravity * dt);
          const expectedY = feet[1] + verticalSpeed * dt;
          feet = world.moveBody(feet, dx, verticalSpeed * dt, dz, radius, height);
          if (Math.abs(feet[1]-expectedY) > .002) {
            if (verticalSpeed < 0) impactSpeed = -verticalSpeed;
            verticalSpeed = 0;
          }
          if (slide) {
            const progress = (feet[0]-previous[0])*slide.x + (feet[2]-previous[2])*slide.z;
            slide.speed -= movement.slideDrag * dt;
            if (!grounded() || progress < Math.hypot(dx,dz)*.65 || slide.speed <= movement.slideEnd) {
              const blocked = progress < Math.hypot(dx,dz)*.65;
              slide = undefined;
              if (blocked) velocityX = velocityZ = 0;
            }
          }
        }
      } else if (dx || dz) feet = world.moveGrounded(feet, dx, dz, radius, height);
      if (!climb && !creative?.flight && dt > 0) {
        // Collision removes the blocked component so motion cannot build up against walls.
        if (Math.abs(feet[0] - previous[0] - dx) > .002) velocityX = 0;
        if (Math.abs(feet[2] - previous[2] - dz) > .002) velocityZ = 0;
      }
      const travel = Math.hypot(feet[0] - previous[0], feet[2] - previous[2]);
      const nowGrounded = grounded();
      groundSpeed = dt > 0 ? travel / dt : 0;
      sprintTime = wantsSprint && nowGrounded && !crouched && groundSpeed > 2 ? Math.min(.2,sprintTime+dt) : 0;
      sprinting = wantsSprint && nowGrounded && !crouched && groundSpeed > movement.walk;
      eyeHeight = MathUtils.damp(eyeHeight, slide ? .78 : crouched ? .98 : climb ? 1.16 : 1.65, 14, dt);
      landing = Math.max(landing * Math.exp(-12 * dt), nowGrounded ? MathUtils.clamp(impactSpeed / 8, 0, 1) : 0);
      const stepping = nowGrounded && !slide && !climb && !creative?.flight;
      if (stepping) {
        const stride = crouched || input.quiet ? movement.quietStep : sprinting ? movement.sprintStep : movement.walkStep;
        stepPhase += travel * Math.PI / stride;
      }
      const bounce = stepping ? Math.min(1, groundSpeed / movement.walk) * (sprinting ? .038 : .019) : 0;
      eyeOffset = MathUtils.damp(eyeOffset, motion * ((aiming ? .25 : 1) * bounce * (Math.cos(stepPhase * 2) - 1) - landing * .065), 18, dt);
      roll = MathUtils.damp(roll, motion * (aiming || climb ? 0 : slide ? -.035 : stepping ? -strafe * .012 : 0), 12, dt);
      if (crouched && eyeHeight > .98) {
        const ceiling = world.blockedDistance([feet[0],feet[1]+.1,feet[2]], [0,1,0], eyeHeight);
        if (ceiling !== null) eyeHeight = Math.min(eyeHeight, Math.max(.3, ceiling+.065));
      }
      syncCamera();
      return travel > .0001;
    },
    setAim(dt: number, aiming: boolean, baseFov = 62, motion = 1) {
      const boost = slide ? 10 : sprinting ? 7 : !grounded() && groundSpeed > movement.walk ? 6 : 0;
      const fov = MathUtils.damp(camera.fov, aiming ? baseFov * 48 / 62 : baseFov + boost * motion, aiming ? 14 : 10, dt);
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
