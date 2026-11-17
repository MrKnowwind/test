import * as THREE from 'three';

export function createSky() {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 40, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: `
      varying vec3 skyDirection;
      void main() {
        skyDirection = position;
        vec4 clip = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position,1.);
        gl_Position = clip.xyww;
      }`,
    fragmentShader: `
      varying vec3 skyDirection;
      float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7))) * 43758.54); }
      float noise(vec2 p) {
        vec2 i=floor(p), f=fract(p);
        f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),
          mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
      }
      float fbm(vec2 p) {
        return noise(p)*.53+noise(p*2.03)*.27+noise(p*4.09)*.13+noise(p*8.21)*.07;
      }
      void main() {
        vec3 d=normalize(skyDirection);
        float height=smoothstep(-.07,.8,d.y);
        vec3 color=mix(vec3(.095,.143,.161),vec3(.009,.024,.043),height);
        float glow=pow(max(0.,dot(d,normalize(vec3(-.8,.04,.7)))),12.);
        color+=vec3(.13,.086,.038)*glow;
        vec2 cloudUV=d.xz/(max(.08,d.y+.24))*2.;
        float clouds=fbm(cloudUV*1.4);
        float layer=smoothstep(.40,.72,clouds)*smoothstep(-.02,.19,d.y);
        color=mix(color,color*.42+vec3(.011,.018,.024),layer*.72);
        color+=vec3(.028,.035,.038)*smoothstep(.5,.72,clouds)*glow;
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  return sky;
}
