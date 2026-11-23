import { MathUtils, type Group } from 'three';
import type { TreatmentPose } from '../combat/treatment.ts';
import { batchRigid, block, ease, pivot, rod } from './modelParts.ts';
import { pigment } from './shell.ts';
import { makeGlove } from './viewmodelModels.ts';

export function makeMedicalActions(parent: Group) {
  const root = pivot(parent, [0, 0, 0], 'medical-action');
  const left = makeGlove(root, [0, 0, 0], true, false, 'medical-support-hand');
  const right = makeGlove(root, [0, 0, 0], false, false, 'medical-tool-hand');
  const shell = pigment(0xe4ece5),
    coral = pigment(0xf37360),
    dark = pigment(0x30495c),
    teal = pigment(0x75efd9, 0.28);
  const kit = pivot(left.root, [0.018, 0.03, -0.025], 'field-kit');
  block(kit, dark, [0.125, 0.047, 0.085], [0, 0, 0], 0.009);
  block(kit, shell, [0.095, 0.012, 0.067], [0, 0.026, 0], 0.003);
  const lid = pivot(kit, [0, 0.025, -0.044], 'kit-lid');
  block(lid, coral, [0.129, 0.014, 0.092], [0, 0.003, 0.043], 0.006);
  block(lid, shell, [0.055, 0.003, 0.014], [0, 0.011, 0.043]);
  block(lid, shell, [0.014, 0.003, 0.055], [0, 0.0115, 0.043]);
  const pad = pivot(right.root, [-0.025, -0.016, -0.026], 'pressure-pad');
  block(pad, shell, [0.071, 0.019, 0.062], [0, 0, 0], 0.006);
  block(pad, teal, [0.073, 0.004, 0.014], [0, 0.01, 0]);
  const injector = pivot(right.root, [-0.026, 0.003, -0.025], 'dose-pen');
  rod(injector, shell, [-0.068, 0, 0], [0.04, 0, 0], 0.015, 0.02, 12);
  rod(injector, dark, [-0.083, 0, 0], [-0.065, 0, 0], 0.008, 0.015, 12);
  const push = pivot(injector, [0.044, 0, 0], 'dose-plunger');
  rod(push, coral, [0, 0, 0], [0.026, 0, 0], 0.011, 0.015, 10);
  for (let i = 0; i < 3; i++)
    block(injector, teal, [0.012, 0.008, 0.009], [-0.047 + i * 0.02, 0.014, 0.005], 0.002);
  for (const g of [kit, lid, pad, injector, push]) batchRigid(g);
  root.visible = false;
  let last: TreatmentPose | undefined,
    visibility = 0;
  function update(dt: number, pose?: TreatmentPose) {
    if (pose) last = pose;
    visibility = MathUtils.damp(visibility, pose ? 1 : 0, 24, dt);
    root.visible = !!last && (pose !== undefined || visibility > 0.035);
    if (!last || !root.visible) {
      last = undefined;
      return false;
    }
    root.position.y = -(1 - visibility) * 0.31;
    const { item, progress: p, elapsed } = last;
    const dressing = item === 'medkit';
    kit.visible = dressing;
    injector.visible = !dressing;
    pad.visible = dressing && p > 0.26;
    if (dressing) {
      const press = ease(p, 0.32, 0.5) * (1 - ease(p, 0.88, 1));
      left.root.position.set(-0.085, -0.16, -0.4);
      left.root.rotation.set(-0.16, 0.08, 0.12);
      lid.rotation.x = -1.85 * ease(p, 0.08, 0.28) * (1 - ease(p, 0.83, 0.98));
      right.root.position.set(
        0.09 - 0.14 * press,
        -0.135 - 0.012 * press + 0.014 * Math.sin(4 * Math.PI * p) * press,
        -0.38 + 0.073 * press,
      );
      right.root.rotation.set(-0.12, -0.4, 0.18 * press);
    } else {
      const contact = ease(p, 0.09, 0.26) * (1 - ease(p, 0.88, 1));
      const pulse = 0.5 - 0.5 * Math.cos(2 * Math.PI * elapsed);
      left.root.position.set(-0.096, -0.155, -0.41);
      left.root.rotation.set(-0.11, 0.27, -0.27);
      right.root.position.set(0.11 - 0.111 * contact, -0.17 + 0.018 * contact, -0.32);
      right.root.rotation.set(0.12, 0.04, 0.1);
      push.position.x = 0.044 - 0.013 * pulse * contact;
    }
    return true;
  }
  return { root, left, right, update };
}
