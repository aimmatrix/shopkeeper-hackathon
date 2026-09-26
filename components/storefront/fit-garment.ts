import * as THREE from 'three';
import { maskCoveredBody } from './fit-body-mask';
import { addHoodieDetailWeights } from './hoodie-details';
import type { Product } from '@/lib/types';

/** Bind the sample garment in a relaxed arm pose to the mannequin's animated skeleton. */
export function dressMannequin(avatar: THREE.Group, garment: THREE.Group, kind: Product['kind'], material: THREE.Material) {
  avatar.updateMatrixWorld(true);
  let body: THREE.SkinnedMesh | undefined;
  avatar.traverse(o => { if (o instanceof THREE.SkinnedMesh) body = o; });
  if (!body) throw new Error('Mannequin has no skeleton');
  const bones = body.skeleton.bones;
  const bone = (suffix: string) => bones.find(b => b.name === `mixamorig${suffix}`)!;
  const boneIndex = (suffix: string) => bones.indexOf(bone(suffix));
  const rest = bones.map(b => b.quaternion.clone());
  for (const [side, angle] of [['Left', -1.30], ['Right', 1.30]] as const) {
    const arm = bone(`${side}Arm`);
    const rotation = arm.getWorldQuaternion(new THREE.Quaternion());
    const parent = arm.parent!.getWorldQuaternion(new THREE.Quaternion());
    arm.quaternion.copy(parent.invert().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), angle).multiply(rotation)));
  }
  avatar.updateMatrixWorld(true);
  const result = new THREE.Group();
  const inverse = bones.map(b => b.matrixWorld.clone().invert());
  const skeleton = new THREE.Skeleton(bones, inverse);
  garment.updateMatrixWorld(true);
  const accessoryBounds = new THREE.Box3().setFromObject(garment);
  const accessorySize = accessoryBounds.getSize(new THREE.Vector3());
  const accessoryCenter = accessoryBounds.getCenter(new THREE.Vector3());
  garment.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    if (kind === 'hoodie' || kind === 'tee') {
      if(kind==='hoodie')addHoodieDetailWeights(geometry);
      const scale = kind === 'hoodie' ? .265 : .235;
      geometry.scale(scale * 1.1, scale, scale * 1.35);
      geometry.translate(0, kind === 'hoodie' ? 1.20 : 1.16, -.018);
      const p = geometry.getAttribute('position');
      const indices = new Uint16Array(p.count * 4), weights = new Float32Array(p.count * 4);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), side = x > 0 ? 'Left' : 'Right';
        const seam = THREE.MathUtils.lerp(.24, .17, THREE.MathUtils.smoothstep(y, 1.15, 1.40));
        const sleeve = THREE.MathUtils.smoothstep(Math.abs(x), seam, seam + .065) * (1 - THREE.MathUtils.smoothstep(y, 1.43, 1.52));
        const elbow = THREE.MathUtils.smoothstep(y, 1.09, 1.22);
        const chest = THREE.MathUtils.smoothstep(y, 1.06, 1.35);
        indices.set([boneIndex('Spine'), boneIndex('Spine2'), boneIndex(`${side}Arm`), boneIndex(`${side}ForeArm`)], i * 4);
        weights.set([(1-sleeve)*(1-chest), (1-sleeve)*chest, sleeve*elbow, sleeve*(1-elbow)], i * 4);
      }
      geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
      geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
      const mesh = new THREE.SkinnedMesh(geometry, material);
      mesh.bind(skeleton, new THREE.Matrix4()); mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true;
      result.add(mesh);
    } else {
      const mesh = new THREE.Mesh(geometry, object.material);
      const anchor = bone(kind === 'cap' ? 'Head' : 'LeftHand');
      geometry.translate(-accessoryCenter.x, -accessoryBounds.min.y, -accessoryCenter.z);
      const scale = kind === 'cap' ? .24 / accessorySize.y : .50 / accessorySize.y;
      mesh.scale.setScalar(scale);
      mesh.position.set(kind === 'cap' ? 0 : .38, kind === 'cap' ? 1.70 : .42, kind === 'cap' ? .015 : .02);
      mesh.updateMatrix(); mesh.applyMatrix4(anchor.matrixWorld.clone().invert());
      anchor.add(mesh); mesh.castShadow = true;
    }
  });
  // Hide the body under the garment, preserving exposed hands, head and lower body.
  if (kind === 'hoodie' || kind === 'tee') avatar.traverse(o => {
    if (!(o instanceof THREE.SkinnedMesh)) return;
    const geometry = maskCoveredBody(o.geometry,kind==='hoodie'?.69:.42);
    o.geometry.dispose();o.geometry=geometry;
  });
  bones.forEach((b,i) => b.quaternion.copy(rest[i]));
  avatar.updateMatrixWorld(true);
  return { group: result, skeleton };
}
