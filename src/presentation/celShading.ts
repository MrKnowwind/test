import * as THREE from 'three';

// Retain material identity so animated sensor lenses and muzzle emission still update.
export function styleCharacter(root: THREE.Object3D) {
  root.traverse(object=>{
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of [object.material].flat()) {
      if (!(material instanceof THREE.MeshStandardMaterial) || material.userData.celShaded) continue;
      material.userData.celShaded = true;
      material.normalScale.setScalar(.06);
      material.metalness = Math.min(material.metalness,.22);
      material.roughness = .82;
      material.onBeforeCompile = shader=>{
        shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>', `
          float lum = dot(totalDiffuse,vec3(.2126,.7152,.0722));
          float base = max(.025,dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)));
          float lightBand = lum/base;
          float tone = .29 + .34*smoothstep(.22,.26,lightBand)
                           + .39*smoothstep(.60,.65,lightBand)
                           + .22*smoothstep(1.1,1.16,lightBand);
          float rim = 1.-smoothstep(.08,.24,abs(dot(normal,normalize(vViewPosition))));
          outgoingLight = diffuseColor.rgb*tone*mix(vec3(.71,.79,1.),vec3(1.),smoothstep(.2,.62,lightBand))
                        + rim*vec3(.025,.045,.07) + totalSpecular*.16 + totalEmissiveRadiance;
          #include <opaque_fragment>`);
      };
      material.needsUpdate = true;
    }
  });
}
