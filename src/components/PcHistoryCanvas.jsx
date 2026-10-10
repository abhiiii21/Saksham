import React, { useRef, useEffect, useState } from 'react';
import { History, TrendingUp, AlertCircle, Info, ShieldAlert } from 'lucide-react';
import { formatPc, formatDistance } from '../utils/formatters';

/**
 * PcHistoryCanvas
 * Scientific visualization of Collision Probability (Pc) evolution across tracking assessments (TCA - 72h down to TCA - 0h).
 * Displays probability dilution ceiling (Pc_max) to identify whether the conjunction is in the high-uncertainty dilution regime.
 */
export default function PcHistoryCanvas({
  pcHistoryData,
  nominalPc,
  riskLevel = 'CRITICAL'
}) {
  const canvasRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);

  const history = pcHistoryData?.history || [];
  const pcMaxDilution = pcHistoryData?.pc_max_dilution_ceiling ?? 1.2e-4;
  const isDiluted = pcHistoryData?.is_diluted ?? false;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padLeft = 60;
    const padRight = 24;
    const padTop = 24;
    const padBottom = 34;

    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;

    ctx.clearRect(0, 0, width, height);

    // Clean Light Mission Control Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    if (!history || history.length < 2) {
      ctx.fillStyle = '#64748B';
      ctx.font = '500 11px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Loading tracking assessment time-series...', width / 2, height / 2);
      return;
    }

    // X Domain: Time before TCA in hours (72h down to 0h)
    const tMin = 0.0;
    const tMax = 72.0;
    const tRange = tMax - tMin;

    // Y Domain: Logarithmic scale from 1e-8 (10^-8) to 1e-2 (10^-2)
    const logMin = -8.0;
    const logMax = -2.0;
    const logRange = logMax - logMin;

    const getX = (hoursVal) => padLeft + ((tMax - hoursVal) / tRange) * plotWidth;
    const getY = (pcVal) => {
      const safePc = Math.max(1e-10, Math.min(1.0, pcVal || 1e-8));
      const logPc = Math.log10(safePc);
      const clampedLog = Math.max(logMin, Math.min(logMax, logPc));
      return padTop + plotHeight - ((clampedLog - logMin) / logRange) * plotHeight;
    };

    // 1. Draw Logarithmic Grid Lines & Y-Axis Labels
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748B';
    ctx.font = '9px "Inter", sans-serif';
    ctx.textAlign = 'right';

    for (let exp = logMin; exp <= logMax; exp += 1) {
      const yPos = padTop + plotHeight - ((exp - logMin) / logRange) * plotHeight;
      ctx.beginPath();
      ctx.moveTo(padLeft, yPos);
      ctx.lineTo(padLeft + plotWidth, yPos);
      ctx.stroke();

      const label = `10^${exp}`;
      ctx.fillText(label, padLeft - 6, yPos + 3);
    }

    // 2. Draw X-Axis Ticks (Hours before TCA)
    ctx.textAlign = 'center';
    const xTicks = [72, 48, 24, 12, 6, 2, 0];
    xTicks.forEach((hVal) => {
      const xPos = getX(hVal);
      ctx.beginPath();
      ctx.moveTo(xPos, padTop);
      ctx.lineTo(xPos, padTop + plotHeight);
      ctx.stroke();

      const label = hVal === 0 ? 'TCA' : `-${hVal}h`;
      ctx.fillStyle = hVal === 0 ? '#0D9488' : '#64748B';
      ctx.font = hVal === 0 ? '600 9px "Inter", sans-serif' : '9px "Inter", sans-serif';
      ctx.fillText(label, xPos, padTop + plotHeight + 14);
    });

    // 3. Draw Red High-Risk Threshold Line (Pc = 1e-4)
    const redThresholdPc = 1e-4;
    const redY = getY(redThresholdPc);
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.8)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(padLeft, redY);
    ctx.lineTo(padLeft + plotWidth, redY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#DC2626';
    ctx.font = '600 9px "Inter", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ESA Threshold (10^-4)', padLeft + 6, redY - 4);

    // 4. Draw Akella-Alfriend Probability Dilution Ceiling (Pc_max) Line
    const pcMaxY = getY(pcMaxDilution);
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.9)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(padLeft, pcMaxY);
    ctx.lineTo(padLeft + plotWidth, pcMaxY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#B45309';
    ctx.font = '600 9px "Inter", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Pc_max Ceiling: ${formatPc(pcMaxDilution)}`, padLeft + plotWidth - 6, pcMaxY - 4);

    // 5. Draw Probability History Curve
    ctx.strokeStyle = '#0D9488';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    history.forEach((rec, idx) => {
      const x = getX(rec.time_to_tca_hours);
      const y = getY(rec.pc);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 6. Draw Assessment Data Points
    history.forEach((rec) => {
      const x = getX(rec.time_to_tca_hours);
      const y = getY(rec.pc);

      const isCurrentTca = rec.time_to_tca_hours === 0;
      ctx.fillStyle = isCurrentTca ? '#DC2626' : rec.is_simulated ? '#0284C7' : '#059669';
      ctx.beginPath();
      ctx.arc(x, y, isCurrentTca ? 4.5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    });

  }, [history, pcMaxDilution, nominalPc]);

  // Handle Mouse Hover
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !history.length) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    const padLeft = 60;
    const padRight = 24;
    const plotWidth = canvas.width - padLeft - padRight;

    if (x < padLeft || x > padLeft + plotWidth) {
      setHoverIndex(null);
      return;
    }

    const tMin = 0.0;
    const tMax = 72.0;
    const ratio = (x - padLeft) / plotWidth;
    const targetHours = tMax - ratio * (tMax - tMin);

    let closestIdx = 0;
    let closestDiff = Infinity;
    history.forEach((h, i) => {
      const diff = Math.abs(h.time_to_tca_hours - targetHours);
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

  const activeRecord = hoverIndex !== null && history[hoverIndex] ? history[hoverIndex] : null;

  return (
    <div className="flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs font-sans text-xs text-slate-800">
      
      {/* Top Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center space-x-2">
          <History className="w-3.5 h-3.5 text-teal-600" />
          <span className="font-bold text-slate-800 uppercase tracking-tight">
            Collision Probability (Pc) Evolution
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[9.5px] font-medium text-slate-500 uppercase">
            {pcHistoryData?.is_simulated_history ? 'PARAMETRIC MODEL' : 'AUTHENTIC CDM HISTORY'}
          </span>

          {isDiluted && (
            <span className="text-[9.5px] font-bold text-amber-700 uppercase">
              DILUTION ZONE
            </span>
          )}
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

        {/* Hover Tooltip Overlay */}
        {activeRecord && (
          <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-xs border border-slate-300 text-slate-900 p-2.5 rounded shadow-md text-[10px] tabular-nums space-y-0.5 pointer-events-none">
            <div className="text-teal-700 font-bold">
              {activeRecord.time_to_tca_hours === 0 ? 'TCA (Current Assessment)' : `T - ${activeRecord.time_to_tca_hours}h (${activeRecord.is_simulated ? 'Model Estimate' : 'Assessment'})`}
            </div>
            <div>Calculated Pc: <span className="font-bold text-red-600 tabular-nums">{activeRecord.pc_formatted}</span></div>
            <div>1σ Covariance: <span className="text-slate-700 tabular-nums">{activeRecord.sigma_major_m}m × {activeRecord.sigma_minor_m}m</span></div>
            <div className="text-[9px] text-slate-500 pt-0.5">Type: {activeRecord.status}</div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-xs border border-slate-200 p-1.5 rounded text-[9px] font-sans space-y-1 shadow-2xs text-slate-700">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-0.5 bg-teal-600 inline-block"></span>
            <span className="font-medium">
              {pcHistoryData?.is_simulated_history ? 'Model Evolution' : 'Assessment Trend'}
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-0.5 bg-amber-600 inline-block"></span>
            <span className="font-medium">Akella-Alfriend Pc_max</span>
          </div>
        </div>
      </div>

      {/* Summary Footer */}
      <div className="p-2.5 border-t border-slate-200 bg-slate-50 grid grid-cols-3 gap-2 text-[10px] font-sans text-slate-600">
        <div>
          <span className="text-slate-400 block uppercase font-medium tracking-wider text-[9px]">Current Pc</span>
          <span className="tabular-nums font-medium text-red-600">{formatPc(nominalPc || 2.4e-4)}</span>
        </div>
        <div>
          <span className="text-slate-400 block uppercase font-medium tracking-wider text-[9px]">Pc_max Ceiling</span>
          <span className="tabular-nums font-medium text-amber-700">{formatPc(pcMaxDilution)}</span>
        </div>
        <div>
          <span className="text-slate-400 block uppercase font-medium tracking-wider text-[9px]">Dilution State</span>
          <span className={`tabular-nums font-medium ${isDiluted ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}`}>
            {isDiluted ? 'DILUTED' : 'CONVERGED'}
          </span>
        </div>
      </div>

    </div>
  );
}
