import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { easing } from 'maath';
import { useStore } from '../store';
import { fetchUserData, fetchUserRepos, fetchRepoLanguages, getLanguageColor } from '../lib/github';

// ═══════════════════════════════════════════════
// PLANET GLSL SHADERS — procedural realistic surfaces
// ═══════════════════════════════════════════════
const PLANET_VERT = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPos;    // normalised object-space position — NO UV seam
  void main() {
    vUv  = uv;
    vNormal = normalize(normalMatrix * normal);
    vPos = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  }
`;

// 0 — Gas Giant (Jupiter/Saturn tones)
const FRAG_GAS = `
  uniform float time;
  uniform vec3 col1; uniform vec3 col2; uniform vec3 col3;
  uniform vec3 seed;
  varying vec3 vNormal; varying vec3 vPos;
  float hsh(float n){return fract(sin(n)*43758.5453);}
  float ns(float x){float i=floor(x),f=fract(x);return mix(hsh(i),hsh(i+1.),f*f*(3.-2.*f));}
  float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n2(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
    return mix(mix(h2(i),h2(i+vec2(1,0)),u.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x),u.y);}
  float sn(vec3 p, float sc){
    vec3 w=abs(vPos); w=pow(w,vec3(4.));w/=(w.x+w.y+w.z);
    return n2(p.yz*sc)*w.x + n2(p.xz*sc)*w.y + n2(p.xy*sc)*w.z;}
  void main(){
    vec3 sp = vPos + seed;
    float t=time*0.03;
    float turb=sn(sp,9.0)*0.06+sn(sp,18.0)*0.03;
    float b1=sin((sp.y+turb)*15.0+t)*0.5+0.5;
    float b2=sin((sp.y+turb*0.6)*28.0+t)*0.5+0.5;
    float b3=sin((sp.y-turb*0.3)*44.0-t*0.7)*0.5+0.5;
    vec3 col=mix(col1,col2,smoothstep(0.3,0.7,b1));
    col=mix(col,col3,b2*b2*0.3);
    col=mix(col,col1*1.3,b3*b3*0.15);
    float rim=1.-abs(dot(normalize(vNormal),vec3(0,0,1)));
    col+=col1*pow(rim,3.)*0.55;
    applyHeat(col);
    gl_FragColor=vec4(clamp(col,0.,1.),1.);
  }
`;

// 1 — Rocky World (Mars/Moon — see FRAG_ROCKY below)

// 2 — Lava / Volcanic (Io-style)
const FRAG_LAVA = `
  uniform float time;
  uniform vec3 seed;
  varying vec3 vNormal; varying vec3 vPos;
  float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n2(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
    return mix(mix(h2(i),h2(i+vec2(1,0)),u.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x),u.y);}
  float sn(vec3 p,float sc){
    vec3 w=abs(vPos);w=pow(w,vec3(4.));w/=(w.x+w.y+w.z);
    return n2(p.yz*sc)*w.x+n2(p.xz*sc)*w.y+n2(p.xy*sc)*w.z;}
  void main(){
    vec3 sp=vPos+seed; float t=time*0.018;
    float n=sn(sp+t*0.04,5.0)*0.5+sn(sp-t*0.03,10.0)*0.25+sn(sp,21.0)*0.125;
    float lava=smoothstep(0.46,0.76,n);
    vec3 dark=vec3(0.05,0.01,0.01),hot=vec3(1.0,0.3,0.0),bright=vec3(1.0,0.85,0.1);
    vec3 col=mix(dark,hot,lava);
    col+=bright*smoothstep(0.70,1.0,n)*1.6;
    float rim=1.-abs(dot(normalize(vNormal),vec3(0,0,1)));
    col+=vec3(1.0,0.2,0.0)*pow(rim,4.)*0.6;
    applyHeat(col);
    gl_FragColor=vec4(clamp(col,0.,1.),1.);
  }
`;

// 3 — Ice World (Europa/Pluto)
const FRAG_ICE = `
  uniform vec3 seed;
  varying vec3 vNormal; varying vec3 vPos;
  float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n2(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
    return mix(mix(h2(i),h2(i+vec2(1,0)),u.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x),u.y);}
  float sn(vec3 p,float sc){
    vec3 w=abs(vPos);w=pow(w,vec3(4.));w/=(w.x+w.y+w.z);
    return n2(p.yz*sc)*w.x+n2(p.xz*sc)*w.y+n2(p.xy*sc)*w.z;}
  void main(){
    vec3 sp=vPos+seed;
    float n=sn(sp,6.0)*0.5+sn(sp,13.0)*0.3+sn(sp,26.0)*0.15;
    float crack=1.-abs(n-0.5)*2.2;
    vec3 base=vec3(0.62,0.78,0.95),deep=vec3(0.18,0.42,0.72),vein=vec3(0.45,0.68,0.92);
    vec3 col=mix(base,deep,smoothstep(0.25,0.65,crack)*0.55);
    col=mix(col,vein,smoothstep(0.7,0.9,crack)*0.4);
    vec3 N=normalize(vNormal);
    float spec=pow(max(dot(N,normalize(vec3(1,1,2))),0.),56.);
    col+=vec3(1.)*spec*0.55;
    float rim=1.-abs(dot(N,vec3(0,0,1)));
    col+=vec3(0.45,0.72,1.)*pow(rim,4.)*0.5;
    applyHeat(col);
    gl_FragColor=vec4(clamp(col,0.,1.),1.);
  }
`;

// 4 — Ocean World (Earth-like)
const FRAG_OCEAN = `
  uniform float time;
  uniform vec3 seed;
  varying vec3 vNormal; varying vec3 vPos;
  float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n2(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
    return mix(mix(h2(i),h2(i+vec2(1,0)),u.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x),u.y);}
  float sn(vec3 p,float sc){
    vec3 w=abs(vPos);w=pow(w,vec3(4.));w/=(w.x+w.y+w.z);
    return n2(p.yz*sc)*w.x+n2(p.xz*sc)*w.y+n2(p.xy*sc)*w.z;}
  float fbm(vec3 p,float sc){return sn(p,sc)*0.5+sn(p,sc*2.1)*0.25+sn(p,sc*4.3)*0.125+sn(p,sc*8.7)*0.0625;}
  void main(){
    vec3 sp=vPos+seed;
    float cont=fbm(sp,4.2);
    vec3 ocean=vec3(0.03,0.16,0.42),shallow=vec3(0.04,0.34,0.60);
    vec3 land=vec3(0.16,0.36,0.10),sand=vec3(0.52,0.40,0.16),mount=vec3(0.38,0.34,0.30);
    vec3 col=mix(ocean,shallow,smoothstep(0.36,0.42,cont));
    col=mix(col,land,  smoothstep(0.43,0.49,cont));
    col=mix(col,sand,  smoothstep(0.49,0.52,cont));
    col=mix(col,mount, smoothstep(0.60,0.68,cont));
    col=mix(col,vec3(0.9),smoothstep(0.70,0.78,cont));
    vec3 cloudPos=sp+vec3(time*0.012,0.,0.);
    float cloud=fbm(cloudPos,5.5);
    col=mix(col,vec3(0.96,0.97,1.0),smoothstep(0.55,0.67,cloud));
    vec3 N=normalize(vNormal);
    float rim=1.-abs(dot(N,vec3(0,0,1)));
    col+=vec3(0.25,0.50,1.0)*pow(rim,4.)*0.65;
    applyHeat(col);
    gl_FragColor=vec4(clamp(col,0.,1.),1.);
  }
