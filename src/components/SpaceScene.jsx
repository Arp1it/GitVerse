import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { easing } from 'maath';
import { useStore } from '../store';
import { fetchUserData, fetchUserRepos, fetchRepoLanguages, getLanguageColor } from '../lib/github';

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
  const { viewLevel, zoomToGalaxy, zoomToSystem, selectedUser, selectedGalaxy, galaxies } = useStore();

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
      });
      instancedMeshRef.current.instanceMatrix.needsUpdate = true;
      instancedMeshRef.current.instanceColor.needsUpdate = true;
    }
  }, [visibleStars]);

  const handleInstancedClick = (e) => {
    e.stopPropagation();
    if (e.instanceId !== undefined && e.instanceId < visibleStars.length) {
      const star = visibleStars[e.instanceId];
      if (selectedUser !== star.username) {
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
      <mesh>
        <sphereGeometry args={[60, 64, 64]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Inner accretion ring — vertical & static */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[88, 20, 32, 128]} />
        <meshBasicMaterial color={color} transparent opacity={0.95} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Outer ring — vertical & static */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[135, 7, 16, 128]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Lensing glow */}
      <mesh>
        <sphereGeometry args={[78, 32, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.07} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
};

// Galaxy developer stars with slow orbital rotation
const GalaxyStars = ({ visibleStars, instancedMeshRef, onClick, center }) => {
  const groupRef = useRef();

  useFrame((state) => {
    // Rotate the star field around its own center (the black hole position)
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.015;
    }
  });

  return (
    // Position group AT the galaxy center so rotation pivot is the black hole
    <group ref={groupRef} position={center}>
      <instancedMesh
        dispose={null}
        frustumCulled={false}
        ref={instancedMeshRef}
        args={[null, null, 4000]}
        count={visibleStars.length}
        onClick={onClick}
        onPointerOver={() => document.body.style.cursor = 'pointer'}
        onPointerOut={() => document.body.style.cursor = 'auto'}
      >
        <sphereGeometry args={[4, 16, 16]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
};

// HIGH-PERFORMANCE NEBULA
const GalaxyParticles = ({ colorInside, colorOutside, count, radius }) => {
  const pointsRef = useRef();
  const cIn = new THREE.Color(colorInside);
  const cOut = new THREE.Color(colorOutside);

  const particlesPosition = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const r = Math.random() * radius + 50;
      const spinAngle = r * 0.01;
      const branchAngle = (i % 4) * ((Math.PI * 2) / 4);
      
      const randomX = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * (radius * 0.15);
      const randomY = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * (radius * 0.1);
      const randomZ = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * (radius * 0.15);

      positions[i3] = Math.cos(branchAngle + spinAngle) * r + randomX;
      positions[i3 + 1] = randomY; 
      positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * r + randomZ;

      const mixedColor = cIn.clone();
      mixedColor.lerp(cOut, r / (radius + 200));
      colors[i3] = mixedColor.r; colors[i3 + 1] = mixedColor.g; colors[i3 + 2] = mixedColor.b;
    }
    return { positions, colors };
  }, [cIn, cOut, count, radius]);

  useFrame((state) => {
    if(pointsRef.current) pointsRef.current.rotation.y = state.clock.getElapsedTime() * 0.0005;
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
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

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.05);
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

  const SUN_RADIUS = Math.max(10, Math.log10(userData.followers || 10) * 8);

  return (
    <group position={systemPosition} ref={groupRef} scale={[0.001, 0.001, 0.001]}> 
      <Sun user={userData} size={SUN_RADIUS} />
      {repos.map((repo, i) => (
        <Planet key={repo.name} repo={repo} username={selectedUser} index={i} sunRadius={SUN_RADIUS} />
      ))}
      <ProfilePlanet username={selectedUser} index={repos.length} sunRadius={SUN_RADIUS} systemPosition={systemPosition} />
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
    <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[distance, 0.5, 16, 120]} />
      <meshBasicMaterial color={color} transparent opacity={0} blending={THREE.AdditiveBlending} />
    </mesh>
  );
};

