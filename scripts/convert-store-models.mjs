// Usage: node scripts/convert-store-models.mjs <kind> <source.obj>
import fs from 'node:fs';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Box3, Vector3, MeshStandardMaterial } from 'three';
// GLTFExporter's Blob output adapter for the Node runtime.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => {this.result=result;this.onloadend?.();}); }
};
const [kind, source] = process.argv.slice(2);
const model=new OBJLoader().parse(fs.readFileSync(source,'utf8'));
const box=new Box3().setFromObject(model),size=box.getSize(new Vector3()),center=box.getCenter(new Vector3());
const scale=2.9/size.y;
model.traverse(o=>{
 if(!o.isMesh)return;
 o.geometry.translate(-center.x,-center.y,-center.z);o.geometry.scale(scale,scale,scale);
 o.geometry=mergeVertices(o.geometry,1e-5);
 o.material=new MeshStandardMaterial({color:0xffffff,roughness:1});
});
const result=await new GLTFExporter().parseAsync(model,{binary:true});
fs.mkdirSync('public/models',{recursive:true});
fs.writeFileSync(`public/models/${kind}.glb`,Buffer.from(result));
console.log(kind,{dimensions:size.multiplyScalar(scale).toArray(),bytes:result.byteLength});
