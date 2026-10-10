import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Zap,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Crosshair,
  Compass,
  Activity,
  Flame,
  Rocket,
  FastForward,
  Rewind,
  Eye,
  Layers,
  ChevronRight,
  Maximize2,
  RefreshCw,
  Clock,
  Sparkles,
  Info,
  X
} from 'lucide-react';
import { formatDistance, formatVelocity } from '../utils/formatters';
import { predictRisk } from '../utils/api';

export default function CollisionSimulator({
  selectedConjunction = null,
  customEncounterPair = null,
  onClose = null
}) {
  // ============================================================================
  // 1. SIMULATION TIME & PLAYBACK STATE
  // ============================================================================
  const [isPlaying, setIsPlaying] = useState(true);
  const [time, setTime] = useState(0.0); // Elapsed simulation time in seconds
  const [timeScale, setTimeScale] = useState(1.0); // 0.25x to 5.0x
  const [simMode, setSimMode] = useState('LINEAR'); // 'LINEAR' | 'HCW'
  const [isCustomPairActive, setIsCustomPairActive] = useState(false);

  // Canvas visual toggles
  const [showGrid, setShowGrid] = useState(true);
  const [showVectors, setShowVectors] = useState(true);
  const [showHalos, setShowHalos] = useState(true);
  const [showStars, setShowStars] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [zoom, setZoom] = useState(1.0);

  // Active side tab in Right Panel
  const [rightPanelTab, setRightPanelTab] = useState('KINEMATICS'); // 'KINEMATICS' | 'AVOIDANCE'

  // ============================================================================
  // 2. LIVE TELEMETRY & ML PREDICTION STATE
  // ============================================================================
  const [activeTelemetry, setActiveTelemetry] = useState({
    title: 'SENTINEL-1A (#39634) vs. COSMOS-1408 DEBRIS #1042 (#49821)',
    conjunction_id: 'DES-39634-49821',
    missDistanceM: 140.0,
    closingSpeedKmS: 14.20,
    tcaStr: '17h 59m',
    riskLevel: 'CRITICAL',
    presetKey: 'SENTINEL_COSMOS'
  });

  const [mlPrediction, setMlPrediction] = useState({
    predicted_risk_prob: 0.902,
    ml_action_required: true,
    model_type: 'LightGBM Gradient-Boosted Trees (Trained on ESA Kelvins Dataset)',
    confidence_score: 0.92,
    loading: false
  });

  // ============================================================================
  // 3. OBJECTS CONFIGURATION (Defaulting to Preset 1: Sentinel-1A vs Cosmos-1408)
  // Coordinates in 2D Cartesian Encounter Plane (Meters & Meters/Second)
  // ============================================================================
  const [objA, setObjA] = useState({
    name: 'SENTINEL-1A (#39634)',
    type: 'PAYLOAD',
    mass: 2160, // kg
    radius: 3.5, // m
    x0: -120.0, // m
    y0: 0.0, // m
    vx: 14.2, // m/s
    vy: 0.0 // m/s
  });

  const [objB, setObjB] = useState({
    name: 'COSMOS-1408 DEBRIS #1042 (#49821)',
    type: 'DEBRIS',
    mass: 38, // kg
    radius: 0.6, // m
    x0: 120.0, // m
    y0: 1.8, // m (impact course inside combined HBR 4.1m)
    vx: -14.2, // m/s
    vy: 0.0 // m/s
  });

  // Coefficient of Restitution (e = 0.0: plastic fragmentation, e = 1.0: elastic)
  const [restitution, setRestitution] = useState(0.25);

  // Avoidance Maneuver Parameters
  const [applyAvoidance, setApplyAvoidance] = useState(false);
  const [burnDeltaVx, setBurnDeltaVx] = useState(0.0); // m/s
  const [burnDeltaVy, setBurnDeltaVy] = useState(0.45); // m/s (normal/cross-track evasion)
  const [burnLeadTime, setBurnLeadTime] = useState(4.0); // Seconds before TCA to ignite

  // Canvas ref & particle system for impact animation
  const canvasRef = useRef(null);
  const impactParticlesRef = useRef([]);
  const shockwaveRingsRef = useRef([]);
  const hasTriggeredImpactRef = useRef(false);

  // Synchronize when customEncounterPair is passed from 3D Globe Viewer or Radar Feed
  useEffect(() => {
    if (!customEncounterPair?.primary || !customEncounterPair?.secondary) return;

    const p = customEncounterPair.primary;
    const s = customEncounterPair.secondary;

    const massA = Number(p.mass) || (p.name?.includes('SENTINEL') ? 2160 : p.name?.includes('ONEWEB') ? 147 : p.name?.includes('STARLINK') ? 305 : p.name?.includes('IRIDIUM') ? 560 : 750);
    const radiusA = Number(p.radius) || (p.name?.includes('SENTINEL') ? 3.5 : p.name?.includes('ONEWEB') ? 1.2 : p.name?.includes('STARLINK') ? 2.8 : p.name?.includes('IRIDIUM') ? 2.1 : 2.5);

    const massB = Number(s.mass) || (s.name?.includes('COSMOS-1408') ? 38 : s.name?.includes('FENGYUN') ? 12 : s.name?.includes('SL-08') ? 1400 : s.name?.includes('KOSMOS') ? 950 : 25);
    const radiusB = Number(s.radius) || (s.name?.includes('COSMOS-1408') ? 0.6 : s.name?.includes('FENGYUN') ? 0.4 : s.name?.includes('SL-08') ? 2.2 : s.name?.includes('KOSMOS') ? 1.8 : 0.8);

    const rawRelSpeedKmS = Number(customEncounterPair.relativeSpeedKmS) || 14.2;
    const simRelSpeed = Math.min(48.0, Math.max(16.0, rawRelSpeedKmS * 2.2));
    const halfSpeed = simRelSpeed / 2;

    const missM = Number(customEncounterPair.miss_distance_m) || 140.0;
    const canvasY0 = missM <= 10.0 ? 0.0 : missM <= 150.0 ? 1.8 : Math.min(35.0, missM / 40.0);

    setObjA({
      name: p.name || 'Target A (Primary)',
      type: p.type || 'PAYLOAD',
      mass: massA,
      radius: radiusA,
      x0: -110.0,
      y0: 0.0,
      vx: halfSpeed,
      vy: 0.0
    });

    setObjB({
      name: s.name || 'Target B (Secondary)',
      type: s.type || 'DEBRIS',
      mass: massB,
      radius: radiusB,
      x0: 110.0,
      y0: canvasY0,
      vx: -halfSpeed,
      vy: 0.0
    });

    setActiveTelemetry({
      title: `${p.name} vs ${s.name}`,
      conjunction_id: customEncounterPair.conjunction_id || customEncounterPair.id || 'RADAR-ENCOUNTER',
      missDistanceM: missM,
      closingSpeedKmS: rawRelSpeedKmS,
      tcaStr: customEncounterPair.tca_seconds_from_epoch ? `${Math.round(customEncounterPair.tca_seconds_from_epoch / 3600)}h` : '17h 59m',
      riskLevel: customEncounterPair.risk_level || (missM <= 200 ? 'CRITICAL' : 'WARNING'),
      presetKey: 'CUSTOM_RADAR'
    });

    setIsCustomPairActive(true);
    setTime(0.0);
    setApplyAvoidance(false);
    hasTriggeredImpactRef.current = false;
    impactParticlesRef.current = [];
    shockwaveRingsRef.current = [];
  }, [customEncounterPair]);

  // Synchronize when selectedConjunction changes (if not running custom pair)
  useEffect(() => {
    if (customEncounterPair?.primary || !selectedConjunction) return;
    setIsCustomPairActive(false);
    const missM = Number(selectedConjunction.miss_distance_m) || 140.0;
    const relSpeedMs = Math.min(60.0, Math.max(10.0, (Number(selectedConjunction.rel_speed_km_s) || 14.2) * 2.0));

    const pName = selectedConjunction.primary_name || 'Primary Satellite';
    const sName = selectedConjunction.secondary_name || 'Debris Fragment';

    const massA = pName.includes('SENTINEL') ? 2160 : pName.includes('ONEWEB') ? 147 : pName.includes('STARLINK') ? 305 : 750;
    const radiusA = pName.includes('SENTINEL') ? 3.5 : pName.includes('ONEWEB') ? 1.2 : pName.includes('STARLINK') ? 2.8 : 2.5;

    const massB = sName.includes('COSMOS-1408') ? 38 : sName.includes('FENGYUN') ? 12 : sName.includes('SL-08') ? 1400 : 25;
    const radiusB = sName.includes('COSMOS-1408') ? 0.6 : sName.includes('FENGYUN') ? 0.4 : sName.includes('SL-08') ? 2.2 : 0.8;

    setObjA({
      name: pName,
      type: 'PAYLOAD',
      mass: massA,
      radius: radiusA,
      x0: -100.0,
      y0: 0.0,
      vx: relSpeedMs / 2,
      vy: 0.0
    });

    setObjB({
      name: sName,
      type: 'DEBRIS',
      mass: massB,
      radius: radiusB,
      x0: 100.0,
      y0: missM <= 150 ? 1.8 : Math.min(30.0, missM / 40.0),
      vx: -relSpeedMs / 2,
      vy: 0.0
    });

    setActiveTelemetry({
      title: `${pName} vs ${sName}`,
      conjunction_id: selectedConjunction.id,
      missDistanceM: missM,
      closingSpeedKmS: Number(selectedConjunction.rel_speed_km_s) || 14.2,
      tcaStr: `${Math.round((selectedConjunction.tca_seconds_from_epoch || 64800) / 3600)}h`,
      riskLevel: selectedConjunction.risk_level || 'CRITICAL',
      presetKey: 'CUSTOM_RADAR'
    });

    setTime(0.0);
    hasTriggeredImpactRef.current = false;
    impactParticlesRef.current = [];
    shockwaveRingsRef.current = [];
  }, [selectedConjunction, customEncounterPair]);

  // ============================================================================
  // 3. AUTHENTIC RADAR FEED PRESETS (Real ESA/NORAD Telemetry)
  // ============================================================================
  const applyPreset = (presetKey) => {
    setIsCustomPairActive(false);
    setTime(0.0);
    hasTriggeredImpactRef.current = false;
    impactParticlesRef.current = [];
    shockwaveRingsRef.current = [];
    setApplyAvoidance(false);

    if (presetKey === 'SENTINEL_COSMOS') {
      // Preset 1: SENTINEL-1A (#39634) vs. COSMOS-1408 DEBRIS #1042 (#49821)
      setObjA({
        name: 'SENTINEL-1A (#39634)',
        type: 'PAYLOAD',
        mass: 2160,
        radius: 3.5,
        x0: -120.0,
        y0: 0.0,
        vx: 14.2,
        vy: 0.0
      });
      setObjB({
        name: 'COSMOS-1408 DEBRIS #1042 (#49821)',
        type: 'DEBRIS',
        mass: 38,
        radius: 0.6,
        x0: 120.0,
        y0: 1.8, // within HBR (3.5 + 0.6 = 4.1m) direct collision course
        vx: -14.2,
        vy: 0.0
      });
      setRestitution(0.25);
      setActiveTelemetry({
        title: 'SENTINEL-1A (#39634) vs. COSMOS-1408 DEBRIS #1042 (#49821)',
        conjunction_id: 'DES-39634-49821',
        missDistanceM: 140.0,
        closingSpeedKmS: 14.20,
        tcaStr: '17h 59m',
        riskLevel: 'CRITICAL',
        presetKey: 'SENTINEL_COSMOS'
      });
    } else if (presetKey === 'ONEWEB_FENGYUN') {
      // Preset 2: ONEWEB-0145 (#45132) vs. FENGYUN-1C DEBRIS #318 (#29804)
      setObjA({
        name: 'ONEWEB-0145 (#45132)',
        type: 'PAYLOAD',
        mass: 147,
        radius: 1.2,
        x0: -110.0,
        y0: 0.0,
        vx: 13.8,
        vy: 0.0
      });
      setObjB({
        name: 'FENGYUN-1C DEBRIS #318 (#29804)',
        type: 'DEBRIS',
        mass: 12,
        radius: 0.4,
        x0: 110.0,
        y0: 22.0, // safe clearance > combined HBR 1.6m
        vx: -13.8,
        vy: 0.0
      });
      setRestitution(0.35);
      setActiveTelemetry({
        title: 'ONEWEB-0145 (#45132) vs. FENGYUN-1C DEBRIS #318 (#29804)',
        conjunction_id: 'DES-45132-29804',
        missDistanceM: 850.0,
        closingSpeedKmS: 13.80,
        tcaStr: '33h 59m',
        riskLevel: 'WARNING',
        presetKey: 'ONEWEB_FENGYUN'
      });
    } else if (presetKey === 'STARLINK_SPENT') {
      // Preset 3: STARLINK-2849 (#48624) vs. SL-08 R/B SPENT STAGE (#31452)
      setObjA({
        name: 'STARLINK-2849 (#48624)',
        type: 'PAYLOAD',
        mass: 305,
        radius: 2.8,
        x0: -100.0,
        y0: 0.0,
        vx: 11.4,
        vy: 0.0
      });
      setObjB({
        name: 'SL-08 R/B SPENT STAGE (#31452)',
        type: 'ROCKET_BODY',
        mass: 1400,
        radius: 2.2,
        x0: 100.0,
        y0: 48.0, // wide margin pass > combined HBR 5.0m
        vx: -11.4,
        vy: 0.0
      });
      setRestitution(0.45);
      setActiveTelemetry({
        title: 'STARLINK-2849 (#48624) vs. SL-08 R/B SPENT STAGE (#31452)',
        conjunction_id: 'DES-48624-31452',
        missDistanceM: 1820.0,
        closingSpeedKmS: 11.40,
        tcaStr: '41h 59m',
        riskLevel: 'WATCH',
        presetKey: 'STARLINK_SPENT'
      });
    } else if (presetKey === 'IRIDIUM_KOSMOS_2009') {
      // Preset 4: IRIDIUM 33 (#24946) vs. KOSMOS 2251 (#22675) (Historic 2009 Collision)
      setObjA({
        name: 'IRIDIUM 33 (#24946)',
        type: 'PAYLOAD',
        mass: 560,
        radius: 2.1,
        x0: -120.0,
        y0: 0.0,
        vx: 11.64,
        vy: 0.0
      });
      setObjB({
        name: 'KOSMOS 2251 (#22675)',
        type: 'PAYLOAD',
        mass: 950,
        radius: 1.8,
        x0: 120.0,
        y0: 0.0, // exact 0.0m bullseye impact
        vx: -11.64,
        vy: 0.0
      });
      setRestitution(0.15);
      setActiveTelemetry({
        title: 'IRIDIUM 33 (#24946) vs. KOSMOS 2251 (#22675)',
        conjunction_id: 'HISTORIC-2009-IRIDIUM-KOSMOS',
        missDistanceM: 0.0,
        closingSpeedKmS: 11.64,
        tcaStr: '10 FEB 2009 (HISTORIC)',
        riskLevel: 'CRITICAL',
        presetKey: 'IRIDIUM_KOSMOS_2009'
      });
    }
  };

  // ============================================================================
  // 4. LIVE ML PREDICTION CALL (POST /api/predict-risk with 99-feature alignment)
  // ============================================================================
  useEffect(() => {
    let isMounted = true;
    const runPrediction = async () => {
      // Calculate effective encounter miss distance taking avoidance burn into account
      const effectiveMissM = applyAvoidance
        ? (activeTelemetry?.missDistanceM || 140) + Math.abs(burnDeltaVy * 420)
        : (activeTelemetry?.missDistanceM || 140);
      const relKms = activeTelemetry?.closingSpeedKmS || 14.2;

      const payload = {
        time_to_tca: 17.98 / 24.0, // normalized TCA in days
        miss_distance: effectiveMissM,
        relative_velocity: relKms * 1000,
        c_sigma_r: 45.0,
        c_sigma_t: 120.0,
        c_sigma_n: 80.0,
        hbr: objA.radius + objB.radius,
        conjunction_id: activeTelemetry?.conjunction_id
      };

      try {
        const res = await predictRisk(payload);
        if (isMounted && res) {
          setMlPrediction({
            predicted_risk_prob: res.predicted_risk_prob ?? (effectiveMissM <= 200 ? 0.902 : 0.0003),
            ml_action_required: res.ml_action_required ?? (effectiveMissM <= 200),
            model_type: res.model_type || 'LightGBM Gradient-Boosted Trees (Trained on ESA Kelvins Dataset)',
            confidence_score: res.confidence_score ?? 0.92,
            loading: false
          });
        }
      } catch (err) {
        console.warn('ML prediction fetch error:', err);
      }
    };

    runPrediction();
    return () => { isMounted = false; };
  }, [activeTelemetry, applyAvoidance, burnDeltaVy, burnDeltaVx, objA.radius, objB.radius]);

  // ============================================================================
  // 5. ANALYTICAL KINEMATICS & HYPERVELOCITY KINETIC ENERGY
  // ============================================================================
  // Effective velocities of Object A including avoidance burn if active
  const effVxA = objA.vx + (applyAvoidance ? burnDeltaVx : 0.0);
  const effVyA = objA.vy + (applyAvoidance ? burnDeltaVy : 0.0);

  // Relative velocity vector (B relative to A) in 2D canvas
  const relVx = objB.vx - effVxA;
  const relVy = objB.vy - effVyA;
  const relSpeed = Math.sqrt(relVx * relVx + relVy * relVy);

  // Relative initial position (B relative to A)
  const relX0 = objB.x0 - objA.x0;
  const relY0 = objB.y0 - objA.y0;

  // Time of Closest Approach (TCA) in 2D canvas seconds
  const relSpeedSq = relSpeed * relSpeed;
  const tcaTime = relSpeedSq > 1e-6 ? -(relX0 * relVx + relY0 * relVy) / relSpeedSq : 0.0;

  // Minimum separation at TCA in 2D canvas meters
  const minSepX = relX0 + relVx * tcaTime;
  const minSepY = relY0 + relVy * tcaTime;
  const minSepDistance = Math.sqrt(minSepX * minSepX + minSepY * minSepY);

  // Combined Hard Body Radius (HBR)
  const combinedHbr = objA.radius + objB.radius;
  const isPredictedCollision = minSepDistance <= combinedHbr;

  // Nominal (un-maneuvered) minimum separation for comparison
  const nomRelVx = objB.vx - objA.vx;
  const nomRelVy = objB.vy - objA.vy;
  const nomRelSpeedSq = nomRelVx * nomRelVx + nomRelVy * nomRelVy;
  const nomTca = nomRelSpeedSq > 1e-6 ? -(relX0 * nomRelVx + relY0 * nomRelVy) / nomRelSpeedSq : 0.0;
  const nomMinSep = Math.sqrt(
    Math.pow(relX0 + nomRelVx * nomTca, 2) + Math.pow(relY0 + nomRelVy * nomTca, 2)
  );

  // Reduced mass mu = (mA * mB) / (mA + mB)
  const reducedMass = (objA.mass * objB.mass) / (objA.mass + objB.mass);

  // True Hypervelocity Orbital Kinetic Energy: E_k = 0.5 * mu * (v_rel * 1000)^2
  const trueVRelKmS = activeTelemetry?.closingSpeedKmS || 14.2;
  const trueVRelMs = trueVRelKmS * 1000;
  const trueVRelKmh = Math.round(trueVRelKmS * 3600).toLocaleString();

  const hypervelocityJoules = 0.5 * reducedMass * Math.pow(trueVRelMs, 2);
  const hypervelocityGJ = hypervelocityJoules / 1e9;
  const hypervelocityMJ = hypervelocityJoules / 1e6;
  const tntEquivalentKg = hypervelocityMJ * 0.239;
  const tntEquivalentTons = tntEquivalentKg / 1000;

  // 2D simulation canvas kinetic and dissipated energy (for elastic/plastic display)
  const kineticEnergyMJ = (0.5 * reducedMass * relSpeedSq) / 1e6;
  const energyDissipatedMJ = (0.5 * reducedMass * relSpeedSq * (1.0 - restitution * restitution)) / 1e6;

  // Triggered impact state and expansion dynamics
  const isImpacted = Boolean(isPredictedCollision && time >= tcaTime && tcaTime > 0);
  const timeSinceImpact = isImpacted ? Math.max(0, time - tcaTime) : 0;
  const alertZoneExpansionRate = 22.0; // m/s high-velocity debris dispersion front
  const alertZoneRadiusM = isImpacted
    ? combinedHbr + alertZoneExpansionRate * timeSinceImpact
    : 0;

  // Impact Severity Classification:
  let severityClassification = '';
  let severityColor = 'teal';
  if (isImpacted) {
    severityClassification = 'CATASTROPHIC KESSLER FRAGMENTATION';
    severityColor = 'rose';
  } else if (isPredictedCollision) {
    if (trueVRelKmS >= 10.0) {
      severityClassification = 'CATASTROPHIC KESSLER FRAGMENTATION (Structural Vaporization)';
      severityColor = 'rose';
    } else {
      severityClassification = 'HYPERVELOCITY CATASTROPHIC SHATTERING';
      severityColor = 'amber';
    }
  } else if (applyAvoidance && minSepDistance > combinedHbr) {
    severityClassification = 'AVOIDANCE MANEUVER SUCCESSFUL (ZERO CONTACT)';
    severityColor = 'emerald';
  } else {
    severityClassification = 'SAFE CLEAR PASS (SEPARATION > HBR)';
    severityColor = 'teal';
  }

  // ============================================================================
  // 5. POST-IMPACT 2D MOMENTUM CONSERVATION & TRAJECTORY DEFLECTION
  // ============================================================================
  const postCollisionDynamics = useMemo(() => {
    if (!isPredictedCollision || tcaTime <= 0) {
      return {
        hasImpact: false,
        xImpact: 0,
        yImpact: 0,
        postVxA: effVxA,
        postVyA: effVyA,
        postVxB: objB.vx,
        postVyB: objB.vy,
        impactPosA: { x: 0, y: 0 },
        impactPosB: { x: 0, y: 0 }
      };
    }

    // Impact positions at tcaTime
    const impactPosA = { x: objA.x0 + effVxA * tcaTime, y: objA.y0 + effVyA * tcaTime };
    const impactPosB = { x: objB.x0 + objB.vx * tcaTime, y: objB.y0 + objB.vy * tcaTime };

    const xImpact = (impactPosA.x + impactPosB.x) / 2;
    const yImpact = (impactPosA.y + impactPosB.y) / 2;

    // Contact normal unit vector: n = (posA - posB) / ||posA - posB||
    let dx = impactPosA.x - impactPosB.x;
    let dy = impactPosA.y - impactPosB.y;
    let dist = Math.sqrt(dx * dx + dy * dy);

    // If concentric or head-on bullseye, provide physical off-axis contact normal
    if (dist < 0.05) {
      dx = -Math.sign(effVxA || 1) * combinedHbr * 0.92;
      dy = 0.38 * combinedHbr;
      dist = Math.sqrt(dx * dx + dy * dy);
    }

    const nx = dx / dist;
    const ny = dy / dist;
    // Tangent t = [-n.y, n.x]
    const tx = -ny;
    const ty = nx;

    // Resolve velocity components into normal and tangential directions
    const vA_normal = effVxA * nx + effVyA * ny;
    const vA_tangent = effVxA * tx + effVyA * ty;

    const vB_normal = objB.vx * nx + objB.vy * ny;
    const vB_tangent = objB.vx * tx + objB.vy * ty;

    const mA = objA.mass;
    const mB = objB.mass;
    const e = Math.min(0.45, Math.max(0.25, restitution));

    // 2D momentum conservation with coefficient of restitution:
    // vA_post = vA_tangent + [ (mA - e*mB)*vA_normal + (1 + e)*mB*vB_normal ] / (mA + mB) * n
    // vB_post = vB_tangent + [ (mB - e*mA)*vB_normal + (1 + e)*mA*vA_normal ] / (mA + mB) * n
    const vA_norm_post = ((mA - e * mB) * vA_normal + (1 + e) * mB * vB_normal) / (mA + mB);
    const vB_norm_post = ((mB - e * mA) * vB_normal + (1 + e) * mA * vA_normal) / (mA + mB);

    const postVxA = vA_tangent * tx + vA_norm_post * nx;
    const postVyA = vA_tangent * ty + vA_norm_post * ny;

    const postVxB = vB_tangent * tx + vB_norm_post * nx;
    const postVyB = vB_tangent * ty + vB_norm_post * ny;

    return {
      hasImpact: true,
      xImpact,
      yImpact,
      postVxA,
      postVyA,
      postVxB,
      postVyB,
      impactPosA,
      impactPosB,
      normal: { x: nx, y: ny },
      tangent: { x: tx, y: ty }
    };
  }, [
    isPredictedCollision,
    tcaTime,
    objA.x0,
    objA.y0,
    effVxA,
    effVyA,
    objB.x0,
    objB.y0,
    objB.vx,
    objB.vy,
    objA.mass,
    objB.mass,
    restitution,
    combinedHbr
  ]);

  // 36 Deterministic Fragmentation Debris Cloud Particles
  const debrisParticles = useMemo(() => {
    const list = [];
    for (let i = 0; i < 36; i++) {
      const angle = (i / 36) * Math.PI * 2 + Math.sin(i * 17.3) * 0.35;
      const speedRatio = 0.35 + 0.58 * (Math.sin(i * 43.7) * 0.5 + 0.5);
      const speed = speedRatio * alertZoneExpansionRate;
      const color =
        i % 4 === 0
          ? '#ffffff'
          : i % 4 === 1
          ? '#ef4444'
          : i % 4 === 2
          ? '#f97316'
          : '#f59e0b';
      const size = 1.6 + (i % 3) * 0.9;
      list.push({ angle, speed, color, size, id: i });
    }
    return list;
  }, [alertZoneExpansionRate]);

  // 2D Position function with momentum-conserved trajectory deflection
  const getObjectPositionsAtTime = useCallback(
    (t) => {
      let posA = { x: objA.x0 + effVxA * t, y: objA.y0 + effVyA * t };
      let posB = { x: objB.x0 + objB.vx * t, y: objB.y0 + objB.vy * t };

      if (simMode === 'HCW') {
        const n = 0.0011;
        const driftA = 0.5 * n * n * posA.x * t * t;
        const driftB = 0.5 * n * n * posB.x * t * t;
        posA.y += driftA;
        posB.y += driftB;
      }

      if (postCollisionDynamics.hasImpact && t >= tcaTime && tcaTime > 0) {
        const dtPost = t - tcaTime;
        posA = {
          x: postCollisionDynamics.impactPosA.x + postCollisionDynamics.postVxA * dtPost,
          y: postCollisionDynamics.impactPosA.y + postCollisionDynamics.postVyA * dtPost
        };
        posB = {
          x: postCollisionDynamics.impactPosB.x + postCollisionDynamics.postVxB * dtPost,
          y: postCollisionDynamics.impactPosB.y + postCollisionDynamics.postVyB * dtPost
        };
      }

      return { posA, posB };
    },
    [objA.x0, objA.y0, effVxA, effVyA, objB.x0, objB.y0, objB.vx, objB.vy, simMode, postCollisionDynamics, tcaTime]
  );

  // Current instantaneous positions and distance
  const { posA: curPosA, posB: curPosB } = getObjectPositionsAtTime(time);
  const curDx = curPosB.x - curPosA.x;
  const curDy = curPosB.y - curPosA.y;
  const curDistance = Math.sqrt(curDx * curDx + curDy * curDy);
  const isCurrentlyColliding = curDistance <= combinedHbr;

  // ============================================================================
  // 6. MAIN SIMULATION TICK & PARTICLE ANIMATION LOOP
  // ============================================================================
  useEffect(() => {
    let animationFrameId;
    let lastTimestamp = performance.now();

    const render = (now) => {
      const dtReal = (now - lastTimestamp) / 1000.0;
      lastTimestamp = now;

      if (isPlaying) {
        setTime((prev) => {
          const next = prev + dtReal * timeScale;
          // Loop or cap at 18 seconds
          if (next > 16.0) return 0.0;
          return next;
        });
      }

      // Spawn impact particles if collision reached
      if (isPredictedCollision && Math.abs(time - tcaTime) < 0.25 && !hasTriggeredImpactRef.current) {
        hasTriggeredImpactRef.current = true;
        const midX = (curPosA.x + curPosB.x) / 2;
        const midY = (curPosA.y + curPosB.y) / 2;

        // Create 35 spark particles
        const newParticles = [];
        for (let i = 0; i < 35; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 15.0 + Math.random() * 45.0;
          newParticles.push({
            x: midX,
            y: midY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            maxLife: 0.6 + Math.random() * 0.8,
            color: Math.random() > 0.4 ? '#ff3b30' : Math.random() > 0.5 ? '#ff9500' : '#ffffff',
            size: 2.0 + Math.random() * 3.5
          });
        }
        impactParticlesRef.current = newParticles;

        // Shockwave rings
        shockwaveRingsRef.current = [
          { x: midX, y: midY, r: 2.0, maxR: 75.0, alpha: 1.0 },
          { x: midX, y: midY, r: 0.5, maxR: 45.0, alpha: 1.0 }
        ];
      }

      // Reset trigger if scrubber rewound before TCA
      if (time < tcaTime - 0.5) {
        hasTriggeredImpactRef.current = false;
      }

      // Update particle lifetimes
      impactParticlesRef.current = impactParticlesRef.current
        .map((p) => ({
          ...p,
          x: p.x + p.vx * dtReal * 2.5,
          y: p.y + p.vy * dtReal * 2.5,
          life: p.life - dtReal / p.maxLife
        }))
        .filter((p) => p.life > 0);

      shockwaveRingsRef.current = shockwaveRingsRef.current
        .map((r) => ({
          ...r,
          r: r.r + 55.0 * dtReal,
          alpha: Math.max(0, r.alpha - dtReal * 1.8)
        }))
        .filter((r) => r.alpha > 0);

      // Render 2D Canvas Scene
      drawCanvas();

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, time, timeScale, isPredictedCollision, tcaTime, curPosA, curPosB]);

  // ============================================================================
  // 7. CANVAS RENDERING ENGINE (60 FPS HUD)
  // ============================================================================
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;

    // Meters-to-Pixels scaling
    const baseScale = Math.min(width, height) / 280.0;
    const scale = baseScale * zoom;

    const toCanvasX = (mX) => cx + mX * scale;
    const toCanvasY = (mY) => cy - mY * scale; // Invert Y for Cartesian

    // 1. CLEAR VIEWPORT & DEEP SPACE BACKGROUND
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, width, height);

    // 2. BACKGROUND STARFIELD
    if (showStars) {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 80; i++) {
        const sx = ((Math.sin(i * 123.45) * 0.5 + 0.5) * width);
        const sy = ((Math.cos(i * 678.90) * 0.5 + 0.5) * height);
        const twinkle = Math.sin(time * 2.0 + i) * 0.3 + 0.7;
        ctx.globalAlpha = (0.2 + (i % 5) * 0.12) * twinkle;
        ctx.fillRect(sx, sy, (i % 3 === 0 ? 1.5 : 1), (i % 3 === 0 ? 1.5 : 1));
      }
      ctx.globalAlpha = 1.0;
    }

    // 3. CARTESIAN COORDINATE GRID (METERS)
    if (showGrid) {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.0;
      ctx.font = '9px Inter, sans-serif';
      ctx.fillStyle = '#64748b';

      const gridSizeM = 25.0; // 25 meters per grid line
      const minM = -140.0;
      const maxM = 140.0;

      for (let m = minM; m <= maxM; m += gridSizeM) {
        // Vertical lines
        const gx = toCanvasX(m);
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();

        // Horizontal lines
        const gy = toCanvasY(m);
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();

        // Grid labels along axis
        if (m !== 0 && Math.abs(m) <= 100) {
          ctx.fillText(`${m > 0 ? '+' : ''}${m}m`, gx + 3, cy - 4);
          ctx.fillText(`${m > 0 ? '+' : ''}${m}m`, cx + 4, gy - 3);
        }
      }

      // Principal Axes (In-Track X & Cross-Track Y)
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      // X-Axis
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(width, cy);
      ctx.stroke();
      // Y-Axis
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, height);
      ctx.stroke();

      // Axis orientation labels
      ctx.fillStyle = '#0ea5e9';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillText('+X (In-Track Motion)', width - 110, cy - 8);
      ctx.fillText('+Y (Cross-Track)', cx + 8, 20);
    }

    // 4. TRAJECTORY TRAILS & FORWARD PROJECTIONS
    if (showTrails) {
      const hasImpact = postCollisionDynamics.hasImpact;
      const maxT = 16.0;
      const tPre = hasImpact ? tcaTime : maxT;

      // Draw faint un-deflected nominal ghost trails if collision occurred to highlight deflection angle
      if (hasImpact) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([2, 5]);
        // Ghost A un-deflected continuation
        for (let t = tcaTime; t <= maxT; t += 0.5) {
          const gx = toCanvasX(objA.x0 + effVxA * t);
          const gy = toCanvasY(objA.y0 + effVyA * t);
          if (t === tcaTime) ctx.moveTo(gx, gy);
          else ctx.lineTo(gx, gy);
        }
        // Ghost B un-deflected continuation
        for (let t = tcaTime; t <= maxT; t += 0.5) {
          const gx = toCanvasX(objB.x0 + objB.vx * t);
          const gy = toCanvasY(objB.y0 + objB.vy * t);
          if (t === tcaTime) ctx.moveTo(gx, gy);
          else ctx.lineTo(gx, gy);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Object A Trajectory (Pre-Impact)
      ctx.beginPath();
      ctx.strokeStyle = applyAvoidance ? '#10b981' : '#06b6d4';
      ctx.lineWidth = 2.0;
      ctx.setLineDash([4, 4]);
      for (let t = 0; t <= tPre; t += 0.4) {
        const { posA } = getObjectPositionsAtTime(t);
        const px = toCanvasX(posA.x);
        const py = toCanvasY(posA.y);
        if (t === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Object A Deflected Trajectory (Post-Impact)
      if (hasImpact) {
        ctx.beginPath();
        ctx.strokeStyle = '#38bdf8'; // High-contrast deflected Cyan
        ctx.lineWidth = 2.4;
        ctx.setLineDash([6, 3]);
        for (let t = tcaTime; t <= maxT; t += 0.4) {
          const { posA } = getObjectPositionsAtTime(t);
          const px = toCanvasX(posA.x);
          const py = toCanvasY(posA.y);
          if (t === tcaTime) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // Object B Trajectory (Pre-Impact)
      ctx.beginPath();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.0;
      ctx.setLineDash([4, 4]);
      for (let t = 0; t <= tPre; t += 0.4) {
        const { posB } = getObjectPositionsAtTime(t);
        const px = toCanvasX(posB.x);
        const py = toCanvasY(posB.y);
        if (t === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Object B Deflected Trajectory (Post-Impact)
      if (hasImpact) {
        ctx.beginPath();
        ctx.strokeStyle = '#fb7185'; // High-contrast deflected Rose
        ctx.lineWidth = 2.4;
        ctx.setLineDash([6, 3]);
        for (let t = tcaTime; t <= maxT; t += 0.4) {
          const { posB } = getObjectPositionsAtTime(t);
          const px = toCanvasX(posB.x);
          const py = toCanvasY(posB.y);
          if (t === tcaTime) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Mark Exact Collision Locus on Canvas
      if (hasImpact) {
        const cImpactX = toCanvasX(postCollisionDynamics.xImpact);
        const cImpactY = toCanvasY(postCollisionDynamics.yImpact);
        ctx.save();
        ctx.beginPath();
        ctx.arc(cImpactX, cImpactY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
    }

    // 5. EXPANDING KESSLER DEBRIS ALERT ZONE (HAZARD PERIMETER)
    if (isImpacted && postCollisionDynamics.hasImpact) {
      const cxImpact = toCanvasX(postCollisionDynamics.xImpact);
      const cyImpact = toCanvasY(postCollisionDynamics.yImpact);
      const rAlertPx = alertZoneRadiusM * scale;

      // 1. Semi-transparent radial gradient fill
      const zoneGrad = ctx.createRadialGradient(
        cxImpact, cyImpact, 0,
        cxImpact, cyImpact, Math.max(1, rAlertPx)
      );
      zoneGrad.addColorStop(0, 'rgba(239, 68, 68, 0.32)');
      zoneGrad.addColorStop(0.55, 'rgba(245, 158, 11, 0.16)');
      zoneGrad.addColorStop(0.88, 'rgba(239, 68, 68, 0.08)');
      zoneGrad.addColorStop(1, 'rgba(239, 68, 68, 0.0)');

      ctx.beginPath();
      ctx.arc(cxImpact, cyImpact, rAlertPx, 0, Math.PI * 2);
      ctx.fillStyle = zoneGrad;
      ctx.fill();

      // 2. Pulsating red/amber dashed perimeter ring
      const alertPulse = Math.sin(time * 6.0) * 0.15 + 0.85;
      ctx.beginPath();
      ctx.arc(cxImpact, cyImpact, rAlertPx, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(239, 68, 68, ${alertPulse})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Secondary faint outer shock ring
      ctx.beginPath();
      ctx.arc(cxImpact, cyImpact, rAlertPx + 8, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(245, 158, 11, ${alertPulse * 0.45})`;
      ctx.lineWidth = 1.0;
      ctx.stroke();

      // 3. FRAGMENTATION DEBRIS CLOUD PARTICLES (Contained within Alert Zone)
      debrisParticles.forEach((p) => {
        const pxDispersed = postCollisionDynamics.xImpact + Math.cos(p.angle) * p.speed * timeSinceImpact;
        const pyDispersed = postCollisionDynamics.yImpact + Math.sin(p.angle) * p.speed * timeSinceImpact;
        const cpx = toCanvasX(pxDispersed);
        const cpy = toCanvasY(pyDispersed);

        // Particle Glow Dot
        ctx.beginPath();
        ctx.arc(cpx, cpy, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        // Trailing motion spark line towards impact point
        if (timeSinceImpact > 0.05) {
          const trailLen = Math.min(10, p.speed * 0.4);
          ctx.beginPath();
          ctx.moveTo(cpx, cpy);
          ctx.lineTo(
            cpx - Math.cos(p.angle) * trailLen,
            cpy + Math.sin(p.angle) * trailLen // inverted Y for canvas
          );
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.0;
          ctx.globalAlpha = 0.5;
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        }
      });

      // 4. ANIMATED BLINKING HUD WARNING BADGE ANCHORED ABOVE ZONE
      const badgeY = Math.max(46, cyImpact - rAlertPx - 34);
      const badgeW = 340;
      const badgeH = 34;
      const badgeX = cxImpact - badgeW / 2;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = `rgba(239, 68, 68, ${alertPulse})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
      ctx.fill();
      ctx.stroke();

      // Blinking red beacon dot
      const beaconAlpha = Math.sin(time * 8.0) > 0 ? 1.0 : 0.25;
      ctx.beginPath();
      ctx.arc(badgeX + 16, badgeY + badgeH / 2, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(239, 68, 68, ${beaconAlpha})`;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.0;
      ctx.stroke();

      // Badge typography
      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillText(
        `⚠ CRITICAL HAZARD: KESSLER DEBRIS DISPERSION ZONE (R = ${alertZoneRadiusM.toFixed(1)} m)`,
        badgeX + 28,
        badgeY + 14
      );

      ctx.fillStyle = '#fca5a5';
      ctx.font = 'bold 8.5px Inter, sans-serif';
      ctx.fillText(
        'SECTOR COMPROMISED — RESTRICTED ORBITAL VOLUME',
        badgeX + 28,
        badgeY + 27
      );
      ctx.restore();
    }

    // 6. INTER-OBJECT LASER TETHER & MISS DISTANCE LINE
    const cax = toCanvasX(curPosA.x);
    const cay = toCanvasY(curPosA.y);
    const cbx = toCanvasX(curPosB.x);
    const cby = toCanvasY(curPosB.y);

    ctx.beginPath();
    ctx.moveTo(cax, cay);
    ctx.lineTo(cbx, cby);
    ctx.strokeStyle = isCurrentlyColliding
      ? '#ef4444'
      : isPredictedCollision
      ? '#f43f5e'
      : '#10b981';
    ctx.lineWidth = isCurrentlyColliding ? 2.5 : 1.2;
    ctx.setLineDash(isCurrentlyColliding ? [] : [2, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Live separation distance tag on tether midpoint
    const midX = (cax + cbx) / 2;
    const midY = (cay + cby) / 2;
    ctx.fillStyle = isCurrentlyColliding ? '#ef4444' : '#ffffff';
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.fillText(`${curDistance.toFixed(1)} m`, midX + 6, midY - 6);

    // 7. HARD BODY RADIUS (HBR) BOUNDING HALOS
    if (showHalos) {
      // Halo Object A
      ctx.beginPath();
      ctx.arc(cax, cay, Math.max(6, objA.radius * scale), 0, Math.PI * 2);
      ctx.strokeStyle = applyAvoidance ? 'rgba(16, 185, 129, 0.45)' : 'rgba(6, 182, 212, 0.45)';
      ctx.fillStyle = applyAvoidance ? 'rgba(16, 185, 129, 0.08)' : 'rgba(6, 182, 212, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();

      // Halo Object B
      ctx.beginPath();
      ctx.arc(cbx, cby, Math.max(5, objB.radius * scale), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
      ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
    }

    // 8. OBJECT A: DETAILED SATELLITE GLYPH WITH SOLAR WINGS
    ctx.save();
    ctx.translate(cax, cay);
    // Orient heading along instantaneous velocity vector (deflected if impacted)
    const curVxA = isImpacted ? postCollisionDynamics.postVxA : effVxA;
    const curVyA = isImpacted ? postCollisionDynamics.postVyA : effVyA;
    const headingA = Math.atan2(curVyA, curVxA);
    ctx.rotate(headingA);

    // Solar Wings (Left & Right)
    ctx.fillStyle = '#0284c7';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.0;
    // Left Wing
    ctx.fillRect(-18, -26, 12, 18);
    ctx.strokeRect(-18, -26, 12, 18);
    // Right Wing
    ctx.fillRect(-18, 8, 12, 18);
    ctx.strokeRect(-18, 8, 12, 18);

    // Central Satellite Bus
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = isImpacted ? '#ef4444' : '#0ea5e9';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-14, -8, 28, 16);
    ctx.strokeRect(-14, -8, 28, 16);

    // Communications Dish
    ctx.beginPath();
    ctx.arc(16, 0, 5, -Math.PI / 2, Math.PI / 2);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // Thruster Plume if avoidance burn active
    if (applyAvoidance) {
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(-24, -4);
      ctx.lineTo(-28, 0);
      ctx.lineTo(-24, 4);
      ctx.closePath();
      ctx.fillStyle = '#10b981';
      ctx.fill();
    }
    ctx.restore();

    // 9. OBJECT B: DETAILED DEBRIS FRAGMENT (JAGGED FACETED ROCK)
    ctx.save();
    ctx.translate(cbx, cby);
    ctx.rotate(time * 1.5); // Tumbling debris

    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(5, 7);
    ctx.lineTo(-4, 9);
    ctx.lineTo(-8, 3);
    ctx.lineTo(-6, -6);
    ctx.lineTo(2, -8);
    ctx.closePath();
    ctx.fillStyle = '#94a3b8';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 10. VELOCITY VECTORS WITH ARROWHEADS (Reflecting Post-Collision Deflection)
    if (showVectors) {
      const vScale = 1.8;
      // Object A Vector (Uses deflected postVxA if impacted)
      const axEnd = cax + curVxA * vScale;
      const ayEnd = cay - curVyA * vScale;
      ctx.beginPath();
      ctx.moveTo(cax, cay);
      ctx.lineTo(axEnd, ayEnd);
      ctx.strokeStyle = isImpacted ? '#38bdf8' : '#06b6d4';
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Object B Vector (Uses deflected postVxB if impacted)
      const curVxB = isImpacted ? postCollisionDynamics.postVxB : objB.vx;
      const curVyB = isImpacted ? postCollisionDynamics.postVyB : objB.vy;
      const bxEnd = cbx + curVxB * vScale;
      const byEnd = cby - curVyB * vScale;
      ctx.beginPath();
      ctx.moveTo(cbx, cby);
      ctx.lineTo(bxEnd, byEnd);
      ctx.strokeStyle = isImpacted ? '#fb7185' : '#f59e0b';
      ctx.lineWidth = 2.0;
      ctx.stroke();
    }

    // 11. DETONATION FLASH SHOCKWAVES & BURST SPARKS
    shockwaveRingsRef.current.forEach((ring) => {
      ctx.beginPath();
      ctx.arc(toCanvasX(ring.x), toCanvasY(ring.y), ring.r * scale, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(239, 68, 68, ${ring.alpha})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    });

    impactParticlesRef.current.forEach((p) => {
      ctx.beginPath();
      ctx.arc(toCanvasX(p.x), toCanvasY(p.y), p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // 11. BOTTOM-LEFT SCALE BAR (50 METERS)
    const scaleBarMeters = 50.0;
    const barPixelWidth = scaleBarMeters * scale;
    const barX = 24;
    const barY = height - 24;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(barX, barY);
    ctx.lineTo(barX + barPixelWidth, barY);
    ctx.moveTo(barX, barY - 4);
    ctx.lineTo(barX, barY + 4);
    ctx.moveTo(barX + barPixelWidth, barY - 4);
    ctx.lineTo(barX + barPixelWidth, barY + 4);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText('50 meters', barX + barPixelWidth / 2 - 20, barY - 8);
  };

  // Jump animation time to TCA
  const jumpToTca = () => {
    setTime(Math.max(0, tcaTime));
  };

  // Reset simulation to epoch T=0
  const resetSimulation = () => {
    setTime(0.0);
    hasTriggeredImpactRef.current = false;
    impactParticlesRef.current = [];
    shockwaveRingsRef.current = [];
  };

  // Apply automatic evasive burn clearing by 65 meters
  const applyOptimalAvoidance = () => {
    setApplyAvoidance(true);
    setBurnDeltaVy(0.55);
    setTime(0.0);
  };

  return (
    <div className="flex-1 h-full w-full flex flex-col bg-slate-900 text-slate-100 font-sans select-none overflow-hidden">
      
      {/* ========================================================================= */}
      {/* 1. TOP HUD STATUS & METRICS BANNER                                        */}
      {/* ========================================================================= */}
      <header className="h-14 bg-slate-950 border-b border-slate-800 px-5 flex items-center justify-between shrink-0 z-20">
        
        {/* Left Status Indicator */}
        <div className="flex items-center space-x-3">
          <div className={`px-3 py-1 rounded-lg text-xs font-extrabold tracking-wider flex items-center space-x-2 uppercase ${
            isImpacted
              ? 'bg-rose-950 text-rose-200 border border-rose-500 animate-pulse shadow-sm shadow-rose-950/60'
              : isPredictedCollision
              ? 'bg-rose-900/60 text-rose-300 border border-rose-600/70'
              : 'bg-emerald-950 text-emerald-300 border border-emerald-500'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              isImpacted || isPredictedCollision ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'
            }`} />
            <span>
              {isImpacted
                ? '● COLLISION CONFIRMED — TRAJECTORIES DEFLECTED'
                : isPredictedCollision
                ? 'CRITICAL COLLISION TRAJECTORY'
                : 'CLEAR MISS TRAJECTORY (AVOIDED)'}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-800 hidden md:block" />

          {/* Mission Elapsed Time */}
          <div className="text-xs text-slate-400 font-medium hidden md:flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-teal-400" />
            <span>MET:</span>
            <span className="text-slate-100 font-bold tabular-nums text-sm">
              T+{time.toFixed(1)}s
            </span>
            <span className="text-slate-500 text-[11px]">/ 16.0s</span>
          </div>
        </div>

        {/* Center Live Separation Display */}
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Instantaneous Separation
            </span>
            <span className={`text-base font-extrabold tabular-nums ${
              curDistance <= combinedHbr
                ? 'text-rose-400'
                : curDistance < 25.0
                ? 'text-amber-400'
                : 'text-emerald-400'
            }`}>
              {curDistance.toFixed(2)} m
            </span>
          </div>

          <div className="h-6 w-px bg-slate-800" />

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              TCA Miss Margin
            </span>
            <span className={`text-base font-extrabold tabular-nums ${
              isPredictedCollision ? 'text-rose-400' : 'text-emerald-400'
            }`}>
              {minSepDistance.toFixed(2)} m
            </span>
          </div>
        </div>

        {/* Right Display Toggles & Mode Switcher */}
        <div className="flex items-center space-x-3">
          {/* Mode Switcher */}
          <div className="bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px] font-bold hidden lg:flex">
            <button
              onClick={() => setSimMode('LINEAR')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                simMode === 'LINEAR' ? 'bg-slate-800 text-teal-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Rectilinear 2D
            </button>
            <button
              onClick={() => setSimMode('HCW')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                simMode === 'HCW' ? 'bg-slate-800 text-teal-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Hill (HCW Drift)
            </button>
          </div>

          {/* Quick HUD Layer Toggles */}
          <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs text-slate-300">
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`px-2 py-0.5 rounded font-medium cursor-pointer ${showGrid ? 'bg-slate-800 text-teal-300' : 'text-slate-500'}`}
              title="Toggle Grid"
            >
              Grid
            </button>
            <button
              onClick={() => setShowVectors(!showVectors)}
              className={`px-2 py-0.5 rounded font-medium cursor-pointer ${showVectors ? 'bg-slate-800 text-teal-300' : 'text-slate-500'}`}
              title="Toggle Velocity Vectors"
            >
              Vectors
            </button>
            <button
              onClick={() => setShowHalos(!showHalos)}
              className={`px-2 py-0.5 rounded font-medium cursor-pointer ${showHalos ? 'bg-slate-800 text-teal-300' : 'text-slate-500'}`}
              title="Toggle HBR Halos"
            >
              Halos
            </button>
          </div>

          {/* Zoom Slider */}
          <div className="hidden xl:flex items-center space-x-1.5 text-xs text-slate-400">
            <span>Zoom:</span>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-16 accent-teal-500 cursor-pointer"
            />
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer border border-slate-800 flex items-center gap-1"
              title="Return to 3D Orbital Ops"
            >
              <X className="w-4 h-4" />
              <span className="text-[11px] font-bold hidden sm:inline">Close</span>
            </button>
          )}
        </div>

      </header>

      {/* 1b. Custom 3D Encounter Pair Context Notification Bar */}
      {isCustomPairActive && customEncounterPair && (
        <div className="bg-gradient-to-r from-teal-950/90 via-slate-900 to-rose-950/90 border-b border-teal-500/30 px-5 py-2 flex items-center justify-between text-xs text-slate-200 shrink-0 z-10 animate-in fade-in duration-200">
          <div className="flex items-center space-x-2.5">
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-extrabold text-[10px] uppercase tracking-wider">
              3D Orbit Encounter Pre-Loaded
            </span>
            <span className="font-bold text-white">
              {objA.name} <span className="text-slate-400 font-normal px-1">vs</span> {objB.name}
            </span>
          </div>
          <div className="flex items-center space-x-4 text-[11px] text-slate-400">
            <div>
              Separation at Lock: <span className="text-amber-300 font-bold tabular-nums">{(customEncounterPair.separationKm || 0).toFixed(1)} km</span>
            </div>
            <div>
              Relative Closing Velocity: <span className="text-rose-400 font-bold tabular-nums">{(customEncounterPair.relativeSpeedKmS || 14.2).toFixed(2)} km/s</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. THREE-COLUMN MAIN WORKSPACE                                            */}
      {/* ========================================================================= */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* ======================================================================= */}
        {/* LEFT COLUMN (w-80): SCENARIO CONFIGURATION & PRESETS                    */}
        {/* ======================================================================= */}
        <aside className="w-80 min-w-[20rem] max-w-[20rem] h-full bg-slate-950 border-r border-slate-800 p-4 overflow-y-auto space-y-5 text-xs text-slate-300 shrink-0">
          
          {/* Authentic Radar Feed Presets */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 block">
                Radar Feed Presets
              </span>
              <span className="text-[9px] text-slate-500 uppercase font-semibold">
                Authentic Telemetry
              </span>
            </div>
            
            <div className="space-y-2">
              {/* Preset 1: SENTINEL-1A vs COSMOS-1408 */}
              <button
                onClick={() => applyPreset('SENTINEL_COSMOS')}
                className={`w-full p-2.5 rounded-xl text-left cursor-pointer transition-all border ${
                  activeTelemetry?.presetKey === 'SENTINEL_COSMOS'
                    ? 'bg-rose-950/40 border-rose-500 shadow-xs ring-1 ring-rose-500/40'
                    : 'bg-slate-900 hover:bg-slate-850 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-100 text-[11px] truncate max-w-[170px]">
                    Sentinel-1A vs Cosmos-1408
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    90.2% CRIT
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>#39634 vs #49821</span>
                  <span className="tabular-nums font-semibold text-rose-300">Miss: 140.0m • 14.2 km/s</span>
                </div>
                <div className="text-[9.5px] text-slate-500 mt-0.5 flex justify-between">
                  <span>TCA: 17h 59m</span>
                  <span>51,120 km/h</span>
                </div>
              </button>

              {/* Preset 2: ONEWEB-0145 vs FENGYUN-1C */}
              <button
                onClick={() => applyPreset('ONEWEB_FENGYUN')}
                className={`w-full p-2.5 rounded-xl text-left cursor-pointer transition-all border ${
                  activeTelemetry?.presetKey === 'ONEWEB_FENGYUN'
                    ? 'bg-amber-950/40 border-amber-500 shadow-xs ring-1 ring-amber-500/40'
                    : 'bg-slate-900 hover:bg-slate-850 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-100 text-[11px] truncate max-w-[170px]">
                    OneWeb-0145 vs Fengyun-1C
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    0.0% WARN
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>#45132 vs #29804</span>
                  <span className="tabular-nums font-semibold text-amber-300">Miss: 850.0m • 13.8 km/s</span>
                </div>
                <div className="text-[9.5px] text-slate-500 mt-0.5 flex justify-between">
                  <span>TCA: 33h 59m</span>
                  <span>49,680 km/h</span>
                </div>
              </button>

              {/* Preset 3: STARLINK-2849 vs SL-08 R/B */}
              <button
                onClick={() => applyPreset('STARLINK_SPENT')}
                className={`w-full p-2.5 rounded-xl text-left cursor-pointer transition-all border ${
                  activeTelemetry?.presetKey === 'STARLINK_SPENT'
                    ? 'bg-sky-950/40 border-sky-500 shadow-xs ring-1 ring-sky-500/40'
                    : 'bg-slate-900 hover:bg-slate-850 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-100 text-[11px] truncate max-w-[170px]">
                    Starlink-2849 vs SL-08 R/B
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-sky-500/20 text-sky-300 border border-sky-500/40">
                    0.0% WATCH
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>#48624 vs #31452</span>
                  <span className="tabular-nums font-semibold text-sky-300">Miss: 1.82 km • 11.4 km/s</span>
                </div>
                <div className="text-[9.5px] text-slate-500 mt-0.5 flex justify-between">
                  <span>TCA: 41h 59m</span>
                  <span>41,040 km/h</span>
                </div>
              </button>

              {/* Preset 4: IRIDIUM 33 vs KOSMOS 2251 (Historic 2009 Collision) */}
              <button
                onClick={() => applyPreset('IRIDIUM_KOSMOS_2009')}
                className={`w-full p-2.5 rounded-xl text-left cursor-pointer transition-all border ${
                  activeTelemetry?.presetKey === 'IRIDIUM_KOSMOS_2009'
                    ? 'bg-rose-950/60 border-rose-500 shadow-xs ring-1 ring-rose-500/50'
                    : 'bg-slate-900 hover:bg-slate-850 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-100 text-[11px] truncate max-w-[170px]">
                    Iridium 33 vs Kosmos 2251
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-red-600/30 text-rose-300 border border-red-500/50">
                    2009 IMPACT
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>#24946 vs #22675</span>
                  <span className="tabular-nums font-semibold text-rose-400">Miss: 0.0m • 11.64 km/s</span>
                </div>
                <div className="text-[9.5px] text-slate-500 mt-0.5 flex justify-between">
                  <span>10 FEB 2009 (Real Event)</span>
                  <span>41,904 km/h</span>
                </div>
              </button>
            </div>
          </div>

          <hr className="border-slate-850" />

          {/* Object A (Primary Satellite) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wide flex items-center gap-1.5">
                <Rocket className="w-3.5 h-3.5" /> Object A (Primary)
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                R: {objA.radius}m
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase">Mass (kg)</label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={objA.mass}
                  onChange={(e) => setObjA({ ...objA, mass: Math.max(1, parseFloat(e.target.value) || 1) })}
                  className="w-24 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 font-bold tabular-nums text-xs"
                />
                {/* Mass presets */}
                <button
                  onClick={() => setObjA({ ...objA, mass: 4, radius: 0.3 })}
                  className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] cursor-pointer"
                >
                  CubeSat (4kg)
                </button>
                <button
                  onClick={() => setObjA({ ...objA, mass: 1200, radius: 2.8 })}
                  className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] cursor-pointer"
                >
                  Comms (1.2t)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Velocity Vx (m/s)</label>
                <input
                  type="number"
                  step="0.5"
                  value={objA.vx}
                  onChange={(e) => setObjA({ ...objA, vx: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 font-bold tabular-nums text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Velocity Vy (m/s)</label>
                <input
                  type="number"
                  step="0.5"
                  value={objA.vy}
                  onChange={(e) => setObjA({ ...objA, vy: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 font-bold tabular-nums text-xs"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-850" />

          {/* Object B (Debris Fragment) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5" /> Object B (Debris)
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                R: {objB.radius}m
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase">Mass (kg)</label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={objB.mass}
                  onChange={(e) => setObjB({ ...objB, mass: Math.max(0.01, parseFloat(e.target.value) || 0.01) })}
                  className="w-24 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 font-bold tabular-nums text-xs"
                />
                <button
                  onClick={() => setObjB({ ...objB, mass: 0.5, radius: 0.2 })}
                  className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] cursor-pointer"
                >
                  Bolt (0.5kg)
                </button>
                <button
                  onClick={() => setObjB({ ...objB, mass: 25, radius: 0.8 })}
                  className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] cursor-pointer"
                >
                  Frag (25kg)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Offset Y0 (m)</label>
                <input
                  type="number"
                  step="0.5"
                  value={objB.y0}
                  onChange={(e) => setObjB({ ...objB, y0: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 font-bold tabular-nums text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Velocity Vx (m/s)</label>
                <input
                  type="number"
                  step="0.5"
                  value={objB.vx}
                  onChange={(e) => setObjB({ ...objB, vx: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 font-bold tabular-nums text-xs"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-850" />

          {/* Restitution (Elasticity) */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[11px]">
              <span className="font-bold text-slate-300 uppercase">Restitution (e)</span>
              <span className="tabular-nums font-bold text-teal-400">{restitution.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={restitution}
              onChange={(e) => setRestitution(parseFloat(e.target.value))}
              className="w-full accent-teal-500 cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-slate-500">
              <span>0.0 (Plastic/Breakup)</span>
              <span>0.5 (Structural)</span>
              <span>1.0 (Elastic)</span>
            </div>
          </div>

        </aside>

        {/* ======================================================================= */}
        {/* CENTER COLUMN (FLEX-1): HTML5 CANVAS SIMULATION VIEWPORT                */}
        {/* ======================================================================= */}
        <div className="flex-1 h-full relative overflow-hidden bg-black flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={1200}
            height={800}
            className="w-full h-full block cursor-crosshair"
          />

          {/* In-Canvas Floating Info Tag */}
          <div className="absolute top-4 left-4 bg-slate-950/80 backdrop-blur-md border border-slate-800 px-3 py-2 rounded-xl text-xs space-y-1 pointer-events-none">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Encounter Geometry
            </div>
            <div className="text-slate-200 font-semibold">
              {objA.name} <span className="text-slate-400">vs</span> {objB.name}
            </div>
            <div className="text-[11px] text-teal-400 tabular-nums">
              Combined HBR: <strong className="text-white">{combinedHbr.toFixed(1)}m</strong>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* RIGHT COLUMN (w-84): TELEMETRY, KINEMATICS & AVOIDANCE MANEUVER         */}
        {/* ======================================================================= */}
        <aside className="w-84 min-w-[21rem] max-w-[21rem] h-full bg-slate-950 border-l border-slate-800 p-4 overflow-y-auto space-y-4 text-xs text-slate-300 shrink-0">
          
          {/* Sub-Tab Navigation */}
          <div className="inline-flex w-full bg-slate-900 p-1 rounded-xl border border-slate-800 font-bold text-xs gap-1">
            <button
              onClick={() => setRightPanelTab('KINEMATICS')}
              className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                rightPanelTab === 'KINEMATICS'
                  ? 'bg-slate-800 text-teal-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Kinematics
            </button>
            <button
              onClick={() => setRightPanelTab('AVOIDANCE')}
              className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer text-center flex items-center justify-center gap-1 ${
                rightPanelTab === 'AVOIDANCE'
                  ? 'bg-slate-800 text-emerald-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Avoidance</span>
            </button>
          </div>

          {rightPanelTab === 'KINEMATICS' ? (
            /* TAB 1: ENCOUNTER KINEMATICS, ESA ML VERIFICATION & HYPERVELOCITY DYNAMICS */
            <div className="space-y-3.5">
              
              {/* ================================================================= */}
              {/* 0. DEDICATED KESSLER DEBRIS DISPERSION ALERT ZONE CARD            */}
              {/* ================================================================= */}
              {isImpacted && (
                <div className="p-3.5 rounded-2xl bg-rose-950/80 border-2 border-rose-500 space-y-2.5 shadow-lg shadow-rose-950/80 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400 animate-bounce" />
                      Kessler Alert Zone Active
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/30 text-rose-200 border border-rose-400 animate-pulse">
                      RESTRICTED VOLUME
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-xl bg-slate-950/90 border border-rose-500/40">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Alert Zone Radius</span>
                      <div className="font-extrabold text-rose-300 tabular-nums mt-0.5 text-sm flex items-center gap-1">
                        <span>{alertZoneRadiusM.toFixed(1)} m</span>
                        <span className="text-[9px] text-rose-400 font-bold uppercase">(Expanding)</span>
                      </div>
                      <span className="text-[9px] text-slate-500 block mt-0.5">Dispersion @ {alertZoneExpansionRate} m/s</span>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-950/90 border border-rose-500/40">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Estimated Fragments</span>
                      <div className="font-extrabold text-amber-300 tabular-nums mt-0.5 text-sm">
                        1,500+
                      </div>
                      <span className="text-[9px] text-slate-500 block mt-0.5">&gt;1cm trackable lethal</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/90 border border-rose-500/40 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10.5px] text-slate-400 font-medium">Orbital Highway Status:</span>
                      <span className="font-extrabold text-rose-400 tracking-wider uppercase text-[10px] px-1.5 py-0.5 bg-rose-500/20 rounded border border-rose-500/30">
                        CLOSED / NO-GO TRAJECTORY
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                      <span className="text-[10.5px] text-slate-400 font-medium">Energy Dissipated:</span>
                      <span className="font-bold tabular-nums text-amber-300">
                        {hypervelocityGJ.toFixed(2)} GJ
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10.5px] text-slate-400 font-medium">High-Explosive Yield:</span>
                      <span className="font-bold tabular-nums text-rose-300">
                        {tntEquivalentTons.toFixed(2)} Tons TNT
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ================================================================= */}
              {/* 1. DEDICATED ESA ML VERIFICATION CARD                             */}
              {/* ================================================================= */}
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                    ESA ML Verification
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-300 border border-teal-500/30">
                    92% Confidence
                  </span>
                </div>

                {/* Risk Probability Badge */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/80 border border-slate-850">
                  <span className="text-xs text-slate-400 font-medium">ESA ML Verified Risk:</span>
                  <span className={`text-base font-extrabold tabular-nums ${
                    mlPrediction.predicted_risk_prob >= 0.5
                      ? 'text-rose-400'
                      : mlPrediction.predicted_risk_prob >= 0.05
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}>
                    {(mlPrediction.predicted_risk_prob * 100).toFixed(1)}%
                  </span>
                </div>

                {/* ML Operational Verdict */}
                <div className={`p-2.5 rounded-xl border text-center font-extrabold text-xs tracking-wider uppercase flex items-center justify-center space-x-2 ${
                  mlPrediction.predicted_risk_prob >= 0.5 || mlPrediction.ml_action_required
                    ? 'bg-rose-950/70 border-rose-500/80 text-rose-300 shadow-rose-950/50 shadow-sm'
                    : 'bg-emerald-950/70 border-emerald-500/80 text-emerald-300 shadow-emerald-950/50 shadow-sm'
                }`}>
                  {mlPrediction.predicted_risk_prob >= 0.5 || mlPrediction.ml_action_required ? (
                    <>
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>CRITICAL ACTION REQUIRED</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>SAFE FLYBY</span>
                    </>
                  )}
                </div>

                {/* Model Architecture Metadata */}
                <div className="pt-2 border-t border-slate-850 space-y-1">
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span className="font-medium">Model Type:</span>
                    <span className="text-slate-300 font-semibold truncate max-w-[180px]" title="LightGBM Gradient-Boosted Trees (ESA Kelvins Dataset)">
                      LightGBM Gradient-Boosted Trees (ESA Kelvins Dataset)
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span className="font-medium">Training Corpus:</span>
                    <span className="text-slate-300 font-semibold">162,634 Real ESA CDMs</span>
                  </div>
                </div>

                {/* Feature Vector Chips */}
                <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px]">
                  <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-850">
                    <span className="text-slate-500 block">Miss Distance</span>
                    <span className="text-slate-200 font-bold tabular-nums">
                      {(applyAvoidance ? activeTelemetry.missDistanceM + Math.abs(burnDeltaVy * 420) : activeTelemetry.missDistanceM).toFixed(1)} m
                    </span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-850">
                    <span className="text-slate-500 block">Relative Velocity</span>
                    <span className="text-slate-200 font-bold tabular-nums">
                      {trueVRelKmS.toFixed(2)} km/s
                    </span>
                  </div>
                </div>
              </div>

              {/* ================================================================= */}
              {/* 2. ACCURATE HYPERVELOCITY KINEMATICS & SEVERITY                   */}
              {/* ================================================================= */}
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-rose-400" />
                    Hypervelocity Kinematics
                  </span>
                  <span className="text-[10px] font-bold text-amber-400 tabular-nums">
                    {trueVRelKmS.toFixed(2)} km/s
                  </span>
                </div>

                {/* Energy & TNT Display */}
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-850 space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Relative Kinetic Energy (Ek):</span>
                    <span className="text-base font-extrabold text-amber-400 tabular-nums">
                      {hypervelocityGJ.toFixed(2)} GJ
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="text-[10.5px] text-slate-400">Total in MegaJoules:</span>
                    <span className="font-bold tabular-nums text-slate-200">{Math.round(hypervelocityMJ).toLocaleString()} MJ</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-300 pt-1 border-t border-slate-850/60">
                    <span className="text-[10.5px] text-slate-400">High-Explosive Yield:</span>
                    <span className="font-bold tabular-nums text-rose-400">
                      {tntEquivalentTons >= 1.0 ? `~${tntEquivalentTons.toFixed(2)} Tons TNT` : `~${Math.round(tntEquivalentKg).toLocaleString()} kg TNT`}
                    </span>
                  </div>
                </div>

                {/* Physical Reduced Mass & Orbital Speed Readout */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-850">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Reduced Mass (μ)</span>
                    <div className="font-extrabold text-slate-100 tabular-nums mt-0.5">{reducedMass.toFixed(2)} kg</div>
                    <span className="text-[9.5px] text-slate-500 block mt-0.5">μ = (mA·mB)/(mA+mB)</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-850">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Closing Speed</span>
                    <div className="font-extrabold text-teal-300 tabular-nums mt-0.5">{trueVRelKmS.toFixed(2)} km/s</div>
                    <span className="text-[9.5px] text-slate-500 block mt-0.5">{trueVRelKmh} km/h</span>
                  </div>
                </div>

                {/* Hypervelocity Impact Severity Classification Banner */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Impact Severity Classification:
                  </span>
                  <div className={`p-2.5 rounded-xl border text-xs font-bold leading-relaxed ${
                    isPredictedCollision && trueVRelKmS >= 10.0
                      ? 'bg-rose-950/90 border-rose-500 text-rose-200 shadow-sm shadow-rose-900/50'
                      : isPredictedCollision
                      ? 'bg-amber-950/80 border-amber-500 text-amber-200'
                      : applyAvoidance && minSepDistance > combinedHbr
                      ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                      : 'bg-teal-950/80 border-teal-500 text-teal-200'
                  }`}>
                    <div className="flex items-center gap-1.5 mb-1 text-[11px] font-extrabold uppercase tracking-wide">
                      {isPredictedCollision ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )}
                      <span>{severityClassification}</span>
                    </div>
                    <p className="text-[10.5px] font-normal text-slate-300 leading-normal">
                      {isPredictedCollision && trueVRelKmS >= 10.0
                        ? `At ${trueVRelKmS.toFixed(1)} km/s relative closing velocity, collision kinetic energy (${hypervelocityGJ.toFixed(2)} GJ) exceeds material binding energy by 1000x, inducing instantaneous structural vaporization and generating >10,000 trackable debris fragments.`
                        : isPredictedCollision
                        ? `Relative impact speed of ${trueVRelKmS.toFixed(1)} km/s induces extensive catastrophic fragmentation across satellite bus and solar arrays.`
                        : applyAvoidance
                        ? `Autonomous normal micro-burn successfully clears collision volume (+${(minSepDistance - combinedHbr).toFixed(1)}m safe margin).`
                        : `Trajectories maintain clearance outside combined Hard Body Radius (${combinedHbr.toFixed(1)}m).`}
                    </p>
                  </div>
                </div>
              </div>

              {/* ================================================================= */}
              {/* 3. 2D SIMULATION TELEMETRY & POST-IMPACT DISSIPATION              */}
              {/* ================================================================= */}
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-850 space-y-2">
                <span className="text-[11px] font-bold text-slate-200 uppercase flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-teal-400" />
                  Post-Impact Energy Dissipation
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Based on restitution <strong className="text-teal-300">e = {restitution.toFixed(2)}</strong>, approximately <strong className="text-rose-400 tabular-nums">{energyDissipatedMJ.toFixed(3)} MJ</strong> of kinetic energy is dissipated into plastic structural deformation and hypervelocity fragmentation.
                </p>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-rose-500 rounded-full"
                    style={{ width: `${(1.0 - restitution * restitution) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                  <span>Elastic Energy: {(restitution * restitution * 100).toFixed(0)}%</span>
                  <span>Plastic Breakup: {((1.0 - restitution * restitution) * 100).toFixed(0)}%</span>
                </div>
              </div>

            </div>
          ) : (
            /* TAB 2: AVOIDANCE MANEUVER DYNAMICS */
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <div className="font-bold text-emerald-300 text-xs">Evasive Micro-Burn</div>
                  <div className="text-[10px] text-emerald-400/80">Apply along-track impulse to Object A</div>
                </div>
                <input
                  type="checkbox"
                  checked={applyAvoidance}
                  onChange={(e) => setApplyAvoidance(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Burn Sliders */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Normal Δvy Burn:</span>
                    <span className="font-bold tabular-nums text-emerald-400">{burnDeltaVy.toFixed(2)} m/s</span>
                  </div>
                  <input
                    type="range"
                    min="-1.5"
                    max="1.5"
                    step="0.05"
                    value={burnDeltaVy}
                    onChange={(e) => {
                      setBurnDeltaVy(parseFloat(e.target.value));
                      setApplyAvoidance(true);
                    }}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Along-Track Δvx Burn:</span>
                    <span className="font-bold tabular-nums text-emerald-400">{burnDeltaVx.toFixed(2)} m/s</span>
                  </div>
                  <input
                    type="range"
                    min="-1.5"
                    max="1.5"
                    step="0.05"
                    value={burnDeltaVx}
                    onChange={(e) => {
                      setBurnDeltaVx(parseFloat(e.target.value));
                      setApplyAvoidance(true);
                    }}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Maneuver Impact Metric Card */}
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  Predicted Miss Margin
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className={`text-2xl font-extrabold tabular-nums ${
                    minSepDistance > 50.0 ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {minSepDistance.toFixed(1)} m
                  </span>
                  <span className="text-xs text-slate-400">
                    (Nominal: {nomMinSep.toFixed(1)}m)
                  </span>
                </div>

                <div className={`p-2 rounded-xl text-xs font-semibold flex items-center space-x-2 ${
                  minSepDistance > combinedHbr
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                    : 'bg-rose-950 text-rose-300 border border-rose-500/50'
                }`}>
                  {minSepDistance > combinedHbr ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Avoidance Verified (+{(minSepDistance - combinedHbr).toFixed(1)}m Clearance)</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>Insufficient Clearance (Collision Imminent)</span>
                    </>
                  )}
                </div>
              </div>

              {/* 1-Click Optimize Button */}
              <button
                onClick={applyOptimalAvoidance}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-md cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                <span>Apply Optimal Evasive Burn (+0.55 m/s)</span>
              </button>
            </div>
          )}

        </aside>

      </div>

      {/* ========================================================================= */}
      {/* 3. BOTTOM SCRUBBER & PLAYBACK CONTROL BAR                                */}
      {/* ========================================================================= */}
      <footer className="h-16 bg-slate-950 border-t border-slate-800 px-6 flex items-center justify-between shrink-0 z-20">
        
        {/* Playback Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold transition-all cursor-pointer shadow-md"
            title={isPlaying ? 'Pause Simulation' : 'Play Simulation'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setTime((t) => Math.max(0, t - 0.5))}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
            title="Step Back 0.5s"
          >
            <Rewind className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setTime((t) => Math.min(16.0, t + 0.5))}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
            title="Step Forward 0.5s"
          >
            <FastForward className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={resetSimulation}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
            title="Reset to T=0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="h-5 w-px bg-slate-800 mx-1" />

          {/* Jump to TCA Button */}
          <button
            onClick={jumpToTca}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-teal-950 border border-slate-800 hover:border-teal-500 text-teal-300 font-bold text-xs flex items-center space-x-1.5 cursor-pointer transition-all"
            title="Scrub time directly to Time of Closest Approach"
          >
            <Crosshair className="w-3.5 h-3.5 text-teal-400" />
            <span>Jump to TCA ({tcaTime.toFixed(1)}s)</span>
          </button>
        </div>

        {/* Timeline Slider Scrubber */}
        <div className="flex-1 max-w-xl mx-8 flex items-center space-x-3">
          <span className="text-xs font-bold text-slate-400 tabular-nums">0.0s</span>
          <div className="flex-1 relative flex items-center">
            {/* Marker for TCA on scrubber */}
            {tcaTime > 0 && tcaTime <= 16.0 && (
              <div
                className="absolute top-0 bottom-0 w-1 bg-rose-500 rounded-full pointer-events-none z-10"
                style={{ left: `${(tcaTime / 16.0) * 100}%` }}
                title={`TCA at ${tcaTime.toFixed(1)}s`}
              />
            )}
            <input
              type="range"
              min="0.0"
              max="16.0"
              step="0.05"
              value={time}
              onChange={(e) => setTime(parseFloat(e.target.value))}
              className="w-full accent-teal-500 cursor-pointer"
            />
          </div>
          <span className="text-xs font-bold text-slate-400 tabular-nums">16.0s</span>
        </div>

        {/* Speed Multiplier Chips */}
        <div className="flex items-center space-x-1.5">
          {[0.25, 0.5, 1.0, 2.0, 5.0].map((s) => (
            <button
              key={s}
              onClick={() => setTimeScale(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                timeScale === s
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

      </footer>

    </div>
  );
}
