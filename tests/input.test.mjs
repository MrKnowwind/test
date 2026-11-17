import assert from 'node:assert/strict';
import test from 'node:test';
import { createInput } from '../src/player/input.ts';

test('number keys select primary slots, sidearm and melee through the actual input sampler', () => {
  const win = new EventTarget();
  const doc = new EventTarget();
  const canvas = new EventTarget();
  doc.pointerLockElement = canvas;
  globalThis.window = win;
  globalThis.document = doc;
  const input = createInput(canvas);
  for (const [code, weapon] of [['Digit1', 'rifle'], ['Digit2', 'shotgun'], ['Digit3', 'pistol'], ['Digit4', 'knife']]) {
    const event = new Event('keydown');
    Object.assign(event, { code, repeat: false });
    win.dispatchEvent(event);
    assert.equal(input.sample().switchTo, weapon);
  }
  const down = new Event('mousedown');
  Object.assign(down, { button: 0 });
  doc.dispatchEvent(down);
  assert.equal(input.sample().attackPressed, true);
  assert.equal(input.sample().attackPressed, true);
  const up = new Event('mouseup');
  Object.assign(up, { button: 0 });
  doc.dispatchEvent(up);
  assert.equal(input.sample().attackPressed, false);
  doc.dispatchEvent(down);
  doc.dispatchEvent(up);
  assert.equal(input.sample().attackPressed, true);
  assert.equal(input.sample().attackPressed, false);
});
