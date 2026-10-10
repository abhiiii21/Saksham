/**
 * Formatting and Unit Conversion Utilities for Aerospace & Astrodynamics
 * All functions are safely guarded against null, undefined, and NaN values.
 */

export function formatPc(pc) {
  if (pc === undefined || pc === null || isNaN(pc)) return 'N/A';
  const num = Number(pc);
  if (num === 0) return '0.00e+00';
  if (num < 1e-4) {
    return num.toExponential(2);
  }
  return `${(num * 100).toFixed(4)}%`;
}

export function formatDistance(meters) {
  if (meters === undefined || meters === null || isNaN(meters)) return '--';
  const m = Number(meters);
  if (m >= 1000) {
    return `${(m / 1000).toFixed(2)} km`;
  }
  return `${m.toFixed(1)} m`;
}

export function formatVelocity(km_s) {
  if (km_s === undefined || km_s === null || isNaN(km_s)) return '--';
  const v = Number(km_s);
  return `${v.toFixed(2)} km/s`;
}

export function formatCountdown(tcaSeconds) {
  if (tcaSeconds === undefined || tcaSeconds === null || isNaN(tcaSeconds)) return '--:--:--';
  const totalSec = Math.max(0, Math.floor(Number(tcaSeconds)));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const pad = (n) => String(n).padStart(2, '0');
  return `T - ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

export function formatUTC(isoString) {
  if (!isoString) return '--:--:-- UTC';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    return d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  } catch {
    return String(isoString);
  }
}

export function getSeverityStyle(riskLevel) {
  switch (riskLevel) {
    case 'CRITICAL':
      return {
        badge: 'text-rose-600 font-bold tracking-wider',
        text: 'text-rose-600',
        border: 'border-rose-200',
        bg: 'bg-rose-50',
        dot: 'bg-rose-500'
      };
    case 'WARNING':
      return {
        badge: 'text-amber-600 font-bold tracking-wider',
        text: 'text-amber-600',
        border: 'border-amber-200',
        bg: 'bg-amber-50',
        dot: 'bg-amber-500'
      };
    case 'WATCH':
    case 'LOW_RISK':
      return {
        badge: 'text-sky-600 font-bold tracking-wider',
        text: 'text-sky-600',
        border: 'border-sky-200',
        bg: 'bg-sky-50',
        dot: 'bg-sky-500'
      };
    default:
      return {
        badge: 'text-emerald-600 font-bold tracking-wider',
        text: 'text-emerald-600',
        border: 'border-emerald-200',
        bg: 'bg-emerald-50',
        dot: 'bg-emerald-500'
      };
  }
}
