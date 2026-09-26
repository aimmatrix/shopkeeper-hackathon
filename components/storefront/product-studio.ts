import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createProductModel, disposeProductModel } from './product-model';
import { createFabricMotion } from './fabric-motion';
import { pickFabricContact } from './fabric-contact';
import type { Product } from '@/lib/types';

export type StudioControls = {rotate:(x:number,y:number,fromPointer?:boolean)=>void;touch:(clientX:number,clientY:number)=>void;zoom:(direction:number)=>void;reset:()=>void;ripple:()=>void;dispose:()=>void; imported:boolean};

function cotton(kind:Product['kind']) {
  const data=new Uint8Array(256*256*4);
  let seed=719;
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const n=128+Math.sin(x*Math.PI/2)*22+Math.sin(y*Math.PI/2)*20+(seed/4294967296-.5)*28;
    const i=(y*256+x)*4;data[i]=data[i+1]=data[i+2]=n;data[i+3]=255;
  }
  const weave=new THREE.DataTexture(data,256,256);
  weave.wrapS=weave.wrapT=THREE.RepeatWrapping;weave.repeat.set(8,8);weave.magFilter=THREE.LinearFilter;weave.minFilter=THREE.LinearMipmapLinearFilter;weave.generateMipmaps=true;weave.needsUpdate=true;
  return new THREE.MeshPhysicalMaterial({color:kind==='hoodie'?'#353936':'#dfd8c9',roughness:.91,metalness:0,bumpMap:weave,bumpScale:.008,sheen:.45,sheenColor:kind==='hoodie'?'#8d9690':'#f5eee1',sheenRoughness:.85,side:THREE.DoubleSide});
}

