import React, { useRef, useEffect, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Crosshair, Shield } from 'lucide-react';
import { formatDistance } from '../utils/formatters';

export default function BPlaneCanvas({
  bPlaneData,
  nominalMissM,
  postBurnMissM,
  isBurnExecuted,
  primaryName = "Primary",
  secondaryName = "Secondary"
}) {
  const canvasRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [hoverCoord, setHoverCoord] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Clean Light Mission Control Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    const bp = bPlaneData || {};
    const xiM = Number(bp.xi_m ?? bp.xi_miss_m ?? 0);
    const zetaM = Number(bp.zeta_m ?? bp.zeta_miss_m ?? 0);
    const sigmaMajM = Number(bp.sigma_major_m ?? 35.0);
    const sigmaMinM = Number(bp.sigma_minor_m ?? 15.0);
    const angleRad = ((Number(bp.ellipse_angle_deg ?? bp.theta_deg ?? 0)) * Math.PI) / 180.0;

    // Coordinate scale: determine meters per pixel
    const maxDimensionM = Math.max(
      Math.abs(xiM || 100),
      Math.abs(zetaM || 100),
      sigmaMajM * 3,
      postBurnMissM ? Number(postBurnMissM) * 0.15 : 120,
      120
    );

    const baseScale = (Math.min(width, height) * 0.38) / maxDimensionM;
    const scale = baseScale * zoomLevel;

    // Helper functions
    const toCanvasX = (mX) => cx + mX * scale;
    const toCanvasY = (mY) => cy - mY * scale; // Invert Y for Cartesian

    // 1. Draw Grid Lines & Circular Range Rings
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;

    const rangeRings = [25, 50, 100, 200, 400, 800];
    rangeRings.forEach((r) => {
      const pixelRadius = r * scale;
      if (pixelRadius > 15 && pixelRadius < width * 0.7) {
        ctx.beginPath();
        ctx.arc(cx, cy, pixelRadius, 0, Math.PI * 2);
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label ring
        ctx.fillStyle = '#64748B';
        ctx.font = '9px "Inter", sans-serif';
        ctx.fillText(`${r}m`, cx + pixelRadius + 3, cy - 3);
      }
    });

    // 2. Draw Crosshair Axes (xi_hat horizontal, zeta_hat vertical)
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(width, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, height);
    ctx.stroke();

    // Axis Labels
    ctx.fillStyle = '#475569';
    ctx.font = '500 10px "Inter", sans-serif';
    ctx.fillText('+ξ (In-Plane) →', width - 110, cy - 6);
    ctx.fillText('+ζ (Cross-Track) ↑', cx + 6, 16);

    // 3. Draw Combined Hard Body Radius (HBR = 3.0 m) Circle at (0,0)
    const hbrM = Number(bp.hbr_combined_m ?? bp.hbr_total_m ?? 3.0);
    const hbrPixels = Math.max(3, hbrM * scale);

    // Gradient disk for collision core
    const hbrGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, hbrPixels * 2);
    hbrGrad.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
    hbrGrad.addColorStop(0.6, 'rgba(239, 68, 68, 0.15)');
    hbrGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = hbrGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, hbrPixels * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Solid HBR Circle
    ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
    ctx.beginPath();
    ctx.arc(cx, cy, hbrPixels, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 4. Draw Covariance Uncertainty Ellipses
    const drawEllipse = (kMultiplier, strokeColor, fillColor, dash = []) => {
      if (!sigmaMajM || sigmaMajM <= 0 || isNaN(sigmaMajM)) return;
      const a = sigmaMajM * kMultiplier * scale;
      const b = Math.max(1, (sigmaMinM || sigmaMajM * 0.3)) * kMultiplier * scale;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angleRad);

      ctx.beginPath();
      ctx.ellipse(0, 0, a, b, 0, 0, Math.PI * 2);
      ctx.fillStyle = fillColor;
      ctx.fill();

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.4;
      ctx.setLineDash(dash);
      ctx.stroke();

      ctx.restore();
    };

    if (sigmaMajM > 0 && !isNaN(sigmaMajM)) {
      // 99.73% 2D Confidence Boundary (k = 3.4393)
      drawEllipse(3.4393, 'rgba(13, 148, 136, 0.45)', 'rgba(13, 148, 136, 0.04)', [4, 3]);
      // 95.00% 2D Confidence Boundary (k = 2.4477)
      drawEllipse(2.4477, 'rgba(13, 148, 136, 0.75)', 'rgba(13, 148, 136, 0.08)', [3, 2]);
      // 1σ 2D Contour (k = 1.0000, 39.35% confidence)
      drawEllipse(1.0000, 'rgba(15, 118, 110, 0.95)', 'rgba(13, 148, 136, 0.16)');
    } else {
      // Degenerate Covariance Warning
      ctx.fillStyle = '#DC2626';
      ctx.font = '500 9px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('[ DEGENERATE COVARIANCE — UNCERTAINTY UNDEFINED ]', cx, cy - 25);
    }

    // 5. Draw Nominal Miss Vector & Encounter Point
    const nomX = toCanvasX(xiM);
    const nomY = toCanvasY(zetaM);

    // Vector line from origin to miss point
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.75)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nomX, nomY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Nominal Point Marker
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.arc(nomX, nomY, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Nominal Marker Label
    ctx.fillStyle = '#B91C1C';
    ctx.font = '600 10px "Inter", sans-serif';
    const nominalDistDisplay = nominalMissM != null ? `${Number(nominalMissM).toFixed(1)}m` : `${Number(Math.sqrt(xiM * xiM + zetaM * zetaM)).toFixed(1)}m`;
    ctx.fillText(`Nominal B: ${nominalDistDisplay}`, nomX + 8, nomY - 6);

    // 6. Draw Post-Burn Shifted Encounter Vector & Safe Evasion Point
    if (postBurnMissM && Number(postBurnMissM) > Number(nominalMissM || 0)) {
      const shiftDistM = Math.min(Number(postBurnMissM) * 0.08, maxDimensionM * 0.85);
      const postX = toCanvasX(xiM + shiftDistM * Math.cos(angleRad));
      const postY = toCanvasY(zetaM + shiftDistM * Math.sin(angleRad));

      // Green Arrow from nominal to post-burn safe point
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(nomX, nomY);
      ctx.lineTo(postX, postY);
      ctx.stroke();

      // Post-burn marker
      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.arc(postX, postY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Post-burn label
      ctx.fillStyle = '#047857';
      ctx.font = '600 10px "Inter", sans-serif';
      ctx.fillText(`Post-Burn Safe B: ${(Number(postBurnMissM) / 1000).toFixed(2)}km`, postX + 8, postY + 12);
    }

  }, [bPlaneData, nominalMissM, postBurnMissM, zoomLevel]);

  // Handle Canvas Mouse Move for coordinate inspection
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const bp = bPlaneData || {};
    const xiM = Number(bp.xi_m ?? bp.xi_miss_m ?? 100);
    const zetaM = Number(bp.zeta_m ?? bp.zeta_miss_m ?? 100);
    const sigmaMajM = Number(bp.sigma_major_m ?? 50);

    const maxDimensionM = Math.max(
      Math.abs(xiM),
      Math.abs(zetaM),
      sigmaMajM * 3,
      120
    );
    const baseScale = (Math.min(canvas.width, canvas.height) * 0.38) / maxDimensionM;
    const scale = baseScale * zoomLevel;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const mX = ((x - cx) / scale).toFixed(1);
    const mY = ((cy - y) / scale).toFixed(1);

    setHoverCoord({ x: mX, y: mY });
  };

  const handleMouseLeave = () => {
    setHoverCoord(null);
  };

  const sigmaMajDisplay = bPlaneData?.sigma_major_m != null ? `${Number(bPlaneData.sigma_major_m).toFixed(1)} m` : '--';
  const sigmaMinDisplay = bPlaneData?.sigma_minor_m != null ? `${Number(bPlaneData.sigma_minor_m).toFixed(1)} m` : '--';
  const mahalanobisDisplay = bPlaneData?.mahalanobis_dist != null
    ? `${Number(bPlaneData.mahalanobis_dist).toFixed(2)} σ`
    : (bPlaneData?.b_m && bPlaneData?.sigma_major_m
      ? `${(Number(bPlaneData.b_m) / Number(bPlaneData.sigma_major_m)).toFixed(2)} σ`
      : '--');

  return (
    <div className="flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
      
      {/* Canvas Top Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 font-sans">
        <div className="flex items-center space-x-2">
          <Crosshair className="w-3.5 h-3.5 text-teal-600" />
          <span className="text-xs font-bold text-slate-800 font-sans uppercase tracking-tight">
            2D B-Plane Encounter Frame (ξ-ζ)
          </span>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setZoomLevel((z) => Math.min(3.0, z + 0.25))}
            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition-all cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
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

      {/* HTML5 Canvas Container */}
      <div className="relative w-full h-56 bg-white flex items-center justify-center font-sans overflow-hidden border-b border-slate-200">
        <canvas
          ref={canvasRef}
          width={354}
          height={224}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-full cursor-crosshair block"
        />

        {/* Hover Coordinate Pill */}
        {hoverCoord && (
          <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-white/95 backdrop-blur-xs text-teal-800 border border-slate-300 text-[10px] tabular-nums rounded shadow-xs">
            ξ: {hoverCoord.x}m, ζ: {hoverCoord.y}m
          </div>
        )}

        {/* Live Legend */}
        <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-xs border border-slate-200 p-1.5 rounded text-[9px] font-sans space-y-1 shadow-2xs text-slate-700">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-1.5 bg-red-500 inline-block"></span>
            <span className="font-medium">HBR Core</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-1 bg-teal-600 inline-block"></span>
            <span className="font-medium">1σ / 95% / 99.7% Covariance</span>
          </div>
          {postBurnMissM && (
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-1.5 bg-emerald-500 inline-block"></span>
              <span className="text-emerald-700 font-semibold">Post-Burn Safe Vector</span>
            </div>
          )}
        </div>
      </div>

      {/* B-Plane Statistical Summary Footer */}
      <div className="p-2.5 border-t border-slate-200 bg-slate-50 grid grid-cols-3 gap-2 text-[10px] font-sans text-slate-600">
        <div>
          <span className="text-slate-400 block uppercase font-medium tracking-wider text-[9px]">1σ Major (σ_ξ)</span>
          <span className="tabular-nums font-medium text-slate-900">{sigmaMajDisplay}</span>
        </div>
        <div>
          <span className="text-slate-400 block uppercase font-medium tracking-wider text-[9px]">1σ Minor (σ_ζ)</span>
          <span className="tabular-nums font-medium text-slate-900">{sigmaMinDisplay}</span>
        </div>
        <div>
          <span className="text-slate-400 block uppercase font-medium tracking-wider text-[9px]">Mahalanobis</span>
          <span className="tabular-nums font-medium text-teal-700">{mahalanobisDisplay}</span>
        </div>
      </div>

    </div>
  );
}
