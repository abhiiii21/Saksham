import React, { useRef, useEffect, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Activity, Clock, Crosshair } from 'lucide-react';
import { formatDistance } from '../utils/formatters';

/**
 * MissDistanceCanvas
 * High-precision scientific visualization of propagated Euclidean miss distance
 * and Radial / In-Track / Cross-Track relative motion as a function of time relative to TCA (t - TCA).
 */
export default function MissDistanceCanvas({
  relativeMotionData,
  nominalMissM,
  tcaEpoch,
  primaryName = 'Primary',
  secondaryName = 'Secondary'
}) {
  const canvasRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [showRicBreakdown, setShowRicBreakdown] = useState(false);

  const samples = relativeMotionData?.samples || [];
  const minMissM = relativeMotionData?.min_miss_distance_m ?? nominalMissM ?? 140.0;
  const relSpeedKms = relativeMotionData?.relative_speed_at_tca_kms ?? 14.2;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padLeft = 52;
    const padRight = 24;
    const padTop = 24;
    const padBottom = 34;

    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;

    ctx.clearRect(0, 0, width, height);

    // Clean Light Mission Control Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    if (!samples || samples.length < 2) {
      // Empty state
      ctx.fillStyle = '#64748B';
      ctx.font = '500 11px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Propagating high-resolution relative ephemeris...', width / 2, height / 2);
      return;
    }

    // Time domain (X): min and max t in minutes
    const tMin = samples[0].time_rel_tca_min;
    const tMax = samples[samples.length - 1].time_rel_tca_min;
    const tRange = (tMax - tMin) || 1.0;

    // Y domain: max distance in meters (scaled with zoom)
    const allDists = samples.map((s) => s.miss_distance_m);
    const rawMaxDist = Math.max(...allDists, 1000);
    const maxDist = (rawMaxDist / zoomLevel) * 1.05;
    const minDist = 0;

    // Coordinate mapping helpers
    const getX = (tMinVal) => padLeft + ((tMinVal - tMin) / tRange) * plotWidth;
    const getY = (distVal) => padTop + plotHeight - ((distVal - minDist) / (maxDist - minDist)) * plotHeight;

    // 1. Draw Grid Lines & Y-Axis Labels
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748B';
    ctx.font = '9px "Inter", sans-serif';
    ctx.textAlign = 'right';

    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const distVal = minDist + (i / yTicks) * (maxDist - minDist);
      const yPos = getY(distVal);

      ctx.beginPath();
      ctx.moveTo(padLeft, yPos);
      ctx.lineTo(padLeft + plotWidth, yPos);
      ctx.stroke();

      const label = distVal >= 1000 ? `${(distVal / 1000).toFixed(1)}k` : `${Math.round(distVal)}m`;
      ctx.fillText(label, padLeft - 6, yPos + 3);
    }

    // 2. Draw X-Axis Ticks (Time relative to TCA in minutes)
    ctx.textAlign = 'center';
    const xTicks = [-30, -20, -10, 0, 10, 20, 30];
    xTicks.forEach((tVal) => {
      if (tVal >= tMin && tVal <= tMax) {
        const xPos = getX(tVal);
        ctx.beginPath();
        ctx.moveTo(xPos, padTop);
        ctx.lineTo(xPos, padTop + plotHeight);
        ctx.stroke();

        const label = tVal === 0 ? 'TCA' : tVal > 0 ? `+${tVal}m` : `${tVal}m`;
        ctx.fillStyle = tVal === 0 ? '#0D9488' : '#64748B';
        ctx.font = tVal === 0 ? '600 9px "Inter", sans-serif' : '9px "Inter", sans-serif';
        ctx.fillText(label, xPos, padTop + plotHeight + 14);
      }
    });

    // 3. Draw TCA Centerline (t = 0)
    const tcaX = getX(0);
    ctx.strokeStyle = 'rgba(13, 148, 136, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(tcaX, padTop);
    ctx.lineTo(tcaX, padTop + plotHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Optional: Draw RIC component curves if enabled
    if (showRicBreakdown) {
      // Radial (delta R) - Sky
      ctx.strokeStyle = 'rgba(2, 132, 199, 0.75)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      samples.forEach((s, idx) => {
        const x = getX(s.time_rel_tca_min);
        const y = getY(Math.abs(s.radial_m));
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // In-Track (delta I) - Amber
      ctx.strokeStyle = 'rgba(217, 119, 6, 0.75)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      samples.forEach((s, idx) => {
        const x = getX(s.time_rel_tca_min);
        const y = getY(Math.abs(s.intrack_m));
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Cross-Track (delta C) - Purple
      ctx.strokeStyle = 'rgba(147, 51, 234, 0.75)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      samples.forEach((s, idx) => {
        const x = getX(s.time_rel_tca_min);
        const y = getY(Math.abs(s.crosstrack_m));
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // 5. Draw Euclidean Miss Distance Curve d(t)
    ctx.strokeStyle = '#0D9488';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    samples.forEach((s, idx) => {
      const x = getX(s.time_rel_tca_min);
      const y = getY(s.miss_distance_m);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 6. Highlight Minimum Point (TCA encounter)
    const tcaSample = samples.reduce((prev, curr) =>
      Math.abs(curr.time_rel_tca_min) < Math.abs(prev.time_rel_tca_min) ? curr : prev, samples[0]
    );

    const minX = getX(tcaSample.time_rel_tca_min);
    const minY = getY(tcaSample.miss_distance_m);

    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.arc(minX, minY, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#B91C1C';
    ctx.font = '600 10px "Inter", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Min Miss: ${formatDistance(tcaSample.miss_distance_m)}`, minX + 8, minY - 4);

  }, [samples, zoomLevel, showRicBreakdown, nominalMissM]);

  // Mouse hover coordinate inspection
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !samples.length) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    const padLeft = 52;
    const padRight = 24;
    const plotWidth = canvas.width - padLeft - padRight;

    if (x < padLeft || x > padLeft + plotWidth) {
      setHoverIndex(null);
      return;
    }

    const tMin = samples[0].time_rel_tca_min;
    const tMax = samples[samples.length - 1].time_rel_tca_min;
    const ratio = (x - padLeft) / plotWidth;
    const tTarget = tMin + ratio * (tMax - tMin);

    let closestIdx = 0;
    let closestDiff = Infinity;
    samples.forEach((s, i) => {
      const diff = Math.abs(s.time_rel_tca_min - tTarget);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIdx = i;
      }
    });

    setHoverIndex(closestIdx);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const activeSample = hoverIndex !== null && samples[hoverIndex] ? samples[hoverIndex] : null;

  return (
    <div className="flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs font-sans text-xs text-slate-800">
      
      {/* Top Header & Controls */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center space-x-2">
          <Activity className="w-3.5 h-3.5 text-teal-600" />
          <span className="font-bold text-slate-800 uppercase tracking-tight">
            Miss Distance vs. Time (t - TCA)
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setShowRicBreakdown(!showRicBreakdown)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer ${
              showRicBreakdown
                ? 'bg-teal-100 text-teal-800 border border-teal-300'
                : 'bg-slate-200/70 text-slate-600 hover:text-slate-900'
            }`}
            title="Toggle Radial, In-Track, Cross-Track Separation Curves"
          >
            RIC Curves
          </button>
          <button
            onClick={() => setZoomLevel((z) => Math.min(4.0, z + 0.5))}
            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition-all cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.5))}
            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition-all cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel(1.0)}
            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition-all cursor-pointer"
            title="Reset Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas Container */}
      <div className="relative w-full h-56 bg-white flex items-center justify-center font-sans overflow-hidden border-b border-slate-200">
        <canvas
          ref={canvasRef}
          width={354}
          height={224}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-full cursor-crosshair block"
        />

        {/* Hover Inspection Overlay Pill */}
        {activeSample && (
          <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-xs border border-slate-300 text-slate-900 p-2 rounded shadow-md text-[10px] tabular-nums space-y-0.5 pointer-events-none">
            <div className="text-teal-700 font-bold">
              t - TCA: {activeSample.time_rel_tca_min > 0 ? `+${activeSample.time_rel_tca_min}m` : `${activeSample.time_rel_tca_min}m`}
            </div>
            <div>Separation: <span className="font-bold text-amber-700 tabular-nums">{formatDistance(activeSample.miss_distance_m)}</span></div>
            {showRicBreakdown && (
              <div className="text-[9px] text-slate-600 tabular-nums">
                ΔR: {activeSample.radial_m}m | ΔI: {activeSample.intrack_m}m | ΔC: {activeSample.crosstrack_m}m
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-xs border border-slate-200 p-1.5 rounded text-[9px] font-sans space-y-1 shadow-2xs text-slate-700">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-0.5 bg-teal-600 inline-block"></span>
            <span className="font-medium">Euclidean Miss d(t)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-1.5 bg-red-500 inline-block"></span>
            <span className="text-red-600 font-semibold">TCA Minimum</span>
          </div>
        </div>
      </div>

      {/* Summary Matrix Footer */}
      <div className="p-2.5 border-t border-slate-200 bg-slate-50 grid grid-cols-3 gap-2 text-[10px] font-sans text-slate-600">
        <div>
          <span className="text-slate-400 block uppercase font-medium tracking-wider text-[9px]">TCA Miss</span>
          <span className="tabular-nums font-medium text-red-600">{formatDistance(minMissM)}</span>
        </div>
        <div>
          <span className="text-slate-400 block uppercase font-medium tracking-wider text-[9px]">Rel Speed</span>
          <span className="tabular-nums font-medium text-slate-900">{Number(relSpeedKms).toFixed(2)} km/s</span>
        </div>
        <div>
          <span className="text-slate-400 block uppercase font-medium tracking-wider text-[9px]">Interval</span>
          <span className="tabular-nums font-medium text-teal-700">±30.0 min</span>
        </div>
      </div>

    </div>
  );
}
