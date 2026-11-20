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
        vec3 color=mix(vec3(.62,.81,.96),vec3(.095,.36,.67),height);
        vec2 uv=d.xz/max(.11,d.y+.16);
        float cloud=fbm(uv*vec2(.87,2.2));
        float edge=smoothstep(.54,.548,cloud)*smoothstep(.0,.13,d.y);
        vec3 cloudPaint=mix(vec3(.68,.77,.89),vec3(1.,.97,.90),smoothstep(.58,.59,cloud));
        color=mix(color,cloudPaint,edge*.84);
        vec3 planet=normalize(vec3(.38,.37,-.85));
        float disc=dot(planet,d);
        float band=dot(d-planet,normalize(vec3(.3,.9,.1)));
        vec3 planetColor=mix(vec3(.60,.67,.89),vec3(.88,.86,.97),step(-.012,band));
        color=mix(color,planetColor,smoothstep(.9954,.9956,disc)*.85);
        vec3 axis=normalize(vec3(1.,-.25,.28));
        vec3 across=normalize(cross(axis,planet));
        vec2 ring=vec2(dot(d,axis)-dot(planet,axis),dot(d,across));
        float ellipse=length(ring/vec2(.158,.025));
        if(disc>.97 && (disc<.9955 || ring.y<0.))
          color=mix(color,vec3(.94,.87,.88),1.-smoothstep(.04,.12,abs(ellipse-1.)));
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  return sky;
}
