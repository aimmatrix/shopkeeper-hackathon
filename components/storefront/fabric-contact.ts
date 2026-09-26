import { Group, Matrix3, PerspectiveCamera, Raycaster, Vector2, Vector3 } from 'three';

/** Pick in the current camera pose, then keep the contact attached to the fabric. */
export function pickFabricContact(model: Group, camera: PerspectiveCamera, point: Vector2) {
  model.updateWorldMatrix(true, true);
  camera.updateMatrixWorld();
  const ray = new Raycaster();
  ray.setFromCamera(point, camera);
  const hit = ray.intersectObject(model, true)[0];
  if (!hit?.face) return null;
  const position = model.worldToLocal(hit.point.clone());
  const normal = (hit.normal ?? hit.face.normal).clone()
    .applyNormalMatrix(new Matrix3().getNormalMatrix(hit.object.matrixWorld))
    .applyNormalMatrix(new Matrix3().getNormalMatrix(model.matrixWorld.clone().invert()));
  return { position, normal: normal.lengthSq() ? normal : new Vector3(0, 0, 1) };
}
