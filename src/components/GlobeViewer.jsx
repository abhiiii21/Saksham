import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  RotateCw,
  Sparkles,
  Layers,
  Crosshair,
  Radio,
  Globe2,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  FastForward,
  Rewind,
  Video,
  ChevronDown,
  X,
  Compass,
  Radar as RadarIcon,
  Zap,
  Orbit,
  Shield
} from 'lucide-react';
import { formatDistance, formatPc } from '../utils/formatters';

// ==============================================================================
// ASTRODYNAMICS & SCENE CONSTANTS
// ==============================================================================
const EARTH_RADIUS = 6371; // km in simulation coordinates

// Satellite classification configuration
const SATELLITE_TYPES = {
  ACTIVE: { color: 0x00e644, colorHex: '#00e644', label: 'Active Satellite' },
  DEBRIS: { color: 0xff2828, colorHex: '#ff2828', label: 'Tracked Debris' },
  ROCKET_BODY: { color: 0xffaa00, colorHex: '#ffaa00', label: 'Rocket Body' },
  UNKNOWN: { color: 0x0077ff, colorHex: '#0077ff', label: 'Unknown / Other' }
};

// 6 Real-World LeoLabs Phased Array Space Radar Stations
const RADAR_STATIONS = [
  {
    name: 'Kiwi Space Radar',
    code: 'KSR',
    country: 'New Zealand',
    location: 'Central Otago',
    lat: -45.03,
    lon: 169.68,
    freq: 'UHF (400-450 MHz)',
    range: '2,000 km',
    status: 'ACTIVE TRACKING'
  },
  {
    name: 'Costa Rica Space Radar',
    code: 'CRSR',
    country: 'Costa Rica',
    location: 'Guanacaste',
    lat: 10.32,
    lon: -84.43,
    freq: 'S-Band (2.9-3.1 GHz)',
    range: '2,500 km',
    status: 'ACTIVE TRACKING'
  },
  {
    name: 'Poker Flat Space Radar',
    code: 'PFSR',
    country: 'United States',
    location: 'Fairbanks, Alaska',
    lat: 65.12,
    lon: -147.48,
    freq: 'UHF Phased Array',
    range: '2,200 km',
    status: 'ACTIVE TRACKING'
  },
  {
    name: 'Midland Space Radar',
    code: 'MSR',
    country: 'United States',
    location: 'Midland, Texas',
    lat: 31.99,
    lon: -102.07,
    freq: 'UHF Phased Array',
    range: '2,000 km',
    status: 'ACTIVE TRACKING'
  },
  {
    name: 'Azores Space Radar',
    code: 'AZSR',
    country: 'Portugal',
    location: 'Flores Island, Azores',
    lat: 39.45,
    lon: -31.13,
    freq: 'S-Band Active Phased Array',
    range: '2,400 km',
    status: 'ACTIVE TRACKING'
  },
  {
    name: 'West Australia Space Radar',
    code: 'WASR',
    country: 'Australia',
    location: 'Collie, WA',
    lat: -33.36,
    lon: 116.15,
    freq: 'S-Band High Sensitivity',
    range: '2,500 km',
    status: 'ACTIVE TRACKING'
  }
];

// NASA Textures
const TEXTURE_URLS = {
  day: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_atmos_2048.jpg',
  night: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_lights_2048.png',
  clouds: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_clouds_1024.png'
};

// ==============================================================================
// 3D MODEL GENERATORS (Recognizable Spacecraft & Orbital Debris Silhouettes)
// ==============================================================================

/**
 * Active Satellite: Central Bus + 2 Solar Array Wings + Parabolic Communications Dish
 */
function createActiveSatelliteGeometry() {
  const bus = new THREE.BoxGeometry(26, 26, 32);

  const leftWing = new THREE.BoxGeometry(46, 18, 2.5);
  leftWing.translate(-38, 0, 0);

  const rightWing = new THREE.BoxGeometry(46, 18, 2.5);
  rightWing.translate(38, 0, 0);

  const yoke = new THREE.CylinderGeometry(1.8, 1.8, 78, 6);
  yoke.rotateZ(Math.PI / 2);

  const dish = new THREE.ConeGeometry(10, 8, 8, 1, true);
  dish.rotateX(Math.PI / 2);
  dish.translate(0, 0, 20);

  const merged = BufferGeometryUtils.mergeGeometries([bus, leftWing, rightWing, yoke, dish], false);
  return merged || bus;
}

/**
 * Rocket Body: Cylindrical Booster Core + Tapered Upper Stage Fairing + Engine Bell Nozzle
 */
function createRocketBodyGeometry() {
  const core = new THREE.CylinderGeometry(12, 12, 65, 10);

  const fairing = new THREE.ConeGeometry(12, 22, 10);
  fairing.translate(0, 43.5, 0);

  const engine = new THREE.CylinderGeometry(7, 12, 14, 8);
  engine.translate(0, -39.5, 0);

  const merged = BufferGeometryUtils.mergeGeometries([core, fairing, engine], false);
  return merged || core;
}

/**
 * Tracked Debris: Irregular faceted tumbling fragment
 */
function createDebrisGeometry() {
  const geom = new THREE.DodecahedronGeometry(16, 0);
  geom.scale(1.35, 0.75, 1.15);
  return geom;
}

/**
 * Unknown Object: Distinctive Diamond / Octahedral Marker
 */
function createUnknownGeometry() {
  const geom = new THREE.OctahedronGeometry(20, 0);
  geom.scale(1.0, 1.35, 1.0);
  return geom;
}

