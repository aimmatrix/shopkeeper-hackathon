import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import { addHoodieDetailWeights } from '../components/storefront/hoodie-details';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

for (const kind of ['hoodie', 'tee']) {
  test(`${kind} asset is self-contained, upright and detailed enough for fabric deformation`, async () => {
    const bytes = await readFile(new URL(`../public/models/${kind}.glb`, import.meta.url));
    assert.equal(bytes.toString('utf8', 0, 4), 'glTF');
    const jsonLength = bytes.readUInt32LE(12);
    const json = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
    assert.ok(json.buffers.every((buffer: { uri?: string }) => !buffer.uri), 'No external buffer downloads');
    assert.ok(!json.images?.length, 'Texture-free source is shaded locally');
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const bounds = new Box3().setFromObject(gltf.scene);
    const size = bounds.getSize(new Vector3());
    assert.ok(Math.abs(size.y - 2.9) < .001, `Expected 2.9-unit height, got ${size.y}`);
    assert.ok(size.x > 1.8 && size.x < 3.2, 'Garment width fits camera');
    assert.ok(size.z > .1 && size.z < 1.4, 'Geometry is volumetric and upright');
    assert.ok(bounds.getCenter(new Vector3()).length() < .001, 'Centred for rotation');
    let vertices = 0;
    gltf.scene.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const position = object.geometry.getAttribute('position');
      vertices += position.count;
      assert.ok(object.geometry.getAttribute('normal'), 'Normals for lit ripples');
      assert.ok(object.geometry.getAttribute('uv'), 'UVs for cotton texture');
      assert.ok([...position.array].every(Number.isFinite));
      if (kind === 'hoodie') {
        addHoodieDetailWeights(object.geometry);
        const lace = object.geometry.getAttribute('laceWeight');
        const moving = [...lace.array].filter(weight => weight > 0);
        assert.ok(moving.length > 1800 && moving.length < 2200, 'Only the two detached cords sway independently');
        assert.ok(moving.every(weight => weight <= 1), 'Cord movement stays bounded');
        for (let i = 0; i < position.count; i++) {
          if (position.getY(i) < .3 || Math.abs(position.getX(i)) > .3) assert.equal(lace.getX(i), 0, 'Body and sleeves are not tagged as cords');
          if (position.getY(i) > 1.09) assert.ok(lace.getX(i) < .01, 'Eyelets remain pinned');
        }
      }
      object.geometry.dispose();
      (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => material.dispose());
    });
    assert.ok(vertices > 20000, 'Dense source mesh for smooth deformation');
  });
}
