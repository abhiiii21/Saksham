import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import RadarFeed from './components/RadarFeed';
import GlobeViewer from './components/GlobeViewer';
import InspectorPanel from './components/InspectorPanel';
import DashboardView from './components/DashboardView';
import CollisionSimulator from './components/CollisionSimulator';
import BriefingModal from './components/BriefingModal';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './components/LoginPage';
import { Radio, Layers, ChevronRight, ChevronLeft, Maximize2, Minimize2, BarChart3, Globe2, Zap } from 'lucide-react';
import {
  fetchHealth,
  fetchSatellites,
  fetchConjunctions,
  fetchConjunctionDetails,
  optimizeBurn,
  generateBriefing,
  setOperationalMode
} from './utils/api';

export default function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('saksham_authenticated') === 'true';
  });
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = sessionStorage.getItem('saksham_user');
    return saved ? JSON.parse(saved) : { email: 'flight.dynamics@esa-space.int', role: 'Flight Dynamics Engineer' };
  });

  // Default to the spacious new DASHBOARD
  const [activeView, setActiveView] = useState('DASHBOARD'); // 'DASHBOARD' | '3D_OPS'
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [systemHealth, setSystemHealth] = useState(null);
  const [satellites, setSatellites] = useState([]);
  const [conjunctions, setConjunctions] = useState([]);
  const [selectedConjunctionId, setSelectedConjunctionId] = useState(null);
  const [conjunctionDetails, setConjunctionDetails] = useState(null);
  const [burnData, setBurnData] = useState(null);
  const [currentMode, setCurrentMode] = useState('BENCHMARK_SCENARIOS');
  const [activeBurnExecuting, setActiveBurnExecuting] = useState(false);
  const [resolvedIds, setResolvedIds] = useState(new Set());
  const [briefingModalOpen, setBriefingModalOpen] = useState(false);
  const [briefingData, setBriefingData] = useState(null);
  const [customEncounterPair, setCustomEncounterPair] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Initial Data Fetch with Safe Fallbacks
  const loadData = useCallback(async () => {
    try {
      const [health, sats, conjs] = await Promise.all([
        fetchHealth().catch((err) => {
          console.warn('Health fetch error:', err);
          return null;
        }),
        fetchSatellites().catch((err) => {
          console.warn('Satellites fetch error:', err);
          return { count: 0, satellites: [] };
        }),
        fetchConjunctions().catch((err) => {
          console.warn('Conjunctions fetch error:', err);
          return { count: 0, conjunctions: [] };
        })
      ]);

      if (health) setSystemHealth(health);

      const satsList = sats?.satellites && Array.isArray(sats.satellites) ? sats.satellites : [];
      setSatellites(satsList);

      const conjsList = conjs?.conjunctions && Array.isArray(conjs.conjunctions) ? conjs.conjunctions : [];
      setConjunctions(conjsList);

      // Auto-select first critical or available conjunction if none selected
      if (conjsList.length > 0 && !selectedConjunctionId) {
        setSelectedConjunctionId(conjsList[0].id);
      }
    } catch (err) {
      console.error('Error loading STM telemetry in App:', err);
      setSatellites([]);
      setConjunctions([]);
    } finally {
      setLoading(false);
    }
  }, [selectedConjunctionId]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
      const interval = setInterval(loadData, 30000); // Polling every 30s
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, loadData]);

  // 2. Fetch Details & Initial Burn Optimization when Conjunction Selected
  useEffect(() => {
    if (!isAuthenticated || !selectedConjunctionId) return;

    let isMounted = true;
    const fetchSelected = async () => {
      try {
        const [details, initialBurn] = await Promise.all([
          fetchConjunctionDetails(selectedConjunctionId).catch((e) => {
            console.warn('Conjunction details fetch error:', e);
            return null;
          }),
          optimizeBurn(selectedConjunctionId, 8.0, 8.0, 'AUTO').catch((e) => {
            console.warn('Initial burn optimization fetch error:', e);
            return null;
          })
        ]);

        if (isMounted) {
          if (details) setConjunctionDetails(details);
          if (initialBurn) setBurnData(initialBurn);
        }
      } catch (err) {
        console.error('Error fetching conjunction details/burn plan:', err);
      }
    };

    fetchSelected();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, selectedConjunctionId]);

  // 3. Handle Burn Optimization Updates from Pareto Slider
  const handleOptimizeBurn = async (conjunctionId, clearanceKm, leadOrbits, direction) => {
    try {
      const result = await optimizeBurn(conjunctionId, clearanceKm, leadOrbits, direction);
      if (result) {
        setBurnData(result);
      }
    } catch (err) {
      console.error('Error optimizing burn in App:', err);
    }
  };

  // 4. Handle Mode Switch (Benchmarks vs Live CelesTrak)
  const handleModeChange = async (newMode) => {
    setLoading(true);
    setCurrentMode(newMode);
    try {
      await setOperationalMode(newMode);
      await loadData();
    } catch (err) {
      console.error('Error switching operational mode:', err);
    } finally {
      setLoading(false);
    }
  };

  // 5. Handle Burn Execution
  const handleExecuteBurn = (conjunctionId) => {
    setActiveBurnExecuting(true);
    setTimeout(() => {
      setActiveBurnExecuting(false);
      setResolvedIds((prev) => new Set([...prev, conjunctionId]));
    }, 3500);
  };

  // 6. Handle ESA CAR Briefing Generation & Modal
  const handleOpenBriefing = async (targetId) => {
    const conjId = targetId || selectedConjunctionId;
    if (!conjId) return;
    try {
      const report = await generateBriefing(conjId, 8.0, 8.0);
      if (report) {
        setBriefingData(report);
        setBriefingModalOpen(true);
      }
    } catch (err) {
      console.error('Error generating briefing report:', err);
    }
  };

  // 7. Handle Inspect in 3D from Dashboard View Table
  const handleInspectIn3D = (conjunctionId) => {
    if (conjunctionId) {
      setSelectedConjunctionId(conjunctionId);
    }
    setActiveView('3D_OPS');
    setLeftSidebarOpen(true);
    setRightSidebarOpen(true);
  };

  // 8. Handle Open in 2D Collision Impact Sandbox (from Radar Feed, Dashboard, or Inspector)
  const handleOpenSimulator = (conjOrId) => {
    if (conjOrId && typeof conjOrId === 'object') {
      setSelectedConjunctionId(conjOrId.id);
      
      const pName = conjOrId.primary_name || '';
      const sName = conjOrId.secondary_name || '';
      
      const massA = pName.includes('SENTINEL') ? 2160
        : pName.includes('ONEWEB') ? 147
        : pName.includes('STARLINK') ? 305
        : pName.includes('IRIDIUM') ? 560
        : 750;
      const radiusA = pName.includes('SENTINEL') ? 3.5
        : pName.includes('ONEWEB') ? 1.2
        : pName.includes('STARLINK') ? 2.8
        : pName.includes('IRIDIUM') ? 2.1
        : 2.5;

      const massB = sName.includes('COSMOS-1408') ? 38
        : sName.includes('FENGYUN') ? 12
        : sName.includes('SL-08') ? 1400
        : sName.includes('KOSMOS') ? 950
        : 25;
      const radiusB = sName.includes('COSMOS-1408') ? 0.6
        : sName.includes('FENGYUN') ? 0.4
        : sName.includes('SL-08') ? 2.2
        : sName.includes('KOSMOS') ? 1.8
        : 0.8;

      setCustomEncounterPair({
        primary: {
          name: conjOrId.primary_name,
          type: 'PAYLOAD',
          id: conjOrId.primary_id,
          mass: massA,
          radius: radiusA,
          velocity: 7.6
        },
        secondary: {
          name: conjOrId.secondary_name,
          type: sName.includes('R/B') ? 'ROCKET_BODY' : 'DEBRIS',
          id: conjOrId.secondary_id,
          mass: massB,
          radius: radiusB,
          velocity: 7.5
        },
        separationKm: (Number(conjOrId.miss_distance_m) || 140) / 1000,
        miss_distance_m: Number(conjOrId.miss_distance_m) || 140,
        relativeSpeedKmS: Number(conjOrId.rel_speed_km_s) || 14.2,
        tca_seconds_from_epoch: conjOrId.tca_seconds_from_epoch,
        ml_risk_score: conjOrId.ml_risk_score,
        risk_level: conjOrId.risk_level,
        conjunction_id: conjOrId.id
      });
    } else if (conjOrId) {
      setSelectedConjunctionId(conjOrId);
      const targetConj = safeConjunctions.find((c) => c.id === conjOrId);
      if (targetConj) {
        handleOpenSimulator(targetConj);
        return;
      }
      setCustomEncounterPair(null);
    }
    setActiveView('SANDBOX');
  };

  // 8b. Seamless Launch from 3D Dual-Raycasting Multi-Selection
  const handleLaunchInSandbox = (pairData) => {
    setCustomEncounterPair(pairData);
    setActiveView('SANDBOX');
  };

  // Toggle Zen Full-Viewport mode in 3D (frees up entire UI)
  const handleToggleZenMode = () => {
    if (leftSidebarOpen || rightSidebarOpen) {
      setLeftSidebarOpen(false);
      setRightSidebarOpen(false);
    } else {
      setLeftSidebarOpen(true);
      setRightSidebarOpen(true);
    }
  };

  // 9. Handle Login & Logout
  const handleLogin = (user) => {
    const userObj = user || { email: 'operator@esa-space.int', role: 'Flight Dynamics Engineer' };
    setCurrentUser(userObj);
    setIsAuthenticated(true);
    sessionStorage.setItem('saksham_authenticated', 'true');
    sessionStorage.setItem('saksham_user', JSON.stringify(userObj));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('saksham_authenticated');
    sessionStorage.removeItem('saksham_user');
  };

  // If user is not authenticated, present the cinematic login portal
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const safeConjunctions = Array.isArray(conjunctions) ? conjunctions : [];
  const selectedConjunction = safeConjunctions.find((c) => c.id === selectedConjunctionId) || null;
  const criticalCount = safeConjunctions.filter((c) => c.risk_level === 'CRITICAL' && !resolvedIds.has(c.id)).length;
  const isZenMode = !leftSidebarOpen && !rightSidebarOpen;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 text-slate-900 select-none font-sans">
      
      {/* Top Navigation Header with View Switcher & Operator Profile */}
      <Header
        systemHealth={systemHealth}
        currentMode={currentMode}
        onModeChange={handleModeChange}
        conjunctionsCount={safeConjunctions.length}
        criticalCount={criticalCount}
        activeBurnExecuting={activeBurnExecuting}
        activeView={activeView}
        onViewChange={setActiveView}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 flex overflow-hidden relative bg-slate-100">
        
        {activeView === 'DASHBOARD' ? (
          /* TAB 1: Dedicated Spacious Mission Analytics Dashboard */
          <DashboardView
            conjunctions={safeConjunctions}
            satellites={satellites}
            systemHealth={systemHealth}
            resolvedIds={resolvedIds}
            onInspectIn3D={handleInspectIn3D}
            onOpenBriefing={handleOpenBriefing}
            onOpenSimulator={handleOpenSimulator}
          />
        ) : (activeView === 'SIMULATOR' || activeView === 'SANDBOX') ? (
          /* TAB 2: Interactive 2D Satellite Collision & Physics Sandbox */
          <ErrorBoundary title="2D Collision Simulator Unavailable">
            <CollisionSimulator
              selectedConjunction={selectedConjunction}
              customEncounterPair={customEncounterPair}
              onClose={() => setActiveView('3D_OPS')}
            />
          </ErrorBoundary>
        ) : (
          /* TAB 3: 3D Orbital Operations (Clean, Breathable & Expansive) */
          <>
            {/* Left Collapsible Radar Feed */}
            {leftSidebarOpen ? (
              <RadarFeed
                conjunctions={safeConjunctions}
                selectedConjunctionId={selectedConjunctionId}
                onSelectConjunction={setSelectedConjunctionId}
                resolvedIds={resolvedIds}
                onToggleCollapse={() => setLeftSidebarOpen(false)}
                onOpenSimulator={handleOpenSimulator}
              />
            ) : (
              /* Floating Re-open Toggle for Radar Feed */
              <button
                onClick={() => setLeftSidebarOpen(true)}
                className="absolute top-4 left-4 z-20 px-3.5 py-2 rounded-xl bg-white/95 hover:bg-white backdrop-blur-md border border-slate-200 text-slate-700 hover:text-teal-700 text-xs font-bold flex items-center space-x-2 transition-all shadow-md cursor-pointer hover:border-teal-400"
                title="Expand Radar Feed"
              >
                <Radio className="w-3.5 h-3.5 text-teal-600" />
                <span>Radar ({safeConjunctions.length})</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}

            {/* Central 3D WebGL Globe View (CONTAINED BLACK VIEWPORT) */}
            <div className="flex-1 h-full relative overflow-hidden bg-black">
              
              {/* Floating Quick Action / Zen Fullscreen Bar inside 3D View */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 pointer-events-auto">
                <button
                  onClick={handleToggleZenMode}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-lg backdrop-blur-md border cursor-pointer ${
                    isZenMode
                      ? 'bg-teal-600 text-white border-teal-500 shadow-teal-500/20'
                      : 'bg-slate-900/80 hover:bg-slate-900 text-slate-200 border-slate-700 hover:border-slate-500'
                  }`}
                  title={isZenMode ? 'Show Side Panels' : 'Hide Side Panels (Free 3D View)'}
                >
                  {isZenMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5 text-teal-400" />}
                  <span>{isZenMode ? 'Exit Free View' : 'Free 3D View'}</span>
                </button>
              </div>

              <ErrorBoundary title="3D Globe Viewport Unavailable">
                <GlobeViewer
                  satellites={satellites}
                  selectedConjunction={selectedConjunction}
                  conjunctionDetails={conjunctionDetails}
                  burnData={burnData}
                  isBurnExecuting={activeBurnExecuting}
                  onLaunchInSandbox={handleLaunchInSandbox}
                />
              </ErrorBoundary>
            </div>

            {/* Right Collapsible Inspector Panel */}
            {rightSidebarOpen ? (
              <InspectorPanel
                selectedConjunction={selectedConjunction}
                conjunctionDetails={conjunctionDetails}
                burnData={burnData}
                onOptimizeBurn={handleOptimizeBurn}
                onExecuteBurn={handleExecuteBurn}
                onOpenBriefing={() => handleOpenBriefing(selectedConjunctionId)}
                onOpenSimulator={() => handleOpenSimulator(selectedConjunctionId)}
                isBurnExecuting={activeBurnExecuting}
                isResolved={selectedConjunctionId ? resolvedIds.has(selectedConjunctionId) : false}
                onToggleCollapse={() => setRightSidebarOpen(false)}
              />
            ) : (
              /* Floating Re-open Toggle for Inspector Panel */
              <button
                onClick={() => setRightSidebarOpen(true)}
                className="absolute top-4 right-4 z-20 px-3.5 py-2 rounded-xl bg-white/95 hover:bg-white backdrop-blur-md border border-slate-200 text-slate-700 hover:text-teal-700 text-xs font-bold flex items-center space-x-2 transition-all shadow-md cursor-pointer hover:border-teal-400"
                title="Expand Encounter Inspector"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
                <Layers className="w-3.5 h-3.5 text-teal-600" />
                <span>Inspector</span>
              </button>
            )}
          </>
        )}

      </main>

      {/* ESA Flight Director CAR Briefing Modal */}
      <BriefingModal
        isOpen={briefingModalOpen}
        onClose={() => setBriefingModalOpen(false)}
        briefingData={briefingData}
      />

    </div>
  );
}
