import type { WeaponId } from '../contracts/demo.ts';

export function createInput(canvas: HTMLCanvasElement) {
  const keys = new Set<string>();
  const pressed = new Set<string>();
  let attack = false;
  let attackHeld = false;
  let aiming = false;
  let lookX = 0;
  let lookY = 0;
  let acceptLook = false;

  const locked = () => document.pointerLockElement === canvas;
  function clear() {
    keys.clear();
    pressed.clear();
    attack = attackHeld = aiming = false;
    lookX = lookY = 0;
  }

  window.addEventListener('keydown', (event) => {
    if (!locked()) return;
    if (event.code === 'Escape') document.exitPointerLock();
    if (!event.repeat) pressed.add(event.code);
    if (event.code === 'Tab' || event.code === 'Space') event.preventDefault();
    keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => {
    clear();
    if (locked()) document.exitPointerLock();
  });
  document.addEventListener('pointerlockchange', () => {
    clear();
    acceptLook = locked();
  });
  document.addEventListener('mousemove', (event) => {
    // Chromium can send cursor-recentering deltas before pointerlockchange is delivered.
    if (!acceptLook || !locked()) return;
    lookX += event.movementX;
    lookY += event.movementY;
  });
  document.addEventListener('mousedown', (event) => {
    if (!locked()) return;
    if (event.button === 0) attack = attackHeld = true;
    if (event.button === 2) aiming = true;
  });
  document.addEventListener('mouseup', (event) => {
    if (event.button === 0) attackHeld = false;
    if (event.button === 2) aiming = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    locked,
    sample() {
      const slots: readonly [string, WeaponId][] = [['Digit1', 'rifle'], ['Digit2', 'shotgun'], ['Digit3', 'pistol'], ['Digit4', 'knife']];
      const switchTo = slots.find(([code]) => pressed.has(code))?.[1];
      const frame = {
        forward: Number(keys.has('KeyW')) - Number(keys.has('KeyS')),
        strafe: Number(keys.has('KeyD')) - Number(keys.has('KeyA')),
        running: keys.has('ShiftLeft') || keys.has('ShiftRight'),
        lookX, lookY, aiming, switchTo,
        attackPressed: attack || attackHeld,
        reloadPressed: pressed.has('KeyR'),
        interactPressed: pressed.has('KeyE'),
        mapPressed: pressed.has('KeyM'),
        backpackPressed: pressed.has('Tab'),
        jumpPressed: pressed.has('Space'),
      };
      pressed.clear();
      attack = false;
      lookX = lookY = 0;
      return frame;
    },
  };
}