export async function createProductStudio(element:HTMLDivElement, kind:Product['kind'], signal:AbortSignal):Promise<StudioControls> {
  let model:THREE.Group;
  let imported=false;
  if(kind==='hoodie'||kind==='tee') {
    try {
      const response=await fetch(`/models/${kind}.glb`,{signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])});
      if(!response.ok)throw new Error('Model unavailable');
      const gltf=await new GLTFLoader().parseAsync(await response.arrayBuffer(),'');
      model=gltf.scene; imported=true;
      const material=cotton(kind);
      model.traverse(o=>{if(o instanceof THREE.Mesh){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());o.material=material;o.castShadow=true;o.receiveShadow=true;}});
    } catch(error) {if(signal.aborted)throw error;model=createProductModel(kind);}
  } else model=createProductModel(kind);
  if(signal.aborted){disposeProductModel(model);throw new DOMException('Aborted','AbortError');}
  let renderer:THREE.WebGLRenderer;
  try {renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});} catch(error){disposeProductModel(model);throw error;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setSize(1,1);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.96;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  element.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(33,1,.1,40);
  const pivot=new THREE.Group();scene.add(pivot);
  // Loaded GLBs are flat mesh hierarchies; flatten any transforms before cloth motion.
  model.updateMatrixWorld(true);
  const meshes:THREE.Mesh[]=[];model.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);});
  meshes.forEach(m=>{const matrix=m.matrixWorld.clone();model.add(m);m.matrix.copy(matrix);m.matrix.decompose(m.position,m.quaternion,m.scale);});
  model.position.set(0,0,0);model.rotation.set(0,0,0);model.scale.set(1,1,1);
  const motion=createFabricMotion(model,kind);pivot.add(model);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
  const environment=pmrem.fromScene(room,.045);scene.environment=environment.texture;scene.environmentIntensity=.38;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight('#fff8ed','#69716b',.65));
  const key=new THREE.DirectionalLight('#fff4e6',2.6);key.position.set(-3,6,5);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=key.shadow.camera.bottom=-3;key.shadow.camera.right=key.shadow.camera.top=3;key.shadow.normalBias=.025;key.shadow.bias=-.00015;key.shadow.radius=4;scene.add(key);
  const rim=new THREE.DirectionalLight('#dae5ff',2.4);rim.position.set(3,2,-3);scene.add(rim);
  const fill=new THREE.DirectionalLight('#ffffff',.45);fill.position.set(4,0,3);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.09}));floor.rotation.x=-Math.PI/2;floor.position.y=-1.63;floor.receiveShadow=true;scene.add(floor);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed=false,visible=true,frame=0,lastTime=0,time=0,zoom=1,targetX=.04,targetY=-.25,bend=0,velocity=0,energy=0,contactAt=0,hasContact=false;
  const sway=new THREE.Vector2(),swayVelocity=new THREE.Vector2();
  pivot.rotation.set(targetX,targetY,0);
  function render(){if(!disposed&&visible)renderer.render(scene,camera);}
  function schedule(){if(!frame&&!disposed&&visible&&document.visibilityState==='visible')frame=requestAnimationFrame(tick);}
  function tick(now:number){
    frame=0;if(disposed||!visible||document.visibilityState!=='visible'){lastTime=0;return;}
    const dt=Math.min((now-(lastTime||now-16.7))/1000,.034);lastTime=now;time+=dt;
    const damping=1-Math.exp(-13*dt);
    pivot.rotation.x+= (targetX-pivot.rotation.x)*damping;pivot.rotation.y+=(targetY-pivot.rotation.y)*damping;
    if(reduced.matches){bend=velocity=energy=0;sway.set(0,0);swayVelocity.set(0,0);}else{
      velocity+=(-65*bend-12*velocity)*dt;bend+=velocity*dt;energy*=Math.exp(-2.3*dt);
      swayVelocity.addScaledVector(sway,-30*dt).multiplyScalar(Math.exp(-4.8*dt));
      sway.addScaledVector(swayVelocity,dt);
    }
    motion.update(time-contactAt,energy,bend,sway,time);render();
    if(Math.abs(targetX-pivot.rotation.x)+Math.abs(targetY-pivot.rotation.y)>.0001||Math.abs(bend)+Math.abs(velocity)+energy+sway.length()+swayVelocity.length()>.0002)schedule();
    else {bend=velocity=energy=0;sway.set(0,0);swayVelocity.set(0,0);motion.update(time-contactAt,0,0,sway,time);render();lastTime=0;}
  }
  function resize(){
    const {width,height}=element.getBoundingClientRect();if(!width||!height)return;
    renderer.setSize(width,height);camera.aspect=width/height;
    camera.position.set(0,.10,Math.max(5.9,4.0/camera.aspect)/zoom);camera.lookAt(0,.03,0);camera.updateProjectionMatrix();render();
  }
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(element);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){lastTime=0;render();schedule();}else{cancelAnimationFrame(frame);frame=0;lastTime=0;}});intersection.observe(element);
  const visibility=()=>{lastTime=0;if(document.visibilityState==='visible')schedule();else{cancelAnimationFrame(frame);frame=0;}};
  document.addEventListener('visibilitychange',visibility);
  const onReduced=()=>{if(reduced.matches){energy=bend=velocity=0;sway.set(0,0);swayVelocity.set(0,0);motion.update(time-contactAt,0,0,sway,time);render();}};
  reduced.addEventListener('change',onReduced);
  const dispose=()=>{
    if(disposed)return;disposed=true;cancelAnimationFrame(frame);resizeObserver.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',onReduced);signal.removeEventListener('abort',dispose);
    motion.dispose();disposeProductModel(model);floor.geometry.dispose();floor.material.dispose();environment.dispose();key.shadow.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
  };
  signal.addEventListener('abort',dispose,{once:true});
  resize();
  return {
    imported,
    touch(clientX,clientY){
      const rect=element.getBoundingClientRect();
      if(!rect.width||!rect.height)return;
      const hit=pickFabricContact(model,camera,new THREE.Vector2((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2));
      hasContact=Boolean(hit);
      if(hit){
        motion.contact(hit.position,hit.normal);
        if(!reduced.matches){contactAt=time;energy=.65;schedule();}
      }
    },
    rotate(x,y,fromPointer=false){
      targetY+=x;targetX=THREE.MathUtils.clamp(targetX+y,-.85,.85);
      if(!reduced.matches){
        swayVelocity.x=THREE.MathUtils.clamp(swayVelocity.x-x*7,-2.8,2.8);
        swayVelocity.y=THREE.MathUtils.clamp(swayVelocity.y+y*6,-2.2,2.2);
        velocity=THREE.MathUtils.clamp(velocity+x*1.2+y*.4,-.55,.55);
        if(fromPointer&&hasContact)energy=Math.min(.9,energy+Math.abs(x)*.65+Math.abs(y)*.45);
      }
      schedule();
    },
    zoom(direction){zoom=THREE.MathUtils.clamp(zoom+direction*.15,.75,1.65);resize();},
    reset(){targetX=.04;targetY=-.25;pivot.rotation.set(targetX,targetY,0);zoom=1;hasContact=false;bend=velocity=energy=0;sway.set(0,0);swayVelocity.set(0,0);motion.update(time-contactAt,0,0,sway,time);resize();},
    ripple(){if(!reduced.matches){if(!hasContact){
      const hit=pickFabricContact(model,camera,new THREE.Vector2(0,0));
      if(!hit)return;
      motion.contact(hit.position,hit.normal);hasContact=true;
    }contactAt=time;energy=.70;velocity=0;schedule();}},
    dispose,
  };
}