const Moon = ({ languageData, index, total, planetSize }) => {
  const moonRef = useRef();
  const [hovered, setHovered] = useState(false);
  const size = Math.max(0.8, languageData.percentage * 4.0);

  // Each moon gets its own orbit radius — guaranteed no overlap
  // Base = planet surface + moon radius, then each subsequent moon adds its own diameter + a fixed gap
  const ORBIT_GAP = 3.0;
  const distance = planetSize + size + ORBIT_GAP + (index * (size * 2 + ORBIT_GAP + 2.5));

  // Stagger each moon on a slightly different Y plane — prevents collision when orbits cross
  const yOffset = (index % 2 === 0 ? 1 : -1) * (index * 1.2);

  const color = getLanguageColor(languageData.language);
  const speed = 0.06 + (index * 0.015); // slow, distinct speed per orbit
  const angleOffset = (index / total) * Math.PI * 2;

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const currentAngle = angleOffset + t * speed;
    moonRef.current.position.x = Math.cos(currentAngle) * distance;
    moonRef.current.position.z = Math.sin(currentAngle) * distance;
    moonRef.current.position.y = yOffset;
    easing.damp3(moonRef.current.scale, [1, 1, 1], 2.0, delta);
  });

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
              <div style={{ fontSize: '11px', color: '#aaa' }}>{Math.round(languageData.percentage * 100)}% Usage</div>
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

  const distance = sunRadius + 60 + (index * 80);
  const size = Math.max(2, Math.log10(repo.size || 10));
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

  const mainColor = repo.language ? getLanguageColor(repo.language) : '#ffffff';
  
  return (
    <group ref={orbitRef}>
      <OrbitRing distance={distance} color={mainColor} />
      <group position={orbitPos}>
        {/* Planet hitbox/mesh */}
        <mesh 
          onClick={(e) => { 
            e.stopPropagation(); 
            if (viewLevel === 'PLANET' && selectedPlanet === repo.name) {
              window.open(`https://github.com/${username}/${repo.name}`, '_blank');
            } else {
              zoomToPlanet(repo.name, absolutePos, repoRadius); 
            }
          }}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
          onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
        >
          <sphereGeometry args={[size, 32, 32]} />
          <meshStandardMaterial color={mainColor} emissive={mainColor} emissiveIntensity={0.8} roughness={0.3} metalness={0.7} />
        </mesh>
        
        <mesh visible={false}>
          <sphereGeometry args={[size * 2.0, 16, 16]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
        
        <mesh scale={1.2}>
          <sphereGeometry args={[size, 32, 32]} />
          <meshBasicMaterial color={mainColor} transparent opacity={0.15} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
        </mesh>

        {(viewLevel === 'PLANET' && selectedPlanet === repo.name) && languages.map((lang, idx) => (
          <Moon key={lang.language} languageData={lang} index={idx} total={languages.length} planetSize={size} />
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

const ProfilePlanet = ({ username, index, sunRadius, systemPosition }) => {
  const { viewLevel, zoomToPlanet, selectedPlanet } = useStore();
  const [hovered, setHovered] = useState(false);
  const orbitRef = useRef();

  // Make it orbit quite far out
  const distance = sunRadius + 60 + (index * 80) + 60; 
  const size = 5; // A noticeable size
  
  const angle = (index * 137.5) * (Math.PI / 180);
  const orbitPos = [
    Math.cos(angle) * distance,
    Math.sin(angle) * (distance * 0.2), 
    Math.sin(angle) * distance
  ];

  const absolutePos = [
    systemPosition[0] + orbitPos[0],
    systemPosition[1] + orbitPos[1],
    systemPosition[2] + orbitPos[2],
  ];

  useFrame((state) => {
    if (orbitRef.current && viewLevel !== 'PLANET') {
      orbitRef.current.rotation.y += 0.001 * (100 / distance); // Slower orbit for the outer edge
    }
  });

  const mainColor = '#ff00ff'; // Bright Neon Magenta for the portal
  
  return (
    <group ref={orbitRef}>
      <OrbitRing distance={distance} color={mainColor} />
      <group position={orbitPos}>
        <mesh 
          onClick={(e) => { e.stopPropagation(); window.open(`https://github.com/${username}`, '_blank'); }}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
          onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
        >
          <sphereGeometry args={[size, 32, 32]} />
          <meshStandardMaterial color={mainColor} emissive={mainColor} emissiveIntensity={0.8} roughness={0.2} metalness={0.8} />
        </mesh>
        
        {/* Glow ring around the profile planet */}
        <mesh scale={1.4}>
          <torusGeometry args={[size, 0.5, 16, 64]} />
          <meshBasicMaterial color="#00ffff" transparent opacity={0.8} blending={THREE.AdditiveBlending} />
        </mesh>

        <mesh scale={1.8}>
          <sphereGeometry args={[size, 32, 32]} />
          <meshBasicMaterial color={mainColor} transparent opacity={0.2} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
        </mesh>

        <Html position={[size + 8, size + 8, 0]} center zIndexRange={[100, 0]} style={{ pointerEvents: 'auto' }}>
          <div 
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={(e) => { e.stopPropagation(); zoomToPlanet('PORTAL', absolutePos, size); }}
            style={{ background: 'rgba(255, 0, 255, 0.1)', border: `1px solid ${mainColor}`, padding: '10px 15px', borderRadius: '8px', color: 'white', width: 'auto', backdropFilter: 'blur(15px)', fontFamily: 'var(--font-mono)', textAlign: 'center', boxShadow: `0 0 15px ${mainColor}`, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.3s' }}
          >
            <h3 style={{ margin: '0 0 3px 0', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', color: '#00ffff' }}>Warp Portal</h3>
            <p style={{ fontSize: '10px', margin: '0', color: '#ccc' }}>{(viewLevel === 'PLANET' && selectedPlanet === 'PORTAL') ? 'Focusing...' : 'Click to zoom in'}</p>
          </div>
        </Html>
      </group>
    </group>
  );
};

const Sun = ({ user, size }) => {
  const sunRef = useRef();
  const color = '#ffffff';

  useFrame((state) => {
    sunRef.current.rotation.y += 0.002;
    const scale = 1 + Math.sin(state.clock.getElapsedTime() * 1.5) * 0.02;
    sunRef.current.scale.setScalar(scale);
  });

  const actualSunRadius = size * 0.3;

  return (
    <group>
      <pointLight intensity={1500} distance={15000} color={color} />
      <mesh ref={sunRef}>
        <sphereGeometry args={[actualSunRadius, 64, 64]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh scale={1.4}>
        <sphereGeometry args={[actualSunRadius, 64, 64]} />
        <meshBasicMaterial color="#00f3ff" transparent opacity={0.6} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
      </mesh>
      <Html position={[0, size + 20, 0]} center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ color: '#00f3ff', fontFamily: 'Orbitron', fontSize: '36px', fontWeight: 'bold', textShadow: '0 0 20px #00f3ff', letterSpacing: '4px', textTransform: 'uppercase', pointerEvents: 'none' }}>
          {user.name}
        </div>
      </Html>
    </group>
  );
};

const SpaceScene = () => {
  return (
    <>
      <CameraController />
      <UniverseBase />
      <FocusedSolarSystem />
    </>
  );
};

export default SpaceScene;
