import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Product } from '@/lib/types';
import { createFabricMotion } from './fabric-motion';
import { pickFitContact } from './fit-contact';
import { dressMannequin } from './fit-garment';
import { createProductModel, disposeProductModel } from './product-model';
export type FitAnimation = 'idle' | 'walk' | 'run';
export type FitControls = { rotate:(x:number,y?:number)=>void; touch:(x:number,y:number)=>void; zoom:(d:number)=>void; animation:(name:FitAnimation)=>void; pause:(paused:boolean)=>void; dispose:()=>void };

export async function createFitStudio(element:HTMLDivElement,kind:Product['kind'],signal:AbortSignal):Promise<FitControls> {
  const loader = new GLTFLoader();
  const load = async (path:string) => {
    const response=await fetch(path,{signal}); if(!response.ok) throw new Error('Model unavailable');
    return loader.parseAsync(await response.arrayBuffer(),'');
  };
  const avatarAsset=await load('/models/fit-mannequin.glb');
  const avatar=avatarAsset.scene;
  let garment:THREE.Group;
  try { garment=kind==='hoodie'||kind==='tee'?(await load(`/models/${kind}.glb`)).scene:createProductModel(kind); }
  catch(error){disposeProductModel(avatar);throw error;}
  if(signal.aborted){disposeProductModel(avatar);disposeProductModel(garment);throw new DOMException('Aborted','AbortError');}
  const mannequinMaterial=new THREE.MeshStandardMaterial({color:'#b8ac96',roughness:.8,metalness:.05});
  avatar.traverse(o=>{if(o instanceof THREE.Mesh){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{Object.values(m).forEach(v=>{if(v instanceof THREE.Texture)v.dispose();});m.dispose();});o.material=mannequinMaterial;o.castShadow=true;o.receiveShadow=true;}});
  const clothMaterial=new THREE.MeshPhysicalMaterial({color:kind==='hoodie'?'#353936':'#ded7c8',roughness:.95,sheen:.35,side:THREE.DoubleSide});
  const dressed=dressMannequin(avatar,garment,kind,clothMaterial);
  const garmentScale=kind==='hoodie'?.265:.235;
  const motion=createFabricMotion(dressed.group,kind,{scale:new THREE.Vector3(garmentScale*1.1,garmentScale,garmentScale*1.35),offset:new THREE.Vector3(0,kind==='hoodie'?1.20:1.16,-.018)});
  let clothTime=0,contactAt=0,energy=0,hasContact=false;
  const sway=new THREE.Vector2(),swayVelocity=new THREE.Vector2();
  // Accessory materials are retained by their attached meshes.
  if(kind==='hoodie'||kind==='tee')disposeProductModel(garment);
  else garment.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
  const bodySkeletons=new Set<THREE.Skeleton>();
  avatar.traverse(o=>{if(o instanceof THREE.SkinnedMesh)bodySkeletons.add(o.skeleton);});
  let renderer:THREE.WebGLRenderer;
  try {renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});}
  catch(error){motion.dispose();disposeProductModel(avatar);disposeProductModel(dressed.group);dressed.skeleton.dispose();bodySkeletons.forEach(s=>s.dispose());clothMaterial.dispose();throw error;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;element.appendChild(renderer.domElement);
  const scene=new THREE.Scene(), pivot=new THREE.Group();pivot.add(avatar,dressed.group);scene.add(pivot);pivot.rotation.y=-.25;
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=.5;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight('#fff8ed','#7a806d',1.5));
  const key=new THREE.DirectionalLight('#fff5e4',3);key.position.set(-3,5,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=key.shadow.camera.bottom=-2;key.shadow.camera.right=key.shadow.camera.top=2;key.shadow.normalBias=.015;scene.add(key);
  const rim=new THREE.DirectionalLight('#e0eaff',2);rim.position.set(3,3,-3);scene.add(rim);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(1.3,64),new THREE.MeshStandardMaterial({color:'#e0e1d5',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.015;floor.receiveShadow=true;scene.add(floor);
  const camera=new THREE.PerspectiveCamera(31,1,.1,30);
  const mixer=new THREE.AnimationMixer(avatar);
  const actions=new Map(avatarAsset.animations.map(clip=>[clip.name,mixer.clipAction(clip)]));
  let selected:FitAnimation='idle';
  const activeNames:FitAnimation[]=['idle','walk','run'];
  activeNames.forEach(name=>actions.get(name)!.setEffectiveWeight(name==='idle'?1:0).play());
  const targetWeight=(name:FitAnimation)=>selected==='run'?(name==='run'?.45:name==='idle'?.55:0):name===selected?1:0;
  mixer.update(0);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let paused=reduced.matches,frame=0,last=0,disposed=false,visible=true,rotation=-.25,target=-.25,zoom=1,elevation=0;
  function render(){renderer.render(scene,camera);}
  function schedule(){if(!frame&&!disposed&&visible&&document.visibilityState==='visible')frame=requestAnimationFrame(tick);}
  function tick(now:number){frame=0;if(disposed||!visible||document.visibilityState!=='visible')return;const dt=Math.min((now-(last||now-16))/1000,.04);last=now;rotation+=(target-rotation)*(1-Math.exp(-12*dt));pivot.rotation.y=rotation;if(!paused&&!reduced.matches){activeNames.forEach(name=>{const action=actions.get(name)!;action.setEffectiveWeight(THREE.MathUtils.lerp(action.getEffectiveWeight(),targetWeight(name),1-Math.exp(-10*dt)));});mixer.update(dt);}
    clothTime+=dt;
    if(reduced.matches){energy=0;sway.set(0,0);swayVelocity.set(0,0);}else{
      energy*=Math.exp(-2.3*dt);swayVelocity.addScaledVector(sway,-30*dt).multiplyScalar(Math.exp(-4.8*dt));sway.addScaledVector(swayVelocity,dt);
    }
    const clothSway=sway.clone();
    const walk=actions.get('walk')!,run=actions.get('run')!;
    const walkPhase=walk.time/walk.getClip().duration*Math.PI*2;
    const runPhase=run.time/run.getClip().duration*Math.PI*2;
    const walking=walk.getEffectiveWeight(),running=run.getEffectiveWeight();
    const gait=reduced.matches?0:walking*.55+running*2.05;
    const phase=selected==='run'?runPhase:walkPhase;
    if(!reduced.matches){
      clothSway.x+=Math.sin(walkPhase)*walking*.095+Math.sin(runPhase)*running*.35;
      clothSway.y+=(Math.cos(walkPhase*2)*walking*.095+Math.cos(runPhase*2)*running*.35)*.65;
    }
    motion.update(clothTime-contactAt,energy,0,clothSway,clothTime,gait,phase);
    render();if((!paused&&!reduced.matches)||Math.abs(target-rotation)>.0001||energy+sway.length()+swayVelocity.length()>.0002)schedule();else last=0;}
  function resize(){const {width,height}=element.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.position.set(0,1.05+elevation,Math.max(3.9,2.1/camera.aspect)/zoom);camera.lookAt(0,.94,0);camera.updateProjectionMatrix();render();}
  const observer=new ResizeObserver(resize);observer.observe(element);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;last=0;if(visible)schedule();else{cancelAnimationFrame(frame);frame=0;}});intersection.observe(element);
  const visibility=()=>{last=0;if(document.visibilityState==='visible')schedule();else{cancelAnimationFrame(frame);frame=0;}};document.addEventListener('visibilitychange',visibility);
  const preference=()=>{last=0;schedule();};reduced.addEventListener('change',preference);
  const dispose=()=>{if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',preference);signal.removeEventListener('abort',dispose);mixer.stopAllAction();mixer.uncacheRoot(avatar);motion.dispose();disposeProductModel(avatar);disposeProductModel(dressed.group);dressed.skeleton.dispose();bodySkeletons.forEach(s=>s.dispose());clothMaterial.dispose();mannequinMaterial.dispose();floor.geometry.dispose();floor.material.dispose();env.dispose();key.shadow.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
  signal.addEventListener('abort',dispose,{once:true});resize();schedule();
  return {touch(x,y){
    const rect=element.getBoundingClientRect();if(!rect.width||!rect.height)return;
    const hit=pickFitContact(dressed.group,camera,new THREE.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2));hasContact=Boolean(hit);
    if(hit){motion.contact(hit.position,hit.normal);contactAt=clothTime;if(!reduced.matches)energy=.75;schedule();}
  },rotate(x,y=0){target+=x;if(y){elevation=THREE.MathUtils.clamp(elevation+y*1.2,-.45,.65);resize();}if(!reduced.matches){swayVelocity.x=THREE.MathUtils.clamp(swayVelocity.x-x*7,-2.8,2.8);swayVelocity.y=THREE.MathUtils.clamp(swayVelocity.y+y*6,-2.2,2.2);if(hasContact)energy=Math.min(.9,energy+Math.abs(x)*.65+Math.abs(y)*.45);}schedule();},zoom(d){zoom=THREE.MathUtils.clamp(zoom+d*.15,.8,1.6);resize();},animation(name){selected=name;if(paused||reduced.matches){activeNames.forEach(key=>actions.get(key)!.setEffectiveWeight(targetWeight(key)));mixer.update(0);}schedule();},pause(value){paused=value;last=0;schedule();},dispose};
}
