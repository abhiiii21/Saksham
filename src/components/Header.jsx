import React, { useState, useEffect } from 'react';
import { Shield, Radio, Activity, Orbit, Globe2, Clock, AlertTriangle, CheckCircle2, ChevronDown, Satellite, BarChart3, LogOut, User, Sparkles, Zap } from 'lucide-react';
import { formatUTC } from '../utils/formatters';

export default function Header({
  systemHealth,
  currentMode,
  onModeChange,
  conjunctionsCount = 0,
  criticalCount = 0,
  activeBurnExecuting = false,
  activeView = 'DASHBOARD',
  onViewChange,
  currentUser = null,
  onLogout
}) {
  const [currentUtc, setCurrentUtc] = useState(new Date().toISOString());

  // Live UTC Mission Clock ticking every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentUtc(new Date().toISOString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="w-full h-15 bg-white border-b border-slate-200/90 shadow-2xs z-30 px-5 shrink-0 transition-all font-sans select-none flex items-center justify-between gap-4 overflow-hidden">
      
      {/* 1. PRODUCT IDENTITY & SUBTITLE */}
      <div className="flex items-center space-x-3.5 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0 shadow-2xs">
          <Orbit className="w-5 h-5" />
        </div>
        <div className="flex flex-col justify-center leading-tight">
          <div className="flex items-center space-x-2.5">
            <span className="text-base font-extrabold tracking-tight text-slate-900 font-sans whitespace-nowrap">
              SAKSHAM
            </span>
            <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700 font-bold tracking-wider uppercase whitespace-nowrap">
              ESA SPACE-01
            </span>
          </div>
          <p className="text-[11px] font-medium text-slate-400 hidden xl:block whitespace-nowrap mt-0.5">
            Autonomous Space Traffic Management & LEO Conjunction Shield
          </p>
        </div>
      </div>

      {/* 2. PRIMARY NAVIGATION TABS (Spacious, prominent switcher) */}
      <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 font-sans text-xs shadow-inner shrink-0 gap-1">
        <button
          onClick={() => onViewChange && onViewChange('3D_OPS')}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-2 cursor-pointer whitespace-nowrap ${
            activeView === '3D_OPS'
              ? 'bg-white text-teal-800 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Globe2 className="w-4 h-4 text-teal-600 shrink-0" />
          <span>3D Orbital Ops</span>
        </button>

        <button
          onClick={() => onViewChange && onViewChange('SANDBOX')}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-2 cursor-pointer whitespace-nowrap ${
            activeView === 'SIMULATOR' || activeView === 'SANDBOX'
              ? 'bg-white text-teal-800 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Zap className="w-4 h-4 text-teal-600 shrink-0" />
          <span>2D Impact Sandbox</span>
        </button>

        <button
          onClick={() => onViewChange && onViewChange('DASHBOARD')}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-2 cursor-pointer whitespace-nowrap ${
            activeView === 'DASHBOARD'
              ? 'bg-white text-teal-800 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-teal-600 shrink-0" />
          <span>Mission Dashboard</span>
        </button>
      </div>

      {/* RIGHT GROUPS: 3. CLOCK, 4. ALERTS, 5. DATA SOURCE & STATUS, 6. USER */}
      <div className="flex items-center space-x-3.5 shrink-0">
        
        {/* 3. UTC CLOCK & TIME CONTEXT */}
        <div className="hidden lg:flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/90 text-xs font-sans shrink-0">
          <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          <span className="text-slate-400 font-semibold text-[11px]">UTC:</span>
          <span className="tabular-nums font-bold text-slate-800 whitespace-nowrap text-xs">{formatUTC(currentUtc)}</span>
        </div>

        {/* 4. ALERT SUMMARY COUNTER */}
        <div className="hidden md:flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/90 text-xs font-sans shrink-0">
          <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${criticalCount > 0 ? 'text-rose-600' : 'text-amber-600'}`} />
          <span className="text-slate-800 font-bold whitespace-nowrap text-xs">
            <span className="tabular-nums font-extrabold">{conjunctionsCount}</span> Events
          </span>
          {criticalCount > 0 && (
            <span className="text-rose-600 text-xs tabular-nums font-extrabold whitespace-nowrap">
              ({criticalCount} CRIT)
            </span>
          )}
        </div>

        {/* 5. DATA-SOURCE CONTROLS & CONNECTION STATUS */}
        <div className="flex items-center space-x-2.5 shrink-0">
          {/* Mode Switcher */}
          <div className="relative inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-medium font-sans shrink-0 gap-1">
            <button
              onClick={() => onModeChange && onModeChange('BENCHMARK_SCENARIOS')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 text-xs cursor-pointer whitespace-nowrap ${
                currentMode === 'BENCHMARK_SCENARIOS'
                  ? 'bg-white text-teal-800 font-bold shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>Benchmarks</span>
            </button>
            <button
              onClick={() => onModeChange && onModeChange('LIVE_CELESTRAK')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 text-xs cursor-pointer whitespace-nowrap ${
                currentMode === 'LIVE_CELESTRAK'
                  ? 'bg-white text-teal-800 font-bold shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>CelesTrak</span>
            </button>
          </div>

          {/* Autonomous Shield Status Badge */}
          <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-sans shrink-0">
            <Shield className={`w-3.5 h-3.5 shrink-0 ${activeBurnExecuting ? 'text-teal-600 animate-pulse' : 'text-emerald-600'}`} />
            <span className={`text-[11px] font-bold tracking-tight whitespace-nowrap ${
              activeBurnExecuting ? 'text-teal-700' : 'text-emerald-700'
            }`}>
              {activeBurnExecuting ? 'EXECUTING BURN' : '72H SHIELD ACTIVE'}
            </span>
          </div>
        </div>

        {/* 6. USER / ACCOUNT CONTROLS */}
        {currentUser && (
          <div className="flex items-center space-x-2.5 pl-2.5 border-l border-slate-200 shrink-0">
            <div className="hidden 2xl:flex flex-col text-right leading-tight max-w-[140px]">
              <span className="text-xs font-bold text-slate-800 truncate">
                {currentUser.role || 'Operator'}
              </span>
              <span className="text-[10px] tabular-nums text-slate-400 truncate">
                {currentUser.email || 'ESA Authorized'}
              </span>
            </div>
            <button
              onClick={onLogout}
              className="p-2 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors border border-transparent hover:border-rose-200 cursor-pointer shrink-0"
              title="Lock Session / Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>

    </header>
  );
}