`;

// 1 — Rocky World (Mars/Moon — craters and dusty terrain)
const FRAG_ROCKY = `
  uniform vec3 seed;
  varying vec3 vNormal; varying vec3 vPos;
  uniform vec3 col1; uniform vec3 col2;
  float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n2(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
    return mix(mix(h2(i),h2(i+vec2(1,0)),u.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x),u.y);}
  float sn(vec3 p,float sc){
    vec3 w=abs(vPos);w=pow(w,vec3(4.));w/=(w.x+w.y+w.z);
    return n2(p.yz*sc)*w.x+n2(p.xz*sc)*w.y+n2(p.xy*sc)*w.z;}
  float fbm(vec3 p,float sc){return sn(p,sc)*0.5+sn(p,sc*2.3)*0.25+sn(p,sc*4.7)*0.125+sn(p,sc*9.3)*0.0625;}
  void main(){
    vec3 sp=vPos+seed;
    float f=fbm(sp,4.0)+fbm(sp,11.0)*0.28+fbm(sp,22.0)*0.12;
    vec3 dark=col1*0.22,mid=col1*0.65,light=mix(col1,col2,0.3)*0.95;
    vec3 col=mix(dark,mid,smoothstep(0.28,0.52,f));
    col=mix(col,light,smoothstep(0.56,0.76,f));
    float cr=sn(sp,7.5)*sn(sp+vec3(1.3,2.7,0.),3.2);
    col=mix(col,dark*0.55,smoothstep(0.56,0.68,cr)*0.7);
    col+=light*0.25*smoothstep(0.65,0.70,cr);
    vec3 N=normalize(vNormal);
    float rim=1.-abs(dot(N,vec3(0,0,1)));
    col+=col1*0.35*pow(rim,4.);
    applyHeat(col);
    gl_FragColor=vec4(clamp(col,0.,1.),1.);
  }
`;

// 5 — Alien World: warped domain FBM with bioluminescent veins
const FRAG_ALIEN = `
  uniform float time;
  uniform vec3 col1; uniform vec3 col2;
  uniform vec3 seed;
  varying vec3 vNormal; varying vec3 vPos;
  float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n2(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
    return mix(mix(h2(i),h2(i+vec2(1,0)),u.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x),u.y);}
  float sn(vec3 p,float sc){
    vec3 w=abs(vPos);w=pow(w,vec3(4.));w/=(w.x+w.y+w.z);
    return n2(p.yz*sc)*w.x+n2(p.xz*sc)*w.y+n2(p.xy*sc)*w.z;}
  float fbm(vec3 p,float sc){return sn(p,sc)*0.5+sn(p+vec3(1.7,9.2,0.),sc*2.1)*0.25
    +sn(p+vec3(8.3,2.8,0.),sc*4.4)*0.125+sn(p+vec3(4.1,6.3,0.),sc*8.9)*0.0625;}
  void main(){
    float t=time*0.022;
    vec3 sp=vPos+seed;
    vec3 qp=sp+vec3(t,t*0.7,0.);
    vec3 rp=sp+vec3(fbm(qp,2.8),fbm(qp+vec3(5.2,1.3,0.),2.8),0.)*1.8;
    float f=fbm(rp+vec3(t*0.4,t*0.3,0.),1.5);
    vec3 dark=col1*0.08,mid=mix(col1,col2,0.45),glow=col2*1.3;
    vec3 col=mix(dark,col1,smoothstep(0.20,0.50,f));
    col=mix(col,mid, smoothstep(0.50,0.70,f));
    col=mix(col,glow,smoothstep(0.72,0.88,f));
    float vein=smoothstep(0.82,1.0,abs(sin(f*18.0+t*2.0)));
    col+=col2*vein*0.7;
    vec3 N=normalize(vNormal);
    float rim=1.-abs(dot(N,vec3(0,0,1)));
    col+=col2*pow(rim,3.)*0.65;
    applyHeat(col);
    gl_FragColor=vec4(clamp(col,0.,1.),1.);
  }
`;
// ── shared heat tint — prepended to every planet fragment shader ──
const HEAT_TINT_GLSL = `
  uniform float heatLevel;
  void applyHeat(inout vec3 col){
    // Hot tint: orange-red for inner / big-sun planets
    // Cold tint: icy blue for outer / small-sun planets
    // Kept subtle so surface texture remains visible
    vec3 hotTint  = vec3(1.0, 0.42, 0.05);
    vec3 coldTint = vec3(0.60, 0.82, 1.0);
    float hot  = smoothstep(0.4, 1.0, heatLevel);   // only kicks in above 0.4
    float cold = smoothstep(0.2, 0.0, heatLevel);   // only kicks in below 0.2
    col = mix(col, hotTint,  hot  * 0.38);           // max 38% hot blend
    col = mix(col, coldTint, cold * 0.28);           // max 28% cold blend
    col += hotTint * hot * hot * 0.12;               // subtle additive glow
  }
`;


// ═══════════════════════════════════════════════
// SUN FRAGMENT SHADER — animated turbulent stellar surface
// (uses the existing PLANET_VERT, no displacement needed)
// ═══════════════════════════════════════════════
const SUN_FRAG = `
  varying vec3 vNormal; varying vec3 vPos;
  uniform float time; uniform vec3 coreCol; uniform vec3 coronaCol;
  float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n2(vec2 p){
    vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
    return mix(mix(h2(i),h2(i+vec2(1.,0.)),u.x),mix(h2(i+vec2(0.,1.)),h2(i+vec2(1.,1.)),u.x),u.y);}
  float sn(float sc){
    vec3 w=abs(vPos); w=w*w*w*w; w=w/(w.x+w.y+w.z);
    return n2(vPos.yz*sc)*w.x + n2(vPos.xz*sc)*w.y + n2(vPos.xy*sc)*w.z;}
  void main(){
    float t=time*0.055;
    // Animated surface: three octaves of noise with time offsets
    float n = sn(3.0 + t*0.3)*0.50
            + sn(6.0 - t*0.2)*0.30
            + sn(13.0 + t*0.5)*0.20;
    // Color zones: dim spots → hot plasma → white-hot bright patches
    vec3 col = mix(coronaCol*0.25, coronaCol, smoothstep(0.25, 0.55, n));
    col = mix(col, mix(coronaCol, coreCol, 0.5), smoothstep(0.55, 0.72, n));
    col = mix(col, coreCol,                      smoothstep(0.72, 0.90, n));
    col += coreCol * smoothstep(0.86, 1.0, n) * 0.8;
    // Limb darkening: edges slightly cooler/dimmer
    float limb = abs(dot(normalize(vNormal), vec3(0.,0.,1.)));
    col *= 0.6 + 0.4 * limb;
    gl_FragColor = vec4(clamp(col, 0., 1.), 1.);
  }
`;
// Flare spike shaders
const FLARE_VERT = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const FLARE_FRAG = `
  uniform vec3 col; uniform float time; uniform float phase;
  varying vec2 vUv;
  void main(){
    float v=vUv.y; float u=vUv.x;
    float shape=(1.-v)*pow(max(0.,1.-abs(u-.5)*2.),1.4);
    float flicker=0.72+0.28*sin(time*3.8+phase);
    float alpha=shape*flicker;
    gl_FragColor=vec4(col,clamp(alpha,0.,1.));
  }
`;
// Nebula wisp billboard shader
const NEBULA_VERT = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const NEBULA_FRAG = `
  uniform float time; uniform vec3 nebCol; uniform float opacity;
  varying vec2 vUv;
  float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n2(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
    return mix(mix(h2(i),h2(i+vec2(1,0)),u.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x),u.y);}
  float fbm(vec2 p){return n2(p)*.5+n2(p*2.1)*.25+n2(p*4.3)*.125+n2(p*8.7)*.0625;}
  void main(){
    vec2 uv=(vUv-.5)*2.;
    float t=time*.006;
    float f=fbm(uv*1.4+t)+fbm(uv*2.7-t*.8)*.5+fbm(uv*5.2)*.25;
    float alpha=smoothstep(.32,.68,f)*opacity;
    float edge=1.-smoothstep(.5,.95,length(uv));
    gl_FragColor=vec4(nebCol,clamp(alpha*edge,0.,1.));
  }
