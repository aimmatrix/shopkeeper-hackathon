import * as THREE from 'three';
type Vertex={p:THREE.Vector3;n:THREE.Vector3;uv:THREE.Vector2;weights:Map<number,number>};

/** Clip covered triangles at the garment boundary rather than dropping whole triangles. */
export function maskCoveredBody(geometry:THREE.BufferGeometry,armEdge:number) {
  const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv'),si=geometry.getAttribute('skinIndex'),sw=geometry.getAttribute('skinWeight');
  const read=(i:number):Vertex=>({p:new THREE.Vector3().fromBufferAttribute(p,i),n:new THREE.Vector3().fromBufferAttribute(n,i),uv:uv?new THREE.Vector2(uv.getX(i),uv.getY(i)):new THREE.Vector2(),weights:new Map([0,1,2,3].filter(k=>sw.getComponent(i,k)>0).map(k=>[si.getComponent(i,k),sw.getComponent(i,k)]))});
  const mix=(a:Vertex,b:Vertex,t:number):Vertex=>{
    const weights=new Map<number,number>();a.weights.forEach((w,k)=>weights.set(k,w*(1-t)));b.weights.forEach((w,k)=>weights.set(k,(weights.get(k)??0)+w*t));
    return {p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize(),uv:a.uv.clone().lerp(b.uv,t),weights};
  };
  const positions:number[]=[],normals:number[]=[],uvs:number[]=[],indices:number[]=[],weights:number[]=[];
  const emit=(poly:Vertex[])=>{for(let i=1;i<poly.length-1;i++)for(const v of [poly[0],poly[i],poly[i+1]]){
    positions.push(...v.p.toArray());normals.push(...v.n.toArray());uvs.push(...v.uv.toArray());
    const w=[...v.weights].filter(([,value])=>value>0).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=w.reduce((s,[,value])=>s+value,0);
    for(let j=0;j<4;j++){indices.push(w[j]?.[0]??0);weights.push((w[j]?.[1]??0)/(sum||1));}
  }};
  const planes=[(v:Vertex)=>v.p.y-.86,(v:Vertex)=>1.51-v.p.y,(v:Vertex)=>v.p.x+armEdge,(v:Vertex)=>armEdge-v.p.x];
  const ix=geometry.index;
  for(let i=0;i<(ix?.count??p.count);i+=3){
    let remaining=[0,1,2].map(k=>read(ix?ix.getX(i+k):i+k));
    for(const distance of planes){
      if(!remaining.length)break;
      const inside:Vertex[]=[],outside:Vertex[]=[];
      for(let j=0;j<remaining.length;j++){
        const a=remaining[j],b=remaining[(j+1)%remaining.length],da=distance(a),db=distance(b);
        (da>=0?inside:outside).push(a);
        if((da>=0)!==(db>=0)){const v=mix(a,b,da/(da-db));inside.push(v);outside.push(v);}
      }
      emit(outside);remaining=inside;
    }
  }
  const result=new THREE.BufferGeometry();
  result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));result.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));result.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));result.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));result.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  result.setIndex(Array.from({length:positions.length/3},(_,i)=>i));return result;
}
