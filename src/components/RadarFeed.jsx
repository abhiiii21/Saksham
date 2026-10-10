import React, { useState, useEffect } from 'react';
import { Search, AlertTriangle, ShieldCheck, Clock, Zap, ArrowRight, Radio, Filter, ChevronLeft } from 'lucide-react';
import { formatDistance, formatVelocity, formatCountdown, getSeverityStyle } from '../utils/formatters';

export default function RadarFeed({
  conjunctions = [],
  selectedConjunctionId,
  onSelectConjunction,
  resolvedIds = new Set(),
  onToggleCollapse,
  onOpenSimulator
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // ALL, CRITICAL, WARNING, WATCH, RESOLVED
  const [countdownOffsets, setCountdownOffsets] = useState({});

  // Real-time countdown tick
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdownOffsets((prev) => {
        const next = { ...prev };
        conjunctions.forEach((c) => {
          const key = c.id;
          const curr = next[key] !== undefined ? next[key] : c.tca_seconds_from_epoch;
          next[key] = Math.max(0, curr - 1);
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [conjunctions]);

  // Filter and search logic
  const filteredConjunctions = conjunctions.filter((c) => {
    const isResolved = resolvedIds.has(c.id);

    // Filter type check
    if (filterType === 'RESOLVED') {
      if (!isResolved) return false;
    } else if (filterType === 'CRITICAL') {
      if (c.risk_level !== 'CRITICAL' || isResolved) return false;
    } else if (filterType === 'WARNING') {
      if (c.risk_level !== 'WARNING' || isResolved) return false;
    } else if (filterType === 'WATCH') {
      if ((c.risk_level !== 'WATCH' && c.risk_level !== 'LOW_RISK') || isResolved) return false;
    }

    // Search query check
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.primary_name?.toLowerCase().includes(q) ||
      c.secondary_name?.toLowerCase().includes(q) ||
      String(c.primary_id).includes(q) ||
      String(c.secondary_id).includes(q)
    );
  });

  const criticalTotal = conjunctions.filter(c => c.risk_level === 'CRITICAL' && !resolvedIds.has(c.id)).length;
  const warningTotal = conjunctions.filter(c => c.risk_level === 'WARNING' && !resolvedIds.has(c.id)).length;
  const watchTotal = conjunctions.filter(c => (c.risk_level === 'WATCH' || c.risk_level === 'LOW_RISK') && !resolvedIds.has(c.id)).length;
  const resolvedTotal = resolvedIds.size;

  return (
    <aside className="w-[310px] min-w-[290px] max-w-[330px] h-full flex flex-col bg-slate-50 border-r border-slate-200 shadow-xs overflow-hidden select-none shrink-0 font-sans text-slate-800">
      
      {/* 1. FIXED-HEIGHT PANEL HEADER & SEARCH */}
      <div className="p-3 border-b border-slate-200 bg-white shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Radio className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <h2 className="text-xs font-bold tracking-tight text-slate-900 uppercase font-sans">
              Radar Feed
            </h2>
            <span className="text-xs tabular-nums font-medium text-slate-500">
              ({conjunctions.length})
            </span>
          </div>

          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
              title="Collapse Radar Feed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search satellite or NORAD..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500/50 focus:border-teal-500 transition-all font-sans shadow-2xs"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[10px]">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-2 py-0.5 rounded-md font-medium whitespace-nowrap transition-all cursor-pointer ${
              filterType === 'ALL'
                ? 'bg-slate-200 text-slate-900 font-semibold shadow-2xs border border-slate-300'
                : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
            }`}
          >
            All ({conjunctions.length})
          </button>
          <button
            onClick={() => setFilterType('CRITICAL')}
            className={`px-2 py-0.5 rounded-md font-medium whitespace-nowrap transition-all cursor-pointer ${
              filterType === 'CRITICAL'
                ? 'bg-rose-100 text-rose-800 font-semibold shadow-2xs border border-rose-300'
                : 'bg-white text-rose-600 hover:bg-rose-50 border border-slate-200'
            }`}
          >
            Crit ({criticalTotal})
          </button>
          <button
            onClick={() => setFilterType('WARNING')}
            className={`px-2 py-0.5 rounded-md font-medium whitespace-nowrap transition-all cursor-pointer ${
              filterType === 'WARNING'
                ? 'bg-amber-100 text-amber-800 font-semibold shadow-2xs border border-amber-300'
                : 'bg-white text-amber-600 hover:bg-amber-50 border border-slate-200'
            }`}
          >
            Warn ({warningTotal})
          </button>
          <button
            onClick={() => setFilterType('RESOLVED')}
            className={`px-2 py-0.5 rounded-md font-medium whitespace-nowrap transition-all cursor-pointer ${
              filterType === 'RESOLVED'
                ? 'bg-emerald-100 text-emerald-800 font-semibold shadow-2xs border border-emerald-300'
                : 'bg-white text-emerald-600 hover:bg-emerald-50 border border-slate-200'
            }`}
          >
            Safe ({resolvedTotal})
          </button>
        </div>
      </div>

      {/* 2. SCROLLABLE ENCOUNTER LIST FILLING REMAINING HEIGHT */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-slate-50">
        {filteredConjunctions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-44 text-center p-4 text-slate-400">
            <ShieldCheck className="w-7 h-7 text-emerald-600 mb-2 opacity-80" />
            <p className="text-xs font-semibold text-slate-700">No conjunctions match filters</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Orbit clearance boundaries are nominal</p>
          </div>
        ) : (
          filteredConjunctions.map((conj) => {
            const isSelected = conj.id === selectedConjunctionId;
            const isResolved = resolvedIds.has(conj.id);
            const sev = getSeverityStyle(isResolved ? 'LOW_RISK' : conj.risk_level);
            const currentTca = countdownOffsets[conj.id] !== undefined ? countdownOffsets[conj.id] : conj.tca_seconds_from_epoch;

            return (
              <div
                key={conj.id}
                onClick={() => onSelectConjunction(conj.id)}
                className={`relative p-2.5 rounded-xl cursor-pointer transition-all border text-left ${
                  isSelected
                    ? 'bg-teal-50/80 border-teal-500 shadow-xs ring-1 ring-teal-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/90 shadow-2xs'
                }`}
              >
                {/* Top Row: Clean Severity Text & Foster Pc (NO PILLS, NO DOTS) */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${
                    isResolved
                      ? 'text-emerald-600'
                      : conj.risk_level === 'CRITICAL'
                      ? 'text-rose-600'
                      : conj.risk_level === 'WARNING'
                      ? 'text-amber-600'
                      : 'text-sky-600'
                  }`}>
                    {isResolved ? 'RESOLVED' : conj.risk_level}
                  </span>

                  <div className="text-right flex items-baseline">
                    <span className="text-[9px] text-slate-400 uppercase font-sans font-medium tracking-wider mr-1">Pc:</span>
                    <span className={`text-xs tabular-nums font-medium ${
                      isResolved ? 'text-emerald-600' : conj.risk_level === 'CRITICAL' ? 'text-rose-600' : 'text-amber-600'
                    }`}>
                      {isResolved ? '< 1.00e-08' : conj.pc_formatted}
                    </span>
                  </div>
                </div>

                {/* Middle Row: Primary vs Secondary Object Names with NORAD IDs */}
                <div className="mb-2 space-y-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900 truncate max-w-[190px]">
                      {conj.primary_name}
                    </span>
                    <span className="text-[10px] tabular-nums text-slate-500 shrink-0">
                      #{conj.primary_id}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5 text-xs">
                    <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="font-normal text-slate-700 truncate max-w-[170px]">
                      {conj.secondary_name}
                    </span>
                    <span className="text-[10px] tabular-nums text-slate-500 shrink-0">
                      #{conj.secondary_id}
                    </span>
                  </div>
                </div>

                {/* Bottom Row: Nominal Miss Distance & TCA Countdown */}
                <div className="pt-1.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase block font-sans font-medium">Miss Distance</span>
                    <span className="tabular-nums font-medium text-slate-900">
                      {formatDistance(conj.miss_distance_m)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] text-slate-400 uppercase block font-sans font-medium flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" /> TCA Countdown
                    </span>
                    <span className="tabular-nums font-medium text-teal-700">
                      {formatCountdown(currentTca)}
                    </span>
                  </div>
                </div>

                {/* ESA ML Verified Risk Badge */}
                <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] font-sans">
                  <span className="text-slate-500 font-medium">ESA ML Verified Risk:</span>
                  <span className={`tabular-nums font-bold ${
                    isResolved
                      ? 'text-emerald-600'
                      : (conj.ml_risk_score ?? 0) >= 0.5
                      ? 'text-rose-600'
                      : (conj.ml_risk_score ?? 0) >= 0.05
                      ? 'text-amber-600'
                      : 'text-slate-700'
                  }`}>
                    {isResolved
                      ? '< 0.01%'
                      : (conj.ml_risk_formatted || `${((conj.ml_risk_score ?? 0) * 100).toFixed(1)}%`)}
                  </span>
                </div>

                {/* Post-Burn Clearance Line if resolved */}
                {isResolved && (
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-emerald-700 font-medium font-sans">
                    <span>Post-Burn Clearance:</span>
                    <span className="tabular-nums font-semibold">+8.0 km Safe</span>
                  </div>
                )}

                {/* Simulate in Impact Sandbox Action Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenSimulator && onOpenSimulator(conj);
                  }}
                  className="mt-2 w-full py-1.5 px-2 rounded-lg bg-teal-50/80 hover:bg-teal-100/90 border border-teal-200 hover:border-teal-300 text-teal-800 text-[10.5px] font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
                  title="Load this exact encounter into 2D Impact Sandbox"
                >
                  <Zap className="w-3 h-3 text-teal-600 shrink-0" />
                  <span>💥 Simulate in Impact Sandbox</span>
                </button>

              </div>
            );
          })
        )}
      </div>

      {/* 3. PINNED BOTTOM FOOTER */}
      <div className="h-8 px-3 border-t border-slate-200 bg-white text-[10px] text-slate-500 flex items-center justify-between font-sans shrink-0">
        <span className="flex items-center gap-1">
          <Zap className="w-3 h-3 text-teal-600 shrink-0" /> SGP4 72h Screening
        </span>
        <span className="text-slate-500 tabular-nums text-[9.5px]">HBR: 3.0m</span>
      </div>

    </aside>
  );
}