`;

// ── Single solar flare spike ──
const FlareSingle = ({ position, quaternion, length, width, phase, color }) => {
  const matRef = useRef();
  const uniforms = useMemo(() => ({
    col:   { value: new THREE.Color(color) },
    time:  { value: 0 },
    phase: { value: phase },
  }), [color, phase]);
  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.uniforms.time.value = clock.getElapsedTime();
  });
  return (
    <mesh position={position} quaternion={quaternion} raycast={() => null}>
      <planeGeometry args={[width, length, 1, 1]} />
      <shaderMaterial ref={matRef} vertexShader={FLARE_VERT} fragmentShader={FLARE_FRAG}
        uniforms={uniforms} transparent depthWrite={false}
        blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
    </mesh>
  );
};

// ── 16 solar flare spikes distributed around sun surface ──
const SolarFlares = ({ radius, coreColor, coronaColor }) => {
  const flares = useMemo(() => Array.from({ length: 16 }, (_, i) => {
    const phi   = Math.acos(1 - 2 * ((i * 0.618033988749895) % 1));
    const theta = i * 2.399963229728653;
    const dir   = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.sin(phi) * Math.sin(theta),
      Math.cos(phi)
    ).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), dir);
    return {
      pos:    dir.clone().multiplyScalar(radius * 0.92).toArray(),
      quat,
      length: radius * (0.55 + (i * 0.137) % 0.9),
      width:  radius * 0.22,
      phase:  (i / 16) * Math.PI * 2,
      color:  i % 3 === 0 ? coreColor : coronaColor,
    };
  }), [radius, coreColor, coronaColor]);

  return (
    <group>
      {flares.map((f, i) => (
        <FlareSingle key={i} position={f.pos} quaternion={f.quat}
          length={f.length} width={f.width} phase={f.phase} color={f.color} />
      ))}
    </group>
  );
};

// ── Nebula wisp clouds — used in galaxy view ──
const NebulaWisps = ({ color, baseRadius }) => {
  const wisps = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const angle = (i / 6) * Math.PI * 2;
    const r     = baseRadius * (0.35 + (i * 0.17) % 0.45);
    return {
      pos:     [Math.cos(angle)*r, (Math.random()-.5)*r*.4, Math.sin(angle)*r],
      size:    baseRadius * (0.5 + (i * 0.23) % 0.6),
      opacity: 0.08 + (i % 4) * 0.04,
      rotX:    Math.random() * Math.PI,
      rotZ:    Math.random() * Math.PI,
    };
  }), [baseRadius]);

  const matRefs = useRef(null);
  if (!matRefs.current || matRefs.current.length !== wisps.length) {
    matRefs.current = wisps.map(() => React.createRef());
  }
  useFrame(({ clock }) => {
    matRefs.current.forEach(r => { if (r.current) r.current.uniforms.time.value = clock.getElapsedTime(); });
  });

  return (
    <group>
      {wisps.map((w, i) => {
        const uniforms = {
          time:    { value: 0 },
          nebCol:  { value: new THREE.Color(color) },
          opacity: { value: w.opacity },
        };
        return (
          <mesh key={i} position={w.pos} rotation={[w.rotX, 0, w.rotZ]} raycast={() => null}>
            <planeGeometry args={[w.size, w.size, 1, 1]} />
            <shaderMaterial ref={matRefs.current[i]} vertexShader={NEBULA_VERT}
              fragmentShader={NEBULA_FRAG} uniforms={uniforms}
              transparent depthWrite={false} blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
};

// ── Sparse background starfield — solar/planet view only ──
const BackgroundStars = () => {
  const { viewLevel } = useStore();
  const COUNT = 30;
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      // Very large radius — always on the far horizon, never clustered
      const r = 18000 + Math.random() * 25000;
      const u = Math.random() * 2 - 1;
      const t = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      pos[i*3]   = r * s * Math.cos(t);
      pos[i*3+1] = r * u;
      pos[i*3+2] = r * s * Math.sin(t);
      // Realistic: mostly blue-white, some yellow/orange
      const type = Math.random();
      const h = type < 0.55 ? 0.58 : type < 0.78 ? 0.15 : type < 0.92 ? 0.08 : 0.62;
      const c = new THREE.Color().setHSL(h, 0.2 + Math.random() * 0.3, 0.82 + Math.random() * 0.15);
      col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
    }
    return { positions: pos, colors: col };
  }, []);

  // Galaxy/Universe already have their own starfield — don't double up
  if (viewLevel === 'GALAXY' || viewLevel === 'UNIVERSE') return null;

  return (
    <points frustumCulled={false} raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color"    count={COUNT} array={colors}    itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={1.8} sizeAttenuation={false} depthWrite={false}
        blending={THREE.AdditiveBlending} vertexColors transparent opacity={0.85} />
    </points>
  );
};

// ── Subtle local cosmic dust — only in solar system view, wider radius ──
const CosmicDust = () => {
  const { viewLevel } = useStore();
  const COUNT = 10;
  const ref = useRef();
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      // Large enough radius to surround the whole solar system evenly
      const r = 1200 + Math.random() * 3500;
      const u = Math.random() * 2 - 1;
      const t = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      pos[i*3]   = r * s * Math.cos(t);
      pos[i*3+1] = r * u;
      pos[i*3+2] = r * s * Math.sin(t);
      // Blue/purple/teal nebula dust tones
      const c = new THREE.Color().setHSL(
        0.55 + Math.random() * 0.28,
        0.55 + Math.random() * 0.3,
        0.62 + Math.random() * 0.28
      );
      col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
    }
    return { positions: pos, colors: col };
  }, []);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.001;
  });

  if (viewLevel === 'GALAXY' || viewLevel === 'UNIVERSE') return null;

  return (
    <points ref={ref} frustumCulled={false} raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color"    count={COUNT} array={colors}    itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={1.0} sizeAttenuation={false} depthWrite={false}
        blending={THREE.AdditiveBlending} vertexColors transparent opacity={0.35} />
    </points>
  );
};

// ── Shooting stars — bright streaks that occasionally dart across the scene ──
const ShootingStars = () => {
  const [stars, setStars] = useState([]);
  const nextIdRef = useRef(0);
  useEffect(() => {
    const spawn = () => {
      const id = nextIdRef.current++;
      const angle = Math.random() * Math.PI * 2;
      const r = 3000 + Math.random() * 5000;
      const start = new THREE.Vector3(Math.cos(angle)*r, (Math.random()-.5)*2000, Math.sin(angle)*r);
      const end   = start.clone().add(new THREE.Vector3(
        (Math.random()-.5)*4000, (Math.random()-.5)*1000, (Math.random()-.5)*4000
      ));
      setStars(s => [...s.slice(-6), { id, start, end, born: Date.now() }]);
      setTimeout(spawn, 2000 + Math.random() * 4000);
    };
    const t = setTimeout(spawn, 1000);
    return () => clearTimeout(t);
  }, []);
  return (
    <group>
      {stars.map(s => <ShootingStar key={s.id} start={s.start} end={s.end} born={s.born} />)}
    </group>
  );
};
const ShootingStar = ({ start, end, born }) => {
  const ref = useRef();
  const lifespan = 1800;
  useFrame(() => {
    if (!ref.current) return;
    const age = Date.now() - born;
    const t = Math.min(age / lifespan, 1);
    const fade = t < 0.3 ? t/0.3 : 1 - (t-0.3)/0.7;
    ref.current.material.opacity = fade * 0.9;
    ref.current.position.lerpVectors(start, end, t);
  });
  const dir = end.clone().sub(start);
  const len = dir.length();
  const midPt = start.clone().add(end).multiplyScalar(0.5);
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0,1,0), dir.clone().normalize()
  );
  // Position is updated every frame via lerpVectors — don't set initial position in JSX
  return (
    <mesh ref={ref} quaternion={quat} raycast={() => null}>
      <cylinderGeometry args={[0.8, 0, len, 4, 1]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false}
        blending={THREE.AdditiveBlending} />
    </mesh>
  );
};

// ═══════════════════════════════════════════════
const PlanetMesh = ({ planetType, size, mainColor, accentColor, seed, heatLevel, ...props }) => {
  const matRef = useRef();
  const uniforms = useMemo(() => ({
    time:      { value: 0 },
    col1:      { value: new THREE.Color(mainColor) },
    col2:      { value: new THREE.Color(accentColor) },
    col3:      { value: new THREE.Color('#ffffff') },
    seed:      { value: new THREE.Vector3(seed * 7.31, seed * 2.87, seed * 5.13) },
    heatLevel: { value: heatLevel ?? 0.5 },
  }), [mainColor, accentColor, seed, heatLevel]);

  useFrame(({ clock }) => {
    if (matRef.current?.uniforms?.time)
      matRef.current.uniforms.time.value = clock.getElapsedTime();
  });

  const frags = [FRAG_GAS, FRAG_ROCKY, FRAG_LAVA, FRAG_ICE, FRAG_OCEAN, FRAG_ALIEN];
  // Prepend heat snippet so applyHeat() is available; each frag calls it before gl_FragColor
  const frag = HEAT_TINT_GLSL + frags[planetType];
  return (
    <mesh {...props}>
      <sphereGeometry args={[size, 64, 64]} />
      <shaderMaterial ref={matRef} vertexShader={PLANET_VERT} fragmentShader={frag} uniforms={uniforms} />
    </mesh>
  );
};

// --- RIG: STRICT CAMERA MANAGER WITH FREE PANNING ---
const CameraController = () => {
  const { cameraTarget, cameraPosition, minDistance } = useStore();
  const controlsRef = useRef();
  const { camera } = useThree();
  const [isLocked, setIsLocked] = useState(true);

  useEffect(() => {
    setIsLocked(true);
  }, [cameraTarget, cameraPosition]);

  useFrame((state, delta) => {
    if (controlsRef.current) {
      controlsRef.current.minDistance = minDistance;
      
      if (isLocked) {
        easing.damp3(camera.position, cameraPosition, 0.8, delta);
        easing.damp3(controlsRef.current.target, cameraTarget, 0.8, delta);
        controlsRef.current.update();

        if (
          camera.position.distanceTo(new THREE.Vector3(...cameraPosition)) < 1.0 &&
          controlsRef.current.target.distanceTo(new THREE.Vector3(...cameraTarget)) < 1.0
        ) {
          setIsLocked(false);
        }
      }
    }
  });

  return (
    <OrbitControls 
      ref={controlsRef} 
      makeDefault 
      enablePan={true} 
      enableZoom={true} 
      maxDistance={60000} 
      onStart={() => setIsLocked(false)}
    />
  );
};

// --- BASE UNIVERSE: GALAXIES & STARS ---
const UniverseBase = () => {
  const { viewLevel, zoomToGalaxy, zoomToSystem, selectedUser, selectedGalaxy, galaxies, ensureGalaxyExists } = useStore();

  const [realUsersData, setRealUsersData] = useState({});

  useEffect(() => {
    if (selectedGalaxy && viewLevel === 'GALAXY' && !realUsersData[selectedGalaxy]) {
      let active = true;
      fetch(`https://api.github.com/search/users?q=location:${selectedGalaxy}&per_page=100`)
        .then(res => res.ok ? res.json() : { items: [] })
        .then(data => {
          if (active && data.items && data.items.length > 0) {
            setRealUsersData(prev => ({ ...prev, [selectedGalaxy]: data.items.map(u => u.login) }));
          }
        }).catch(err => console.error(err));
      return () => { active = false };
    }
  }, [selectedGalaxy, viewLevel]);

  const allStars = useMemo(() => {
    const stars = [];
    const FAKE_PREFIXES = ['alex', 'sarah', 'chris', 'ninja', 'coder', 'hacker', 'dev', 'pro', 'master', 'tech', 'web', 'data', 'ai', 'cloud', 'cyber', 'quantum', 'pixel', 'code', 'git', 'hub', 'shadow', 'neon', 'matrix', 'zero', 'one'];
    const FAKE_SUFFIXES = ['_99', '_dev', 'x', 'y', 'z', '_pro', '123', '_code', '_hacker', '_guru', 'master', 'smith', 'lee', 'kim', 'wang', 'kumar', 'son', 'man', 'girl', '_x', '_y', '77', '88'];

    galaxies.forEach((g) => {
      // If we have dynamically fetched REAL users for this galaxy, use them! Otherwise fallback to 400 fake ones.
      const realUsers = realUsersData[g.name] || [];
      const count = realUsers.length > 0 ? realUsers.length : 400;

      for (let i = 0; i < count; i++) {
        let username;
        if (realUsers.length > 0) {
          username = realUsers[i];
        } else {
          const prefix = FAKE_PREFIXES[Math.floor(Math.random() * FAKE_PREFIXES.length)];
          const suffix = FAKE_SUFFIXES[Math.floor(Math.random() * FAKE_SUFFIXES.length)];
          username = i === 0 ? 'octocat' : `${prefix}${suffix}`;
        }
        
        // Procedural fame (some developers are massive, most are tiny)
        const fame = Math.random() > 0.95 ? (Math.random() * 8 + 4) : (Math.random() * 2 + 1);
        
        // Procedural clustering: highly famous stars clump near the galactic core (radius 0-300), others spread out to 1500
        const radiusDist = fame > 4 ? Math.random() * 300 : 300 + Math.random() * 1200;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(1 - 2 * Math.random());
        
        const offset = [
          radiusDist * Math.cos(theta) * Math.sin(phi) * (g.size || 1),
          (Math.random() - 0.5) * 400 * (g.size || 1), // Flatten the y-axis for a disc shape
          radiusDist * Math.cos(phi) * (g.size || 1)
        ];

        stars.push({
          galaxyName: g.name,
          username,
          pos: [g.pos[0] + offset[0], g.pos[1] + offset[1], g.pos[2] + offset[2]],
          relPos: offset, // relative to galaxy center for rotation
          size: 3,
          color: new THREE.Color().setHSL(Math.random(), 0.5, 0.8)
        });
      }
    });
    return stars;
  }, [galaxies, realUsersData]);

  const visibleStars = useMemo(() => {
    if (viewLevel === 'UNIVERSE' || !selectedGalaxy) return []; // DONT render developer stars in UNIVERSE view
    return allStars.filter(s => s.galaxyName === selectedGalaxy);
  }, [allStars, selectedGalaxy, viewLevel]);

  const instancedMeshRef = useRef();
  const instancedHitboxRef = useRef();
  
  // Get the center of the selected galaxy
  const galaxyCenter = useMemo(() => {
    if (!selectedGalaxy) return [0, 0, 0];
    const g = galaxies.find(g => g.name === selectedGalaxy);
    return g ? g.pos : [0, 0, 0];
  }, [selectedGalaxy, galaxies]);

  useEffect(() => {
    if (instancedMeshRef.current && visibleStars.length > 0) {
      const dummy = new THREE.Object3D();
      visibleStars.forEach((star, i) => {
        // Use relative position so rotation is around the galaxy center (black hole)
        dummy.position.set(...star.relPos);
        dummy.scale.set(star.size, star.size, star.size);
        dummy.updateMatrix();
        instancedMeshRef.current.setMatrixAt(i, dummy.matrix);
        instancedMeshRef.current.setColorAt(i, star.color);
        if (instancedHitboxRef.current) {
          instancedHitboxRef.current.setMatrixAt(i, dummy.matrix);
        }
      });
      instancedMeshRef.current.instanceMatrix.needsUpdate = true;
      instancedMeshRef.current.instanceColor.needsUpdate = true;
      if (instancedHitboxRef.current) instancedHitboxRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [visibleStars]);

  const handleInstancedClick = async (e) => {
    e.stopPropagation();
    if (e.instanceId !== undefined && e.instanceId < visibleStars.length) {
      const star = visibleStars[e.instanceId];
      if (selectedUser !== star.username) {
        // Fetch the real user data to get their actual location
        const uData = await fetchUserData(star.username);
        if (uData && !uData.notFound) {
          const loc = uData.location || selectedGalaxy;
          const correctGalaxy = ensureGalaxyExists(loc);
          if (correctGalaxy && correctGalaxy.name !== selectedGalaxy) {
            // User belongs in a different galaxy — remap them but still zoom to system
            useStore.setState({ selectedGalaxy: correctGalaxy.name });
          }
        }
        zoomToSystem(star.username, star.pos, star.size * 2);
      }
    }
  };

  return (
    <group>
      {galaxies.map((g, i) => {
        // At UNIVERSE level, show ALL galaxies as simple massive MACRO STARS
        if (viewLevel === 'UNIVERSE') {
          return (
            <group key={`macro-${i}`} position={g.pos} onClick={(e) => { e.stopPropagation(); zoomToGalaxy(g.name, g.pos); }}>
              {/* Macro Star Representation */}
              <mesh>
                <sphereGeometry args={[150, 32, 32]} />
                <meshBasicMaterial color={g.cIn} />
              </mesh>
              <mesh scale={1.5}>
                <sphereGeometry args={[150, 32, 32]} />
                <meshBasicMaterial color={g.cOut} transparent opacity={0.4} blending={THREE.AdditiveBlending} side={THREE.BackSide} />
              </mesh>
              {/* Massive Hitbox so it's super easy to click from 15000 units away */}
              <mesh visible={false}>
                <sphereGeometry args={[1000, 8, 8]} />
                <meshBasicMaterial />
              </mesh>
              <Html position={[0, 400, 0]} center zIndexRange={[50, 0]} style={{ pointerEvents: 'none' }}>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Orbitron', fontSize: '12px', textShadow: `0 0 10px ${g.cIn}`, pointerEvents: 'none', textTransform: 'uppercase', letterSpacing: '2px' }}>
                  {g.name}
                </div>
              </Html>
            </group>
          );
        }

        // At GALAXY or SYSTEM level, ONLY render the selected galaxy, and render it as a full NEBULA
        if (selectedGalaxy && selectedGalaxy !== g.name) return null;
        
        // ISOLATE SOLAR SYSTEM: Hide the giant nebula if we are focused deeply on a single solar system
        if (viewLevel === 'SYSTEM' || viewLevel === 'PLANET') return null;
        
        return (
          <group key={`nebula-${i}`} position={g.pos}>
            <GalaxyParticles colorInside={g.cIn} colorOutside={g.cOut} count={Math.floor(8000 * (g.size || 1))} radius={800 * (g.size || 1)} />
            <BlackHole color={g.cIn} />
            <Html position={[0, 400 * (g.size || 1), 0]} center zIndexRange={[50, 0]} style={{ pointerEvents: 'none' }}>
              <div style={{ color: 'white', fontFamily: 'Orbitron', fontSize: '24px', textShadow: `0 0 15px ${g.cIn}`, pointerEvents: 'none', textTransform: 'uppercase', letterSpacing: '4px' }}>
                {g.name} Galaxy
              </div>
            </Html>
          </group>
        );
      })}

      {/* Developer Stars: orbit around galaxy center (black hole) */}
      {visibleStars.length > 0 && viewLevel === 'GALAXY' && (
        <GalaxyStars
          visibleStars={visibleStars}
          instancedMeshRef={instancedMeshRef}
          instancedHitboxRef={instancedHitboxRef}
          onClick={handleInstancedClick}
          center={galaxyCenter}
        />
      )}
    </group>
  );
};

// BLACK HOLE at galaxy center — flat horizontal static disk
const BlackHole = ({ color }) => {
  return (
    <group>
      {/* Event horizon */}
      <mesh raycast={() => null}>
        <sphereGeometry args={[60, 64, 64]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Inner accretion ring — vertical & static */}
      <mesh rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
        <torusGeometry args={[88, 20, 32, 128]} />
        <meshBasicMaterial color={color} transparent opacity={0.95} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Outer ring — vertical & static */}
      <mesh rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
        <torusGeometry args={[135, 7, 16, 128]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Lensing glow */}
      <mesh raycast={() => null}>
        <sphereGeometry args={[78, 32, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.07} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
};

// Galaxy developer stars with slow orbital rotation
const GalaxyStars = ({ visibleStars, instancedMeshRef, instancedHitboxRef, onClick, center }) => {
  const groupRef = useRef();

  useFrame((state) => {
    // Rotate the star field around its own center (the black hole position)
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.021;
    }
  });

  return (
    // Position group AT the galaxy center so rotation pivot is the black hole
    <group ref={groupRef} position={center}>
      {/* Visual Stars — raycast disabled so it doesn't block the hitboxes */}
      <instancedMesh
        dispose={null}
        frustumCulled={false}
        ref={instancedMeshRef}
        args={[null, null, 4000]}
        count={visibleStars.length}
        raycast={() => null}
      >
        <sphereGeometry args={[4, 16, 16]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* Fat Invisible Hitboxes for easy clicking */}
      <instancedMesh
        dispose={null}
        frustumCulled={false}
        ref={instancedHitboxRef}
        args={[null, null, 4000]}
        count={visibleStars.length}
        onClick={onClick}
        onPointerOver={() => document.body.style.cursor = 'pointer'}
        onPointerOut={() => document.body.style.cursor = 'auto'}
      >
        <sphereGeometry args={[35, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </instancedMesh>
    </group>
  );
};

// HIGH-PERFORMANCE NEBULA
const GalaxyParticles = ({ colorInside, colorOutside, count, radius }) => {
  const pointsRef = useRef();

  const particlesPosition = useMemo(() => {
    const cInColor  = new THREE.Color(colorInside);
    const cOutColor = new THREE.Color(colorOutside);
    const positions = new Float32Array(count * 3);
    const colors    = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const r = Math.random() * radius + 50;
      const spinAngle  = r * 0.01;
      const branchAngle = (i % 4) * ((Math.PI * 2) / 4);
      const randomX = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * (radius * 0.15);
      const randomY = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * (radius * 0.1);
      const randomZ = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * (radius * 0.15);
      positions[i3]     = Math.cos(branchAngle + spinAngle) * r + randomX;
      positions[i3 + 1] = randomY;
      positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * r + randomZ;
      const mixedColor = cInColor.clone();
      mixedColor.lerp(cOutColor, r / (radius + 200));
      colors[i3] = mixedColor.r; colors[i3 + 1] = mixedColor.g; colors[i3 + 2] = mixedColor.b;
    }
    return { positions, colors };
  }, [colorInside, colorOutside, count, radius]);

  useFrame((state) => {
    if(pointsRef.current) pointsRef.current.rotation.y = state.clock.getElapsedTime() * 0.007;
  });

  return (
    <points ref={pointsRef} frustumCulled={false} raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={particlesPosition.positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={count} array={particlesPosition.colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={1.5} sizeAttenuation={false} depthWrite={false} blending={THREE.AdditiveBlending} vertexColors={true} transparent opacity={0.8} />
    </points>
  );
};

// --- FOCUSED DETAILED MODE: DYNAMIC SOLAR SYSTEM ---
const FocusedSolarSystem = () => {
  const { viewLevel, selectedUser, systemPosition } = useStore();
  const [userData, setUserData] = useState(null);
  const [repos, setRepos] = useState([]);
  
  const groupRef = useRef();

  useEffect(() => {
    if (!selectedUser || (viewLevel !== 'SYSTEM' && viewLevel !== 'PLANET')) {
      setUserData(null);
      setRepos([]);
      return;
    }
    
    // Clear old state immediately on search to prevent ghosting/duplicates
    setUserData(null);
    setRepos([]);

    let active = true;
    const loadUniverse = async () => {
      try {
        const [uData, rData] = await Promise.all([
          fetchUserData(selectedUser),
          fetchUserRepos(selectedUser)
        ]);
        if (active) {
          setUserData(uData);
          setRepos(rData.slice(0, 20)); 
        }
      } catch (e) {
        console.error("Failed to load user universe", e);
      }
    };
    
    loadUniverse();
    return () => { active = false; };
  }, [selectedUser, viewLevel]);

  const _scaleTarget = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.scale.lerp(_scaleTarget, 0.05);
    }
  });

  if ((viewLevel !== 'SYSTEM' && viewLevel !== 'PLANET') || !userData) return null;

  if (userData.isRateLimited) {
    return (
      <group position={systemPosition} ref={groupRef} scale={[0.001, 0.001, 0.001]}>  
        <mesh rotation={[Math.PI / 4, Math.PI / 4, 0]}>
          <octahedronGeometry args={[25, 0]} />
          <meshBasicMaterial color="#ff0000" wireframe />
        </mesh>
        <mesh scale={1.5}>
          <octahedronGeometry args={[25, 0]} />
          <meshBasicMaterial color="#ff0000" transparent opacity={0.2} blending={THREE.AdditiveBlending} />
        </mesh>
        <Html position={[0, 50, 0]} center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ color: '#ff4444', fontFamily: 'Orbitron', fontSize: '32px', fontWeight: 'bold', textShadow: '0 0 20px red', textAlign: 'center', pointerEvents: 'none', background: 'rgba(20,0,0,0.8)', padding: '20px', border: '2px solid red', borderRadius: '10px' }}>
            SYSTEM LOCKED<br/>
            <span style={{ fontSize: '14px', color: 'white' }}>GitHub API Limit Exceeded</span>
          </div>
        </Html>
      </group>
    );
  }

  // Sun size = solar system scale: grows with both follower fame AND repo count
  const systemScale = Math.log10((userData.followers || 1) + 1) * 5
                    + Math.log10((userData.publicRepos || 1) + 1) * 3;
  const SUN_RADIUS = Math.max(12, Math.min(systemScale, 60));

  return (
    <group position={systemPosition} ref={groupRef} scale={[0.001, 0.001, 0.001]}>
      <Sun user={userData} size={SUN_RADIUS} />
      {repos.map((repo, i) => (
        <Planet key={repo.name} repo={repo} username={selectedUser} index={i} sunRadius={SUN_RADIUS} />
      ))}
    </group>
  );
};

