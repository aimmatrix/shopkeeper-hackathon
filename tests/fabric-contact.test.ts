import assert from 'node:assert/strict';
import test from 'node:test';
import { DoubleSide, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Vector2, Vector3 } from 'three';
import { pickFabricContact } from '../components/storefront/fabric-contact';

test('fabric contact follows the touched shoulder or chest through rotation and zoom', () => {
  const pivot = new Group();
  const model = new Group();
  const mesh = new Mesh(new PlaneGeometry(2, 3), new MeshBasicMaterial({ side: DoubleSide }));
  model.add(mesh);
  pivot.add(model);
  const camera = new PerspectiveCamera(33, 1, .1, 40);
  for (const rotation of [-.8, 0, .8, Math.PI]) {
    pivot.rotation.set(.12, rotation, 0);
    for (const zoom of [4, 7]) {
      camera.position.set(0, .1, zoom);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      model.updateWorldMatrix(true, true);
      for (const point of [new Vector3(-.7, 1, 0), new Vector3(.1, .2, 0)]) {
        const screen = model.localToWorld(point.clone()).project(camera);
        const hit = pickFabricContact(model, camera, new Vector2(screen.x, screen.y));
        assert.ok(hit);
        assert.ok(hit.position.distanceTo(point) < 1e-6, 'Origin stays on the touched part');
        assert.ok(Math.abs(hit.normal.z) > .999, 'Normal is in garment space');
      }
    }
  }
  assert.equal(pickFabricContact(model, camera, new Vector2(1, 1)), null, 'Background has no fabric contact');
  mesh.geometry.dispose();
  mesh.material.dispose();
});
