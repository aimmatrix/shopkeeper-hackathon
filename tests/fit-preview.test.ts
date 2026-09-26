import assert from 'node:assert/strict';
import * as T from 'three';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { AnimationMixer, Mesh, MeshStandardMaterial, SkinnedMesh, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { dressMannequin } from '../components/storefront/fit-garment';

const load = async (name:string) => {
  const data=await readFile(new URL(`../public/models/${name}.glb`,import.meta.url));
  const loader=new GLTFLoader();
  loader.register(()=>({name:'test-textures',loadTexture:()=>Promise.resolve(new Texture())}));
  return loader.parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
};
for(const kind of ['hoodie','tee'] as const) test(`${kind} stays skinned and finite in every mannequin animation`,async()=>{
  const avatar=await load('fit-mannequin'),garment=await load(kind);
  const dressed=dressMannequin(avatar.scene,garment.scene,kind,new MeshStandardMaterial());
  assert.ok(dressed.group.children.length);
  const mixer=new AnimationMixer(avatar.scene);
  for(const name of ['idle','walk','run']){
    const clip=avatar.animations.find(a=>a.name===name);assert.ok(clip);
    mixer.stopAllAction();mixer.clipAction(clip).play();
    for(const fraction of [.1,.5,.9]){
      mixer.setTime(clip.duration*fraction);avatar.scene.updateMatrixWorld(true);dressed.skeleton.update();
      dressed.group.traverse(o=>{if(!(o instanceof SkinnedMesh))return;
        const p=o.geometry.getAttribute('position'),w=o.geometry.getAttribute('skinWeight');
        for(let i=0;i<p.count;i+=97){
          assert.ok(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-5);
          const v=o.getVertexPosition(i,new Vector3());
          assert.ok(v.toArray().every(Number.isFinite));assert.ok(v.length()<3,'Garment remains near the mannequin');
        }
      });
    }
  }
  avatar.scene.traverse(o=>{if(o instanceof Mesh){assert.ok(o.geometry.index!.count>0,'Exposed mannequin surfaces remain');o.geometry.dispose();}});
});

for(const kind of ['cap','bag'] as const) test(`${kind} scales all accessory parts together`,async()=>{
  const {Group,BoxGeometry,Box3}=T;
  const avatar=await load('fit-mannequin'),garment=new Group();
  const material=new MeshStandardMaterial();
  garment.add(new Mesh(new BoxGeometry(2,2,1),material),new Mesh(new BoxGeometry(1,.01,1),material));
  dressMannequin(avatar.scene,garment,kind,material);
  avatar.scene.updateMatrixWorld(true);
  const anchor=avatar.scene.getObjectByName(`mixamorig${kind==='cap'?'Head':'LeftHand'}`)!;
  const parts=anchor.children.filter(o=>o instanceof Mesh);
  assert.equal(parts.length,2);
  const a=new Box3().setFromObject(parts[0]).getSize(new Vector3()).length();
  const b=new Box3().setFromObject(parts[1]).getSize(new Vector3()).length();
  assert.ok(a<1 && b<1,'No oversized brim, seam or handle');
  assert.ok(a>b,'Thin component keeps its original proportions');
});

test('body mask clips exactly at the hem and preserves normalized skin weights',async()=>{
  const {maskCoveredBody}=await import('../components/storefront/fit-body-mask');
  const avatar=await load('fit-mannequin');
  let boundary=0;
  avatar.scene.traverse(o=>{if(!(o instanceof SkinnedMesh))return;
    const masked=maskCoveredBody(o.geometry,.69),p=masked.getAttribute('position'),w=masked.getAttribute('skinWeight');
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i);
      assert.ok(y<=.86001||y>=1.50999||Math.abs(x)>=.68999,'No covered body fragments remain');
      assert.ok(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-5);
      if(Math.abs(y-.86)<1e-5)boundary++;
    }
  });
  assert.ok(boundary>0,'Boundary triangles end at the hem instead of leaving a gap');
});

test('touch on a posed mesh maps back to the garment bind space',async()=>{
  const {pickFitContact}=await import('../components/storefront/fit-contact');
  const root=new T.Group(),bone=new T.Bone();root.add(bone);
  const geometry=new T.PlaneGeometry(2,2);
  geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(new Uint16Array(16),4));
  geometry.setAttribute('skinWeight',new T.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],4));
  const mesh=new T.SkinnedMesh(geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));root.add(mesh);mesh.bind(new T.Skeleton([bone]));
  const camera=new T.PerspectiveCamera(40,1,.1,20);camera.position.z=5;camera.updateMatrixWorld();
  for(const angle of [0,.4,-.6]){
    bone.rotation.z=angle;bone.position.set(.3,.2,0);root.updateMatrixWorld(true);mesh.skeleton.update();
    const expected=new T.Vector3(-.4,.5,0),screen=expected.clone().applyMatrix4(bone.matrixWorld).project(camera);
    const hit=pickFitContact(root,camera,new T.Vector2(screen.x,screen.y));assert.ok(hit);
    assert.ok(hit.position.distanceTo(expected)<1e-5,'Shoulder contact remains at the same fabric point as it animates');
  }
});
