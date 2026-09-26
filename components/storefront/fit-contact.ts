import { Camera, Group, Mesh, SkinnedMesh, Raycaster, Triangle, Vector2, Vector3 } from 'three';

/** Recover the bind-space contact from the animated triangle, keeping ripples on the touched panel. */
export function pickFitContact(root:Group,camera:Camera,point:Vector2) {
  root.updateWorldMatrix(true,true);camera.updateMatrixWorld();
  root.traverse(o=>{if(o instanceof SkinnedMesh){o.skeleton.update();o.computeBoundingSphere();}});
  const ray=new Raycaster();ray.setFromCamera(point,camera);
  const hit=ray.intersectObject(root,true)[0];
  if(!hit?.face||!(hit.object instanceof Mesh))return null;
  const mesh=hit.object,face=hit.face;
  const local=mesh.worldToLocal(hit.point.clone());
  const a=mesh.getVertexPosition(face.a,new Vector3()),b=mesh.getVertexPosition(face.b,new Vector3()),c=mesh.getVertexPosition(face.c,new Vector3());
  const bary=new Triangle(a,b,c).getBarycoord(local,new Vector3());if(!bary)return null;
  const p=mesh.geometry.getAttribute('position');
  a.fromBufferAttribute(p,face.a);b.fromBufferAttribute(p,face.b);c.fromBufferAttribute(p,face.c);
  return {position:a.clone().multiplyScalar(bary.x).addScaledVector(b,bary.y).addScaledVector(c,bary.z),normal:new Triangle(a,b,c).getNormal(new Vector3())};
}
