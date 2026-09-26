import * as THREE from 'three';
import { addHoodieDetailWeights } from './hoodie-details';

// A gentle deformation field spreading from a picked point on the fabric. Every part samples the same
// field, so pockets, seams and drawstrings move with the underlying cloth.
// This is a visual spring/ripple approximation, not a collision cloth solver.
export function createFabricMotion(root: THREE.Group, kind: string, fit?: {scale:THREE.Vector3;offset:THREE.Vector3}) {
  const uniforms = { clothGait:{value:new THREE.Vector2()}, clothScale:{value:fit?.scale ?? new THREE.Vector3(1,1,1)}, clothOffset:{value:fit?.offset ?? new THREE.Vector3()}, clothSway:{value:new THREE.Vector2()}, clothClock:{value:0}, clothHoodie:{value:kind==='hoodie'?1:0}, clothOrigin:{value:new THREE.Vector3(0,.35,.35)}, clothNormal:{value:new THREE.Vector3(0,0,1)}, clothTime: {value:0}, clothEnergy:{value:0}, clothBend:{value:0}, clothSoftness:{value:kind==='cap'?.16:kind==='bag'?.55:1} };
  const shader = `
    uniform float clothTime, clothEnergy, clothBend, clothSoftness;
    uniform vec3 clothOrigin, clothNormal;
    uniform vec2 clothSway, clothGait;
    uniform float clothClock, clothHoodie;
    attribute vec3 laceProfile;
    uniform vec3 clothScale, clothOffset;
    vec3 clothWarp(vec3 point) {
      vec3 p = (point - clothOffset) / clothScale;
      float laceWeight = pow(clamp((laceProfile.x - p.y) * laceProfile.y, 0.0, 1.0), 1.5);
      float hanging = 1.0 - smoothstep(-1.35, 1.2, p.y);
      float freeEdge = smoothstep(0.45, 1.35, abs(p.x));
      float weight = max(hanging * hanging, freeEdge * 0.6);
      float distanceFromTouch = distance(p, clothOrigin);
      float arrival = 1.0 - smoothstep(clothTime * 1.15, clothTime * 1.15 + 0.16, distanceFromTouch);
      float falloff = exp(-distanceFromTouch * distanceFromTouch * 2.2);
      float ripple = cos(distanceFromTouch * 12.0 - clothTime * 8.0)
                   * arrival * falloff * clothEnergy * 0.062;
      float hem = exp(-pow((p.y + 1.10) * 3.3, 2.0));
      float sideFold = smoothstep(0.25, 0.85, abs(p.x)) * (1.0 - smoothstep(0.9, 1.4, abs(p.x)));
      float restingFold = sin(p.x * 17.0 + p.y * 4.0) * hem * 0.016
                        + sin(p.y * 16.0 + p.x * 7.0) * sideFold * 0.009;
      p.z += restingFold * clothSoftness;
      // Local contact is not suppressed at the shoulders by the hanging mask.
      p += clothNormal * ripple * clothSoftness;
      p.z += clothBend * p.x * 0.035 * weight * clothSoftness;
      p.x += clothBend * 0.045 * weight * clothSoftness;
      // Step-driven folds travel through loose fabric, keeping the collar anchored.
      float strideFold = sin(p.y * 8.0 - clothGait.y * 2.0 + p.x * 3.0);
      float looseFabric = weight * (1.0 - laceWeight);
      p.z += sign(p.z) * (0.55 + strideFold * 0.45) * clothGait.x * 0.055 * looseFabric * clothSoftness;
      p.x += sin(clothGait.y + p.y * 3.0) * clothGait.x * 0.025 * looseFabric * clothSoftness;
      // Sewn pocket edges stay fixed; the loose opening and centre flex forward.
      float pocket = exp(-pow(p.x / 0.46, 4.0) - pow((p.y + 0.78) / 0.30, 4.0))
                   * smoothstep(0.16, 0.34, p.z) * clothHoodie;
      p.z += pocket * (clothSway.x * sin(p.x * 7.0 + clothClock * 5.0) * 0.10
                      + clothSway.y * 0.12 + ripple * 0.8);
      p.x += pocket * clothSway.x * 0.07;
      // Cords are pinned at the eyelets, with most movement at their free tips.
      float cordPhase = laceProfile.z;
      float cordWave = sin(laceWeight * 5.0 - clothClock * 9.0 + cordPhase);
      p.x += laceWeight * (clothSway.x * (0.65 + cordWave * 0.18));
      p.z += laceWeight * (clothSway.y * 0.55 + abs(clothSway.x) * (0.22 + cordWave * 0.10));
      p.y += laceWeight * abs(clothSway.x) * 0.12;
      return p * clothScale + clothOffset;
    }
  `;
  function install(material:THREE.Material, normals:boolean) {
    material.onBeforeCompile = program => {
      Object.assign(program.uniforms, uniforms);
      program.vertexShader = shader + program.vertexShader;
      program.vertexShader = program.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = clothWarp(position);');
      if(normals) program.vertexShader = program.vertexShader.replace('#include <beginnormal_vertex>', `
        vec3 tangentA = normalize(cross(normal, abs(normal.y) < 0.9 ? vec3(0.,1.,0.) : vec3(1.,0.,0.)));
        vec3 tangentB = normalize(cross(normal, tangentA));
        vec3 base = clothWarp(position);
        vec3 objectNormal = normalize(cross(clothWarp(position + tangentA * 0.002) - base, clothWarp(position + tangentB * 0.002) - base));
      `);
    };
    material.customProgramCacheKey=()=>`cloth-details-v6-${normals}`;
    material.needsUpdate=true;
  }
  root.updateMatrixWorld(true);
  root.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    // Flatten transforms into geometry so all meshes share deformation space.
    if(!fit){object.geometry.applyMatrix4(object.matrixWorld);
    object.position.set(0,0,0);object.rotation.set(0,0,0);object.scale.set(1,1,1);}
    if(kind==='hoodie'&&!object.geometry.hasAttribute('laceProfile')) addHoodieDetailWeights(object.geometry);
    else if(!object.geometry.hasAttribute('laceProfile')) object.geometry.setAttribute('laceProfile', new THREE.BufferAttribute(new Float32Array(object.geometry.getAttribute('position').count * 3), 3));
    object.frustumCulled=false;
    (Array.isArray(object.material)?object.material:[object.material]).forEach(material=>install(material,true));
    const depth = new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
    install(depth,false);object.customDepthMaterial=depth;
  });
  return {
    contact(position:THREE.Vector3,normal:THREE.Vector3) { uniforms.clothOrigin.value.copy(position).sub(uniforms.clothOffset.value).divide(uniforms.clothScale.value);uniforms.clothNormal.value.copy(normal).multiply(uniforms.clothScale.value).normalize(); },
    update(time:number,energy:number,bend:number,sway:THREE.Vector2,clock:number,gait=0,phase=0) { uniforms.clothGait.value.set(gait,phase); uniforms.clothSway.value.copy(sway);uniforms.clothClock.value=clock;uniforms.clothTime.value=time;uniforms.clothEnergy.value=energy;uniforms.clothBend.value=bend; },
    dispose() {root.traverse(o=>{if(o instanceof THREE.Mesh)o.customDepthMaterial?.dispose();});}
  };
}
