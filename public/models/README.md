# Local store garment assets

Downloaded 26 September 2026 for this local demonstration. These are third-party meshes, not original Shopkeeper assets. No models have been deployed or published by this task.

| File | Source | Source geometry |
| --- | --- | --- |
| hoodie.glb | https://3dfree.org/hoodie | `high poly.obj` in Hoodie 3D model.zip; 80,624 source vertices |
| tee.glb | https://3dfree.org/t-shirt | `high poly.obj` in T-shirt 3D model.zip; 27,652 source vertices |

Publisher: 3D Free / 3dadmin. Source license: https://3dfree.org/license . The publisher permits using and modifying models in commercial and non-commercial work, retains authors' copyright, and prohibits standalone redistribution or claiming authorship. The original archives are retained temporarily outside the repository in `/tmp`.

Converted with `scripts/convert-store-models.mjs`: preserve source topology/UVs/normals, merge identical vertices, center and scale to 2.9 units tall, export self-contained GLB. Runtime adds cotton material, woven bump texture, lighting and movement. No original texture files were supplied with these OBJ models.

Rebuild after downloading and extracting the source archive:

```sh
node scripts/convert-store-models.mjs hoodie '/path/to/hoodie/high poly.obj'
node scripts/convert-store-models.mjs tee '/path/to/tee/high poly.obj'
```

The tote and cap remain the locally authored procedural models. All four use the same studio renderer and motion controls. The cloth movement is a bounded spring-driven GPU deformation, not a physically accurate collision simulation. It stops after settling, offscreen or in a hidden tab, and is disabled by reduced-motion preferences.

Hoodie motion identifies the two detached drawstring components by topology, pins their eyelets, and adds directional spring sway with separate cord phases. A smooth front pocket mask adds local flex; touch ripples still originate at the picked surface point.

## Animated fit mannequin

`fit-mannequin.glb` is the Xbot sample from the Three.js examples, sourced from https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/Xbot.glb . The official example credits Mixamo: https://threejs.org/examples/webgl_animation_skinning_additive_blending.html . Model and animation authorship remains with Mixamo/Adobe; this local embedded preview does not claim authorship. Downloaded 26 September 2026. The mannequin is rendered with a neutral material. Standing, walking and running use its included animation clips.

Fit preview binds the garment to a sample skeleton using approximate regional weights. It illustrates styling and motion, not measured personal sizing or collision-accurate fabric simulation. Cap and tote are attached to the head and hand respectively.
