import assert from 'node:assert/strict';
import test from 'node:test';
import { finishMaps, faceAlbedo } from '../src/presentation/finishes.ts';

test('all presentation finishes and the face are generated synchronously without browser image loaders', () => {
  globalThis.document = {}; // The browser path must have the same asset provenance as Node.
  try {
    for (const kind of ['metal', 'fabric', 'skin', 'rubber', 'polymer', 'leather']) {
      const maps = finishMaps(kind);
      for (const map of Object.values(maps)) {
        assert.equal(map.isDataTexture, true, kind);
        assert.equal(map.image.data.length, map.image.width * map.image.height * 4);
      }
      assert.equal(finishMaps(kind), maps, 'share cached maps across meshes');
      assert.ok(new Set(maps.color.image.data).size > 30, 'retain surface variation');
    }
    assert.equal(faceAlbedo.isDataTexture, true);
  } finally { delete globalThis.document; }
});
