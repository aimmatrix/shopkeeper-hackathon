import * as THREE from 'three';
import type { Product } from '@/lib/types';

/** Sewn surfaces with open necks, sleeves and bag mouth, rather than solid extrusions. */
export function createProductModel(kind: Product['kind']) {
  const group = new THREE.Group();
  const weave = new Uint8Array(256 * 256 * 4);
  let seed = 417;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const thread = Math.sin(x * Math.PI / 2) * 23 + Math.cos(y * Math.PI / 2) * 19;
    const value = 128 + thread + (seed / 4294967296 - .5) * 32;
    const i = (y * 256 + x) * 4;
    weave[i] = weave[i + 1] = weave[i + 2] = value; weave[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(weave,256,256);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === 'bag' ? 5 : 7,7);
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true;
  const colors = { hoodie: '#303332', tee: '#ddd6c6', bag: '#707b57', cap: '#ac6850' };
  const fabric = new THREE.MeshPhysicalMaterial({color:colors[kind],roughness:.94,bumpMap:texture,bumpScale:.018,sheen:.65,sheenColor:'#c3baa5',sheenRoughness:.9,side:THREE.DoubleSide});
  const trim = fabric.clone(); trim.color.multiplyScalar(.86); trim.bumpScale=.024;
  const stitch = new THREE.MeshStandardMaterial({color:colors[kind],roughness:1}); stitch.color.multiplyScalar(1.22);
  const dark = new THREE.MeshStandardMaterial({color:'#1e211c',roughness:1,side:THREE.DoubleSide});
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material = fabric) {
    const object = new THREE.Mesh(geometry,material); object.castShadow=true; object.receiveShadow=true; group.add(object); return object;
  }
  type Point = (u:number,v:number) => THREE.Vector3;
  function surface(point:Point, nx=72, ny=64, material:THREE.Material=fabric) {
    const vertices:number[]=[], uv:number[]=[], indices:number[]=[];
    for(let j=0;j<=ny;j++) for(let i=0;i<=nx;i++) {const p=point(i/nx,j/ny); vertices.push(p.x,p.y,p.z); uv.push(i/nx,j/ny);}
    for(let j=0;j<ny;j++) for(let i=0;i<nx;i++) {const a=j*(nx+1)+i,b=a+nx+1; indices.push(a,b,a+1,b,b+1,a+1);}
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)); geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); geometry.setIndex(indices); geometry.computeVertexNormals();
    return mesh(geometry,material);
  }
  function seam(points:THREE.Vector3[], radius=.006, material:THREE.Material=stitch) {
    return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(32,points.length*2),radius,5,false),material);
  }
  const line = (point:(t:number)=>THREE.Vector3, radius=.006, material:THREE.Material=stitch) => seam(Array.from({length:65},(_,i)=>point(i/64)),radius,material);
  const power=(n:number,p:number)=>Math.sign(n)*Math.pow(Math.abs(n),p);
  function print(point:Point, width:number, height:number, label=false) {
    const canvas=document.createElement('canvas'); canvas.width=512;canvas.height=256;
    const ctx=canvas.getContext('2d'); if(!ctx)return;
    if(label){ctx.fillStyle='#d5c9ad';ctx.fillRect(0,0,512,256);}
    ctx.fillStyle=label?'#44473b':'#d8d1b8';ctx.textAlign='center';ctx.font='54px Georgia';ctx.fillText('N O R T H',256,100);ctx.font='italic 34px Georgia';ctx.fillText('& Form',256,151);
    if(!label){ctx.font='15px sans-serif';ctx.fillText('E V E R Y D A Y   G O O D S',256,199);}
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
    const material=new THREE.MeshStandardMaterial({map,transparent:true,roughness:1,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
    surface((u,v)=>point((u-.5)*width,(v-.5)*height),32,16,material);
  }
  if(kind==='hoodie'||kind==='tee') {
    const hoodie=kind==='hoodie';
    const profile = new THREE.CatmullRomCurve3([
      new THREE.Vector3(.66,-1.22,.26), new THREE.Vector3(.72,-1.02,.30),new THREE.Vector3(.70,-.42,.32),
      new THREE.Vector3(.76,.30,.32),new THREE.Vector3(.81,.75,.30),new THREE.Vector3(.64,1.02,.25),new THREE.Vector3(.28,1.16,.19)
    ]);
    const body:Point=(u,v)=>{
      const p=profile.getPoint(v),a=u*Math.PI*2;
      const x=power(Math.cos(a),.78)*p.x;
      const folds=(Math.sin(a*9+v*3)*.020+Math.sin(a*15-v*5)*.012)*(Math.sin(v*Math.PI)*.7+.3);
      const drape=.019*Math.sin(x*17+v*5)*Math.exp(-Math.pow((v-.2)*4,2));
      return new THREE.Vector3(x,p.y+.018*Math.sin(a*3)*(1-v)-(hoodie?.04:.24)*Math.max(0,Math.sin(a))*Math.pow(v,14),power(Math.sin(a),.9)*(p.z+folds+drape));
    };
    surface(body,96,90);
    for(const v of [.025,.06])line(t=>body(t,v).multiply(new THREE.Vector3(1.006,1,1.02)));
    // Rib-knit waistband and an actual open collar.
    surface((u,v)=>body(u,v*(hoodie?.095:.025)),96,12,trim);
    surface((u,v)=>{const p=body(u,.965+v*.035);return p.multiply(new THREE.Vector3(1.005,1,1.02));},72,8,trim);
    if(hoodie)for(let i=0;i<110;i++)line(t=>body(i/110,t*.09).multiply(new THREE.Vector3(1.003,1,1.01)),.003,stitch);
    for(const side of [-1,1]) {
      const path=new THREE.CatmullRomCurve3([new THREE.Vector3(side*.50,.72,0),new THREE.Vector3(side*.94,.49,.015),new THREE.Vector3(side*(hoodie?1.15:1.22),hoodie?-.15:.24,.07),new THREE.Vector3(side*(hoodie?1.26:1.29),hoodie?-.90:.10,.13)]);
      const sleeve:Point=(u,v)=>{
        const center=path.getPoint(v),tangent=path.getTangent(v).normalize();
        const across=new THREE.Vector3(tangent.y,-tangent.x,0).normalize();
        const a=u*Math.PI*2,r=(.30-(hoodie?.13:.035)*v);
        const wrinkle=(hoodie?.012:.005)*Math.sin(v*39+Math.sin(a*3)*2)*Math.pow(Math.sin(v*Math.PI),2);
        return center.addScaledVector(across,Math.cos(a)*(r+wrinkle)).add(new THREE.Vector3(0,0,Math.sin(a)*(r*.85+wrinkle)));
      };
      surface(sleeve,56,64);
      surface((u,v)=>sleeve(u,.89+v*.11),56,10,trim);
      line(t=>sleeve(t,.96),.006);
      if(hoodie)for(let i=0;i<48;i++)line(t=>sleeve(i/48,.90+t*.095),.003);
      line(t=>sleeve(t,.25),.004);
    }
    if(hoodie) {
      // A hollow fabric hood: the opening points towards the camera.
      const hood:Point=(u,v)=>{const a=u*Math.PI*2,theta=.83+v*(Math.PI-.83);return new THREE.Vector3(.47*Math.sin(theta)*Math.cos(a),1.27+.57*Math.sin(theta)*Math.sin(a),.46*Math.cos(theta)-.07);};
      surface(hood,80,48);
      surface((u,v)=>{const p=hood(u,v);p.x*=.96;p.y=1.27+(p.y-1.27)*.96;p.z-=.012;return p;},64,36,trim);
      line(t=>hood(t,0),.024,trim);line(t=>hood(.25,t),.005);
      // Soft kangaroo pocket follows the curvature of the front panel.
      const pocket:Point=(u,v)=>{const width=.48-v*.12,x=(u-.5)*2*width,y=-.96+v*.43;return new THREE.Vector3(x,y,.337+.055*Math.sin(u*Math.PI)*Math.sin(v*Math.PI)+.009*Math.sin(u*16));};
      surface(pocket,40,28);
      for(const v of [.03,.97])line(t=>pocket(t,v),.006);
      for(const u of [.02,.98])line(t=>pocket(u,t),.011,trim);
      const rope=new THREE.MeshStandardMaterial({color:'#aaa799',roughness:1});
      for(const side of [-1,1]){
        line(t=>new THREE.Vector3(side*(.17+.035*Math.sin(t*4)),.98-t*.77,.36+.025*Math.sin(t*5)),.012,rope);
        const tip=mesh(new THREE.CylinderGeometry(.015,.015,.07,10),trim);tip.position.set(side*(.17+.035*Math.sin(4)),.175,.36+.025*Math.sin(5));
      }
    }
    print((x,y)=>new THREE.Vector3(.34+x,.48+y,.34),.22,.11,true);
  } else if(kind==='bag') {
    const bag:Point=(u,v)=>{const a=u*Math.PI*2,width=.83-.10*v,depth=.29-.10*Math.pow(v,4);const fold=.027*Math.sin(a*10+v*4)*Math.sin(v*Math.PI);return new THREE.Vector3(width*power(Math.cos(a),.45),-1.15+v*1.88-.055*Math.sin(a)**2*v,depth*power(Math.sin(a),.48)+fold);};
    surface(bag,112,72);
    surface((u,v)=>{const p=bag(u,v);p.x*=.97;p.z*=.94;return p;},80,48,trim);
    const base=mesh(new THREE.SphereGeometry(1,48,20),trim);base.position.y=-1.14;base.scale.set(.83,.075,.29);
    for(const v of [.035,.94,.98])line(t=>bag(t,v),.008);
    for(const u of [.02,.48,.52,.98])line(t=>bag(u,t),.007);
    // Flat woven straps, stitched along both edges.
    for(const side of [-1,1]) {
      const handle:Point=(u,v)=>{const a=Math.PI*v;return new THREE.Vector3(-.43*Math.cos(a)+(u-.5)*.09,.43+1.13*Math.sin(a),side*(.21+.055*Math.sin(a)));};
      surface(handle,8,72,trim);
      for(const u of [.12,.88])line(t=>handle(u,t),.004);
      for(const x of [-.43,.43])for(const dx of [-.028,.028])line(t=>new THREE.Vector3(x+dx,.39+t*.30,side*.245),.004);
    }
    print((x,y)=>new THREE.Vector3(x,-.27+y,.325),1.04,.52);
  } else {
    const crown:Point=(u,v)=>{const a=u*Math.PI*2,t=.015+v*(Math.PI/2-.015);const panel=1+.008*Math.cos(a*6)*Math.sin(t);return new THREE.Vector3(Math.sin(t)*Math.cos(a)*panel,.80-.95*(1-Math.cos(t)),.87*Math.sin(t)*Math.sin(a)*panel);};
    surface(crown,120,64);
    line(t=>crown(t,1),.025,trim);
    for(let i=0;i<6;i++)for(const delta of [-.003,.003])line(t=>crown(i/6+delta,t),.004,stitch);
    // A bent, thin visor with concentric rows of stitching.
    const visor:Point=(u,v)=>{const a=(u-.5)*Math.PI*1.04;const radius=.73+v*.85;return new THREE.Vector3(Math.sin(a)*(.87+.14*v),-.15-.16*v+.10*Math.sin(a)**2,Math.cos(a)*radius+.04);};
    surface(visor,80,36);
    surface((u,v)=>{const p=visor(u,v);p.y-=.018;return p;},80,24,trim);
    for(const v of [.24,.39,.54,.69,.84,.97])line(t=>visor(t,v).add(new THREE.Vector3(0,.004,0)),.004);
    const button=mesh(new THREE.SphereGeometry(.075,20,12),trim);button.position.set(0,.81,0);button.scale.y=.48;
    for(let i=0;i<6;i++) {
      const a=(i+.5)/6*Math.PI*2,center=crown((i+.5)/6,.53);
      const eyelet=mesh(new THREE.TorusGeometry(.023,.007,6,12),trim);eyelet.position.copy(center);eyelet.lookAt(center.clone().add(new THREE.Vector3(Math.cos(a),.7,Math.sin(a))));
      const hole=mesh(new THREE.CircleGeometry(.016,12),dark);hole.position.copy(center);hole.quaternion.copy(eyelet.quaternion);
    }
    print((x,y)=>{const yy=.23+y;return new THREE.Vector3(x,yy,.87*Math.sqrt(Math.max(0,1-(x*x)-((yy+.15)/.95)**2))+.008);},.48,.24);
    group.rotation.x=.12;
  }
  return group;
}

export function disposeProductModel(group:THREE.Group) {
  const materials=new Set<THREE.Material>(), textures=new Set<THREE.Texture>();
  group.traverse(object=>{if(!(object instanceof THREE.Mesh))return;object.geometry.dispose();(Array.isArray(object.material)?object.material:[object.material]).forEach(material=>materials.add(material));});
  materials.forEach(material=>{if(material instanceof THREE.MeshStandardMaterial){if(material.map)textures.add(material.map);if(material.bumpMap)textures.add(material.bumpMap);}material.dispose();});
  textures.forEach(texture=>texture.dispose());
}