// Procedural fallback day texture with continents and graticule grid
function createFallbackDayTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  ctx.fillStyle = '#0a1d36';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#173656';
  ctx.strokeStyle = '#295f8f';
  ctx.lineWidth = 2.5;

  function drawPoly(coords) {
    ctx.beginPath();
    ctx.moveTo(coords[0][0] * canvas.width, coords[0][1] * canvas.height);
    for (let i = 1; i < coords.length; i++) {
      ctx.lineTo(coords[i][0] * canvas.width, coords[i][1] * canvas.height);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  drawPoly([[0.08,0.18],[0.15,0.14],[0.28,0.16],[0.27,0.34],[0.23,0.48],[0.19,0.44],[0.14,0.36],[0.08,0.28]]);
  drawPoly([[0.23,0.52],[0.31,0.54],[0.34,0.66],[0.29,0.85],[0.22,0.76],[0.20,0.60]]);
  drawPoly([[0.31,0.08],[0.38,0.09],[0.36,0.20],[0.30,0.18]]);
  drawPoly([[0.45,0.18],[0.58,0.14],[0.74,0.15],[0.86,0.20],[0.84,0.35],[0.72,0.42],[0.60,0.40],[0.50,0.42],[0.46,0.32],[0.42,0.24]]);
  drawPoly([[0.45,0.42],[0.57,0.42],[0.61,0.55],[0.55,0.76],[0.48,0.70],[0.43,0.50]]);
  drawPoly([[0.66,0.40],[0.70,0.42],[0.68,0.55],[0.65,0.52]]);
  drawPoly([[0.75,0.42],[0.80,0.44],[0.78,0.56],[0.74,0.52]]);
  drawPoly([[0.83,0.32],[0.86,0.34],[0.85,0.40],[0.82,0.38]]);
  drawPoly([[0.78,0.64],[0.88,0.63],[0.88,0.78],[0.77,0.77]]);
  drawPoly([[0.02,0.92],[0.98,0.92],[0.98,0.98],[0.02,0.98]]);

  ctx.lineWidth = 1;
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = ((90 - lat) / 180) * canvas.height;
    ctx.strokeStyle = lat === 0 ? 'rgba(51, 181, 229, 0.45)' : 'rgba(51, 181, 229, 0.15)';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  for (let lon = 0; lon < 360; lon += 30) {
    const x = (lon / 360) * canvas.width;
    ctx.strokeStyle = (lon === 0 || lon === 180) ? 'rgba(51, 181, 229, 0.35)' : 'rgba(51, 181, 229, 0.12)';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// Procedural fallback night lights texture
function createFallbackNightTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  ctx.fillStyle = '#000205';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cities = [
    [-74.0, 40.7, 7, 0.9],
    [-71.0, 42.3, 5, 0.8],
    [-77.0, 38.9, 6, 0.85],
    [-87.6, 41.8, 6, 0.85],
    [-84.4, 33.7, 5, 0.75],
    [-80.2, 25.8, 5, 0.8],
    [-118.2, 34.0, 7, 0.9],
    [-122.4, 37.7, 6, 0.85],
    [-95.3, 29.7, 5, 0.75],
    [-96.8, 32.8, 5, 0.75],
    [-99.1, 19.4, 6, 0.8],
    [-0.1, 51.5, 7, 0.95],
    [2.3, 48.8, 7, 0.9],
    [6.8, 51.2, 8, 0.9],
    [13.4, 52.5, 5, 0.75],
    [-3.7, 40.4, 5, 0.8],
    [12.5, 41.9, 5, 0.8],
    [37.6, 55.7, 6, 0.85],
    [139.7, 35.7, 8, 1.0],
    [135.5, 34.7, 6, 0.85],
    [126.9, 37.5, 7, 0.9],
    [121.5, 31.2, 8, 0.95],
    [116.4, 39.9, 7, 0.9],
    [114.1, 22.3, 7, 0.9],
    [121.5, 25.0, 5, 0.8],
    [72.8, 18.9, 7, 0.9],
    [77.2, 28.6, 7, 0.9],
    [77.6, 12.9, 6, 0.85],
    [88.3, 22.5, 5, 0.8],
    [103.8, 1.3, 6, 0.85],
    [100.5, 13.7, 5, 0.8],
    [31.2, 30.0, 6, 0.85],
    [55.3, 25.2, 6, 0.9],
    [46.7, 24.7, 5, 0.75],
    [28.0, -26.2, 5, 0.75],
    [-46.6, -23.5, 7, 0.9],
    [-43.2, -22.9, 6, 0.85],
    [-58.4, -34.6, 6, 0.85],
    [151.2, -33.8, 6, 0.85],
    [144.9, -37.8, 5, 0.8],
    [174.7, -36.8, 4, 0.75]
  ];

  cities.forEach(([lon, lat, size, intensity]) => {
    const x = ((lon + 180) / 360) * canvas.width;
    const y = ((90 - lat) / 180) * canvas.height;

    const grad = ctx.createRadialGradient(x, y, 0, x, y, size * 2.2);
    grad.addColorStop(0, `rgba(255, 220, 140, ${intensity})`);
    grad.addColorStop(0.35, `rgba(255, 170, 70, ${intensity * 0.7})`);
    grad.addColorStop(0.75, `rgba(200, 110, 30, ${intensity * 0.25})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, size * 2.2, 0, Math.PI * 2);
    ctx.fill();
  });

  for (let i = 0; i < 400; i++) {
    const x = Math.random() * canvas.width;
    const y = (0.15 + Math.random() * 0.65) * canvas.height;
    const r = Math.random() * 1.5;
    ctx.fillStyle = `rgba(255, 200, 120, ${Math.random() * 0.5 + 0.2})`;
    ctx.fillRect(x, y, r, r);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

function toSceneVec3(arrOrObj) {
  if (!arrOrObj) return new THREE.Vector3();
  if (Array.isArray(arrOrObj) && arrOrObj.length >= 3) {
    return new THREE.Vector3(arrOrObj[0], arrOrObj[1], arrOrObj[2]);
  }
  if (arrOrObj.position_eci_km && Array.isArray(arrOrObj.position_eci_km)) {
    return new THREE.Vector3(arrOrObj.position_eci_km[0], arrOrObj.position_eci_km[1], arrOrObj.position_eci_km[2]);
  }
  if (arrOrObj.r_eci && Array.isArray(arrOrObj.r_eci)) {
    return new THREE.Vector3(arrOrObj.r_eci[0], arrOrObj.r_eci[1], arrOrObj.r_eci[2]);
  }
  if (arrOrObj.x != null && arrOrObj.y != null && arrOrObj.z != null) {
    return new THREE.Vector3(arrOrObj.x, arrOrObj.y, arrOrObj.z);
  }
  return new THREE.Vector3();
}

function calculateOrbitalPeriod(semiMajorAxis) {
  const mu = 398600.4418;
  return 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / mu);
}

function calculateOrbitalVelocity(semiMajorAxis) {
  const mu = 398600.4418;
  return Math.sqrt(mu / semiMajorAxis);
}

function getOrbitalVelocityVector(d) {
  if (!d) return new THREE.Vector3();
  const mu = 398600.4418;
  const p = d.semiMajorAxis * (1 - (d.eccSquared || 0));
  const sqrtMuP = Math.sqrt(mu / Math.max(1, p));
  const sinTA = Math.sin(d.trueAnomaly || 0);
  const cosTA = Math.cos(d.trueAnomaly || 0);
  const vx0 = -sqrtMuP * sinTA;
  const vy0 = sqrtMuP * ((d.eccentricity || 0) + cosTA);
  const vx1 = vx0 * (d.cosW ?? 1) - vy0 * (d.sinW ?? 0);
  const vy1 = vx0 * (d.sinW ?? 0) + vy0 * (d.cosW ?? 1);
  const vx2 = vx1;
  const vy2 = vy1 * (d.cosI ?? 1);
  const vz2 = vy1 * (d.sinI ?? 0);
  const vx3 = vx2 * (d.cosO ?? 1) - vy2 * (d.sinO ?? 0);
  const vy3 = vx2 * (d.sinO ?? 0) + vy2 * (d.cosO ?? 1);
  return new THREE.Vector3(vx3, vy3, vz2);
}

function generateSatelliteName(type, index) {
  if (index === 0) return 'ISS (ZARYA)';
  if (index === 1) return 'TIANGONG SPACE STATION';
  if (index === 2) return 'HUBBLE SPACE TELESCOPE';

  const prefixes = {
    ACTIVE: ['STARLINK', 'ONEWEB', 'IRIDIUM', 'GPS', 'GALILEO', 'GLONASS', 'BEIDOU', 'PLANET-SKYSAT', 'COSMO-SKYMED'],
    DEBRIS: ['DEB-COSMOS-2251', 'DEB-FENGYUN-1C', 'DEB-IRIDIUM-33', 'DEB-SL-16', 'DEB-ARIANE', 'DEB-TITAN'],
    ROCKET_BODY: ['FALCON9-R/B', 'ATLAS5-CENTAUR', 'DELTA4-R/B', 'SOYUZ-2-R/B', 'ARIANE5-ESC', 'LONGMARCH-4B', 'PSLV-R/B'],
    UNKNOWN: ['RADAR-HIT', 'UNKNOWN-FRAGMENT', 'ORBITAL-OBJECT', 'HIGH-B-STAR']
  };
  const list = prefixes[type] || prefixes.ACTIVE;
  const p = list[Math.floor(Math.random() * list.length)];
  const num = 1000 + Math.floor(Math.random() * 8999);
  return `${p}-${num}`;
}

export default function GlobeViewer({
  satellites = [],
  selectedConjunction = null,
  conjunctionDetails = null,
  burnData = null,
  isBurnExecuting = false,
  onLaunchInSandbox = null
}) {
  const containerRef = useRef(null);
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);

  // Scene object refs
  const earthRef = useRef(null);
  const earthGroupRef = useRef(null);
  const cloudsRef = useRef(null);
  const starFieldRef = useRef(null);
  const radarGroupRef = useRef(null);
  const satellitesRef = useRef([]);
  const orbitsRef = useRef([]);
  const encounterGroupRef = useRef(null);
  const conjunctionTetherLineRef = useRef(null);
  const thrusterPlumeRef = useRef(null);
  const hoverReticleRef = useRef(null);
  const animFrameIdRef = useRef(null);

  // Dual-Selection Scene Refs & Beacons
  const pairVisualGroupRef = useRef(null);
  const primaryBeaconRef = useRef(null);
  const secondaryBeaconRef = useRef(null);
  const pairTetherLineRef = useRef(null);

  // Mutable synchronization refs for 60fps render loop
  const isPlayingRef = useRef(true);
  const timeScaleRef = useRef(1);
  const earthRotationRef = useRef(true);
  const radarsVisibleRef = useRef(true);
  const selectedSatRef = useRef(null); // { mesh, data }
  const selectedPairRef = useRef({ primary: null, secondary: null }); // { primary: {mesh, data}, secondary: {mesh, data} }
  const hoveredSatRef = useRef(null);  // mesh
  const chaseSatRef = useRef(null);    // mesh
  const flyToSatRef = useRef(null);    // mesh
  const simTimeRef = useRef(new Date());

  // React state for HUD UI
  const [isPlaying, setIsPlaying] = useState(true);
  const [timeScale, setTimeScale] = useState(1);
  const [earthRotationEnabled, setEarthRotationEnabled] = useState(true);
  const [radarsVisible, setRadarsVisible] = useState(true);
  const [activeHeatmapMode, setActiveHeatmapMode] = useState('TYPE');
  const [cameraPreset, setCameraPreset] = useState('GLOBAL');
  const [selectedSat, setSelectedSat] = useState(null);
  const [selectedPair, setSelectedPair] = useState({ primary: null, secondary: null });
  const [pairDistanceKm, setPairDistanceKm] = useState(0);
  const [chaseSat, setChaseSat] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHeatmapMenu, setShowHeatmapMenu] = useState(false);
  const [showCameraMenu, setShowCameraMenu] = useState(false);
  const [showLegendMenu, setShowLegendMenu] = useState(false);
  const [utcTimeStr, setUtcTimeStr] = useState('');
  const [fps, setFps] = useState(60);

  // Camera transition refs
  const cameraTargetRef = useRef(new THREE.Vector3(-800, 0, 0));
  const cameraDesiredPosRef = useRef(new THREE.Vector3(-2600, 4200, 24500));
  const isTransitioningCameraRef = useRef(false);

  // Satellite counts
  const [counts, setCounts] = useState({ ACTIVE: 0, DEBRIS: 0, ROCKET_BODY: 0, UNKNOWN: 0, TOTAL: 0 });

  // --------------------------------------------------------------------------
  // Visual Reset Helper for a Satellite Mesh
  // --------------------------------------------------------------------------
  const resetSatelliteMeshVisual = useCallback((satMesh) => {
    if (!satMesh) return;
    satMesh.material.color.setHex(satMesh.userData.originalColor || 0x00e644);
    satMesh.material.emissive.setHex(0x000000);
    satMesh.scale.set(1, 1, 1);
    if (satMesh.userData.orbit) {
      satMesh.userData.orbit.visible = false;
      satMesh.userData.orbit.material.color.setHex(0x27527c);
      satMesh.userData.orbit.material.opacity = 0.22;
    }
  }, []);

  // --------------------------------------------------------------------------
  // Selection & Deselection Handlers (Interactive Dual Raycasting Multi-Selection)
  // --------------------------------------------------------------------------
  const clearPairSelection = useCallback(() => {
    const cur = selectedPairRef.current;
    if (cur.primary?.mesh) resetSatelliteMeshVisual(cur.primary.mesh);
    if (cur.secondary?.mesh) resetSatelliteMeshVisual(cur.secondary.mesh);

    selectedPairRef.current = { primary: null, secondary: null };
    setSelectedPair({ primary: null, secondary: null });
    setPairDistanceKm(0);

    selectedSatRef.current = null;
    setSelectedSat(null);
    chaseSatRef.current = null;
    setChaseSat(null);
    flyToSatRef.current = null;
  }, [resetSatelliteMeshVisual]);

  const selectSatelliteInPair = useCallback((satMesh) => {
    if (!satMesh) return;

    const cur = selectedPairRef.current;

    // Click 1: Assign to primary (Highlight with Cyan beacon ring)
    if (!cur.primary) {
      satMesh.material.color.setHex(0x00f2fe);
      satMesh.material.emissive.setHex(0x004466);
      satMesh.scale.set(1.8, 1.8, 1.8);
      if (satMesh.userData.orbit) {
        satMesh.userData.orbit.visible = true;
        satMesh.userData.orbit.material.color.setHex(0x00f2fe);
        satMesh.userData.orbit.material.opacity = 0.9;
      }

      const pObj = { mesh: satMesh, data: satMesh.userData };
      selectedPairRef.current = { primary: pObj, secondary: null };
      setSelectedPair({ primary: pObj, secondary: null });

      selectedSatRef.current = pObj;
      setSelectedSat(pObj);
      return;
    }

    // Click 2: Assign to secondary (Highlight with Red beacon ring, draw 3D dashed line)
    if (cur.primary && !cur.secondary) {
      if (cur.primary.mesh === satMesh) {
        clearPairSelection();
        return;
      }

      satMesh.material.color.setHex(0xff1744);
      satMesh.material.emissive.setHex(0x660011);
      satMesh.scale.set(1.8, 1.8, 1.8);
      if (satMesh.userData.orbit) {
        satMesh.userData.orbit.visible = true;
        satMesh.userData.orbit.material.color.setHex(0xff1744);
        satMesh.userData.orbit.material.opacity = 0.9;
      }

      const sObj = { mesh: satMesh, data: satMesh.userData };
      const dist = cur.primary.mesh.position.distanceTo(satMesh.position);
      setPairDistanceKm(dist);

      selectedPairRef.current = { primary: cur.primary, secondary: sObj };
      setSelectedPair({ primary: cur.primary, secondary: sObj });

      selectedSatRef.current = sObj;
      setSelectedSat(sObj);
      return;
    }

    // Click 3: Replace secondary with the newly selected object
    if (cur.primary && cur.secondary) {
      if (cur.primary.mesh === satMesh) {
        // Toggle off primary, promote secondary to primary
        resetSatelliteMeshVisual(cur.primary.mesh);
        const newPrimMesh = cur.secondary.mesh;
        newPrimMesh.material.color.setHex(0x00f2fe);
        newPrimMesh.material.emissive.setHex(0x004466);
        if (newPrimMesh.userData.orbit) {
          newPrimMesh.userData.orbit.material.color.setHex(0x00f2fe);
        }
        const newPrimObj = { mesh: newPrimMesh, data: newPrimMesh.userData };
        selectedPairRef.current = { primary: newPrimObj, secondary: null };
        setSelectedPair({ primary: newPrimObj, secondary: null });
        setPairDistanceKm(0);
        selectedSatRef.current = newPrimObj;
        setSelectedSat(newPrimObj);
        return;
      }

      if (cur.secondary.mesh === satMesh) {
        // Toggle off secondary
        resetSatelliteMeshVisual(cur.secondary.mesh);
        selectedPairRef.current = { primary: cur.primary, secondary: null };
        setSelectedPair({ primary: cur.primary, secondary: null });
        setPairDistanceKm(0);
        selectedSatRef.current = cur.primary;
        setSelectedSat(cur.primary);
        return;
      }

      // Replace secondary with new object
      resetSatelliteMeshVisual(cur.secondary.mesh);

      satMesh.material.color.setHex(0xff1744);
      satMesh.material.emissive.setHex(0x660011);
      satMesh.scale.set(1.8, 1.8, 1.8);
      if (satMesh.userData.orbit) {
        satMesh.userData.orbit.visible = true;
        satMesh.userData.orbit.material.color.setHex(0xff1744);
        satMesh.userData.orbit.material.opacity = 0.9;
      }

      const sObj = { mesh: satMesh, data: satMesh.userData };
      const dist = cur.primary.mesh.position.distanceTo(satMesh.position);
      setPairDistanceKm(dist);

      selectedPairRef.current = { primary: cur.primary, secondary: sObj };
      setSelectedPair({ primary: cur.primary, secondary: sObj });

      selectedSatRef.current = sObj;
    }

    // If Chase Cam was already active, immediately follow the newly selected satellite
    if (chaseSatRef.current) {
      chaseSatRef.current = satMesh;
      setChaseSat(satMesh);
    }
  }, [clearPairSelection, resetSatelliteMeshVisual]);

  // Backward-compatible aliases
  const deselectSatellite = clearPairSelection;
  const selectSatellite = selectSatelliteInPair;

  // --------------------------------------------------------------------------
  // Fly To Selected Satellite (Smooth live-tracking animation)
  // --------------------------------------------------------------------------
  const handleFlyToSatellite = useCallback(() => {
    if (!selectedSatRef.current?.mesh) return;

    chaseSatRef.current = null;
    setChaseSat(null);

    flyToSatRef.current = selectedSatRef.current.mesh;
    isTransitioningCameraRef.current = true;
  }, []);

  // --------------------------------------------------------------------------
  // Chase Camera Toggle
  // --------------------------------------------------------------------------
  const handleToggleChase = useCallback(() => {
    if (chaseSatRef.current) {
      chaseSatRef.current = null;
      setChaseSat(null);
    } else {
      const targetMesh = selectedSatRef.current?.mesh || (satellitesRef.current.length > 0 ? satellitesRef.current[0] : null);
      if (!targetMesh) return;

      if (!selectedSatRef.current?.mesh) {
        selectSatellite(targetMesh);
      }

      flyToSatRef.current = null;
      isTransitioningCameraRef.current = false;
      chaseSatRef.current = targetMesh;
      setChaseSat(targetMesh);
    }
  }, [selectSatellite]);

  // --------------------------------------------------------------------------
  // Simulation Speed & Time Controls
  // --------------------------------------------------------------------------
  const handleTogglePlay = useCallback(() => {
    const next = !isPlayingRef.current;
    isPlayingRef.current = next;
    setIsPlaying(next);
  }, []);

  const handleSpeedChange = useCallback((multiplier) => {
    const next = Math.min(64, Math.max(0.125, multiplier));
    timeScaleRef.current = next;
    setTimeScale(next);
  }, []);

  const handleToggleEarthRotation = useCallback(() => {
    const next = !earthRotationRef.current;
    earthRotationRef.current = next;
    setEarthRotationEnabled(next);
  }, []);

  // --------------------------------------------------------------------------
  // Heatmap Analytical Modes
  // --------------------------------------------------------------------------
  const handleSetHeatmapMode = useCallback((mode) => {
    setActiveHeatmapMode(mode);
    setShowHeatmapMenu(false);

    satellitesRef.current.forEach((sat) => {
      const d = sat.userData;
      let colorHex;

      if (mode === 'TYPE') {
        colorHex = SATELLITE_TYPES[d.type].color;
      } else if (mode === 'ALTITUDE') {
        const norm = Math.min(1, Math.max(0, (d.altitude - 250) / 1400));
        const hue = (1.0 - norm) * 0.52;
        const col = new THREE.Color().setHSL(hue, 1.0, 0.52);
        colorHex = col.getHex();
      } else if (mode === 'VELOCITY') {
        const norm = Math.min(1, Math.max(0, (d.velocity - 6.9) / 0.95));
        const hue = 0.5 + norm * 0.35;
        const col = new THREE.Color().setHSL(hue, 1.0, 0.55);
        colorHex = col.getHex();
      } else if (mode === 'CONSTELLATION') {
        if (d.name.includes('STARLINK')) colorHex = 0x00e5ff;
        else if (d.name.includes('ONEWEB')) colorHex = 0xbf55ec;
        else if (d.name.includes('GPS') || d.name.includes('GALILEO')) colorHex = 0xffbb00;
        else if (d.type === 'DEBRIS') colorHex = 0xff2828;
        else if (d.type === 'ROCKET_BODY') colorHex = 0xff8800;
        else colorHex = 0x00ff88;
      }

      d.originalColor = colorHex;
      if (!selectedSatRef.current || sat !== selectedSatRef.current.mesh) {
        sat.material.color.setHex(colorHex);
      }
    });
  }, []);

  // --------------------------------------------------------------------------
  // Camera Presets
  // --------------------------------------------------------------------------
  const handleSetCameraPreset = useCallback((preset) => {
    setCameraPreset(preset);
    setShowCameraMenu(false);

    chaseSatRef.current = null;
    setChaseSat(null);
    flyToSatRef.current = null;

    let targetPos, targetLook;
    if (preset === 'GLOBAL') {
      targetPos = new THREE.Vector3(-2600, 4200, 24500);
      targetLook = new THREE.Vector3(-800, 0, 0);
    } else if (preset === 'SWARM') {
      targetPos = new THREE.Vector3(-7200, 1800, 9200);
      targetLook = new THREE.Vector3(-1200, 600, 5800);
    } else if (preset === 'POLAR') {
      targetPos = new THREE.Vector3(0, 24000, 1000);
      targetLook = new THREE.Vector3(0, 0, 0);
    } else if (preset === 'RADAR') {
      const ksr = latLonToVector3(-45.03, 169.68, EARTH_RADIUS + 350);
      targetPos = ksr.clone().add(ksr.clone().normalize().multiplyScalar(4500));
      targetLook = ksr;
    } else if (preset === 'SUN_SYNC') {
      targetPos = new THREE.Vector3(18000, 3000, 1000);
      targetLook = new THREE.Vector3(0, 0, 0);
    } else if (preset === 'CHASE') {
      handleToggleChase();
      return;
    }

    if (targetPos) {
      cameraTargetRef.current.copy(targetLook);
      cameraDesiredPosRef.current.copy(targetPos);
      isTransitioningCameraRef.current = true;
    }
  }, [handleToggleChase]);

  // Radar Surveillance Toggle
  const handleToggleRadars = useCallback(() => {
    const next = !radarsVisibleRef.current;
    radarsVisibleRef.current = next;
    setRadarsVisible(next);
    if (radarGroupRef.current) {
      radarGroupRef.current.visible = next;
    }
  }, []);

  // Fullscreen Handler
  const handleToggleFullscreen = useCallback(() => {
    const elem = containerRef.current;
    if (!elem) return;

    if (!document.fullscreenElement) {
      if (elem.requestFullscreen) elem.requestFullscreen();
      else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // --------------------------------------------------------------------------
  // Main Three.js Scene Setup & Continuous Animation Loop
  // --------------------------------------------------------------------------
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02050b);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 10, 350000);
    camera.position.set(-2600, 4200, 24500);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 6700;
    controls.maxDistance = 85000;
    controls.target.set(-800, 0, 0);
    controlsRef.current = controls;

    // Lighting
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
    sunLight.position.set(16000, -9000, 14000);
    scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0x182538, 0.75);
    scene.add(ambientLight);

    // Earth Master Group with 23.44° Axial Tilt
    const earthGroup = new THREE.Group();
    earthGroup.rotation.z = (23.439 * Math.PI) / 180;
    scene.add(earthGroup);
    earthGroupRef.current = earthGroup;

    // Earth Textures & Terminator Shader
    const dayTex = createFallbackDayTexture();
    const nightTex = createFallbackNightTexture();

    const earthShaderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uDayMap: { value: dayTex },
        uNightMap: { value: nightTex },
        uSunDirection: { value: new THREE.Vector3(16000, -9000, 14000).normalize() }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;

        void main() {
          vUv = uv;
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;

        uniform sampler2D uDayMap;
        uniform sampler2D uNightMap;
        uniform vec3 uSunDirection;

        void main() {
          vec3 N = normalize(vWorldNormal);
          vec3 L = normalize(uSunDirection);
          vec3 V = normalize(cameraPosition - vWorldPosition);

          float nDotL = dot(N, L);
          float dayFactor = smoothstep(-0.12, 0.18, nDotL);

          vec4 dayColor = texture2D(uDayMap, vUv);
          vec4 nightColor = texture2D(uNightMap, vUv);

          vec3 nightLights = nightColor.rgb * vec3(1.7, 1.35, 0.85) * (1.0 - dayFactor);
          float diffuse = max(0.0, nDotL);
          vec3 dayLit = dayColor.rgb * (diffuse * 0.95 + 0.08);

          vec3 H = normalize(L + V);
          float spec = pow(max(0.0, dot(N, H)), 28.0);
          float oceanMask = clamp((dayColor.b - dayColor.r) * 2.2, 0.0, 1.0);
          vec3 specularLight = vec3(0.5, 0.75, 1.0) * spec * oceanMask * max(0.0, nDotL);

          float sunsetRim = smoothstep(0.09, 0.0, abs(nDotL));
          vec3 sunsetColor = vec3(1.0, 0.48, 0.18) * sunsetRim * 0.28;

          vec3 finalSurface = mix(nightLights, dayLit, dayFactor) + specularLight + sunsetColor;
          gl_FragColor = vec4(finalSurface, 1.0);
        }
      `
    });

    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
    const earthMesh = new THREE.Mesh(earthGeo, earthShaderMaterial);
    earthGroup.add(earthMesh);
    earthRef.current = earthMesh;

    // Clouds
    const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS + 28, 64, 64);
    const cloudMat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      blending: THREE.NormalBlending,
      depthWrite: false
    });
    const cloudsMesh = new THREE.Mesh(cloudGeo, cloudMat);
    earthGroup.add(cloudsMesh);
    cloudsRef.current = cloudsMesh;

    // Atmospheric Inner Fresnel Haze
    const innerAtmosGeom = new THREE.SphereGeometry(EARTH_RADIUS + 45, 64, 64);
    const innerAtmosMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vec3 viewDir = normalize(-vPosition);
          float fresnel = 1.0 - max(0.0, dot(viewDir, vNormal));
          float alpha = pow(fresnel, 2.6);
          gl_FragColor = vec4(vec3(0.32, 0.72, 1.0), alpha * 0.48);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      transparent: true,
      depthWrite: false
    });
    const innerAtmos = new THREE.Mesh(innerAtmosGeom, innerAtmosMat);
    earthGroup.add(innerAtmos);

    // Outer Rayleigh Atmosphere Halo
    const outerAtmosGeom = new THREE.SphereGeometry(EARTH_RADIUS + 150, 64, 64);
    const outerAtmosMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vec3 viewDir = normalize(-vPosition);
          float rim = 1.0 - max(0.0, dot(viewDir, vNormal));
          float intensity = smoothstep(0.0, 1.0, pow(rim, 3.8));
          gl_FragColor = vec4(vec3(0.18, 0.52, 1.0), intensity * 0.65);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false
    });
    const outerAtmos = new THREE.Mesh(outerAtmosGeom, outerAtmosMat);
    earthGroup.add(outerAtmos);

    // Asynchronously load NASA textures
    const texLoader = new THREE.TextureLoader();
    texLoader.setCrossOrigin('anonymous');
    texLoader.load(TEXTURE_URLS.day, (t) => {
      t.anisotropy = 4;
      if (earthShaderMaterial.uniforms.uDayMap) earthShaderMaterial.uniforms.uDayMap.value = t;
    });
    texLoader.load(TEXTURE_URLS.night, (t) => {
      t.anisotropy = 4;
      if (earthShaderMaterial.uniforms.uNightMap) earthShaderMaterial.uniforms.uNightMap.value = t;
    });
    texLoader.load(TEXTURE_URLS.clouds, (t) => {
      if (cloudsRef.current) {
        cloudsRef.current.material.map = t;
        cloudsRef.current.material.needsUpdate = true;
      }
    });

    // 3D Milky Way Galaxy with 60,000 pinpoint stars
    const starCount = 60000;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);

    const galaxyRadius = 75000;
    let sIdx = 0;

    for (let i = 0; i < 12000; i++) {
      const r = Math.pow(Math.random(), 2.0) * (galaxyRadius * 0.28);
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI * 0.5;
      starPositions[sIdx * 3] = r * Math.cos(phi) * Math.cos(theta);
      starPositions[sIdx * 3 + 1] = r * Math.sin(phi);
      starPositions[sIdx * 3 + 2] = r * Math.cos(phi) * Math.sin(theta);

      const b = Math.random();
      starColors[sIdx * 3] = 1.0;
      starColors[sIdx * 3 + 1] = 0.88 + b * 0.12;
      starColors[sIdx * 3 + 2] = 0.70 + b * 0.30;
      starSizes[sIdx] = Math.random() * 2.0 + 1.0;
      sIdx++;
    }

    const arms = 2;
    for (let i = 0; i < 36000; i++) {
      const r = (0.06 + Math.pow(Math.random(), 0.55) * 0.94) * galaxyRadius;
      const armIndex = i % arms;
      const spiralAngle = (armIndex * Math.PI) + (r / galaxyRadius) * 3.6;
      const scatterAngle = (Math.random() - 0.5) * (1.1 + (r / galaxyRadius) * 0.6);
      const theta = spiralAngle + scatterAngle;
      const diskHeight = (galaxyRadius * 0.16) * (1 - r / (galaxyRadius * 1.25));
      const y = (Math.random() + Math.random() + Math.random() - 1.5) * diskHeight;

      starPositions[sIdx * 3] = r * Math.cos(theta);
      starPositions[sIdx * 3 + 1] = y;
      starPositions[sIdx * 3 + 2] = r * Math.sin(theta);

      const radiusRatio = r / galaxyRadius;
      const rand = Math.random();
      if (radiusRatio < 0.35) {
        starColors[sIdx * 3] = 1.0;
        starColors[sIdx * 3 + 1] = 0.88;
        starColors[sIdx * 3 + 2] = 0.72;
      } else if (rand < 0.65) {
        starColors[sIdx * 3] = 0.95;
        starColors[sIdx * 3 + 1] = 0.98;
        starColors[sIdx * 3 + 2] = 1.0;
      } else {
        starColors[sIdx * 3] = 0.75;
        starColors[sIdx * 3 + 1] = 0.88;
        starColors[sIdx * 3 + 2] = 1.0;
      }
      starSizes[sIdx] = Math.random() * 1.8 + 0.8;
      sIdx++;
    }

    for (let i = 0; i < 12000; i++) {
      const r = 50000 + Math.random() * 45000;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      starPositions[sIdx * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[sIdx * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[sIdx * 3 + 2] = r * Math.cos(phi);

      starColors[sIdx * 3] = 0.9;
      starColors[sIdx * 3 + 1] = 0.95;
      starColors[sIdx * 3 + 2] = 1.0;
      starSizes[sIdx] = Math.random() * 1.4 + 0.6;
      sIdx++;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

    const starMaterial = new THREE.PointsMaterial({
      size: 1.6,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      sizeAttenuation: false
    });

    const galaxy = new THREE.Points(starGeometry, starMaterial);
    galaxy.rotation.set(0.42, 1.45, -0.48);
    galaxy.position.set(3500, -1500, -8000);
    scene.add(galaxy);
    starFieldRef.current = galaxy;

    // LeoLabs Phased-Array Ground Radar Stations Group
    const radarGroup = new THREE.Group();
    earthGroup.add(radarGroup);
    radarGroupRef.current = radarGroup;

    RADAR_STATIONS.forEach((station) => {
      const surfacePos = latLonToVector3(station.lat, station.lon, EARTH_RADIUS);
      const normal = surfacePos.clone().normalize();

      const ringGeom = new THREE.RingGeometry(18, 55, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.position.copy(surfacePos.clone().multiplyScalar(1.001));
      ringMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      radarGroup.add(ringMesh);

      const beaconGeom = new THREE.CylinderGeometry(25, 35, 15, 16);
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0x33b5e5 });
      const beaconMesh = new THREE.Mesh(beaconGeom, beaconMat);
      beaconMesh.position.copy(surfacePos);
      beaconMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      radarGroup.add(beaconMesh);

      const coneHeight = 2400;
      const coneRadius = 750;
      const coneGeom = new THREE.ConeGeometry(coneRadius, coneHeight, 32, 1, true);
      coneGeom.translate(0, coneHeight / 2, 0);

      const coneMat = new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const coneMesh = new THREE.Mesh(coneGeom, coneMat);
      coneMesh.position.copy(surfacePos);
      coneMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      radarGroup.add(coneMesh);

      const scanRingGeom = new THREE.RingGeometry(100, 130, 32);
      const scanRingMat = new THREE.MeshBasicMaterial({
        color: 0x00ffcc,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending
      });
      const scanRing = new THREE.Mesh(scanRingGeom, scanRingMat);
      scanRing.position.copy(surfacePos.clone().add(normal.clone().multiplyScalar(400)));
      scanRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      scanRing.userData = {
        basePos: surfacePos,
        normal: normal,
        progress: Math.random()
      };
      radarGroup.add(scanRing);
    });

    // ------------------------------------------------------------------------
    // Construct 3,500 High-Tech 3D Satellites & Debris Objects
    // ------------------------------------------------------------------------
    const satCount = 3500;

    // Master Geometries (Recognizable spacecraft silhouettes)
    const masterGeometries = {
      ACTIVE: createActiveSatelliteGeometry(),
      ROCKET_BODY: createRocketBodyGeometry(),
      DEBRIS: createDebrisGeometry(),
      UNKNOWN: createUnknownGeometry()
    };

    const satList = [];
    const orbList = [];
    const newCounts = { ACTIVE: 0, DEBRIS: 0, ROCKET_BODY: 0, UNKNOWN: 0, TOTAL: satCount };

    for (let i = 0; i < satCount; i++) {
      let altitude;
      const altRand = Math.random();
      if (altRand < 0.74) {
        altitude = 260 + Math.random() * 560;
      } else if (altRand < 0.91) {
        altitude = 820 + Math.random() * 530;
      } else {
        altitude = 1350 + Math.random() * 650;
      }

      const semiMajorAxis = EARTH_RADIUS + altitude;
      const eccentricity = Math.random() < 0.85 ? Math.random() * 0.02 : Math.random() * 0.07;

      let inclination;
      const incRand = Math.random();
      if (incRand < 0.35) {
        inclination = (96 + (Math.random() - 0.5) * 6) * (Math.PI / 180);
      } else if (incRand < 0.65) {
        inclination = (53 + (Math.random() - 0.5) * 5) * (Math.PI / 180);
      } else if (incRand < 0.85) {
        inclination = (28 + Math.random() * 25) * (Math.PI / 180);
      } else {
        inclination = Math.random() * Math.PI;
      }

      const raan = Math.random() * Math.PI * 2;
      const argPerigee = Math.random() * Math.PI * 2;
      const trueAnomaly = Math.random() * Math.PI * 2;

      const typeRand = Math.random();
      let type;
      if (typeRand < 0.78) {
        type = 'ACTIVE';
      } else if (typeRand < 0.90) {
        type = 'DEBRIS';
      } else if (typeRand < 0.97) {
        type = 'ROCKET_BODY';
      } else {
        type = 'UNKNOWN';
      }

      newCounts[type]++;

      const color = SATELLITE_TYPES[type].color;
      const geom = masterGeometries[type];

      // Material supporting per-satellite category colors and hover emissive highlight
      const mat = new THREE.MeshPhongMaterial({
        color: color,
        emissive: 0x000000,
        shininess: 40,
        flatShading: type === 'DEBRIS'
      });

      const satellite = new THREE.Mesh(geom, mat);

      const orbitalPeriod = calculateOrbitalPeriod(semiMajorAxis);
      const cosW = Math.cos(argPerigee);
      const sinW = Math.sin(argPerigee);
      const cosI = Math.cos(inclination);
      const sinI = Math.sin(inclination);
      const cosO = Math.cos(raan);
      const sinO = Math.sin(raan);
      const eccSquared = eccentricity * eccentricity;
      const meanMotion = (2 * Math.PI) / orbitalPeriod;

      const cosTA = Math.cos(trueAnomaly);
      const sinTA = Math.sin(trueAnomaly);
      const dist = (semiMajorAxis * (1 - eccSquared)) / (1 + eccentricity * cosTA);
      const x0 = dist * cosTA;
      const y0 = dist * sinTA;
      const x1 = x0 * cosW - y0 * sinW;
      const y1 = x0 * sinW + y0 * cosW;
      const x2 = x1;
      const y2 = y1 * cosI;
      const z2 = y1 * sinI;

      satellite.position.set(
        x2 * cosO - y2 * sinO,
        x2 * sinO + y2 * cosO,
        z2
      );

      // Orient satellite along orbital tangent
      if (type === 'ACTIVE' || type === 'ROCKET_BODY') {
        const forward = new THREE.Vector3(-y1, x1, 0).normalize();
        satellite.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);
      } else if (type === 'DEBRIS') {
        satellite.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      }

      // Orbital Trajectory line
      const orbitPoints = [];
      const segments = 64;
      for (let s = 0; s <= segments; s++) {
        const ta = (s / segments) * Math.PI * 2;
        const d = (semiMajorAxis * (1 - eccSquared)) / (1 + eccentricity * Math.cos(ta));
        const px0 = d * Math.cos(ta);
        const py0 = d * Math.sin(ta);
        const px1 = px0 * cosW - py0 * sinW;
        const py1 = px0 * sinW + py0 * cosW;
        const px2 = px1;
        const py2 = py1 * cosI;
        const pz2 = py1 * sinI;
        const px3 = px2 * cosO - py2 * sinO;
        const py3 = px2 * sinO + py2 * cosO;
        orbitPoints.push(new THREE.Vector3(px3, py3, pz2));
      }
      const orbGeom = new THREE.BufferGeometry().setFromPoints(orbitPoints);
      const orbMat = new THREE.LineBasicMaterial({ color: 0x27527c, transparent: true, opacity: 0.22 });
      const orbitLine = new THREE.Line(orbGeom, orbMat);
      orbitLine.visible = false;
      scene.add(orbitLine);

      const satName = generateSatelliteName(type, i);
      satellite.userData = {
        isSatellite: true,
        id: `SAT-${10000 + i}`,
        name: satName,
        type: type,
        originalColor: color,
        semiMajorAxis: semiMajorAxis,
        eccentricity: eccentricity,
        inclination: inclination,
        raan: raan,
        argPerigee: argPerigee,
        trueAnomaly: trueAnomaly,
        orbitalPeriod: orbitalPeriod,
        altitude: altitude,
        velocity: calculateOrbitalVelocity(semiMajorAxis),
        orbit: orbitLine,
        cosW, sinW, cosI, sinI, cosO, sinO, eccSquared, meanMotion,
        rotSpeed: type === 'DEBRIS' ? (Math.random() - 0.5) * 0.04 : 0
      };

      scene.add(satellite);
      satList.push(satellite);
      orbList.push(orbitLine);
    }

    satellitesRef.current = satList;
    orbitsRef.current = orbList;
    setCounts(newCounts);

    // Dedicated Encounter Group for primary/secondary tracks, covariance & beacons
    const encounterGroup = new THREE.Group();
    scene.add(encounterGroup);
    encounterGroupRef.current = encounterGroup;

    // Dedicated Pair Selection Group for dual-selected beacon rings & 3D dashed tether line
    const pairGroup = new THREE.Group();
    scene.add(pairGroup);
    pairVisualGroupRef.current = pairGroup;

    // Primary Cyan Beacon Ring
    const pRingGeom = new THREE.RingGeometry(35, 95, 32);
    const pRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    const pBeacon = new THREE.Mesh(pRingGeom, pRingMat);
    pBeacon.visible = false;
    pairGroup.add(pBeacon);
    primaryBeaconRef.current = pBeacon;

    // Secondary Red Beacon Ring
    const sRingGeom = new THREE.RingGeometry(35, 95, 32);
    const sRingMat = new THREE.MeshBasicMaterial({
      color: 0xff1744,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    const sBeacon = new THREE.Mesh(sRingGeom, sRingMat);
    sBeacon.visible = false;
    pairGroup.add(sBeacon);
    secondaryBeaconRef.current = sBeacon;

    // Inter-Object 3D Dashed Tether Line
    const tetherGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)]);
    const tetherMat = new THREE.LineDashedMaterial({
      color: 0xffd600,
      dashSize: 180,
      gapSize: 90,
      linewidth: 2,
      transparent: true,
      opacity: 0.95
    });
    const pairTetherLine = new THREE.Line(tetherGeom, tetherMat);
    pairTetherLine.visible = false;
    pairGroup.add(pairTetherLine);
    pairTetherLineRef.current = pairTetherLine;

    // Hover Highlight Reticle Ring
    const hoverRingGeom = new THREE.RingGeometry(35, 48, 32);
    const hoverRingMat = new THREE.MeshBasicMaterial({
      color: 0x55ffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    const hoverReticle = new THREE.Mesh(hoverRingGeom, hoverRingMat);
    hoverReticle.visible = false;
    scene.add(hoverReticle);
    hoverReticleRef.current = hoverReticle;

    // Thruster Pulse Plume Mesh
    const thrusterGeo = new THREE.RingGeometry(20, 90, 32);
    const thrusterMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const thrusterMesh = new THREE.Mesh(thrusterGeo, thrusterMat);
    thrusterMesh.visible = false;
    scene.add(thrusterMesh);
    thrusterPlumeRef.current = thrusterMesh;

    // Continuous 60fps Animation Loop
    let frameCount = 0;
    let lastFpsUpdate = performance.now();

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      const now = performance.now();
      frameCount++;
      if (now - lastFpsUpdate >= 500) {
        setFps(Math.round((frameCount * 1000) / (now - lastFpsUpdate)));
        frameCount = 0;
        lastFpsUpdate = now;
      }

      const deltaTime = 16.67;

      // Update Keplerian Satellites using live ref values
      if (isPlayingRef.current) {
        const currentScale = timeScaleRef.current;
        const timeStep = (deltaTime * currentScale) / 1000;

        simTimeRef.current = new Date(simTimeRef.current.getTime() + deltaTime * currentScale);
        setUtcTimeStr(simTimeRef.current.toISOString().substring(0, 19).replace('T', ' ') + ' UTC');

        for (let i = 0; i < satList.length; i++) {
          const sat = satList[i];
          const d = sat.userData;
          d.trueAnomaly += d.meanMotion * timeStep;
          if (d.trueAnomaly > 6.2831853) d.trueAnomaly -= 6.2831853;

          const cosTA = Math.cos(d.trueAnomaly);
          const sinTA = Math.sin(d.trueAnomaly);
          const dist = (d.semiMajorAxis * (1 - d.eccSquared)) / (1 + d.eccentricity * cosTA);
          const x0 = dist * cosTA;
          const y0 = dist * sinTA;
          const x1 = x0 * d.cosW - y0 * d.sinW;
          const y1 = x0 * d.sinW + y0 * d.cosW;
          const x2 = x1;
          const y2 = y1 * d.cosI;
          const z2 = y1 * d.sinI;

          sat.position.set(
            x2 * d.cosO - y2 * d.sinO,
            x2 * d.sinO + y2 * d.cosO,
            z2
          );

          if (d.rotSpeed) {
            sat.rotation.x += d.rotSpeed;
            sat.rotation.y += d.rotSpeed;
          }
        }

        // Earth & Clouds Rotation
        if (earthRef.current && earthRotationRef.current) {
          earthRef.current.rotation.y += timeStep * 0.00007292115;
          if (cloudsRef.current) {
            cloudsRef.current.rotation.y += timeStep * 0.00007292115 * 1.02;
          }
        }

        // Animate Pulsing Radar Beam Rings
        if (radarGroupRef.current && radarsVisibleRef.current) {
          radarGroupRef.current.children.forEach((child) => {
            if (child.userData && child.userData.progress !== undefined) {
              child.userData.progress += 0.008;
              if (child.userData.progress > 1.0) child.userData.progress = 0;
              const h = child.userData.progress * 2200;
              child.position.copy(
                child.userData.basePos.clone().add(child.userData.normal.clone().multiplyScalar(h))
              );
              child.scale.setScalar(1 + child.userData.progress * 4.5);
              child.material.opacity = (1.0 - child.userData.progress) * 0.45;
            }
          });
        }
      }

      // Update Hover Reticle Position & Orientation
      if (hoveredSatRef.current && hoverReticleRef.current) {
        hoverReticleRef.current.position.copy(hoveredSatRef.current.position);
        hoverReticleRef.current.lookAt(camera.position);
        hoverReticleRef.current.visible = true;
      } else if (hoverReticleRef.current) {
        hoverReticleRef.current.visible = false;
      }

      // Update Dual-Selection Beacon Rings & Inter-Object Tether Line
      const curPair = selectedPairRef.current;
      if (curPair?.primary?.mesh && primaryBeaconRef.current) {
        primaryBeaconRef.current.position.copy(curPair.primary.mesh.position);
        primaryBeaconRef.current.lookAt(camera.position);
        const pulse = 1.0 + Math.sin(performance.now() * 0.005) * 0.2;
        primaryBeaconRef.current.scale.set(pulse, pulse, pulse);
        primaryBeaconRef.current.visible = true;
      } else if (primaryBeaconRef.current) {
        primaryBeaconRef.current.visible = false;
      }

      if (curPair?.secondary?.mesh && secondaryBeaconRef.current) {
        secondaryBeaconRef.current.position.copy(curPair.secondary.mesh.position);
        secondaryBeaconRef.current.lookAt(camera.position);
        const pulse = 1.0 + Math.sin(performance.now() * 0.005 + 1.5) * 0.2;
        secondaryBeaconRef.current.scale.set(pulse, pulse, pulse);
        secondaryBeaconRef.current.visible = true;
      } else if (secondaryBeaconRef.current) {
        secondaryBeaconRef.current.visible = false;
      }

      if (curPair?.primary?.mesh && curPair?.secondary?.mesh && pairTetherLineRef.current) {
        pairTetherLineRef.current.geometry.setFromPoints([
          curPair.primary.mesh.position,
          curPair.secondary.mesh.position
        ]);
        pairTetherLineRef.current.computeLineDistances();
        pairTetherLineRef.current.visible = true;

        if (frameCount % 10 === 0) {
          const liveDist = curPair.primary.mesh.position.distanceTo(curPair.secondary.mesh.position);
          setPairDistanceKm(liveDist);
        }
      } else if (pairTetherLineRef.current) {
        pairTetherLineRef.current.visible = false;
      }

      // 1. Dynamic Live Tracking Fly-To Transition
      if (flyToSatRef.current && isTransitioningCameraRef.current) {
        const satPos = flyToSatRef.current.position;
        const targetDir = satPos.clone().normalize();
        const desiredCam = satPos.clone().add(targetDir.multiplyScalar(2200));

        camera.position.lerp(desiredCam, 0.08);
        controls.target.lerp(satPos, 0.08);

        if (camera.position.distanceTo(desiredCam) < 40 && controls.target.distanceTo(satPos) < 15) {
          flyToSatRef.current = null;
          isTransitioningCameraRef.current = false;
          controls.target.copy(satPos);
        }
      }
      // 2. Static Target Camera Transitions (e.g. Presets)
      else if (isTransitioningCameraRef.current) {
        camera.position.lerp(cameraDesiredPosRef.current, 0.06);
        controls.target.lerp(cameraTargetRef.current, 0.06);
        if (
          camera.position.distanceTo(cameraDesiredPosRef.current) < 25 &&
          controls.target.distanceTo(cameraTargetRef.current) < 8
        ) {
          isTransitioningCameraRef.current = false;
        }
      }

      // 3. Continuous Chase Camera Follow
      if (chaseSatRef.current && !isTransitioningCameraRef.current) {
        const satPos = chaseSatRef.current.position;
        const posNorm = satPos.clone().normalize();
        const camOffset = satPos.clone().add(posNorm.clone().multiplyScalar(1200)).add(new THREE.Vector3(0, 350, 0));

        camera.position.lerp(camOffset, 0.08);
        controls.target.copy(satPos);
      }

      // Update Controls & Render
      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // ------------------------------------------------------------------------
    // Raycasting & Pointer Events (Click vs Drag Detection, Subtle Hover)
    // ------------------------------------------------------------------------
    let pointerDownPos = { x: 0, y: 0, time: 0 };

    const findNearestSatellite = (mouseVec) => {
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouseVec, camera);
      const ray = raycaster.ray;

      let closest = null;
      let closestDist = Infinity;

      for (let i = 0; i < satList.length; i++) {
        const sat = satList[i];
        if (!sat.visible) continue;
        const distToRay = ray.distanceToPoint(sat.position);
        const distToCam = camera.position.distanceTo(sat.position);
        const threshold = (distToCam / 22000) * 380;

        if (distToRay < threshold && distToRay < closestDist) {
          closestDist = distToRay;
          closest = sat;
        }
      }
      return closest;
    };

    const handlePointerMove = (e) => {
      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const hit = findNearestSatellite(mouse);

      if (hit !== hoveredSatRef.current) {
        // Reset previous hovered satellite's visual highlight (if not the selected sat)
        if (hoveredSatRef.current && hoveredSatRef.current !== selectedSatRef.current?.mesh) {
          hoveredSatRef.current.material.emissive.setHex(0x000000);
        }

        hoveredSatRef.current = hit;

        // Apply subtle visual highlight to new hovered object (without popup card)
        if (hit) {
          if (hit !== selectedSatRef.current?.mesh) {
            hit.material.emissive.setHex(0x4488aa);
          }
          container.style.cursor = 'pointer';
        } else {
          container.style.cursor = 'grab';
        }
      }
    };

    const handlePointerLeave = () => {
      if (hoveredSatRef.current && hoveredSatRef.current !== selectedSatRef.current?.mesh) {
        hoveredSatRef.current.material.emissive.setHex(0x000000);
      }
      hoveredSatRef.current = null;
      if (hoverReticleRef.current) hoverReticleRef.current.visible = false;
      container.style.cursor = 'grab';
    };

    const handlePointerDown = (e) => {
      pointerDownPos = { x: e.clientX, y: e.clientY, time: performance.now() };
    };

    const handlePointerUp = (e) => {
      if (e.target && e.target.closest && e.target.closest('.hud-interactive')) return;

      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dt = performance.now() - pointerDownPos.time;

      // Distinguish click from camera drag (threshold <= 6px and quick release)
      if (dist > 6 || dt > 1200) return;

      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const hit = findNearestSatellite(mouse);
      if (hit) {
        selectSatelliteInPair(hit);
      }
    };

    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerleave', handlePointerLeave);
    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameIdRef.current);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerleave', handlePointerLeave);
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
    };
  }, [selectSatellite, deselectSatellite]);

  // --------------------------------------------------------------------------
  // Conjunction Encounter Integration
  // --------------------------------------------------------------------------
  useEffect(() => {
    const encounterGroup = encounterGroupRef.current;
    if (!encounterGroup) return;

    while (encounterGroup.children.length > 0) {
      const obj = encounterGroup.children[0];
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
      encounterGroup.remove(obj);
    }

    if (!selectedConjunction) return;

    const primaryPos = toSceneVec3(selectedConjunction.primary_r_eci);
    const secondaryPos = toSceneVec3(selectedConjunction.secondary_r_eci);

    // Dynamic Conjunction Laser Tether Line
    const tetherGeom = new THREE.BufferGeometry().setFromPoints([primaryPos, secondaryPos]);
    const tetherMat = new THREE.LineBasicMaterial({
      color: 0xff1744,
      transparent: true,
      opacity: 0.95,
      linewidth: 2
    });
    const tetherLine = new THREE.Line(tetherGeom, tetherMat);
    encounterGroup.add(tetherLine);
    conjunctionTetherLineRef.current = tetherLine;

    // Primary Satellite Beacon Ring & Core
    const ringGeom = new THREE.RingGeometry(35, 120, 32);
    const pRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    const pRing = new THREE.Mesh(ringGeom, pRingMat);
    pRing.position.copy(primaryPos);
    pRing.lookAt(0, 0, 0);
    encounterGroup.add(pRing);

    const pCoreGeom = new THREE.SphereGeometry(45, 16, 16);
    const pCoreMat = new THREE.MeshBasicMaterial({ color: 0x00e676 });
    const pCore = new THREE.Mesh(pCoreGeom, pCoreMat);
    pCore.position.copy(primaryPos);
    encounterGroup.add(pCore);

    // Secondary Object Beacon Ring & Core
    const sRingMat = new THREE.MeshBasicMaterial({
      color: 0xff1744,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    const sRing = new THREE.Mesh(ringGeom, sRingMat);
    sRing.position.copy(secondaryPos);
    sRing.lookAt(0, 0, 0);
    encounterGroup.add(sRing);

    const sCoreGeom = new THREE.SphereGeometry(45, 16, 16);
    const sCoreMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
    const sCore = new THREE.Mesh(sCoreGeom, sCoreMat);
    sCore.position.copy(secondaryPos);
    encounterGroup.add(sCore);

    // Primary Track
    if (conjunctionDetails?.primary_track_eci_km && conjunctionDetails.primary_track_eci_km.length > 1) {
      const pts = conjunctionDetails.primary_track_eci_km.map(toSceneVec3);
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineDashedMaterial({
        color: 0xff1744,
        dashSize: 120,
        gapSize: 60,
        linewidth: 2
      });
      const line = new THREE.Line(geo, mat);
      line.computeLineDistances();
      encounterGroup.add(line);
    }

    // Secondary Track
    if (conjunctionDetails?.secondary_track_eci_km && conjunctionDetails.secondary_track_eci_km.length > 1) {
      const pts = conjunctionDetails.secondary_track_eci_km.map(toSceneVec3);
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: 0xffd600,
        transparent: true,
        opacity: 0.85,
        linewidth: 2
      });
      encounterGroup.add(new THREE.Line(geo, mat));
    }

    // Avoidance Maneuver Track
    if (burnData?.trajectories?.avoidance_track && burnData.trajectories.avoidance_track.length > 1) {
      const pts = burnData.trajectories.avoidance_track.map(toSceneVec3);
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: 0x00e676,
        transparent: true,
        opacity: 0.95,
        linewidth: 3
      });
      encounterGroup.add(new THREE.Line(geo, mat));
    }

    // Covariance Ellipsoids
    if (selectedConjunction.primary_r_eci) {
      const bPlane = selectedConjunction.b_plane || {};
      const sigmaMajKm = Number(bPlane.sigma_major_m || 65.0) / 1000.0;
      const sigmaMinKm = Number(bPlane.sigma_minor_m || 20.0) / 1000.0;

      const rMaj = Math.max(90, sigmaMajKm * 400.0);
      const rMin = Math.max(45, sigmaMinKm * 400.0);

      const covGeo = new THREE.SphereGeometry(rMaj, 24, 18);
      covGeo.scale(1.0, rMin / rMaj, rMin / rMaj);

      const covMat = new THREE.MeshPhongMaterial({
        color: 0x00f2fe,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const covMesh = new THREE.Mesh(covGeo, covMat);
      covMesh.position.copy(primaryPos);
      encounterGroup.add(covMesh);

      const secCovGeo = new THREE.SphereGeometry(rMaj * 0.75, 20, 16);
      secCovGeo.scale(1.0, rMin / rMaj, rMin / rMaj);
      const secCovMat = new THREE.MeshPhongMaterial({
        color: 0xff1744,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const secCovMesh = new THREE.Mesh(secCovGeo, secCovMat);
      secCovMesh.position.copy(secondaryPos);
      encounterGroup.add(secCovMesh);
    }
  }, [selectedConjunction, conjunctionDetails, burnData]);

  // Focus on selected encounter
  const handleFocusEncounter = useCallback(() => {
    if (!selectedConjunction?.primary_r_eci) return;
    const primaryPos = toSceneVec3(selectedConjunction.primary_r_eci);
    const secondaryPos = toSceneVec3(selectedConjunction.secondary_r_eci);
    const midpoint = primaryPos.clone().add(secondaryPos).multiplyScalar(0.5);

    const targetDir = midpoint.clone().normalize();
    const desiredCam = midpoint.clone().add(targetDir.multiplyScalar(2400)).add(new THREE.Vector3(600, 400, 800));

    chaseSatRef.current = null;
    setChaseSat(null);
    flyToSatRef.current = null;

    cameraTargetRef.current.copy(midpoint);
    cameraDesiredPosRef.current.copy(desiredCam);
    isTransitioningCameraRef.current = true;
    setCameraPreset('ENCOUNTER');
  }, [selectedConjunction]);

  // Thruster Plume during Maneuver Execution
  useEffect(() => {
    if (isBurnExecuting && selectedConjunction?.primary_r_eci && thrusterPlumeRef.current) {
      const primaryPos = toSceneVec3(selectedConjunction.primary_r_eci);
      thrusterPlumeRef.current.position.copy(primaryPos);
      thrusterPlumeRef.current.visible = true;

      const timer = setTimeout(() => {
        if (thrusterPlumeRef.current) thrusterPlumeRef.current.visible = false;
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isBurnExecuting, selectedConjunction]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-[#020617] overflow-hidden select-none font-sans"
    >
      {/* 3D Viewport Mount */}
      <div
        ref={mountRef}
        className="w-full h-full absolute inset-0 cursor-grab active:cursor-grabbing"
        style={{
          background: 'radial-gradient(ellipse at 50% 45%, #0B172E 0%, #030712 70%, #000208 100%)'
        }}
      />

      {/* Subtle Inner Space Vignette */}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_90px_rgba(0,0,0,0.8)]" />

      {/* ============================================================================== */}
      {/* HUD OVERLAYS                                                                   */}
      {/* ============================================================================== */}
      <div className="pointer-events-none absolute inset-0 z-10 font-sans">

        {/* TOP LEFT: Quick Status & Catalog Count */}
        <div className="pointer-events-auto absolute top-3.5 left-3.5 flex items-center space-x-2 hud-interactive">
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-900/75 hover:bg-slate-900/90 backdrop-blur-md border border-slate-700/60 text-slate-200 shadow-md">
            <span className="tabular-nums text-xs font-semibold text-emerald-400">
              {counts.TOTAL ? `${counts.TOTAL.toLocaleString()} TRACKED` : '3,500 TRACKED'}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-[11px] text-slate-300 tabular-nums">{utcTimeStr || 'LIVE UTC'}</span>
          </div>

          {/* LeoLabs Radar Network Quick Toggle */}
          <button
            onClick={handleToggleRadars}
            className={`px-3 py-1.5 rounded-xl backdrop-blur-md border text-xs font-medium flex items-center space-x-1.5 transition-all shadow-md cursor-pointer ${
              radarsVisible
                ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-900/60 hover:bg-slate-900/80 border-slate-700/60 text-slate-400'
            }`}
            title="Toggle 6 LeoLabs Global Phased-Array Space Radars"
          >
            <RadarIcon className="w-3.5 h-3.5 text-cyan-400" />
            <span>Radar Net</span>
          </button>
        </div>

        {/* TOP RIGHT: Heatmap, Camera Presets & Layer Legend Dropdowns */}
        <div className="pointer-events-auto absolute top-3.5 right-3.5 flex items-center space-x-2 hud-interactive">
          
          {/* Analytical Heatmap Mode Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowHeatmapMenu(!showHeatmapMenu);
                setShowCameraMenu(false);
                setShowLegendMenu(false);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900/75 hover:bg-slate-900/90 backdrop-blur-md border border-slate-700/60 text-slate-200 hover:text-white text-xs font-medium flex items-center space-x-1.5 transition-all shadow-md cursor-pointer"
              title="Change Analytical Color Heatmap"
            >
              <Layers className="w-3.5 h-3.5 text-teal-400" />
              <span>Color: {activeHeatmapMode === 'TYPE' ? 'Type' : activeHeatmapMode === 'ALTITUDE' ? 'Altitude' : activeHeatmapMode === 'VELOCITY' ? 'Velocity' : 'Clusters'}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showHeatmapMenu && (
              <div className="absolute top-full right-0 mt-2 w-48 rounded-xl bg-slate-950/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl p-1.5 text-xs text-slate-200 space-y-1 z-50">
                <button
                  onClick={() => handleSetHeatmapMode('TYPE')}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center justify-between cursor-pointer ${activeHeatmapMode === 'TYPE' ? 'bg-teal-500/20 text-teal-300 font-semibold' : 'hover:bg-slate-800/70 text-slate-300'}`}
                >
                  <span>Object Classification</span>
                  <span className="w-2 h-2 rounded-xs bg-emerald-400" />
                </button>
                <button
                  onClick={() => handleSetHeatmapMode('ALTITUDE')}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center justify-between cursor-pointer ${activeHeatmapMode === 'ALTITUDE' ? 'bg-teal-500/20 text-teal-300 font-semibold' : 'hover:bg-slate-800/70 text-slate-300'}`}
                >
                  <span>Altitude Heatmap</span>
                  <span className="w-2 h-2 rounded-xs bg-cyan-400" />
                </button>
                <button
                  onClick={() => handleSetHeatmapMode('VELOCITY')}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center justify-between cursor-pointer ${activeHeatmapMode === 'VELOCITY' ? 'bg-teal-500/20 text-teal-300 font-semibold' : 'hover:bg-slate-800/70 text-slate-300'}`}
                >
                  <span>Orbital Velocity</span>
                  <span className="w-2 h-2 rounded-xs bg-purple-400" />
                </button>
                <button
                  onClick={() => handleSetHeatmapMode('CONSTELLATION')}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center justify-between cursor-pointer ${activeHeatmapMode === 'CONSTELLATION' ? 'bg-teal-500/20 text-teal-300 font-semibold' : 'hover:bg-slate-800/70 text-slate-300'}`}
                >
                  <span>Constellation Clusters</span>
                  <span className="w-2 h-2 rounded-xs bg-amber-400" />
                </button>
              </div>
            )}
          </div>

          {/* Camera Presets Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowCameraMenu(!showCameraMenu);
                setShowHeatmapMenu(false);
                setShowLegendMenu(false);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900/75 hover:bg-slate-900/90 backdrop-blur-md border border-slate-700/60 text-slate-200 hover:text-white text-xs font-medium flex items-center space-x-1.5 transition-all shadow-md cursor-pointer"
              title="Camera View Angles"
            >
              <Video className="w-3.5 h-3.5 text-cyan-400" />
              <span>Camera</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showCameraMenu && (
              <div className="absolute top-full right-0 mt-2 w-48 rounded-xl bg-slate-950/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl p-1.5 text-xs text-slate-200 space-y-1 z-50">
                <button
                  onClick={() => handleSetCameraPreset('GLOBAL')}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center space-x-2 cursor-pointer ${cameraPreset === 'GLOBAL' ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'hover:bg-slate-800/70 text-slate-300'}`}
                >
                  <Globe2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Global LEO Overview</span>
                </button>
                <button
                  onClick={() => handleSetCameraPreset('SWARM')}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center space-x-2 cursor-pointer ${cameraPreset === 'SWARM' ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'hover:bg-slate-800/70 text-slate-300'}`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                  <span>LEO Swarm Skimmer</span>
                </button>
                <button
                  onClick={() => handleSetCameraPreset('POLAR')}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center space-x-2 cursor-pointer ${cameraPreset === 'POLAR' ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'hover:bg-slate-800/70 text-slate-300'}`}
                >
                  <Compass className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Polar Orbit Zenith</span>
                </button>
                <button
                  onClick={() => handleSetCameraPreset('RADAR')}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center space-x-2 cursor-pointer ${cameraPreset === 'RADAR' ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'hover:bg-slate-800/70 text-slate-300'}`}
                >
                  <RadarIcon className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Kiwi Radar Site (NZ)</span>
                </button>
                <button
                  onClick={() => handleSetCameraPreset('CHASE')}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center space-x-2 cursor-pointer ${chaseSat ? 'bg-rose-500/20 text-rose-300 font-semibold' : 'hover:bg-slate-800/70 text-slate-300'}`}
                >
                  <Crosshair className="w-3.5 h-3.5 text-rose-400" />
                  <span>{chaseSat ? 'Stop Chase Cam' : 'Satellite Chase Cam'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Swarm Legend Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowLegendMenu(!showLegendMenu);
                setShowHeatmapMenu(false);
                setShowCameraMenu(false);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900/75 hover:bg-slate-900/90 backdrop-blur-md border border-slate-700/60 text-slate-200 hover:text-white text-xs font-medium flex items-center space-x-1.5 transition-all shadow-md cursor-pointer"
              title="Toggle Swarm Legend & Classification"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Legend</span>
            </button>

            {showLegendMenu && (
              <div className="absolute top-full right-0 mt-2 w-56 rounded-xl bg-slate-950/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl p-3.5 text-xs text-slate-200 space-y-2.5 z-50">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-1.5 border-b border-slate-800">
                  LEO Population Classification
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#00e644]" />
                      <span>Active Payloads</span>
                    </div>
                    <span className="tabular-nums text-slate-400">{counts.ACTIVE.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#ff2828]" />
                      <span>Tracked Debris</span>
                    </div>
                    <span className="tabular-nums text-slate-400">{counts.DEBRIS.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#ffaa00]" />
                      <span>Rocket Bodies</span>
                    </div>
                    <span className="tabular-nums text-slate-400">{counts.ROCKET_BODY.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#0077ff]" />
                      <span>Unknown / Other</span>
                    </div>
                    <span className="tabular-nums text-slate-400">{counts.UNKNOWN.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ============================================================================== */}
        {/* FLOATING "ENCOUNTER PAIR" HUD CARD (Dual-Selection & 2D Sandbox Launcher)     */}
        {/* ============================================================================== */}
        {selectedPair.primary && (
          <div className="pointer-events-auto absolute bottom-20 right-4 w-84 md:w-92 rounded-2xl bg-slate-950/92 backdrop-blur-xl border border-cyan-500/40 shadow-2xl p-4 text-slate-200 text-xs space-y-3 z-30 hud-interactive animate-in fade-in slide-in-from-bottom-3 duration-200">
            {/* Header & Lock Status */}
            <div className="flex items-center justify-between pb-2.5 border-b border-cyan-500/25">
              <div className="flex items-center space-x-2">
                <div className="p-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-extrabold text-cyan-200 text-xs tracking-wider uppercase font-sans">
                    Encounter Pair HUD
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {selectedPair.secondary ? '2/2 TARGETS LOCKED' : '1/2 SELECTED (CLICK 2ND SATELLITE)'}
                  </div>
                </div>
              </div>
              <button
                onClick={clearPairSelection}
                className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800/70 rounded-lg transition-all cursor-pointer text-[11px] font-semibold flex items-center space-x-1"
                title="Clear selection [x]"
              >
                <span>Clear</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Target A (Primary Satellite - Cyan Beacon) */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-cyan-500/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-[10px] font-bold tracking-wider text-cyan-300 uppercase">
                    Object A (Primary)
                  </span>
                </div>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-semibold border"
                  style={{
                    backgroundColor: `${SATELLITE_TYPES[selectedPair.primary.data.type]?.colorHex || '#00e644'}18`,
                    color: SATELLITE_TYPES[selectedPair.primary.data.type]?.colorHex || '#00e644',
                    borderColor: `${SATELLITE_TYPES[selectedPair.primary.data.type]?.colorHex || '#00e644'}40`
                  }}
                >
                  {SATELLITE_TYPES[selectedPair.primary.data.type]?.label || selectedPair.primary.data.type}
                </span>
              </div>
              <div className="font-bold text-white text-xs truncate">
                {selectedPair.primary.data.name}
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-300 pt-0.5">
                <div>
                  <span className="text-slate-400">Altitude:</span>{' '}
                  <span className="tabular-nums font-semibold text-slate-100">
                    {selectedPair.primary.data.altitude.toFixed(1)} km
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Velocity:</span>{' '}
                  <span className="tabular-nums font-semibold text-cyan-300">
                    {selectedPair.primary.data.velocity.toFixed(2)} km/s
                  </span>
                </div>
              </div>
            </div>

            {/* Encounter Kinematics (Separation & Relative Velocity) */}
            {selectedPair.secondary ? (
              <div className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-950/40 via-slate-900/90 to-rose-950/40 border border-slate-700/80">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex flex-col">
                    <span className="text-[9.5px] uppercase text-slate-400 font-semibold tracking-wider">
                      3D Euclidean Separation
                    </span>
                    <span className="text-sm font-extrabold text-amber-300 tabular-nums">
                      {pairDistanceKm.toFixed(1)} km
                    </span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[9.5px] uppercase text-slate-400 font-semibold tracking-wider">
                      Relative Closing Speed
                    </span>
                    <span className="text-sm font-extrabold text-rose-400 tabular-nums">
                      {(() => {
                        const vA = getOrbitalVelocityVector(selectedPair.primary.data);
                        const vB = getOrbitalVelocityVector(selectedPair.secondary.data);
                        const rel = vA.clone().sub(vB).length();
                        return rel > 0.1
                          ? `${rel.toFixed(2)} km/s`
                          : `${Math.abs(selectedPair.primary.data.velocity - selectedPair.secondary.data.velocity).toFixed(2)} km/s`;
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-slate-900/40 border border-dashed border-slate-700/80 text-center text-[10.5px] text-slate-400">
                Click any 2nd satellite or debris object on the 3D globe to establish encounter pair & relative vectors.
              </div>
            )}

            {/* Target B (Secondary Object - Red Beacon) */}
            {selectedPair.secondary && (
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-rose-500/30 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span className="text-[10px] font-bold tracking-wider text-rose-300 uppercase">
                      Object B (Secondary / Interceptor)
                    </span>
                  </div>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-semibold border"
                    style={{
                      backgroundColor: `${SATELLITE_TYPES[selectedPair.secondary.data.type]?.colorHex || '#ff2828'}18`,
                      color: SATELLITE_TYPES[selectedPair.secondary.data.type]?.colorHex || '#ff2828',
                      borderColor: `${SATELLITE_TYPES[selectedPair.secondary.data.type]?.colorHex || '#ff2828'}40`
                    }}
                  >
                    {SATELLITE_TYPES[selectedPair.secondary.data.type]?.label || selectedPair.secondary.data.type}
                  </span>
                </div>
                <div className="font-bold text-white text-xs truncate">
                  {selectedPair.secondary.data.name}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-300 pt-0.5">
                  <div>
                    <span className="text-slate-400">Altitude:</span>{' '}
                    <span className="tabular-nums font-semibold text-slate-100">
                      {selectedPair.secondary.data.altitude.toFixed(1)} km
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Velocity:</span>{' '}
                    <span className="tabular-nums font-semibold text-rose-300">
                      {selectedPair.secondary.data.velocity.toFixed(2)} km/s
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Bar & Launch in 2D Sandbox Button */}
            <div className="space-y-2 pt-1 border-t border-slate-800">
              <div className="flex space-x-2">
                <button
                  onClick={handleFlyToSatellite}
                  className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-1 transition-all cursor-pointer"
                  title="Smoothly fly camera to selected object"
                >
                  <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Fly To</span>
                </button>
                <button
                  onClick={handleToggleChase}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center space-x-1 transition-all cursor-pointer ${
                    chaseSat
                      ? 'bg-rose-500/30 border-rose-500 text-rose-200'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                  }`}
                  title="Toggle continuous chase camera"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>{chaseSat ? 'Stop Chase' : 'Chase Cam'}</span>
                </button>
              </div>

              {/* Prominent Launch Action Button when both are selected */}
              {selectedPair.primary && selectedPair.secondary && (
                <button
                  onClick={() => {
                    if (!onLaunchInSandbox) return;
                    const vA = getOrbitalVelocityVector(selectedPair.primary.data);
                    const vB = getOrbitalVelocityVector(selectedPair.secondary.data);
                    const relSpeed = vA.clone().sub(vB).length();
                    onLaunchInSandbox({
                      primary: {
                        ...selectedPair.primary.data,
                        velocityVec: [vA.x, vA.y, vA.z]
                      },
                      secondary: {
                        ...selectedPair.secondary.data,
                        velocityVec: [vB.x, vB.y, vB.z]
                      },
                      separationKm: pairDistanceKm,
                      relativeSpeedKmS: Number(relSpeed.toFixed(2)) || 14.2
                    });
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-rose-500 hover:from-teal-400 hover:via-cyan-400 hover:to-rose-400 text-slate-950 font-black text-xs shadow-lg shadow-cyan-500/20 flex items-center justify-center space-x-2 transition-all transform hover:scale-[1.01] active:scale-[0.98] cursor-pointer"
                  title="Launch selected encounter pair into the 2D Impact Sandbox"
                >
                  <Zap className="w-3.5 h-3.5 text-slate-950" />
                  <span>💥 Launch in 2D Impact Sandbox</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* BOTTOM LEFT: Watermark & FPS */}
        <div className="pointer-events-none absolute bottom-3.5 left-3.5 opacity-60 text-[10px] tabular-nums text-slate-400 flex items-center space-x-2 select-none">
          <span className="tabular-nums">{fps} FPS</span>
          <span>•</span>
          <span>LEOLABS SSA ENGINE</span>
          <span>•</span>
          <span>ECI / J2000</span>
        </div>

        {/* ============================================================================== */}
        {/* UNIFIED FLOATING BOTTOM CONTROL DOCK                                          */}
        {/* ============================================================================== */}
        <div className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 rounded-2xl shadow-2xl border px-3 py-1.5 bg-slate-900/85 hover:bg-slate-900/95 backdrop-blur-xl border-slate-700/70 text-slate-200 flex items-center space-x-2 text-xs font-sans z-20 hud-interactive">
          
          {/* Play / Pause */}
          <button
            onClick={handleTogglePlay}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
            title={isPlaying ? 'Pause Simulation' : 'Resume Simulation'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 text-teal-400" /> : <Play className="w-3.5 h-3.5 text-teal-400" />}
          </button>

          {/* Slower */}
          <button
            onClick={() => handleSpeedChange(timeScale / 2)}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Slower Time Scale"
          >
            <Rewind className="w-3.5 h-3.5" />
          </button>

          {/* Speed Display */}
          <span className="tabular-nums text-[11px] font-bold text-teal-300 min-w-[28px] text-center select-none">
            {timeScale >= 1 ? `${timeScale}x` : `${timeScale.toFixed(2)}x`}
          </span>

          {/* Faster */}
          <button
            onClick={() => handleSpeedChange(timeScale * 2)}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Faster Time Scale"
          >
            <FastForward className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-slate-700/80" />

          {/* Global LEO Overview */}
          <button
            onClick={() => handleSetCameraPreset('GLOBAL')}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
              cameraPreset === 'GLOBAL'
                ? 'bg-teal-600/30 text-teal-300 border border-teal-500/40'
                : 'hover:bg-slate-800 text-slate-300 hover:text-white'
            }`}
            title="Reset Camera to Global LEO Overview"
          >
            <RotateCw className="w-3.5 h-3.5 text-teal-400" />
            <span>Global LEO</span>
          </button>

          {/* Focus Encounter (if selected) */}
          {selectedConjunction && (
            <button
              onClick={handleFocusEncounter}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
                cameraPreset === 'ENCOUNTER'
                  ? 'bg-rose-950/80 text-rose-300 border border-rose-500/60 shadow-xs'
                  : 'hover:bg-slate-800 text-slate-300 hover:text-white'
              }`}
              title="Anchor Camera on Encounter Collision Pair"
            >
              <Crosshair className="w-3.5 h-3.5 text-rose-400" />
              <span>Focus Encounter</span>
            </button>
          )}

          <div className="h-4 w-px bg-slate-700/80" />

          {/* Earth Rotation Toggle */}
          <button
            onClick={handleToggleEarthRotation}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
              earthRotationEnabled
                ? 'bg-teal-600/30 text-teal-300 border border-teal-500/40'
                : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Earth Surface Rotation"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>{earthRotationEnabled ? 'Rotate ON' : 'Rotate OFF'}</span>
          </button>

          {/* Solar Terminator View */}
          <button
            onClick={() => handleSetCameraPreset('SUN_SYNC')}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
              cameraPreset === 'SUN_SYNC'
                ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40'
                : 'hover:bg-slate-800 text-slate-300 hover:text-white'
            }`}
            title="Solar Terminator (Day / Night Arc)"
          >
            <Globe2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Day / Night</span>
          </button>

          <div className="h-4 w-px bg-slate-700/80" />

          {/* Fullscreen Toggle */}
          <button
            onClick={handleToggleFullscreen}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl font-medium hover:bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter 3D Fullscreen'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-teal-400" />
                <span>Exit</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-teal-400" />
                <span>Fullscreen</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
