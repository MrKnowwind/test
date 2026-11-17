import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

export function createPuddles() {
  const vertices: number[] = [], edges: number[] = [];
  for (const [x, z, width, depth] of [[-20, 33, 2.4, 4], [-2, 25, 3, 1.9], [-18, 20, 1.1, 2.7]]) {
    const point = (i: number) => {
      const angle = i / 48 * Math.PI * 2;
      const radius = 1 + Math.sin(angle * 5) * .11 + Math.cos(angle * 9) * .05;
      return [x + Math.cos(angle) * width * radius, -z + Math.sin(angle) * depth * radius, 0];
    };
    for (let i = 0; i < 48; i++) {
      vertices.push(x, -z, 0, ...point(i), ...point(i + 1));
      edges.push(0, 1, 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('edge', new THREE.Float32BufferAttribute(edges, 1));
  geometry.computeVertexNormals();
  const reflector = new Reflector(geometry, {
    textureWidth: 512, textureHeight: 288, multisample: 0, clipBias: .0005,
    shader: {
      name: 'Shallow rainwater',
      uniforms: {
        color: { value: new THREE.Color(0x141b1f) },
        textureMatrix: { value: new THREE.Matrix4() }, tDiffuse: { value: null },
      },
      vertexShader: `
        attribute float edge;
        uniform mat4 textureMatrix;
        varying vec4 reflectedUV;
        varying vec3 worldPosition;
        varying float shore;
        void main() {
          reflectedUV=textureMatrix*vec4(position,1.);
          worldPosition=(modelMatrix*vec4(position,1.)).xyz;
          shore=edge;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
        }`,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        varying vec4 reflectedUV;
        varying vec3 worldPosition;
        varying float shore;
        void main() {
          vec2 uv=reflectedUV.xy/reflectedUV.w;
          vec2 offset=vec2(sin(worldPosition.z*8.),cos(worldPosition.x*11.))*.0006;
          vec3 reflected=texture2D(tDiffuse,uv+offset).rgb*.50+
            texture2D(tDiffuse,uv+offset+vec2(.003,.002)).rgb*.25+
            texture2D(tDiffuse,uv+offset-vec2(.003,.002)).rgb*.25;
          float grazing=1.-abs(normalize(cameraPosition-worldPosition).y);
          gl_FragColor=vec4(reflected*.48+vec3(.008,.012,.014),
            (1.-smoothstep(.56,1.,shore))*(.31+grazing*.31));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    },
  });
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.y = .014;
  const water = reflector.material as THREE.ShaderMaterial;
  water.transparent = true;
  water.depthWrite = false;
  reflector.renderOrder = 1;
  return reflector;
}
