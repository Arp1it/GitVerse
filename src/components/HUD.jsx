import React, { useState, useEffect } from 'react';
import { Search, Map, Crosshair, Activity, Star, ChevronLeft, Globe, Users, Database } from 'lucide-react';
import { useStore } from '../store';
import { fetchUserData } from '../lib/github';

const HUD = ({ onSearch }) => {
  const [searchInput, setSearchInput] = useState('');
  const [userData, setUserData] = useState(null);
  
  const { viewLevel, selectedGalaxy, selectedUser, selectedPlanet, zoomToUniverse, zoomToGalaxy, zoomToSystem, ensureGalaxyExists } = useStore();

  useEffect(() => {
    if (selectedUser) {
      fetchUserData(selectedUser).then(data => setUserData(data));
    } else {
      setUserData(null);
    }
  }, [selectedUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const username = searchInput.trim();
      setSearchInput('');
      
      const uData = await fetchUserData(username);
      const loc = uData.location || 'Global Network';
      const targetGalaxy = ensureGalaxyExists(loc);
      
      // Explicitly set the galaxy before zooming so the UI breadcrumbs and background stars render correctly
      useStore.setState({ selectedGalaxy: targetGalaxy.name });
      zoomToSystem(username, [targetGalaxy.pos[0] + 50, targetGalaxy.pos[1], targetGalaxy.pos[2]], 20);
    }
  };

  const handleBack = () => {
    if (viewLevel === 'PLANET') zoomToSystem(selectedUser, [0, 0, 0]); 
    else if (viewLevel === 'SYSTEM') {
      const target = selectedGalaxy ? useStore.getState().galaxies.find(g => g.name === selectedGalaxy) : null;
      zoomToGalaxy(selectedGalaxy || 'India', target ? target.pos : [0, 0, 0]);
    }
    else if (viewLevel === 'GALAXY') zoomToUniverse();
  };

  return (
    <div className="hud-container">
      {/* HEADER */}
      <div className="hud-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {viewLevel !== 'UNIVERSE' && (
            <button 
              onClick={handleBack}
              style={{
                background: 'transparent', border: '1px solid var(--neon-blue)', 
                color: 'var(--neon-blue)', padding: '0.5rem', borderRadius: '5px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', pointerEvents: 'auto'
              }}
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <div className="hud-title">GITVERSE_</div>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px' }}>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                className="search-bar" 
                placeholder="SEARCH GITHUB USER..." 
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <button 
                type="submit" 
                style={{ 
                  position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', 
                  background: 'transparent', border: 'none', color: 'var(--neon-blue)', cursor: 'pointer' 
                }}
              >
                <Search size={18} />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* CROSSHAIR FOR UNIVERSE VIEW */}
      {viewLevel === 'UNIVERSE' && <div className="crosshair"></div>}

      {/* DYNAMIC RIGHT SIDEBAR */}
      {viewLevel !== 'UNIVERSE' && (
        <div className="hud-sidebar">
          {userData && userData.isRateLimited && (
            <div style={{ background: 'rgba(255,0,0,0.2)', border: '1px solid red', color: '#ff4444', padding: '10px', borderRadius: '5px', marginBottom: '15px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
              ⚠️ GITHUB API RATE LIMIT EXCEEDED (60 req/hr). SHOWING PROCEDURAL MOCK REPOSITORIES.
            </div>
          )}
          {viewLevel === 'GALAXY' && selectedGalaxy && (
            <>
              <div className="sidebar-header">
                <div className="sidebar-title">{selectedGalaxy} GALAXY</div>
                <div className="sidebar-subtitle">Macro-Level Git Region</div>
              </div>
              <div className="sidebar-data-group">
                <div className="sidebar-data-row">
                  <span className="sidebar-data-label"><Globe size={14} style={{ display: 'inline', marginRight: '5px' }} /> Region</span>
                  <span className="sidebar-data-value">Earth / {selectedGalaxy}</span>
                </div>
                <div className="sidebar-data-row">
                  <span className="sidebar-data-label"><Users size={14} style={{ display: 'inline', marginRight: '5px' }} /> Detected Systems</span>
                  <span className="sidebar-data-value">~200 (Scanned)</span>
                </div>
                <div className="sidebar-data-row">
                  <span className="sidebar-data-label"><Activity size={14} style={{ display: 'inline', marginRight: '5px' }} /> Nebula Status</span>
                  <span className="sidebar-data-value" style={{ color: 'var(--neon-green)' }}>Stable</span>
                </div>
              </div>
            </>
          )}

          {(viewLevel === 'SYSTEM' || viewLevel === 'PLANET') && userData && (
            <>
              <div className="sidebar-header">
                <div className="sidebar-title">{userData.name} SYSTEM</div>
                <div className="sidebar-subtitle">Developer Solar System</div>
              </div>
              <div className="sidebar-data-group">
                <div className="sidebar-data-row">
                  <span className="sidebar-data-label"><Globe size={14} style={{ display: 'inline', marginRight: '5px' }} /> Location</span>
                  <span className="sidebar-data-value">{userData.location || selectedGalaxy || 'Unknown'}</span>
                </div>
                <div className="sidebar-data-row">
                  <span className="sidebar-data-label"><Users size={14} style={{ display: 'inline', marginRight: '5px' }} /> Followers (Star Mass)</span>
                  <span className="sidebar-data-value">{userData.followers}</span>
                </div>
                <div className="sidebar-data-row">
                  <span className="sidebar-data-label"><Database size={14} style={{ display: 'inline', marginRight: '5px' }} /> Repositories (Planets)</span>
                  <span className="sidebar-data-value">{userData.publicRepos}</span>
                </div>
              </div>
            </>
          )}

          {viewLevel === 'PLANET' && selectedPlanet && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="sidebar-title" style={{ fontSize: '1rem', color: 'var(--neon-purple)' }}>TARGET LOCKED</div>
              <div className="sidebar-subtitle">Orbiting: {selectedPlanet}</div>
            </div>
          )}
        </div>
      )}

      {/* BOTTOM STATS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div className="hud-stats">
          <div className="stat-item">
            <span className="stat-label">Sector</span>
            <span className="stat-value">{viewLevel}</span>
          </div>
          {selectedGalaxy && (
            <div className="stat-item">
              <span className="stat-label">Galaxy</span>
              <span className="stat-value">{selectedGalaxy.toUpperCase()}</span>
            </div>
          )}
          {selectedUser && (
            <div className="stat-item">
              <span className="stat-label">System</span>
              <span className="stat-value">{selectedUser.toUpperCase()}</span>
            </div>
          )}
        </div>

        <div className="hud-stats" style={{ flexDirection: 'column', gap: '1rem', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: '1rem', color: 'var(--neon-blue)' }}>
            <Map size={24} style={{ cursor: 'pointer' }} />
            <Activity size={24} style={{ cursor: 'pointer' }} />
            <Crosshair size={24} style={{ cursor: 'pointer' }} />
            <Star size={24} style={{ cursor: 'pointer' }} />
          </div>
          <div style={{ fontSize: '0.8rem', color: '#8888aa', textAlign: 'right' }}>
            ORBITAL CONTROLS: [L-CLICK] ROTATE [R-CLICK] PAN [SCROLL] ZOOM<br/>
            [CLICK] PLANET OR GALAXY TO WARP
          </div>
        </div>
      </div>
    </div>
  );
};

export default HUD;
