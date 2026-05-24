import React from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import SpaceScene from './components/SpaceScene';
import HUD from './components/HUD';
import { useStore } from './store';

function App() {
  const { zoomToSystem } = useStore();

  const handleSearch = (username) => {
    // Zoom directly to the searched user's solar system
    zoomToSystem(username, [0, 0, 0]);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#020205' }}>
      {/* ADDED EXTREME FAR PLANE (far: 150000) TO PREVENT BLACK SCREEN CLIPPING */}
      <Canvas camera={{ position: [0, 4000, 8000], fov: 60, far: 150000 }}>
        <color attach="background" args={['#010103']} />
        <ambientLight intensity={0.1} />
        {/* Generic Background Stars - MASSIVE radius to wrap the entire universe */}
        <Stars radius={100000} depth={50000} count={30000} factor={10} saturation={0} fade speed={0.5} />
        
        {/* Main Unified Engine */}
        <SpaceScene />

        {/* Cinematic Post-Processing */}
        <EffectComposer disableNormalPass>
          <Bloom luminanceThreshold={0.2} mipmapBlur intensity={1.5} />
          <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={[0.001, 0.001]} />
        </EffectComposer>
      </Canvas>
      
      {/* Holographic UI Overlay */}
      <HUD onSearch={handleSearch} />
    </div>
  );
}

export default App;
