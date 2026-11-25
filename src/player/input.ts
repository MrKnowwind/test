import type { WeaponId } from '../contracts/demo.ts';
import { defaultSettings, type InputAction } from './settings.ts';

export function createInput(canvas: HTMLCanvasElement, settings = defaultSettings()) {
  const keys = new Set<string>(), pressed = new Set<string>();
  const ownsPointer = () => document.pointerLockElement === canvas;
  let lookX = 0, lookY = 0, captureReady = ownsPointer();
  let medicineDown: number | undefined, medicineRelease: 'quick' | 'confirm' | undefined;
  const locked = () => captureReady && ownsPointer();
  const held = (action: InputAction) => settings.bindings[action].some(code => keys.has(code));
  const tapped = (action: InputAction) => settings.bindings[action].some(code => pressed.has(code));
  function press(code: string) {
    if (keys.has(code)) return;
    if (settings.bindings.medicine.includes(code) && !held('medicine')) medicineDown = performance.now();
    keys.add(code);
    pressed.add(code);
  }
  function release(code: string) {
    keys.delete(code);
    if (settings.bindings.medicine.includes(code) && !held('medicine') && medicineDown !== undefined) {
      medicineRelease = performance.now() - medicineDown >= 330 ? 'confirm' : 'quick';
      medicineDown = undefined;
    }
  }
  function clear() {
    medicineDown = medicineRelease = undefined;
    keys.clear();
    pressed.clear();
    lookX = lookY = 0;
  }
  window.addEventListener('keydown', event => {
    if (!locked()) return;
    if (event.code === 'Escape') document.exitPointerLock();
    if (!event.repeat) press(event.code);
    if (Object.values(settings.bindings).some(codes => codes.includes(event.code)) || event.code.startsWith('Arrow'))
      event.preventDefault();
  });
  window.addEventListener('keyup', event => {
    if (locked() && settings.bindings.quiet.includes(event.code) && event.code.startsWith('Alt')) event.preventDefault();
    release(event.code);
  });
  window.addEventListener('blur', () => {
    clear();
    if (locked()) document.exitPointerLock();
  });
  document.addEventListener('pointerlockchange', () => {
    clear();
    captureReady = ownsPointer();
  });
  document.addEventListener('mousemove', event => {
    if (!locked()) return;
    lookX += event.movementX;
    lookY += event.movementY;
  });
  document.addEventListener('mousedown', event => { if (locked()) press('Mouse' + event.button); });
  document.addEventListener('mouseup', event => release('Mouse' + event.button));
  canvas.addEventListener('contextmenu', event => event.preventDefault());

  return {
    locked,
    reset: clear,
    sample() {
      const slots: readonly [InputAction, WeaponId][] = [['primaryA', 'rifle'], ['primaryB', 'shotgun'], ['pistol', 'pistol'], ['knife', 'knife']];
      const frame = {
        forward: Number(held('forward')) - Number(held('backward')),
        strafe: Number(held('right')) - Number(held('left')),
        running: held('sprint'), quiet: held('quiet'),
        stancePressed: tapped('stance'), stanceHeld: held('stance'), holdStance: settings.stance === 'hold',
        lift: Number(held('jump')) - Number(held('descend')),
        medicineHeld: medicineDown !== undefined && performance.now() - medicineDown >= 330,
        medicineRelease,
        medicineCycle: Number(pressed.has('ArrowRight') || pressed.has('ArrowDown')) - Number(pressed.has('ArrowLeft') || pressed.has('ArrowUp')),
        healPressed: tapped('heal'),
        lookX: lookX * settings.sensitivity, lookY: lookY * settings.sensitivity,
        aiming: held('aim'), switchTo: slots.find(([action]) => tapped(action))?.[1],
        attackPressed: held('attack') || tapped('attack'),
        reloadPressed: tapped('reload'), interactPressed: tapped('interact'),
        mapPressed: tapped('map'), backpackPressed: tapped('backpack'),
        jumpPressed: tapped('jump'), ammoPressed: tapped('ammo'),
      };
      medicineRelease = undefined;
      pressed.clear();
      lookX = lookY = 0;
      return frame;
    },
  };
}
