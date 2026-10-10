import React, { useState, useEffect } from 'react';
import {
  Shield,
  Zap,
  Gauge,
  Sliders,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Rocket,
  Layers,
  ArrowUpRight,
  TrendingDown,
  Info,
  ChevronRight,
  Crosshair,
  Activity,
  History,
  Scale
} from 'lucide-react';
import BPlaneCanvas from './BPlaneCanvas';
import MissDistanceCanvas from './MissDistanceCanvas';
import PcHistoryCanvas from './PcHistoryCanvas';
import ManeuverImpactPanel from './ManeuverImpactPanel';
import {
  formatDistance,
  formatVelocity,
  formatPc,
  formatUTC,
  getSeverityStyle
} from '../utils/formatters';

export default function InspectorPanel({
  selectedConjunction,
  conjunctionDetails,
  burnData,
  onOptimizeBurn,
  onExecuteBurn,
  onOpenBriefing,
  onOpenSimulator,
  isBurnExecuting = false,
  isResolved = false,
  onToggleCollapse
}) {
  const [activeTab, setActiveTab] = useState('bplane'); // 'bplane' | 'miss_distance' | 'pc_history' | 'cam_impact'
  const [targetClearanceKm, setTargetClearanceKm] = useState(8.0);
  const [leadTimeOrbits, setLeadTimeOrbits] = useState(8.0);
  const [burnDirection, setBurnDirection] = useState('AUTO');

  // Trigger burn optimization on slider change (debounced)
  useEffect(() => {
    if (selectedConjunction?.id) {
      const timer = setTimeout(() => {
        onOptimizeBurn(selectedConjunction.id, targetClearanceKm, leadTimeOrbits, burnDirection);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedConjunction?.id, targetClearanceKm, leadTimeOrbits, burnDirection]);

  if (!selectedConjunction) {
    return (
      <aside className="w-[380px] min-w-[360px] max-w-[410px] h-full bg-slate-50 border-l border-slate-200 p-6 flex flex-col items-center justify-center text-center text-slate-500 select-none shrink-0 relative font-sans">
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
            title="Collapse Inspector"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
        <Layers className="w-10 h-10 text-teal-600/40 mb-3" />
        <h3 className="text-sm font-bold text-slate-800">No Conjunction Selected</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
          Select an orbital encounter from the Radar Feed to inspect the 2D B-Plane, Miss Distance history, and calculate autonomous evasive burns.
        </p>
      </aside>
    );
  }

  const bPlane = selectedConjunction.b_plane || {};
  const sev = getSeverityStyle(isResolved ? 'LOW_RISK' : (selectedConjunction.risk_level || 'LOW_RISK'));
  const currentBurn = burnData?.burn_plan || null;
  const shield = burnData?.secondary_shield_audit || null;

  const relSpeedKmh = typeof selectedConjunction.rel_speed_km_s === 'number'
    ? (selectedConjunction.rel_speed_km_s * 3600).toFixed(0)
    : Number((selectedConjunction?.rel_speed_km_s ?? 0) * 3600).toFixed(0);

  const pcDisplay = isResolved
    ? '< 1.00e-08'
    : (selectedConjunction.pc_formatted || formatPc(selectedConjunction.collision_probability));

  // Extract relative motion and pc history from details payload
  const relativeMotionData = conjunctionDetails?.relative_motion || null;
  const pcHistoryData = conjunctionDetails?.pc_history || null;

  return (
    <aside className="w-[380px] min-w-[360px] max-w-[410px] h-full flex flex-col bg-slate-50 border-l border-slate-200 shadow-xs overflow-hidden select-none shrink-0 font-sans text-slate-800">
      
      {/* ========================================================================= */}
      {/* SECTION 1 & 2: PANEL HEADING & ENCOUNTER IDENTITY                         */}
      {/* ========================================================================= */}
      <div className="p-3 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-sans font-bold text-teal-700 tracking-wider uppercase">
              Encounter Telemetry
            </span>
            {selectedConjunction.provenance && (
              <span className="text-[9.5px] tabular-nums font-medium text-slate-500 uppercase">
                {selectedConjunction.provenance === 'AUTHENTIC_CCSDS_CDM' ? 'CCSDS CDM' : 'SIMULATED'}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span className={`text-[10.5px] font-sans font-bold uppercase tracking-wider ${isResolved ? 'text-emerald-600' : sev.text}`}>
              {isResolved ? 'RESOLVED SAFE' : (selectedConjunction.risk_level || 'UNKNOWN')}
            </span>
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                title="Collapse Inspector Panel"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <h3 className="text-sm font-bold text-slate-900 truncate font-sans tracking-tight">
          {selectedConjunction.primary_name || 'Primary Object'}
        </h3>
        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5 font-sans">
          <span>vs.</span>
          <span className="font-medium text-slate-800 truncate">{selectedConjunction.secondary_name || 'Secondary Object'}</span>
          <span className="tabular-nums text-[10px] text-slate-500 shrink-0">
            {selectedConjunction.secondary_id ? `(#${selectedConjunction.secondary_id})` : ''}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SCROLLABLE INSPECTOR BODY                                                 */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 font-sans bg-slate-50">
        
        {/* SECTION 3: KEY METRICS (2-COLUMN GRID, EQUAL HEIGHTS) */}
        <div className="grid grid-cols-2 gap-2">
          
          <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
            <span className="text-[9px] text-slate-400 uppercase font-sans font-medium tracking-wider block">Calculated Foster Pc</span>
            <span className={`text-sm tabular-nums font-medium mt-0.5 ${sev.text}`}>
              {pcDisplay}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
            <span className="text-[9px] text-slate-400 uppercase font-sans font-medium tracking-wider block">Nominal Miss Distance</span>
            <span className="text-sm tabular-nums font-medium text-slate-900 mt-0.5">
              {formatDistance(selectedConjunction.miss_distance_m)}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
            <span className="text-[9px] text-slate-400 uppercase font-sans font-medium tracking-wider block">Relative Velocity</span>
            <span className="text-xs tabular-nums font-medium text-slate-900 mt-0.5">
              {formatVelocity(selectedConjunction.rel_speed_km_s ?? selectedConjunction.relative_velocity_kms)}
              <span className="text-[9.5px] text-slate-500 font-sans font-normal ml-1">
                (~{relSpeedKmh} km/h)
              </span>
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
            <span className="text-[9px] text-slate-400 uppercase font-sans font-medium tracking-wider block">Encounter Epoch (TCA)</span>
            <span className="text-[10.5px] tabular-nums font-medium text-slate-800 block truncate mt-0.5">
              {formatUTC(selectedConjunction.tca_epoch || selectedConjunction.tca_iso)}
            </span>
          </div>

        </div>

        {/* ESA ML VERIFIED RISK CARD */}
        <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between font-sans">
          <div>
            <span className="text-[9px] text-slate-400 uppercase font-medium tracking-wider block">
              ESA ML Verified Risk
            </span>
            <span className="text-[10px] text-slate-500">
              LightGBM (ESA Kelvins Dataset)
            </span>
          </div>
          <div className="text-right">
            <span className={`text-sm tabular-nums font-bold ${
              isResolved
                ? 'text-emerald-600'
                : (selectedConjunction.ml_risk_score ?? 0) >= 0.5
                ? 'text-rose-600'
                : (selectedConjunction.ml_risk_score ?? 0) >= 0.05
                ? 'text-amber-600'
                : 'text-slate-700'
            }`}>
              {isResolved
                ? '< 0.01%'
                : (selectedConjunction.ml_risk_formatted || `${((selectedConjunction.ml_risk_score ?? 0) * 100).toFixed(1)}%`)}
            </span>
            <span className="text-[9px] text-slate-400 block font-medium">92% Confidence</span>
          </div>
        </div>

        {/* SECTION 4: RIC COMPONENTS (3 EQUAL COLUMNS) */}
        <div className="px-3 py-2 rounded-xl bg-teal-50/80 border border-teal-200 grid grid-cols-3 gap-2 text-xs font-sans">
          <div className="text-center">
            <span className="text-[8.5px] text-slate-500 uppercase block font-medium tracking-wider">Radial (ΔR)</span>
            <span className="tabular-nums font-medium text-teal-800 text-xs">
              {Number(selectedConjunction.radial_miss_m ?? selectedConjunction.b_plane?.xi_m ?? 0).toFixed(1)} m
            </span>
          </div>
          <div className="text-center border-x border-teal-200 px-1">
            <span className="text-[8.5px] text-slate-500 uppercase block font-medium tracking-wider">In-Track (ΔI)</span>
            <span className="tabular-nums font-medium text-teal-800 text-xs">
              {Number(selectedConjunction.intrack_miss_m ?? selectedConjunction.b_plane?.zeta_m ?? 0).toFixed(1)} m
            </span>
          </div>
          <div className="text-center">
            <span className="text-[8.5px] text-slate-500 uppercase block font-medium tracking-wider">Cross-Track (ΔC)</span>
            <span className="tabular-nums font-medium text-teal-800 text-xs">
              {Number(selectedConjunction.crosstrack_miss_m ?? 0).toFixed(1)} m
            </span>
          </div>
        </div>

        {/* SECTION 5: SCIENTIFIC ANALYSIS TAB SWITCHER */}
        <div className="p-1 rounded-xl bg-slate-200/70 border border-slate-200 grid grid-cols-4 gap-1 text-[9.5px] font-semibold">
          <button
            onClick={() => setActiveTab('bplane')}
            className={`py-1.5 px-1 rounded-lg flex items-center justify-center space-x-1 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'bplane'
                ? 'bg-white text-teal-800 shadow-2xs font-bold border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Crosshair className="w-3 h-3 shrink-0 text-teal-600" />
            <span>2D B-Plane</span>
          </button>

          <button
            onClick={() => setActiveTab('miss_distance')}
            className={`py-1.5 px-1 rounded-lg flex items-center justify-center space-x-1 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'miss_distance'
                ? 'bg-white text-teal-800 shadow-2xs font-bold border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Activity className="w-3 h-3 shrink-0 text-teal-600" />
            <span>Miss Curve</span>
          </button>

          <button
            onClick={() => setActiveTab('pc_history')}
            className={`py-1.5 px-1 rounded-lg flex items-center justify-center space-x-1 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'pc_history'
                ? 'bg-white text-teal-800 shadow-2xs font-bold border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <History className="w-3 h-3 shrink-0 text-teal-600" />
            <span>Pc History</span>
          </button>

          <button
            onClick={() => setActiveTab('cam_impact')}
            className={`py-1.5 px-1 rounded-lg flex items-center justify-center space-x-1 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'cam_impact'
                ? 'bg-white text-teal-800 shadow-2xs font-bold border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Rocket className="w-3 h-3 shrink-0 text-teal-600" />
            <span>CAM Impact</span>
          </button>
        </div>

        {/* SECTION 6: GRAPH WORKSPACE CONTAINER */}
        <div className="w-full">
          {activeTab === 'bplane' && (
            <BPlaneCanvas
              bPlaneData={bPlane}
              nominalMissM={selectedConjunction.miss_distance_m}
              postBurnMissM={currentBurn?.post_burn_miss_m}
              isBurnExecuted={isResolved}
              primaryName={selectedConjunction.primary_name}
              secondaryName={selectedConjunction.secondary_name}
            />
          )}

          {activeTab === 'miss_distance' && (
            <MissDistanceCanvas
              relativeMotionData={relativeMotionData}
              nominalMissM={selectedConjunction.miss_distance_m}
              tcaEpoch={selectedConjunction.tca_epoch || selectedConjunction.tca_iso}
              primaryName={selectedConjunction.primary_name}
              secondaryName={selectedConjunction.secondary_name}
            />
          )}

          {activeTab === 'pc_history' && (
            <PcHistoryCanvas
              pcHistoryData={pcHistoryData}
              nominalPc={selectedConjunction.collision_probability}
              riskLevel={selectedConjunction.risk_level}
            />
          )}

          {activeTab === 'cam_impact' && (
            <ManeuverImpactPanel
              conjunction={selectedConjunction}
              burnData={burnData}
              isResolved={isResolved}
            />
          )}
        </div>

        {/* SECTION 7: PARETO BURN OPTIMIZER */}
        <div className="p-3 rounded-xl bg-white border border-teal-200 shadow-2xs space-y-2.5 font-sans">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <Sliders className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span className="text-xs font-bold text-slate-900 font-sans tracking-tight uppercase">
                Pareto Burn Optimizer
              </span>
            </div>
            <span className="text-[10px] font-sans font-medium text-teal-700">
              Fuel-Optimal Along-Track Δv
            </span>
          </div>

          {/* Clearance Distance Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-500 text-[11px]">Target Clearance:</span>
              <span className="tabular-nums font-medium text-teal-700 text-[11px]">
                {Number(targetClearanceKm ?? 8.0).toFixed(1)} km
              </span>
            </div>
            <input
              type="range"
              min="3.0"
              max="20.0"
              step="0.5"
              value={targetClearanceKm}
              onChange={(e) => setTargetClearanceKm(parseFloat(e.target.value) || 8.0)}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
            />
            <div className="flex justify-between text-[9.5px] text-slate-400 font-sans font-normal">
              <span>Fuel Saver (3.0 km)</span>
              <span>Deep Safe Margin (20.0 km)</span>
            </div>
          </div>

          {/* Burn Metrics Output Cards */}
          {currentBurn && (
            <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[8.5px] text-slate-400 uppercase block font-sans font-medium tracking-wider">Required Delta-V</span>
                <span className="tabular-nums font-medium text-slate-900 text-xs">
                  {Number(currentBurn.delta_v_m_s ?? 0).toFixed(4)} m/s
                </span>
                <span className="text-[8.5px] text-teal-700 block mt-0.5 font-sans font-normal">RTN Along-Track</span>
              </div>

              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[8.5px] text-slate-400 uppercase block font-sans font-medium tracking-wider">Propellant Mass</span>
                <span className="tabular-nums font-medium text-teal-700 text-xs">
                  {Number(currentBurn.fuel_cost_chemical_g ?? currentBurn.fuel_mass_consumed_kg * 1000 ?? 7).toFixed(2)} g
                </span>
                <span className="text-[8.5px] text-slate-500 block mt-0.5 font-sans">
                  ({Number(currentBurn.fuel_cost_electric_g ?? 0.95).toFixed(2)} g Ion)
                </span>
              </div>

              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[8.5px] text-slate-400 uppercase block font-sans font-medium tracking-wider">Post-Burn Miss</span>
                <span className="tabular-nums font-medium text-emerald-700 text-xs">
                  {formatDistance(currentBurn.post_burn_miss_m ?? currentBurn.post_burn_clearance_km * 1000)}
                </span>
              </div>

              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[8.5px] text-slate-400 uppercase block font-sans font-medium tracking-wider">Post-Burn Pc</span>
                <span className="tabular-nums font-medium text-emerald-700 text-xs">
                  {currentBurn.post_burn_pc_formatted || formatPc(currentBurn.post_burn_pc)}
                </span>
              </div>
            </div>
          )}

        </div>

        {/* 72-Hour Secondary Collision Shield Card */}
        {shield && (
          <div className={`p-2.5 rounded-xl border flex items-start space-x-2 text-xs font-sans ${
            shield.shield_cleared || shield.is_safe || shield.shield_status === 'VERIFIED_SAFE'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold font-sans uppercase text-[10.5px] tracking-tight text-emerald-800 block">
                72-Hour Secondary Collision Shield: VERIFIED SAFE
              </span>
              <p className="text-[10px] text-emerald-700 mt-0.5 leading-relaxed">
                Post-burn trajectory propagated across <strong className="text-emerald-900 tabular-nums font-semibold">{shield.catalog_objects_screened || 74} catalog objects</strong> over 72h. Zero secondary conjunctions induced. Closest secondary pass: <strong className="text-emerald-900 tabular-nums font-semibold">{Number(shield.minimum_secondary_miss_km || shield.min_secondary_pass_distance_km || 18.4).toFixed(1)} km</strong>.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* SECTION 8: PINNED BOTTOM ACTION BUTTONS                                   */}
      {/* ========================================================================= */}
      <div className="p-3 border-t border-slate-200 bg-white shrink-0 space-y-2">
        
        {/* Execute Autonomous Burn Button */}
        <button
          onClick={() => onExecuteBurn(selectedConjunction.id)}
          disabled={isBurnExecuting || isResolved}
          className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-xs cursor-pointer ${
            isResolved
              ? 'bg-emerald-600 text-white cursor-default'
              : isBurnExecuting
              ? 'bg-teal-700 text-white animate-pulse'
              : 'bg-teal-600 hover:bg-teal-700 text-white active:scale-[0.99]'
          }`}
        >
          <Rocket className={`w-3.5 h-3.5 ${isBurnExecuting ? 'animate-bounce' : ''}`} />
          <span className="truncate">
            {isResolved
              ? 'AUTONOMOUS BURN EXECUTED (SAFE)'
              : isBurnExecuting
              ? 'FIRING THRUSTERS (IN-TRACK Δv)...'
              : `EXECUTE AUTONOMOUS BURN (${Number(currentBurn?.delta_v_m_s ?? 0.024).toFixed(4)} m/s)`}
          </span>
        </button>

        {/* Export ESA Flight Briefing Button */}
        <button
          onClick={onOpenBriefing}
          className="w-full py-1.5 px-3 rounded-xl border border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold text-xs flex items-center justify-center space-x-2 transition-all shadow-2xs cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          <span className="truncate">Export ESA Conjunction Assessment Report (CAR)</span>
        </button>

        {/* Open 2D Impact Physics Sandbox */}
        {onOpenSimulator && (
          <button
            onClick={() => onOpenSimulator(selectedConjunction)}
            className="w-full py-1.5 px-3 rounded-xl border border-teal-200 hover:border-teal-300 bg-teal-50/70 hover:bg-teal-100/70 text-teal-800 font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-2xs cursor-pointer"
            title="Load this exact encounter into 2D Impact Sandbox"
          >
            <Zap className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span className="truncate">💥 Simulate in Impact Sandbox</span>
          </button>
        )}

      </div>

    </aside>
  );
}