const OrbitRing = ({ distance, color }) => {
  const ringRef = useRef();
  useFrame((state, delta) => {
    if(ringRef.current && ringRef.current.material) {
      easing.damp(ringRef.current.material, 'opacity', 0.25, 1.5, delta);
    }
  });
  return (
    <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <torusGeometry args={[distance, 0.5, 16, 120]} />
      <meshBasicMaterial color={color} transparent opacity={0} blending={THREE.AdditiveBlending} />
    </mesh>
  );
};

const Moon = ({ languageData, index, total, planetSize, maxOrbitRadius }) => {
  const moonRef = useRef();
  const [hovered, setHovered] = useState(false);
  const size = Math.max(0.8, languageData.percentage * 4.0);

  // Moon orbit — start BEYOND the atmosphere glow (1.5× planet radius)
  const ORBIT_GAP = 5.0;
  const atmoClearance = planetSize * 1.55; // atmosphere glow at 1.3×, add buffer
  const rawDistance = atmoClearance + size + ORBIT_GAP + (index * (size * 2 + ORBIT_GAP + 3.0));

  // Hard cap: moons must stay inside the planet's orbital lane
  // maxOrbitRadius = half the gap between this orbit and the next (default generous)
  const safeMax = maxOrbitRadius ?? 60;
  const distance = Math.min(rawDistance, safeMax - size - 1.5);

  // Stagger each moon on a slightly different Y plane
  const yOffset = (index % 2 === 0 ? 1 : -1) * (index * 1.2);

  const color = getLanguageColor(languageData.language);
  const speed = 0.12 / (1 + index * 0.28); // inner moons faster, outer ones slower
  const angleOffset = (index / total) * Math.PI * 2;

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const currentAngle = angleOffset + t * speed;
    moonRef.current.position.x = Math.cos(currentAngle) * distance;
    moonRef.current.position.z = Math.sin(currentAngle) * distance;
    moonRef.current.position.y = yOffset;
    easing.damp3(moonRef.current.scale, [1, 1, 1], 2.0, delta);
  });

  const formatPercent = (p) => {
    const raw = p * 100;
    if (raw > 0 && raw < 0.01) return '<0.01';
    return parseFloat(raw.toFixed(2));
  };

  return (
    <group ref={moonRef} scale={[0.001, 0.001, 0.001]}>
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
      >
        <sphereGeometry args={[size, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
      </mesh>
      
      {/* Invisible larger hitbox for easier hovering on tiny moons */}
      <mesh
        visible={false}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
      >
        <sphereGeometry args={[size * 3.0, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {hovered && (
        <Html position={[size + 1, size + 1, 0]} center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(5, 5, 20, 0.9)', border: `1px solid ${color}`, padding: '8px 12px', borderRadius: '6px', color: 'white', backdropFilter: 'blur(10px)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }}></div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>{languageData.language}</div>
              <div style={{ fontSize: '11px', color: '#aaa' }}>{formatPercent(languageData.percentage)}% Usage</div>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

const Planet = ({ repo, username, index, sunRadius }) => {
  const { zoomToPlanet, viewLevel, selectedPlanet, systemPosition } = useStore();
  const [languages, setLanguages] = useState([]);
  const [hovered, setHovered] = useState(false);
  const orbitRef = useRef();

  useEffect(() => {
    if (viewLevel === 'PLANET' && selectedPlanet === repo.name) {
      fetchRepoLanguages(username, repo.name).then(setLanguages);
    }
  }, [viewLevel, selectedPlanet, repo.name, username]);

  // Orbit distance: wider gaps so planets have room to breathe
  const distance = sunRadius + 80 + (index * 140);

  // Planet size: driven by repo size in KB — small project = tiny, large = big
  // log scale keeps it visually manageable (2 → 8 units)
  const rawSize = Math.log10(Math.max(repo.size || 1, 1) + 1);
  const size = Math.max(2, Math.min(rawSize * 2.2, 8));
  const repoRadius = size;
  
  // Calculate relative orbit position
  const angle = (index * 137.5) * (Math.PI / 180);
  const orbitPos = [
    Math.cos(angle) * distance,
    Math.sin(angle) * (distance * 0.2), 
    Math.sin(angle) * distance
  ];

  // Calculate the absolute world position of the planet
  const absolutePos = [
    systemPosition[0] + orbitPos[0],
    systemPosition[1] + orbitPos[1],
    systemPosition[2] + orbitPos[2],
  ];

  useFrame((state) => {
    if (orbitRef.current && viewLevel !== 'PLANET') {
      orbitRef.current.rotation.y += 0.002 * (100 / distance);
    }
  });

  const repoHash   = Math.abs(repo.name.split('').reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0));

  // Repos with no detected language get a unique hue from their hash instead of flat white
  const baseColor  = repo.language
    ? getLanguageColor(repo.language)
    : `hsl(${repoHash % 360}, 65%, 52%)`;

  // Hue-shift per repo so two repos sharing the same language still look different
  const hueShiftDeg = (repoHash % 72) - 36;            // ±36° hue rotation
  const satScale    = 0.75 + (repoHash % 50) / 200;    // 0.75–1.0 saturation scale
  const _c = new THREE.Color(baseColor);
  const _hsl = { h: 0, s: 0, l: 0 };
  _c.getHSL(_hsl);
  _c.setHSL(
    (_hsl.h + hueShiftDeg / 360 + 1) % 1,
    Math.min(1, _hsl.s * satScale),
    _hsl.l
  );
  const mainColor = '#' + _c.getHexString();

  // Planet TYPE by distance from sun — like a real solar system
  // Inner: scorching hot → outer: frozen alien worlds
  const planetType = index <= 1  ? 2   // 🌋 Lava    — closest, sun-scorched
                   : index <= 3  ? 1   // 🪨 Rocky   — inner rocky worlds
                   : index <= 6  ? 0   // 🌀 Gas Giant — mid system
                   : index <= 10 ? 4   // 🌊 Ocean   — habitable zone
                   : index <= 14 ? 3   // 🧊 Ice     — cold outer system
                   :               5;  // 👽 Alien   — outermost edge

  // Rings only on outer cold planets (gas giants, ice, alien) — inner planets are too hot
  const hasRings   = index >= 4 && repoHash % 3 === 0;
  const accentHue  = (repoHash % 360 + 120) % 360;
  const accentColor = `hsl(${accentHue},80%,60%)`;
  const planetRef  = useRef();
  // band1Ref / band2Ref reserved for future use; rotation handled inside PlanetMesh shader

  // band1Ref / band2Ref are wired inside PlanetMesh for Gas/Lava/Ocean types
  // Planet group just rotates the whole body
  useFrame((_, delta) => {
    if (planetRef.current) planetRef.current.rotation.y += delta * 0.35;
  });

  const onClickPlanet = (e) => {
    e.stopPropagation();
    if (viewLevel === 'PLANET' && selectedPlanet === repo.name) {
      window.open(`https://github.com/${username}/${repo.name}`, '_blank');
    } else { zoomToPlanet(repo.name, absolutePos, repoRadius); }
  };

  return (
    <group ref={orbitRef}>
      <OrbitRing distance={distance} color={mainColor} />
      <group position={orbitPos}>

        {/* Fat invisible hitbox — always first */}
        <mesh visible={false} onClick={onClickPlanet}>
          <sphereGeometry args={[size * 2.8, 8, 8]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>

        {/* ══ ROTATING PLANET BODY ══ */}
        <group ref={planetRef}
          onClick={onClickPlanet}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true);  document.body.style.cursor = 'pointer'; }}
          onPointerOut={(e)  => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
        >
          {/* Use PlanetMesh for all types — shader-driven */}
          <PlanetMesh
            planetType={planetType}
            size={size}
            mainColor={mainColor}
            accentColor={accentColor}
            seed={repoHash % 1000}
            heatLevel={Math.max(0, Math.min(1,
              (sunRadius - 12) / 48 * 0.65 +   // bigger sun = more heat
              (1 - index / 19) * 0.35           // closer orbit = more heat
            ))}
          />
        </group>

        {/* Atmosphere glow (outside rotating group) */}
        <mesh scale={1.3} raycast={() => null}><sphereGeometry args={[size, 32, 32]} /><meshBasicMaterial color={mainColor} transparent opacity={0.07} side={THREE.BackSide} blending={THREE.AdditiveBlending} /></mesh>
        <mesh scale={1.65} raycast={() => null}><sphereGeometry args={[size, 16, 16]} /><meshBasicMaterial color={mainColor} transparent opacity={0.02} side={THREE.BackSide} blending={THREE.AdditiveBlending} /></mesh>

        {/* Rings — only for sphere-type planets, NOT rocky(1) or crystal(5) icosahedrons */}
        {hasRings && planetType !== 1 && planetType !== 5 && (<>
          <mesh rotation={[Math.PI / 2.8, 0.4, 0.2]}>
            <torusGeometry args={[size * 2.0, size * 0.45, 2, 100]} />
            <meshBasicMaterial color={mainColor} transparent opacity={0.55} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[Math.PI / 2.8, 0.4, 0.2]}>
            <torusGeometry args={[size * 2.8, size * 0.18, 2, 100]} />
            <meshBasicMaterial color={accentColor} transparent opacity={0.22} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
          </mesh>
        </>)}

        {(viewLevel === 'PLANET' && selectedPlanet === repo.name) && languages.map((lang, idx) => (
          <Moon
            key={lang.language}
            languageData={lang}
            index={idx}
            total={languages.length}
            planetSize={size}
            maxOrbitRadius={60}
          />
        ))}

        {(hovered || (viewLevel === 'PLANET' && selectedPlanet === repo.name)) && (
          <Html position={[size + 5, size + 5, 0]} center zIndexRange={[100, 0]} style={{ pointerEvents: 'auto' }}>
            {viewLevel === 'PLANET' && selectedPlanet === repo.name ? (
              // Small compact card when zoomed in — doesn't block moons
              <div
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                onClick={(e) => { e.stopPropagation(); window.open(`https://github.com/${username}/${repo.name}`, '_blank'); }}
                style={{ background: 'rgba(5,5,20,0.88)', border: `1px solid ${mainColor}`, padding: '8px 12px', borderRadius: '10px', color: 'white', backdropFilter: 'blur(10px)', fontFamily: 'var(--font-mono)', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '11px', boxShadow: `0 0 10px ${mainColor}40` }}
              >
                <div style={{ color: mainColor, fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>{repo.name}</div>
                <div style={{ display: 'flex', gap: '10px', color: '#aaa', fontSize: '10px' }}>
                  <span>⭐ {repo.stargazers_count}</span>
                  <span>🍴 {repo.forks}</span>
                  {repo.language && <span style={{ color: mainColor }}>● {repo.language}</span>}
                </div>
                <div style={{ fontSize: '9px', color: '#00ffff', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Click to open GitHub</div>
              </div>
            ) : (
              // Full description card on hover from far away
              <div
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                onClick={(e) => { e.stopPropagation(); zoomToPlanet(repo.name, absolutePos, repoRadius); }}
                style={{ background: 'rgba(5,5,20,0.9)', border: `1px solid ${mainColor}`, padding: '20px', borderRadius: '12px', color: 'white', width: '300px', backdropFilter: 'blur(15px)', fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: 'all 0.3s' }}
              >
                <h3 style={{ color: mainColor, margin: '0 0 10px 0', fontSize: '16px', textTransform: 'uppercase' }}>{repo.name}</h3>
                <p style={{ fontSize: '12px', margin: '0 0 12px 0', color: '#ccc', lineHeight: '1.4' }}>{repo.description || 'No description provided.'}</p>
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
                  <span>⭐ {repo.stargazers_count}</span><span>🍴 {repo.forks}</span><span>📦 {repo.size} KB</span>
                </div>
                <div style={{ marginTop: '10px', fontSize: '10px', color: '#00ffff', textAlign: 'center', borderTop: '1px solid rgba(0,255,255,0.15)', paddingTop: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Click to Zoom In
                </div>
              </div>
            )}
          </Html>
        )}
      </group>
    </group>
  );
};

const ProfilePlanet = ({ username, sunRadius }) => {
  const { viewLevel, systemPosition, zoomToPlanet } = useStore();
  const [hovered, setHovered] = useState(false);
  const portalRef  = useRef();
  const glowRef    = useRef();
  const orbitRef   = useRef();

  // Always at the outermost edge — well beyond all repo planets
  const distance = sunRadius + 80 + (20 * 140) + 200; // beyond 20 repo planets
  const size = 7;
  const angle = 0;
  const orbitPos = [distance, 0, 0];
  const absolutePos = [
    systemPosition[0] + orbitPos[0],
    systemPosition[1] + orbitPos[1],
    systemPosition[2] + orbitPos[2],
  ];

  useFrame((state, delta) => {
    if (portalRef.current)  portalRef.current.rotation.z  += delta * 0.6;
    if (glowRef.current)    glowRef.current.rotation.z   -= delta * 0.3;
    if (orbitRef.current && viewLevel !== 'PLANET') {
      orbitRef.current.rotation.y += 0.0003;
    }
  });

  const mainColor = '#ff00ff';

  return (
    <group ref={orbitRef}>
      {/* Warp portal orbit ring */}
      <OrbitRing distance={distance} color={mainColor} />

      {/* ── Asteroid belt between last planet and portal ── */}
      {Array.from({ length: 320 }).map((_, i) => {
        const beltR   = sunRadius + 80 + (16 * 140) + 80 + (i % 4) * 55;
        const beltA   = (i / 320) * Math.PI * 2 + i * 0.37;
        const beltY   = (Math.sin(i * 1.7) * 8);
        const aSize   = 0.4 + (i % 5) * 0.3;
        return (
          <mesh key={i} position={[Math.cos(beltA) * beltR, beltY, Math.sin(beltA) * beltR]} raycast={() => null}>
            <icosahedronGeometry args={[aSize, 0]} />
            <meshStandardMaterial color={i % 3 === 0 ? '#8a7a6a' : i % 3 === 1 ? '#6a5a4a' : '#4a4a5a'} roughness={1} flatShading />
          </mesh>
        );
      })}

      <group position={orbitPos}>
        {/* Outer glow halo */}
        <mesh scale={2.2} raycast={() => null}>
          <sphereGeometry args={[size, 32, 32]} />
          <meshBasicMaterial color={mainColor} transparent opacity={0.05} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
        </mesh>

        {/* Portal ring 1 */}
        <mesh ref={portalRef} raycast={() => null}>
          <torusGeometry args={[size, 0.8, 16, 80]} />
          <meshBasicMaterial color={mainColor} transparent opacity={0.9} blending={THREE.AdditiveBlending} />
        </mesh>

        {/* Portal ring 2 — counter-spin */}
        <mesh ref={glowRef} scale={1.35} raycast={() => null}>
          <torusGeometry args={[size, 0.3, 8, 80]} />
          <meshBasicMaterial color="#00ffff" transparent opacity={0.5} blending={THREE.AdditiveBlending} />
        </mesh>

        {/* Portal core disk */}
        <mesh raycast={() => null}>
          <circleGeometry args={[size * 0.85, 64]} />
          <meshBasicMaterial color="#0a0020" transparent opacity={0.95} side={THREE.DoubleSide} />
        </mesh>

        {/* Swirling inner pattern */}
        <mesh scale={0.65} raycast={() => null}>
          <torusGeometry args={[size, size * 0.5, 2, 64]} />
          <meshBasicMaterial color={mainColor} transparent opacity={0.15} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>

        {/* Click hitbox */}
        <mesh
          onClick={(e) => { e.stopPropagation(); window.open(`https://github.com/${username}`, '_blank'); }}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true);  document.body.style.cursor = 'pointer'; }}
          onPointerOut={(e)  => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
          visible={false}
        >
          <sphereGeometry args={[size * 1.5, 8, 8]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>

        {/* Always-visible Warp Portal banner */}
        <Html position={[size + 12, 0, 0]} center zIndexRange={[100, 0]} style={{ pointerEvents: 'auto' }}>
          <div
            onClick={(e) => { e.stopPropagation(); window.open(`https://github.com/${username}`, '_blank'); }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              background: hovered ? 'rgba(20,0,50,0.97)' : 'rgba(10,0,30,0.88)',
              border: `1px solid ${hovered ? '#ff44ff' : '#ff00ff'}`,
              padding: hovered ? '12px 18px' : '8px 14px',
              borderRadius: '10px',
              color: 'white',
              fontFamily: 'var(--font-mono)',
              whiteSpace: 'nowrap',
              boxShadow: hovered ? '0 0 30px #ff00ff90' : '0 0 14px #ff00ff50',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              userSelect: 'none',
            }}
          >
            <div style={{ color: '#ff00ff', fontWeight: 'bold', fontSize: hovered ? '14px' : '12px', letterSpacing: '2px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '16px' }}>⬡</span> Warp Portal
            </div>
            <div style={{ color: hovered ? '#ccc' : '#888', fontSize: '10px', marginTop: '3px' }}>
              → github.com/{username}
            </div>
            {hovered && (
              <div style={{ fontSize: '9px', color: '#00ffff', marginTop: '5px', textTransform: 'uppercase', letterSpacing: '1px', borderTop: '1px solid rgba(255,0,255,0.2)', paddingTop: '5px' }}>
                Click to open GitHub profile
              </div>
            )}
          </div>
        </Html>
      </group>
    </group>
  );
};

// Sun color based on follower count (star classification)
const getSunColor = (followers) => {
  if (followers >= 10000) return { core: '#a8d8ff', corona: '#6ab4ff', type: 'Blue Giant' };   // Blue-white supergiant
  if (followers >= 3000)  return { core: '#fff5e0', corona: '#ffd080', type: 'White Star' };    // White/yellow-white
  if (followers >= 1000)  return { core: '#fffde0', corona: '#ffee88', type: 'Yellow Star' };   // Sun-like yellow
  if (followers >= 200)   return { core: '#ffdd88', corona: '#ffaa44', type: 'Orange Star' };   // Orange subgiant
  return                         { core: '#ffaa66', corona: '#ff6633', type: 'Red Dwarf' };      // Red dwarf
};

const Sun = ({ user, size }) => {
  const sunRef   = useRef();
  const [hovered, setHovered] = useState(false);
  const { core, corona } = getSunColor(user.followers || 0);
  const { selectedUser } = useStore();
  const actualSunRadius = size * 0.3;

  const sunMatRef = useRef();
  const sunUniforms = useMemo(() => ({
    time:      { value: 0 },
    coreCol:   { value: new THREE.Color(core) },
    coronaCol: { value: new THREE.Color(corona) },
  }), [core, corona]);

  useFrame(({ clock }) => {
    if (sunMatRef.current) sunMatRef.current.uniforms.time.value = clock.getElapsedTime();
    const scale = 1 + Math.sin(clock.getElapsedTime() * 1.5) * 0.02;
    // pulse via scale on the group instead
    if (sunRef.current) sunRef.current.scale.setScalar(scale);
  });

  return (
    <group>
      <pointLight intensity={1500} distance={15000} color={core} />

      {/* Animated shader sun surface */}
      <mesh
        ref={sunRef}
        onClick={(e) => { e.stopPropagation(); window.open(`https://github.com/${selectedUser}`, '_blank'); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true);  document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e)  => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
      >
        <sphereGeometry args={[actualSunRadius, 64, 64]} />
        <shaderMaterial ref={sunMatRef} vertexShader={PLANET_VERT} fragmentShader={SUN_FRAG} uniforms={sunUniforms} />
      </mesh>

      {/* Solar flare spikes */}
      <SolarFlares radius={actualSunRadius} coreColor={core} coronaColor={corona} />

      {/* Inner corona */}
      <mesh scale={1.3} raycast={() => null}>
        <sphereGeometry args={[actualSunRadius, 64, 64]} />
        <meshBasicMaterial color={corona} transparent opacity={0.5} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* Outer corona */}
      <mesh scale={1.8} raycast={() => null}>
        <sphereGeometry args={[actualSunRadius, 32, 32]} />
        <meshBasicMaterial color={corona} transparent opacity={0.15} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* Solar flare halo */}
      <mesh scale={2.4} raycast={() => null}>
        <sphereGeometry args={[actualSunRadius, 32, 32]} />
        <meshBasicMaterial color={core} transparent opacity={0.05} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Name label — always visible */}
      <Html position={[0, size + 20, 0]} center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ color: corona, fontFamily: 'Orbitron', fontSize: '36px', fontWeight: 'bold', textShadow: `0 0 20px ${corona}`, letterSpacing: '4px', textTransform: 'uppercase', pointerEvents: 'none' }}>
          {user.name}
        </div>
      </Html>

      {/* Hover tooltip — click to visit GitHub */}
      {hovered && (
        <Html position={[actualSunRadius + 8, actualSunRadius + 4, 0]} center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(5,5,20,0.92)', border: `1px solid ${corona}`, padding: '7px 12px', borderRadius: '8px', color: 'white', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', fontSize: '11px', boxShadow: `0 0 15px ${corona}60` }}>
            <div style={{ color: corona, fontWeight: 'bold', marginBottom: '3px' }}>☀ {user.name}</div>
            <div style={{ color: '#aaa', fontSize: '10px' }}>Click to open GitHub profile</div>
          </div>
        </Html>
      )}
    </group>
  );
};

const SpaceScene = () => {
  return (
    <>
      <CameraController />
      <BackgroundStars />
      <UniverseBase />
      <FocusedSolarSystem />
      <CosmicDust />
      <ShootingStars />
    </>
  );
};

export default SpaceScene;
