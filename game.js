/* ============================================================
   SPIN CIRCUIT — tabletop top racing
   A self-contained canvas game for phone, tablet and desktop.
   ============================================================ */
(() => {
  'use strict';

  // ------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const mod = (n, m) => ((n % m) + m) % m;
  const angleDiff = (a, b) => mod(a - b + Math.PI, TAU) - Math.PI;
  const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const n = parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgba(hex, a) {
    const c = hexToRgb(hex);
    return `rgba(${c.r},${c.g},${c.b},${a})`;
  }

  function mixColor(hex, target, amount) {
    const a = hexToRgb(hex);
    const b = hexToRgb(target);
    const r = Math.round(lerp(a.r, b.r, amount));
    const g = Math.round(lerp(a.g, b.g, amount));
    const b2 = Math.round(lerp(a.b, b.b, amount));
    return `rgb(${r},${g},${b2})`;
  }

  function formatTime(t) {
    t = Math.max(0, t);
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
  }

  function ordinal(n) {
    const s = ['TH', 'ST', 'ND', 'RD'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function roundedRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  // ------------------------------------------------------------
  // DOM
  // ------------------------------------------------------------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const mini = document.getElementById('mini');
  const miniCtx = mini.getContext('2d');

  const hud = document.getElementById('hud');
  const menu = document.getElementById('menu');
  const finishPanel = document.getElementById('finish');
  const pausePanel = document.getElementById('pause');

  const lapNow = document.getElementById('lapNow');
  const posNow = document.getElementById('posNow');
  const posOf = document.getElementById('posOf');
  const timerEl = document.getElementById('timer');
  const speedEl = document.getElementById('speed');
  const boostRing = document.getElementById('boostRing');
  const boostBtn = document.getElementById('boostBtn');
  const leftBtn = document.getElementById('leftBtn');
  const rightBtn = document.getElementById('rightBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const tiltBtn = document.getElementById('tiltBtn');
  const tiltLabel = document.getElementById('tiltLabel');
  const countdownEl = document.getElementById('countdown');
  const countText = document.getElementById('countText');
  const countSub = document.getElementById('countSub');
  const offtrackWarning = document.getElementById('offtrackWarning');
  const noticeEl = document.getElementById('notice');

  const playBtn = document.getElementById('playBtn');
  const menuTiltBtn = document.getElementById('menuTiltBtn');
  const menuTiltState = document.getElementById('menuTiltState');
  const soundBtn = document.getElementById('soundBtn');
  const soundState = document.getElementById('soundState');
  const againBtn = document.getElementById('againBtn');
  const menuBtn = document.getElementById('menuBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  const restartBtn = document.getElementById('restartBtn');
  const quitBtn = document.getElementById('quitBtn');
  const resultTitle = document.getElementById('resultTitle');
  const resultLine = document.getElementById('resultLine');
  const resultTime = document.getElementById('resultTime');
  const resultLap = document.getElementById('resultLap');
  const resultBeaten = document.getElementById('resultBeaten');
  const heroCaption = document.querySelector('.hero-caption');

  // ------------------------------------------------------------
  // Configuration
  // ------------------------------------------------------------
  const TRACK_WIDTH = 174;
  const TRACK_HALF = TRACK_WIDTH / 2;
  const TOP_RADIUS = 24;
  const TOTAL_LAPS = 3;
  const PLAYER_GAP = 286;

  const TOPS = {
    volt: {
      name: 'VOLT', color: '#36f3ff', deep: '#075a7a',
      maxSpeed: 330, accel: 205, turnRate: 3.05, mass: 1.0,
      role: 'BALANCED'
    },
    nova: {
      name: 'NOVA', color: '#ff2f9d', deep: '#6b073a',
      maxSpeed: 318, accel: 238, turnRate: 3.52, mass: 0.86,
      role: 'AGILE'
    },
    titan: {
      name: 'TITAN', color: '#ffb340', deep: '#7d4a04',
      maxSpeed: 350, accel: 174, turnRate: 2.66, mass: 1.3,
      role: 'POWER'
    }
  };

  const AI_DEFS = [
    { name: 'KAI', color: '#b8ff4d', deep: '#3d6e05', maxSpeed: 326, accel: 210, turnRate: 3.22, gap: 64, offset: -39, line: -12 },
    { name: 'VEX', color: '#ff6b4a', deep: '#7a1c0a', maxSpeed: 333, accel: 196, turnRate: 3.02, gap: 102, offset: 39, line: 15 },
    { name: 'RUSH', color: '#8d7bff', deep: '#2b1a78', maxSpeed: 321, accel: 218, turnRate: 3.35, gap: 140, offset: -39, line: -18 },
    { name: 'NOVA', color: '#ff2f9d', deep: '#6b073a', maxSpeed: 317, accel: 224, turnRate: 3.46, gap: 178, offset: 39, line: 10 },
    { name: 'JAX', color: '#36f3ff', deep: '#075a7a', maxSpeed: 337, accel: 190, turnRate: 2.98, gap: 216, offset: -39, line: -4 }
  ];

  const PAD_FRACTIONS = [0.225, 0.505, 0.775];

  // ------------------------------------------------------------
  // Track geometry
  // ------------------------------------------------------------
  const CONTROL = [
    { x: 300, y: 0 },
    { x: 300, y: -260 },
    { x: 180, y: -470 },
    { x: -20, y: -520 },
    { x: -220, y: -420 },
    { x: -300, y: -220 },
    { x: -240, y: 0 },
    { x: -320, y: 180 },
    { x: -240, y: 420 },
    { x: -40, y: 540 },
    { x: 180, y: 480 },
    { x: 300, y: 260 }
  ];

  const SAMPLES_PER_SEG = 48;
  const samples = [];
  let TRACK_LENGTH = 0;
  let trackPath = null;
  let leftEdgePath = null;
  let rightEdgePath = null;
  const curbs = [];
  const boostPads = [];
  let worldBounds = { minX: -400, maxX: 400, minY: -600, maxY: 600 };

  function catmull(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return {
      x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
    };
  }

  function buildTrack() {
    const n = CONTROL.length;
    for (let i = 0; i < n; i++) {
      const p0 = CONTROL[(i - 1 + n) % n];
      const p1 = CONTROL[i];
      const p2 = CONTROL[(i + 1) % n];
      const p3 = CONTROL[(i + 2) % n];
      for (let j = 0; j < SAMPLES_PER_SEG; j++) {
        const p = catmull(p0, p1, p2, p3, j / SAMPLES_PER_SEG);
        samples.push({ x: p.x, y: p.y, tx: 0, ty: 0, nx: 0, ny: 0, dist: 0 });
      }
    }

    const count = samples.length;
    for (let i = 0; i < count; i++) {
      const a = samples[(i - 1 + count) % count];
      const b = samples[(i + 1) % count];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const s = samples[i];
      s.tx = dx;
      s.ty = dy;
      s.nx = -dy;
      s.ny = dx;
    }

    let total = 0;
    for (let i = 0; i < count; i++) {
      samples[i].dist = total;
      const next = samples[(i + 1) % count];
      total += Math.hypot(next.x - samples[i].x, next.y - samples[i].y);
    }
    TRACK_LENGTH = total;

    trackPath = new Path2D();
    trackPath.moveTo(samples[0].x, samples[0].y);
    for (let i = 1; i < count; i++) trackPath.lineTo(samples[i].x, samples[i].y);
    trackPath.closePath();

    leftEdgePath = new Path2D();
    rightEdgePath = new Path2D();
    for (let i = 0; i < count; i++) {
      const s = samples[i];
      const lx = s.x + s.nx * TRACK_HALF;
      const ly = s.y + s.ny * TRACK_HALF;
      const rx = s.x - s.nx * TRACK_HALF;
      const ry = s.y - s.ny * TRACK_HALF;
      if (i === 0) {
        leftEdgePath.moveTo(lx, ly);
        rightEdgePath.moveTo(rx, ry);
      } else {
        leftEdgePath.lineTo(lx, ly);
        rightEdgePath.lineTo(rx, ry);
      }
    }
    leftEdgePath.closePath();
    rightEdgePath.closePath();

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const s of samples) {
      minX = Math.min(minX, s.x);
      maxX = Math.max(maxX, s.x);
      minY = Math.min(minY, s.y);
      maxY = Math.max(maxY, s.y);
    }
    worldBounds = { minX, maxX, minY, maxY };

    for (let d = 0; d < TRACK_LENGTH; d += 27) {
      const a = sampleAtDistance(d);
      const b = sampleAtDistance(d + 14);
      const odd = Math.floor(d / 27) % 2 === 0;
      for (const side of [-1, 1]) {
        curbs.push({
          x1: a.x + a.nx * (TRACK_HALF - 1) * side,
          y1: a.y + a.ny * (TRACK_HALF - 1) * side,
          x2: b.x + b.nx * (TRACK_HALF - 1) * side,
          y2: b.y + b.ny * (TRACK_HALF - 1) * side,
          color: odd ? '#f5fbff' : '#ff3d72'
        });
      }
    }

    for (const f of PAD_FRACTIONS) {
      const p = sampleAtDistance(f * TRACK_LENGTH);
      boostPads.push(p);
    }
  }

  function sampleAtDistance(d) {
    d = mod(d, TRACK_LENGTH);
    const count = samples.length;
    let lo = 0;
    let hi = count - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (samples[mid].dist <= d) lo = mid;
      else hi = mid - 1;
    }
    const s = samples[lo];
    const next = samples[(lo + 1) % count];
    const segLen = next.dist > s.dist ? next.dist - s.dist : TRACK_LENGTH - s.dist;
    const t = segLen > 0 ? clamp((d - s.dist) / segLen, 0, 1) : 0;
    let tx = lerp(s.tx, next.tx, t);
    let ty = lerp(s.ty, next.ty, t);
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    return {
      x: lerp(s.x, next.x, t),
      y: lerp(s.y, next.y, t),
      tx, ty,
      nx: -ty, ny: tx,
      dist: d,
      index: lo
    };
  }

  function nearestIndex(pos, guess) {
    const count = samples.length;
    const g = Number.isFinite(guess) ? guess : 0;
    let best = g;
    let bestD = Infinity;

    for (let k = -30; k <= 36; k++) {
      const i = mod(g + k, count);
      const s = samples[i];
      const d = dist2(pos.x, pos.y, s.x, s.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }

    if (bestD > (TRACK_WIDTH * 2.4) * (TRACK_WIDTH * 2.4)) {
      for (let i = 0; i < count; i++) {
        const s = samples[i];
        const d = dist2(pos.x, pos.y, s.x, s.y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    }

    return { idx: best, dist: Math.sqrt(bestD) };
  }

  // ------------------------------------------------------------
  // Sound
  // ------------------------------------------------------------
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.engine = null;
      this.engineGain = null;
      this.engineFilter = null;
      this.muted = false;
      this.ready = false;
    }

    init() {
      if (this.ready) {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.62;
        this.master.connect(this.ctx.destination);

        this.engine = this.ctx.createOscillator();
        this.engine.type = 'sawtooth';
        this.engine.frequency.value = 58;
        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 240;
        this.engineFilter.Q.value = 3.5;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0.0001;
        this.engine.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engine.start();
        this.ready = true;
      } catch {
        this.ready = false;
      }
    }

    setMuted(muted) {
      this.muted = muted;
      if (!this.ctx || !this.master) return;
      this.master.gain.setTargetAtTime(muted ? 0 : 0.62, this.ctx.currentTime, 0.02);
    }

    startEngine() {
      if (!this.ctx || !this.engineGain) return;
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      this.engineGain.gain.setTargetAtTime(0.018, this.ctx.currentTime, 0.1);
    }

    stopEngine() {
      if (!this.ctx || !this.engineGain) return;
      this.engineGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08);
    }

    updateEngine(speed, boost) {
      if (!this.ctx || !this.engine) return;
      const t = this.ctx.currentTime;
      const freq = 52 + speed * 0.22 + (boost ? 26 : 0);
      this.engine.frequency.setTargetAtTime(freq, t, 0.06);
      if (this.engineFilter) {
        this.engineFilter.frequency.setTargetAtTime(220 + speed * 1.3 + (boost ? 500 : 0), t, 0.08);
      }
    }

    beep(freq = 440, dur = 0.09, type = 'sine', vol = 0.045, slide = 0) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }

    crash() {
      this.beep(112, 0.14, 'square', 0.045, -55);
    }

    boost() {
      this.beep(190, 0.2, 'sawtooth', 0.035, 720);
    }

    pad() {
      this.beep(620, 0.08, 'triangle', 0.045, 280);
    }

    lap() {
      this.beep(760, 0.09, 'triangle', 0.04, 180);
      setTimeout(() => this.beep(980, 0.1, 'triangle', 0.035, 140), 90);
    }

    finish(win) {
      const notes = win ? [660, 830, 1040] : [520, 620, 760];
      notes.forEach((n, i) => setTimeout(() => this.beep(n, 0.16, 'triangle', 0.05, 30), i * 120));
    }
  }

  const sound = new SoundEngine();

  // ------------------------------------------------------------
  // State
  // ------------------------------------------------------------
  let W = window.innerWidth;
  let H = window.innerHeight;
  let DPR = Math.min(2, window.devicePixelRatio || 1);
  let baseScale = 1;

  // Static art is rendered once into offscreen canvases. Redrawing the long
  // neon track and the full-screen backdrop every frame is the single most
  // expensive thing the renderer can do, especially on software rasterisers.
  let backdropCache = null;
  let trackCache = null;
  let trackCacheScale = 0;
  let trackCacheDPR = 0;
  let trackCacheBounds = null;

  let state = 'menu';
  let pausedFrom = 'racing';
  let selectedTop = 'volt';
  let racers = [];
  let player = null;
  let particles = [];
  let raceTime = 0;
  let countdown = 0;
  let goTimer = 0;
  let lastCount = null;
  let noticeTimer = 0;
  let lastFrame = performance.now();
  let hudTick = 0;
  let offTrackShown = false;

  const camera = { x: 0, y: 0, zoom: 1, shake: 0 };
  const keys = { left: false, right: false, boost: false };
  const touch = { left: false, right: false, boost: false };

  let tiltEnabled = false;
  let tiltInput = 0;
  let tiltTarget = 0;
  let tiltNeutral = null;
  let tiltSamples = [];
  let tiltGotEvent = false;
  let tiltTimeout = null;
  let tiltHandler = null;

  const specks = [];
  for (let i = 0; i < 220; i++) {
    specks.push({
      x: (Math.random() - 0.5) * 1900,
      y: (Math.random() - 0.5) * 2200,
      r: 0.5 + Math.random() * 1.8,
      a: 0.02 + Math.random() * 0.1
    });
  }

  // ------------------------------------------------------------
  // Build the world
  // ------------------------------------------------------------
  buildTrack();

  // ------------------------------------------------------------
  // Resize
  // ------------------------------------------------------------
  function computeBaseScale() {
    const min = Math.min(W, H);
    if (W < 560) return clamp(min / 560, 0.61, 0.9);
    if (W < 900) return clamp(min / 800, 0.74, 1.04);
    return clamp(min / 840, 0.8, 1.22);
  }

  function buildBackdropCache() {
    const c = document.createElement('canvas');
    c.width = Math.round(W * DPR);
    c.height = Math.round(H * DPR);
    const g = c.getContext('2d', { alpha: false });
    g.setTransform(DPR, 0, 0, DPR, 0, 0);

    const base = g.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, '#10182a');
    base.addColorStop(0.34, '#080d18');
    base.addColorStop(1, '#04060c');
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);

    const glowA = g.createRadialGradient(W * 0.73, H * 0.28, 0, W * 0.73, H * 0.28, Math.max(W, H) * 0.7);
    glowA.addColorStop(0, 'rgba(54,243,255,.085)');
    glowA.addColorStop(0.45, 'rgba(54,243,255,.025)');
    glowA.addColorStop(1, 'rgba(54,243,255,0)');
    g.fillStyle = glowA;
    g.fillRect(0, 0, W, H);

    const glowB = g.createRadialGradient(W * 0.25, H * 0.75, 0, W * 0.25, H * 0.75, Math.max(W, H) * 0.72);
    glowB.addColorStop(0, 'rgba(255,47,157,.075)');
    glowB.addColorStop(0.5, 'rgba(255,47,157,.018)');
    glowB.addColorStop(1, 'rgba(255,47,157,0)');
    g.fillStyle = glowB;
    g.fillRect(0, 0, W, H);

    backdropCache = c;
  }

  function buildTrackCache() {
    const pad = 176;
    const minX = worldBounds.minX - pad;
    const minY = worldBounds.minY - pad;
    const maxX = worldBounds.maxX + pad;
    const maxY = worldBounds.maxY + pad;
    const bw = maxX - minX;
    const bh = maxY - minY;
    const scale = clamp((window.devicePixelRatio || 1) * 1.15, 1.1, 1.6);

    const c = document.createElement('canvas');
    c.width = Math.ceil(bw * scale);
    c.height = Math.ceil(bh * scale);
    const g = c.getContext('2d', { alpha: true });
    g.setTransform(scale, 0, 0, scale, -minX * scale, -minY * scale);
    drawTrack(g);

    trackCache = c;
    trackCacheScale = scale;
    trackCacheBounds = { minX, minY, w: bw, h: bh };
  }

  let miniW = 72;
  let miniH = 94;

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    DPR = Math.min(2, window.devicePixelRatio || 1);

    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

    baseScale = computeBaseScale();
    buildBackdropCache();
    if (!trackCache || trackCacheDPR !== DPR) {
      buildTrackCache();
      trackCacheDPR = DPR;
    }

    const wrap = document.getElementById('minimap-wrap');
    const rect = wrap.getBoundingClientRect();
    miniW = Math.max(40, rect.width || 72);
    miniH = Math.max(50, rect.height || 94);
    mini.width = Math.round(miniW * DPR);
    mini.height = Math.round(miniH * DPR);
    mini.style.width = `${miniW}px`;
    mini.style.height = `${miniH}px`;

    if (!player) camera.zoom = baseScale * 0.9;
    else camera.zoom = baseScale;

    ensureLoop();
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 180));

  // ------------------------------------------------------------
  // Racer creation
  // ------------------------------------------------------------
  function makeRacer(def, startDist, isPlayer) {
    const s = sampleAtDistance(startDist);
    const offset = def.offset || 0;
    const color = def.color;
    const r = {
      name: def.name,
      color,
      colorLight: mixColor(color, '#ffffff', 0.58),
      colorDeep: mixColor(color, '#000000', 0.58),
      isPlayer,
      pos: { x: s.x + s.nx * offset, y: s.y + s.ny * offset },
      heading: Math.atan2(s.ty, s.tx),
      speed: 0,
      maxSpeed: def.maxSpeed,
      accel: def.accel,
      turnRate: def.turnRate,
      mass: def.mass || 1,
      radius: TOP_RADIUS,
      spin: Math.random() * TAU,
      trail: [],
      trailTimer: 0,
      revTimer: 0,
      trackIndex: s.index,
      progress: s.dist,
      lastProgress: s.dist,
      lap: 0,
      lapStart: 0,
      bestLap: null,
      finished: false,
      finishTime: null,
      offTrack: false,
      offTimer: 0,
      steer: 0,
      boost: isPlayer ? 0.64 : 0,
      boostActive: false,
      padCooldown: 0,
      collisionCooldown: 0,
      ai: isPlayer ? null : {
        lineOffset: def.line || 0,
        seed: Math.random() * TAU,
        boostTimer: 0,
        boostCooldown: 2.5 + Math.random() * 4.5
      }
    };
    return r;
  }

  function totalProgress(r) {
    return r.lap * TRACK_LENGTH + r.progress;
  }

  function resetMenu() {
    document.body.classList.add('in-menu');
    racers = [];
    player = null;
    particles = [];
  }

  function resetRace() {
    racers = [];
    particles = [];
    raceTime = 0;
    countdown = 3.0;
    goTimer = 0;
    lastCount = 3;
    offTrackShown = false;

    const top = TOPS[selectedTop];

    AI_DEFS.forEach((def) => {
      racers.push(makeRacer(def, mod(TRACK_LENGTH - def.gap, TRACK_LENGTH), false));
    });

    player = makeRacer({
      ...top,
      name: 'YOU',
      color: top.color,
      deep: top.deep,
      offset: 38
    }, mod(TRACK_LENGTH - PLAYER_GAP, TRACK_LENGTH), true);
    racers.push(player);

    player.lapStart = 0;
    player.lastProgress = player.progress;

    const lookX = player.pos.x + Math.cos(player.heading) * 120;
    const lookY = player.pos.y + Math.sin(player.heading) * 120;
    camera.x = lookX;
    camera.y = lookY;
    camera.zoom = baseScale;
    camera.shake = 0;

    document.documentElement.style.setProperty('--top-color', top.color);
    document.documentElement.style.setProperty('--top-deep', top.deep);

    hud.classList.remove('hidden');
    finishPanel.classList.add('hidden');
    pausePanel.classList.add('hidden');
    countdownEl.classList.add('show');
    countdownEl.classList.remove('go');
    setCountDisplay('3', 'GET READY', true);
    offtrackWarning.classList.remove('show');
    document.body.classList.remove('boosting');

    state = 'countdown';
    sound.init();
    sound.startEngine();
    sound.beep(480, 0.08, 'sine', 0.05);
    updateHUD();
  }

  // ------------------------------------------------------------
  // UI helpers
  // ------------------------------------------------------------
  function showNotice(message, duration = 1500) {
    noticeEl.textContent = message;
    noticeEl.classList.add('show');
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => noticeEl.classList.remove('show'), duration);
  }

  function setCountDisplay(text, sub, animate) {
    countText.textContent = text;
    countSub.textContent = sub;
    if (animate) {
      countText.style.animation = 'none';
      void countText.offsetWidth;
      countText.style.animation = 'count-pop .55s cubic-bezier(.2,.8,.2,1) both';
    }
  }

  function updateHUD() {
    if (!player) return;
    lapNow.textContent = clamp(player.lap, 1, TOTAL_LAPS);
    timerEl.textContent = formatTime(raceTime);
    speedEl.textContent = Math.round(player.speed * 1.32);

    const standings = computeStandings();
    const pIndex = standings.indexOf(player);
    posNow.textContent = pIndex >= 0 ? pIndex + 1 : racers.length;
    posOf.textContent = `/${racers.length}`;

    const b = Math.round(player.boost * 100);
    boostRing.style.setProperty('--boost', b);
    boostRing.classList.toggle('empty', player.boost <= 0.02);
    boostBtn.classList.toggle('active', player.boostActive);

    if (player.offTrack && state === 'racing') {
      if (!offTrackShown) {
        offtrackWarning.classList.add('show');
        offTrackShown = true;
      }
    } else if (offTrackShown) {
      offtrackWarning.classList.remove('show');
      offTrackShown = false;
    }
  }

  function computeStandings() {
    return racers.slice().sort((a, b) => {
      if (a.finished && b.finished) return (a.finishTime || 0) - (b.finishTime || 0);
      if (a.finished) return -1;
      if (b.finished) return 1;
      return totalProgress(b) - totalProgress(a);
    });
  }

  function getSteerInput() {
    let s = 0;
    if (keys.left || touch.left) s -= 1;
    if (keys.right || touch.right) s += 1;
    if (s === 0 && tiltEnabled) s = tiltInput;
    return clamp(s, -1, 1);
  }

  // ------------------------------------------------------------
  // Motion / tilt
  // ------------------------------------------------------------
  function screenAngle() {
    if (screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle;
    if (typeof window.orientation === 'number') return window.orientation;
    return 0;
  }

  function handleOrientation(event) {
    if (!tiltEnabled) return;
    const angle = screenAngle();
    const landscape = Math.abs(angle) === 90;
    const raw = landscape ? event.beta : event.gamma;
    if (raw === null || raw === undefined || Number.isNaN(raw)) return;

    if (!tiltGotEvent) {
      tiltGotEvent = true;
      clearTimeout(tiltTimeout);
    }

    if (tiltNeutral === null) {
      tiltSamples.push(raw);
      if (tiltSamples.length >= 3) {
        tiltNeutral = tiltSamples.reduce((a, b) => a + b, 0) / tiltSamples.length;
        tiltSamples = [];
      }
      return;
    }

    let delta = raw - tiltNeutral;
    if (landscape) delta *= angle === 90 ? -1 : 1;
    if (Math.abs(delta) < 2.2) delta = 0;
    tiltTarget = clamp(delta / 19, -1, 1);
  }

  function syncTiltUI() {
    tiltBtn.classList.toggle('active', tiltEnabled);
    tiltLabel.textContent = tiltEnabled ? 'TILT ON' : 'TILT';
    tiltBtn.setAttribute('aria-pressed', String(tiltEnabled));
    menuTiltBtn.classList.toggle('active', tiltEnabled);
    menuTiltBtn.setAttribute('aria-pressed', String(tiltEnabled));
    menuTiltState.textContent = tiltEnabled ? 'ON' : 'OFF';
  }

  async function toggleTilt() {
    if (tiltEnabled) {
      disableTilt();
      return;
    }
    await enableTilt();
  }

  async function enableTilt() {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') {
          showNotice('MOTION ACCESS DENIED — TILT UNAVAILABLE', 2200);
          return;
        }
      }
    } catch {
      showNotice('MOTION PERMISSION NEEDS A TAP IN SAFARI', 2400);
      return;
    }

    if (typeof window.DeviceOrientationEvent === 'undefined') {
      showNotice('THIS DEVICE HAS NO TILT SENSOR', 2000);
      return;
    }

    tiltEnabled = true;
    tiltInput = 0;
    tiltTarget = 0;
    tiltNeutral = null;
    tiltSamples = [];
    tiltGotEvent = false;
    tiltHandler = handleOrientation;
    window.addEventListener('deviceorientation', tiltHandler, true);
    syncTiltUI();
    showNotice('TILT ON — HOLD YOUR DEVICE LEVEL', 1900);
    sound.beep(720, 0.08, 'triangle', 0.035, 120);

    clearTimeout(tiltTimeout);
    tiltTimeout = setTimeout(() => {
      if (!tiltGotEvent && tiltEnabled) showNotice('NO TILT DATA — USE TOUCH PADS', 2200);
    }, 1600);
  }

  function disableTilt() {
    tiltEnabled = false;
    tiltInput = 0;
    tiltTarget = 0;
    tiltNeutral = null;
    clearTimeout(tiltTimeout);
    if (tiltHandler) {
      window.removeEventListener('deviceorientation', tiltHandler, true);
      tiltHandler = null;
    }
    syncTiltUI();
    showNotice('TILT OFF — TOUCH PADS ACTIVE', 1400);
  }

  // ------------------------------------------------------------
  // Player physics
  // ------------------------------------------------------------
  function updatePlayer(dt) {
    const p = player;
    const steer = getSteerInput();
    p.steer += (steer - p.steer) * Math.min(1, dt * 11);

    const speedFactor = clamp(p.speed / p.maxSpeed, 0, 1);
    const turn = p.turnRate * (0.38 + 0.62 * speedFactor);
    p.heading += p.steer * turn * dt;

    const wantBoost = touch.boost || keys.boost;
    p.boostActive = Boolean(wantBoost && p.boost > 0.015 && state === 'racing');

    let targetSpeed = p.maxSpeed;
    if (p.offTrack) targetSpeed *= 0.3;
    if (p.boostActive) targetSpeed += 112;

    if (p.speed < targetSpeed) {
      p.speed += p.accel * dt * (p.boostActive ? 1.65 : 1);
    } else {
      p.speed += (targetSpeed - p.speed) * Math.min(1, dt * (p.offTrack ? 6.5 : 2.3));
    }
    p.speed -= Math.abs(p.steer) * speedFactor * 11 * dt;
    p.speed = clamp(p.speed, 0, p.maxSpeed + 125);

    if (p.boostActive) {
      p.boost = Math.max(0, p.boost - 0.34 * dt);
      if (p.boost <= 0) p.boostActive = false;
      if (Math.random() < dt * 48) spawnBoostParticle(p);
    } else {
      const driftCharge = Math.abs(p.steer) > 0.55 && speedFactor > 0.58 ? 0.072 : 0;
      p.boost = Math.min(1, p.boost + (0.052 + driftCharge) * dt);
    }

    p.pos.x += Math.cos(p.heading) * p.speed * dt;
    p.pos.y += Math.sin(p.heading) * p.speed * dt;

    if (p.boostActive) camera.shake = Math.max(camera.shake, 0.55);
  }

  // ------------------------------------------------------------
  // AI physics
  // ------------------------------------------------------------
  function updateAI(r, dt, time) {
    if (!r.ai) return;

    const look = 128 + r.speed * 0.44;
    const ahead = sampleAtDistance(r.progress + look);
    let targetX;
    let targetY;

    if (r.offTrack) {
      targetX = ahead.x;
      targetY = ahead.y;
    } else {
      const wobble = Math.sin(time * 0.62 + r.ai.seed) * 13;
      const offset = r.ai.lineOffset + wobble;
      targetX = ahead.x + ahead.nx * offset;
      targetY = ahead.y + ahead.ny * offset;
    }

    let desired = Math.atan2(targetY - r.pos.y, targetX - r.pos.x);
    if (r.offTrack) desired = Math.atan2(ahead.ty, ahead.tx);

    const diff = angleDiff(desired, r.heading);
    const speedFactor = clamp(r.speed / r.maxSpeed, 0, 1);
    const turn = r.turnRate * (0.5 + 0.5 * speedFactor);
    r.heading += clamp(diff, -turn * dt, turn * dt);

    let targetSpeed = r.maxSpeed * (1 - clamp(Math.abs(diff) * 1.1, 0, 0.42));
    if (r.offTrack) targetSpeed *= 0.33;

    if (player && !player.finished) {
      const gap = totalProgress(player) - totalProgress(r);
      if (gap > 520) targetSpeed *= 1.085;
      else if (gap < -620) targetSpeed *= 0.93;
    }

    r.ai.boostCooldown -= dt;
    r.ai.boostTimer = Math.max(0, r.ai.boostTimer - dt);
    r.boostActive = r.ai.boostTimer > 0;
    if (r.boostActive) {
      targetSpeed += 72;
      if (Math.random() < dt * 34) spawnBoostParticle(r);
    } else if (r.ai.boostCooldown <= 0 && !r.offTrack && Math.abs(diff) < 0.16 && r.speed > r.maxSpeed * 0.5) {
      r.ai.boostTimer = 0.75 + Math.random() * 0.55;
      r.ai.boostCooldown = 5 + Math.random() * 6;
      r.boostActive = true;
    }

    if (r.speed < targetSpeed) r.speed += r.accel * dt;
    else r.speed += (targetSpeed - r.speed) * Math.min(1, dt * 2.6);

    r.speed -= Math.abs(diff) * speedFactor * 9 * dt;
    r.speed = clamp(r.speed, 0, r.maxSpeed + 90);

    r.pos.x += Math.cos(r.heading) * r.speed * dt;
    r.pos.y += Math.sin(r.heading) * r.speed * dt;
  }

  // ------------------------------------------------------------
  // Progress, laps and off-track recovery
  // ------------------------------------------------------------
  function updateProgress(r, dt) {
    const near = nearestIndex(r.pos, r.trackIndex);
    r.trackIndex = near.idx;
    const s = samples[near.idx];
    const along = (r.pos.x - s.x) * s.tx + (r.pos.y - s.y) * s.ty;
    const prog = mod(s.dist + along, TRACK_LENGTH);

    const delta = prog - r.lastProgress;
    if (delta < -TRACK_LENGTH * 0.5) {
      r.lap++;
      if (r.isPlayer) onPlayerLap(r);
    } else if (delta > TRACK_LENGTH * 0.5) {
      r.lap = Math.max(0, r.lap - 1);
    }

    r.lastProgress = prog;
    r.progress = prog;

    const off = near.dist > TRACK_HALF - 9;
    if (off && !r.offTrack && r.isPlayer) {
      camera.shake = Math.max(camera.shake, 3);
    }
    r.offTrack = off;

    if (off) {
      r.offTimer += dt;
      if (Math.random() < dt * 26) spawnDust(r);
      if (r.isPlayer && r.offTimer > 1.35) resetRacer(r);
      else if (!r.isPlayer && r.offTimer > 2.4) resetRacer(r);
    } else {
      r.offTimer = Math.max(0, r.offTimer - dt * 2.5);
    }

    r.padCooldown = Math.max(0, r.padCooldown - dt);
    for (const pad of boostPads) {
      if (r.padCooldown > 0) break;
      if (dist2(r.pos.x, r.pos.y, pad.x, pad.y) < 46 * 46) {
        r.padCooldown = 1.5;
        if (r.isPlayer) {
          r.boost = Math.min(1, r.boost + 0.3);
          showNotice('BOOST CHARGE +30', 900);
          sound.pad();
        } else {
          r.speed += 48;
        }
        spawnPadBurst(pad);
      }
    }

    if (r.lap > TOTAL_LAPS && !r.finished) {
      if (r.isPlayer) {
        finishRace();
      } else {
        r.finished = true;
        r.finishTime = raceTime;
        r.speed *= 0.82;
      }
    }
  }

  function onPlayerLap(r) {
    const lapTime = raceTime - r.lapStart;
    if (r.lap >= 2 && lapTime > 1) {
      if (r.bestLap === null || lapTime < r.bestLap) r.bestLap = lapTime;
    }
    r.lapStart = raceTime;
    if (r.lap > 1 && r.lap <= TOTAL_LAPS) {
      sound.lap();
      showNotice(`LAP ${clamp(r.lap, 1, TOTAL_LAPS)} OF ${TOTAL_LAPS}`, 1000);
    }
  }

  function resetRacer(r) {
    const near = nearestIndex(r.pos, r.trackIndex);
    const s = samples[near.idx];
    r.pos.x = s.x;
    r.pos.y = s.y;
    r.heading = Math.atan2(s.ty, s.tx);
    r.speed = 68;
    r.steer = 0;
    r.offTrack = false;
    r.offTimer = 0;
    r.lastProgress = s.dist;
    r.progress = s.dist;
    r.trackIndex = near.idx;
    r.trail.length = 0;
    if (r.isPlayer) {
      camera.shake = 7;
      showNotice('BACK ON TRACK', 1100);
      sound.crash();
    }
    for (let i = 0; i < 12; i++) {
      spawnParticle(r.pos.x, r.pos.y, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120, 0.35 + Math.random() * 0.3, 2 + Math.random() * 3, r.color, 'spark');
    }
  }

  // ------------------------------------------------------------
  // Collisions
  // ------------------------------------------------------------
  function handleCollisions() {
    for (let i = 0; i < racers.length; i++) {
      for (let j = i + 1; j < racers.length; j++) {
        const a = racers[i];
        const b = racers[j];
        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const d = Math.hypot(dx, dy);
        const minD = a.radius + b.radius + 1;
        if (d >= minD) continue;

        const nx = d > 0.001 ? dx / d : 1;
        const ny = d > 0.001 ? dy / d : 0;
        const overlap = minD - d;
        const aMass = a.mass || 1;
        const bMass = b.mass || 1;
        const totalMass = aMass + bMass;

        a.pos.x -= nx * overlap * (bMass / totalMass);
        a.pos.y -= ny * overlap * (bMass / totalMass);
        b.pos.x += nx * overlap * (aMass / totalMass);
        b.pos.y += ny * overlap * (aMass / totalMass);

        a.speed *= 0.93;
        b.speed *= 0.93;

        const midX = (a.pos.x + b.pos.x) / 2;
        const midY = (a.pos.y + b.pos.y) / 2;
        for (let k = 0; k < 7; k++) {
          spawnParticle(midX, midY, (Math.random() - 0.5) * 180, (Math.random() - 0.5) * 180, 0.2 + Math.random() * 0.3, 1.5 + Math.random() * 2.5, Math.random() < 0.5 ? a.color : b.color, 'spark');
        }
        if (a.isPlayer || b.isPlayer) {
          camera.shake = Math.max(camera.shake, 6);
          sound.crash();
        }
      }
    }
  }

  // ------------------------------------------------------------
  // Particles
  // ------------------------------------------------------------
  function spawnParticle(x, y, vx, vy, life, size, color, type) {
    if (particles.length > 560) return;
    particles.push({
      x, y, vx, vy,
      life,
      maxLife: life,
      size,
      color,
      type: type || 'dot',
      rot: Math.random() * TAU,
      vr: (Math.random() - 0.5) * 9
    });
  }

  function spawnBoostParticle(r) {
    const back = r.heading + Math.PI + (Math.random() - 0.5) * 0.55;
    const px = r.pos.x + Math.cos(back) * (r.radius + 3);
    const py = r.pos.y + Math.sin(back) * (r.radius + 3);
    spawnParticle(
      px, py,
      Math.cos(back) * (60 + Math.random() * 100) + (Math.random() - 0.5) * 40,
      Math.sin(back) * (60 + Math.random() * 100) + (Math.random() - 0.5) * 40,
      0.22 + Math.random() * 0.3,
      2 + Math.random() * 3.5,
      Math.random() < 0.3 ? '#ffffff' : r.color,
      'spark'
    );
  }

  function spawnDust(r) {
    spawnParticle(
      r.pos.x + (Math.random() - 0.5) * 24,
      r.pos.y + (Math.random() - 0.5) * 24,
      (Math.random() - 0.5) * 55,
      (Math.random() - 0.5) * 55,
      0.35 + Math.random() * 0.4,
      3 + Math.random() * 5,
      Math.random() < 0.5 ? '#8b8177' : '#5d6a76',
      'dust'
    );
  }

  function spawnPadBurst(pad) {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * TAU;
      const sp = 50 + Math.random() * 150;
      spawnParticle(pad.x, pad.y, Math.cos(a) * sp, Math.sin(a) * sp, 0.3 + Math.random() * 0.35, 2 + Math.random() * 3, i % 3 === 0 ? '#ffffff' : '#36f3ff', 'spark');
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2.2 * dt;
      p.vy *= 1 - 2.2 * dt;
      p.rot += p.vr * dt;
    }
  }

  // ------------------------------------------------------------
  // Visual updates
  // ------------------------------------------------------------
  function updateVisuals(r, dt) {
    r.spin += (14 + r.speed * 0.085) * dt;

    if (r.speed > 25) {
      r.trailTimer += dt;
      if (r.trailTimer > 0.038) {
        r.trailTimer = 0;
        r.trail.push({ x: r.pos.x, y: r.pos.y });
        if (r.trail.length > 17) r.trail.shift();
      }
    } else if (r.trail.length) {
      r.trail.shift();
    }

    if (r.offTrack && Math.random() < dt * 22) spawnDust(r);
  }

  // ------------------------------------------------------------
  // Race flow
  // ------------------------------------------------------------
  function startRace() {
    document.body.classList.remove('in-menu');
    menu.classList.add('closing');
    resetRace();
    sound.startEngine();
    ensureLoop();
  }

  function finishRace() {
    if (state !== 'racing') return;
    state = 'finished';
    player.finished = true;
    player.finishTime = raceTime;
    player.speed *= 0.5;
    sound.stopEngine();

    const standings = computeStandings();
    const position = Math.max(1, standings.indexOf(player) + 1);
    const beaten = Math.max(0, racers.length - position);

    resultTitle.textContent = `P${position}`;
    resultLine.textContent =
      position === 1 ? 'Untouchable. The table is yours.' :
      position === 2 ? 'One spin short of glory.' :
      position === 3 ? 'A podium finish. Nice spin.' :
      position === 4 ? 'The pack is still within reach.' :
      'The table fought back. Run it again.';

    resultTime.textContent = formatTime(raceTime);
    resultLap.textContent = player.bestLap ? formatTime(player.bestLap) : formatTime(raceTime);
    resultBeaten.textContent = `${beaten}/${racers.length - 1}`;

    finishPanel.classList.remove('hidden');
    sound.finish(position === 1);

    for (let i = 0; i < 70; i++) {
      const a = Math.random() * TAU;
      const sp = 40 + Math.random() * 260;
      spawnParticle(
        player.pos.x, player.pos.y,
        Math.cos(a) * sp, Math.sin(a) * sp,
        0.8 + Math.random() * 1.1,
        2 + Math.random() * 4,
        ['#36f3ff', '#ff2f9d', '#ffb340', '#b8ff4d', '#ffffff'][i % 5],
        i % 3 === 0 ? 'confetti' : 'spark'
      );
    }
  }

  function pauseRace() {
    if (state !== 'racing' && state !== 'countdown') return;
    pausedFrom = state;
    state = 'paused';
    pausePanel.classList.remove('hidden');
    sound.stopEngine();
    countdownEl.classList.remove('show');
    document.body.classList.remove('boosting');
  }

  function resumeRace() {
    if (state !== 'paused') return;
    state = pausedFrom;
    pausePanel.classList.add('hidden');
    if (state === 'countdown') countdownEl.classList.add('show');
    sound.startEngine();
    ensureLoop();
  }

  function quitToMenu() {
    pausePanel.classList.add('hidden');
    finishPanel.classList.add('hidden');
    hud.classList.add('hidden');
    countdownEl.classList.remove('show');
    offtrackWarning.classList.remove('show');
    document.body.classList.remove('boosting');
    menu.classList.remove('closing');
    sound.stopEngine();
    state = 'menu';
    resetMenu();
    ensureLoop();
  }

  function showMenu() {
    pausePanel.classList.add('hidden');
    finishPanel.classList.add('hidden');
    hud.classList.add('hidden');
    countdownEl.classList.remove('show');
    menu.classList.remove('closing');
    sound.stopEngine();
    state = 'menu';
    resetMenu();
    ensureLoop();
  }

  // ------------------------------------------------------------
  // Update loop helpers
  // ------------------------------------------------------------
  function updateCountdown(dt) {
    countdown -= dt;
    const n = Math.ceil(Math.max(0, countdown));

    if (n > 0 && n !== lastCount) {
      lastCount = n;
      setCountDisplay(String(n), n === 1 ? 'HOLD BOOST' : 'GET READY', true);
      sound.beep(n === 1 ? 720 : 480, 0.08, 'sine', 0.05);
    }

    for (const r of racers) {
      r.spin += 24 * dt;
      r.revTimer += dt;
      if (r.revTimer > 0.12) {
        r.revTimer = 0;
        const a = r.heading + Math.PI + (Math.random() - 0.5) * 0.9;
        spawnParticle(r.pos.x + Math.cos(a) * (r.radius + 2), r.pos.y + Math.sin(a) * (r.radius + 2), Math.cos(a) * 40, Math.sin(a) * 40, 0.25, 2 + Math.random() * 2, r.color, 'spark');
      }
    }

    if (countdown <= 0) {
      state = 'racing';
      raceTime = 0;
      goTimer = 0.82;
      countdownEl.classList.add('go');
      setCountDisplay('SPIN!', 'HOLD BOOST ON GREEN', true);
      sound.beep(960, 0.18, 'sine', 0.07, 60);
      sound.startEngine();
      for (const r of racers) r.lapStart = 0;
    }
  }

  function updateRace(dt) {
    raceTime += dt;
    goTimer = Math.max(0, goTimer - dt);
    if (goTimer <= 0 && countdownEl.classList.contains('show')) {
      countdownEl.classList.remove('show');
      countdownEl.classList.remove('go');
    }

    updatePlayer(dt);
    for (const r of racers) {
      if (!r.isPlayer) updateAI(r, dt, raceTime);
    }

    handleCollisions();

    for (const r of racers) {
      updateProgress(r, dt);
      updateVisuals(r, dt);
    }

    updateParticles(dt);
    updateHUD();

    if (player) sound.updateEngine(player.speed, player.boostActive);
  }

  function updateFinished(dt) {
    updateParticles(dt);
    for (const r of racers) {
      if (!r.isPlayer) {
        r.speed *= 1 - 0.8 * dt;
        r.pos.x += Math.cos(r.heading) * r.speed * dt;
        r.pos.y += Math.sin(r.heading) * r.speed * dt;
        updateVisuals(r, dt);
      }
    }
    if (player) player.spin += 12 * dt;
  }

  function updateCamera(dt) {
    let tx;
    let ty;
    let smooth = 5.2;
    let zoomTarget = baseScale;

    if (state === 'menu') {
      let lead = racers[0];
      if (lead) {
        for (const r of racers) if (totalProgress(r) > totalProgress(lead)) lead = r;
      }
      if (lead) {
        tx = lead.pos.x + Math.cos(lead.heading) * 105;
        ty = lead.pos.y + Math.sin(lead.heading) * 105;
      } else {
        tx = 0;
        ty = 0;
      }
      smooth = 1.3;
      zoomTarget = baseScale * 0.9;
    } else if (player) {
      tx = player.pos.x + Math.cos(player.heading) * 122;
      ty = player.pos.y + Math.sin(player.heading) * 122;
      if (player.boostActive) {
        zoomTarget = baseScale * 0.965;
        smooth = 6.4;
      }
      if (state === 'finished') zoomTarget = baseScale * 0.94;
    } else {
      tx = 0;
      ty = 0;
    }

    const k = Math.min(1, dt * smooth);
    camera.x += (tx - camera.x) * k;
    camera.y += (ty - camera.y) * k;
    camera.zoom += (zoomTarget - camera.zoom) * Math.min(1, dt * 3.1);
    camera.shake *= Math.exp(-7 * dt);

    if (tiltEnabled) {
      tiltInput += (tiltTarget - tiltInput) * Math.min(1, dt * 9);
    }
  }

  // ------------------------------------------------------------
  // Drawing
  // ------------------------------------------------------------
  function drawBackdrop() {
    if (backdropCache) {
      ctx.drawImage(backdropCache, 0, 0, W, H);
      return;
    }
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, W, H);
  }

  let worldGlow = null;

  function drawWorldBackdrop() {
    const halfW = W / (2 * camera.zoom);
    const halfH = H / (2 * camera.zoom);
    const left = camera.x - halfW - 60;
    const right = camera.x + halfW + 60;
    const top = camera.y - halfH - 60;
    const bottom = camera.y + halfH + 60;

    ctx.strokeStyle = 'rgba(94,138,172,.055)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const step = 90;
    for (let x = Math.floor(left / step) * step; x <= right; x += step) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    for (let y = Math.floor(top / step) * step; y <= bottom; y += step) {
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.stroke();

    for (const p of specks) {
      if (p.x < left || p.x > right || p.y < top || p.y > bottom) continue;
      ctx.fillStyle = `rgba(160,210,235,${p.a})`;
      ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }

    // Soft pool of light under the circuit.
    if (!worldGlow) {
      worldGlow = ctx.createRadialGradient(0, 0, 80, 0, 0, 820);
      worldGlow.addColorStop(0, 'rgba(54,243,255,.035)');
      worldGlow.addColorStop(0.55, 'rgba(255,47,157,.012)');
      worldGlow.addColorStop(1, 'rgba(0,0,0,0)');
    }
    ctx.fillStyle = worldGlow;
    ctx.beginPath();
    ctx.arc(0, 0, 820, 0, TAU);
    ctx.fill();
  }

  function drawTrack(g) {
    g.lineCap = 'round';
    g.lineJoin = 'round';

    // Outer atmosphere.
    g.strokeStyle = 'rgba(54,243,255,.035)';
    g.lineWidth = TRACK_WIDTH + 76;
    g.stroke(trackPath);

    g.strokeStyle = 'rgba(0,0,0,.62)';
    g.lineWidth = TRACK_WIDTH + 48;
    g.stroke(trackPath);

    g.strokeStyle = '#04070d';
    g.lineWidth = TRACK_WIDTH + 18;
    g.stroke(trackPath);

    // Road surface.
    const road = g.createLinearGradient(0, worldBounds.minY - 80, 0, worldBounds.maxY + 80);
    road.addColorStop(0, '#1b2438');
    road.addColorStop(0.35, '#141b2b');
    road.addColorStop(0.68, '#111725');
    road.addColorStop(1, '#1a2235');
    g.strokeStyle = road;
    g.lineWidth = TRACK_WIDTH;
    g.stroke(trackPath);

    // Subtle tarmac band.
    g.strokeStyle = 'rgba(255,255,255,.018)';
    g.lineWidth = TRACK_WIDTH * 0.62;
    g.stroke(trackPath);

    // Curbs.
    for (const c of curbs) {
      g.strokeStyle = c.color;
      g.globalAlpha = 0.72;
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(c.x1, c.y1);
      g.lineTo(c.x2, c.y2);
      g.stroke();
    }
    g.globalAlpha = 1;

    // Center dashes.
    g.save();
    g.strokeStyle = 'rgba(215,245,255,.13)';
    g.lineWidth = 2.5;
    g.setLineDash([16, 24]);
    g.stroke(trackPath);
    g.restore();

    // Neon edges.
    drawEdge(g, leftEdgePath, '#ff2f9d');
    drawEdge(g, rightEdgePath, '#36f3ff');

    // Start/finish strip.
    drawStartLine(g);
  }

  function drawEdge(g, path, color) {
    g.strokeStyle = rgba(color, 0.07);
    g.lineWidth = 26;
    g.stroke(path);

    g.strokeStyle = rgba(color, 0.18);
    g.lineWidth = 11;
    g.stroke(path);

    g.strokeStyle = rgba(color, 0.92);
    g.lineWidth = 2.6;
    g.stroke(path);

    g.strokeStyle = 'rgba(255,255,255,.34)';
    g.lineWidth = 0.9;
    g.stroke(path);
  }

  function drawStartLine(g) {
    const s = sampleAtDistance(0);
    const angle = Math.atan2(s.ty, s.tx);
    const strip = 23;
    const width = TRACK_WIDTH - 8;

    g.save();
    g.translate(s.x, s.y);
    g.rotate(angle);

    g.fillStyle = 'rgba(255,255,255,.08)';
    g.fillRect(-strip / 2 - 6, -width / 2 - 6, strip + 12, width + 12);

    const cols = 8;
    const rows = 2;
    const cw = strip / rows;
    const ch = width / cols;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const white = (row + col) % 2 === 0;
        g.fillStyle = white ? 'rgba(240,252,255,.95)' : 'rgba(6,12,20,.94)';
        g.fillRect(-strip / 2 + row * cw, -width / 2 + col * ch, cw + 0.4, ch + 0.4);
      }
    }

    g.strokeStyle = 'rgba(54,243,255,.5)';
    g.lineWidth = 1.5;
    g.strokeRect(-strip / 2 - 3, -width / 2 - 3, strip + 6, width + 6);
    g.restore();
  }

  function drawBoostPads(g = ctx) {
    const time = performance.now() * 0.001;
    for (let i = 0; i < boostPads.length; i++) {
      const p = boostPads[i];
      const angle = Math.atan2(p.ty, p.tx);
      const pulse = 0.62 + Math.sin(time * 3.4 + i * 2.1) * 0.22;

      g.save();
      g.translate(p.x, p.y);
      g.rotate(angle);

      const glow = g.createRadialGradient(0, 0, 2, 0, 0, 48);
      glow.addColorStop(0, `rgba(54,243,255,${0.18 * pulse})`);
      glow.addColorStop(1, 'rgba(54,243,255,0)');
      g.fillStyle = glow;
      g.beginPath();
      g.arc(0, 0, 48, 0, TAU);
      g.fill();

      g.strokeStyle = `rgba(54,243,255,${0.16 * pulse})`;
      g.lineWidth = 1;
      g.beginPath();
      g.arc(0, 0, 31, 0, TAU);
      g.stroke();

      for (let k = -1; k <= 1; k++) {
        g.save();
        g.translate(k * 15, 0);
        g.beginPath();
        g.moveTo(10, 0);
        g.lineTo(-5, -12);
        g.lineTo(-1, 0);
        g.lineTo(-5, 12);
        g.closePath();
        g.fillStyle = `rgba(140,250,255,${0.18 + pulse * 0.34})`;
        g.fill();
        g.strokeStyle = `rgba(215,255,255,${0.28 + pulse * 0.4})`;
        g.lineWidth = 1;
        g.stroke();
        g.restore();
      }
      g.restore();
    }
  }

  function drawTrails() {
    for (const r of racers) {
      const tr = r.trail;
      if (tr.length < 2) continue;
      const baseWidth = r.isPlayer ? 13 : 8;
      for (let i = 1; i < tr.length; i++) {
        const a = i / tr.length;
        ctx.strokeStyle = rgba(r.color, a * (r.isPlayer ? 0.25 : 0.15));
        ctx.lineWidth = baseWidth * a;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tr[i - 1].x, tr[i - 1].y);
        ctx.lineTo(tr[i].x, tr[i].y);
        ctx.stroke();
      }
    }
  }

  function drawFlames(r) {
    if (!r.boostActive) return;
    const back = r.heading + Math.PI;
    const length = 34 + Math.random() * 20;
    ctx.save();
    ctx.translate(r.pos.x, r.pos.y);
    ctx.rotate(back);
    ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createLinearGradient(r.radius, 0, r.radius + length, 0);
    grad.addColorStop(0, rgba(r.color, 0.65));
    grad.addColorStop(0.45, rgba(r.color, 0.2));
    grad.addColorStop(1, rgba(r.color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(r.radius + length * 0.4, 0, length * 0.55, r.radius * 0.34, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Each top is composited from three pre-rendered sprites. Rebuilding the
  // dozens of gradients and paths that make up a top every frame is costly
  // on phones and software rasterisers; the artwork itself never changes.
  const discSprites = new Map();
  const stemSprites = new Map();
  const haloSpriteCache = new Map();

  function spriteCanvas(span, supersample) {
    const size = Math.ceil(span * supersample);
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    g.translate(size / 2, size / 2);
    g.scale(supersample, supersample);
    return { img: c, g, span };
  }

  function makeDiscSprite(r) {
    const R = r.radius;
    const s = spriteCanvas(R * 2.2, 2.5);
    const g = s.g;

    const body = g.createRadialGradient(-R * 0.32, -R * 0.36, R * 0.04, 0, 0, R * 1.08);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.1, r.colorLight);
    body.addColorStop(0.42, r.color);
    body.addColorStop(0.79, r.colorDeep);
    body.addColorStop(0.94, mixColor(r.color, '#000000', 0.78));
    body.addColorStop(1, '#020509');
    g.fillStyle = body;
    g.beginPath();
    g.arc(0, 0, R, 0, TAU);
    g.fill();

    // Blades / spokes.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, R * 0.94, a, a + 0.245);
      g.closePath();
      g.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,.2)' : 'rgba(2,7,12,.28)';
      g.fill();
    }

    // Bright rim + inner ring.
    g.strokeStyle = rgba(r.colorLight, 0.96);
    g.lineWidth = 2.8;
    g.beginPath();
    g.arc(0, 0, R * 0.94, 0, TAU);
    g.stroke();

    g.strokeStyle = 'rgba(2,7,12,.58)';
    g.lineWidth = 3.4;
    g.beginPath();
    g.arc(0, 0, R * 0.58, 0, TAU);
    g.stroke();

    // Moving highlights.
    g.strokeStyle = 'rgba(255,255,255,.82)';
    g.lineWidth = 1.7;
    g.beginPath();
    g.arc(0, 0, R * 0.78, -1.48, -0.32);
    g.stroke();
    g.beginPath();
    g.arc(0, 0, R * 0.78, 1.2, 1.95);
    g.stroke();

    // Machined hub.
    const cap = g.createRadialGradient(-R * 0.13, -R * 0.16, R * 0.015, 0, 0, R * 0.44);
    cap.addColorStop(0, '#ffffff');
    cap.addColorStop(0.2, r.colorLight);
    cap.addColorStop(0.54, r.color);
    cap.addColorStop(0.86, r.colorDeep);
    cap.addColorStop(1, '#020509');
    g.fillStyle = cap;
    g.beginPath();
    g.arc(0, 0, R * 0.42, 0, TAU);
    g.fill();

    g.strokeStyle = 'rgba(255,255,255,.72)';
    g.lineWidth = 1.1;
    g.beginPath();
    g.arc(0, 0, R * 0.42, 0, TAU);
    g.stroke();

    g.fillStyle = 'rgba(255,255,255,.72)';
    g.beginPath();
    g.ellipse(-R * 0.36, -R * 0.42, R * 0.17, R * 0.08, -0.6, 0, TAU);
    g.fill();

    return s;
  }

  function makeStemSprite(r) {
    const R = r.radius;
    const s = spriteCanvas(R * 3.4, 2.5);
    const g = s.g;
    const baseY = -3;
    const topY = -R * 1.12;
    const stemW = R * 0.19;

    // Central spindle. This is what makes it read as a top, not a puck.
    const stem = g.createLinearGradient(-stemW, 0, stemW, 0);
    stem.addColorStop(0, r.colorDeep);
    stem.addColorStop(0.32, r.color);
    stem.addColorStop(0.5, '#ffffff');
    stem.addColorStop(0.68, r.color);
    stem.addColorStop(1, r.colorDeep);
    g.fillStyle = stem;
    g.beginPath();
    g.moveTo(-stemW, baseY);
    g.lineTo(-stemW * 0.28, topY + 4);
    g.lineTo(0, topY);
    g.lineTo(stemW * 0.28, topY + 4);
    g.lineTo(stemW, baseY);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,.42)';
    g.lineWidth = 0.8;
    g.stroke();

    // Spindle base ring.
    g.strokeStyle = rgba(r.colorLight, 0.75);
    g.lineWidth = 1.4;
    g.beginPath();
    g.ellipse(0, baseY, stemW * 1.65, stemW * 0.6, 0, 0, TAU);
    g.stroke();

    // Tip.
    const tip = g.createRadialGradient(-1, topY - 1, 0.4, 0, topY, R * 0.15);
    tip.addColorStop(0, '#ffffff');
    tip.addColorStop(0.45, r.colorLight);
    tip.addColorStop(1, r.colorDeep);
    g.fillStyle = tip;
    g.beginPath();
    g.arc(0, topY, R * 0.13, 0, TAU);
    g.fill();

    if (r.isPlayer) {
      g.fillStyle = rgba(r.color, 0.98);
      g.beginPath();
      g.moveTo(0, topY - R * 0.18);
      g.lineTo(-5, topY - R * 0.4);
      g.lineTo(5, topY - R * 0.4);
      g.closePath();
      g.fill();
    }

    return s;
  }

  function makeHaloSprite(r) {
    const R = r.radius;
    const s = spriteCanvas(R * 4.6, 1.5);
    const g = s.g;
    const halo = g.createRadialGradient(0, 0, R * 0.35, 0, 0, R * 2.3);
    halo.addColorStop(0, rgba(r.color, r.isPlayer ? 0.28 : 0.16));
    halo.addColorStop(0.48, rgba(r.color, 0.055));
    halo.addColorStop(1, rgba(r.color, 0));
    g.fillStyle = halo;
    g.beginPath();
    g.arc(0, 0, R * 2.3, 0, TAU);
    g.fill();
    return s;
  }

  function spriteFor(cache, r, make, key) {
    let s = cache.get(key);
    if (!s) {
      s = make(r);
      cache.set(key, s);
    }
    return s;
  }

  function drawTop(r) {
    const R = r.radius;
    const pulse = 0.72 + Math.sin(performance.now() * 0.006 + (r.isPlayer ? 0 : r.trackIndex)) * 0.2;
    const squash = 0.76;
    const key = `${r.color}|${r.colorDeep}|${r.isPlayer ? 1 : 0}`;

    drawFlames(r);

    ctx.save();
    ctx.translate(r.pos.x, r.pos.y);

    // Cast shadow, offset to sell the raised body.
    ctx.fillStyle = 'rgba(0,0,0,.52)';
    ctx.beginPath();
    ctx.ellipse(4, 12, R * 1.18, R * 0.52, 0, 0, TAU);
    ctx.fill();

    // Soft team-coloured halo.
    const halo = spriteFor(haloSpriteCache, r, makeHaloSprite, key);
    ctx.drawImage(halo.img, -halo.span / 2, -halo.span / 2, halo.span, halo.span);

    // Player tracking ring.
    if (r.isPlayer) {
      ctx.strokeStyle = rgba(r.color, 0.36 + pulse * 0.26);
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.ellipse(0, 3, R + 9, (R + 9) * squash, 0, r.spin * 0.18, r.spin * 0.18 + TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Side wall of the spinning disc.
    ctx.fillStyle = r.colorDeep;
    ctx.beginPath();
    ctx.ellipse(0, 5, R, R * squash, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(1,4,8,.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Spinning disc.
    const disc = spriteFor(discSprites, r, makeDiscSprite, `${r.color}|${r.colorDeep}`);
    ctx.save();
    ctx.translate(0, -2);
    ctx.scale(1, squash);
    ctx.rotate(r.spin);
    ctx.drawImage(disc.img, -disc.span / 2, -disc.span / 2, disc.span, disc.span);
    ctx.restore();

    // Spindle sits above the disc.
    const stem = spriteFor(stemSprites, r, makeStemSprite, key);
    ctx.drawImage(stem.img, -stem.span / 2, -stem.span / 2, stem.span, stem.span);

    ctx.restore();
  }

  function drawRacers() {
    const sorted = racers.slice().sort((a, b) => (a.isPlayer ? 1 : 0) - (b.isPlayer ? 1 : 0));
    for (const r of sorted) drawTop(r);
  }

  function drawParticles() {
    for (const p of particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      if (p.type === 'spark') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba(p.color, a * 0.9);
        ctx.lineWidth = p.size * 0.55;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
        ctx.stroke();
      } else if (p.type === 'dust') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = rgba(p.color, a * 0.28);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.5 - a * 0.5), 0, TAU);
        ctx.fill();
      } else if (p.type === 'confetti') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = rgba(p.color, a);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rgba(p.color, a * 0.85);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawSpeedFx() {
    if (!player || !player.boostActive) return;
    const sx = W / 2 + (player.pos.x - camera.x) * camera.zoom;
    const sy = H * 0.53 + (player.pos.y - camera.y) * camera.zoom;
    const t = performance.now() * 0.001;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU + Math.sin(t * 1.4 + i) * 0.05;
      const inner = 95 + (i % 4) * 12;
      const outer = inner + 40 + (i % 3) * 20;
      ctx.strokeStyle = `rgba(145,250,255,${0.025 + (i % 3) * 0.012})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(a) * inner, sy + Math.sin(a) * inner);
      ctx.lineTo(sx + Math.cos(a) * outer, sy + Math.sin(a) * outer);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMinimap() {
    if (hud.classList.contains('hidden')) return;
    miniCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
    miniCtx.clearRect(0, 0, miniW, miniH);

    const pad = 8;
    const bw = worldBounds.maxX - worldBounds.minX;
    const bh = worldBounds.maxY - worldBounds.minY;
    const scale = Math.min((miniW - pad * 2) / bw, (miniH - pad * 2) / bh);
    const ox = (miniW - bw * scale) / 2 - worldBounds.minX * scale;
    const oy = (miniH - bh * scale) / 2 - worldBounds.minY * scale;
    const mx = x => x * scale + ox;
    const my = y => y * scale + oy;

    miniCtx.lineCap = 'round';
    miniCtx.lineJoin = 'round';

    miniCtx.strokeStyle = 'rgba(150,220,245,.18)';
    miniCtx.lineWidth = 8;
    miniCtx.beginPath();
    for (let i = 0; i < samples.length; i += 3) {
      const s = samples[i];
      if (i === 0) miniCtx.moveTo(mx(s.x), my(s.y));
      else miniCtx.lineTo(mx(s.x), my(s.y));
    }
    miniCtx.closePath();
    miniCtx.stroke();

    miniCtx.strokeStyle = 'rgba(220,250,255,.62)';
    miniCtx.lineWidth = 1.5;
    miniCtx.stroke();

    const start = sampleAtDistance(0);
    miniCtx.fillStyle = 'rgba(255,255,255,.8)';
    miniCtx.fillRect(mx(start.x) - 2, my(start.y) - 2, 4, 4);

    for (const r of racers) {
      miniCtx.fillStyle = r.color;
      miniCtx.beginPath();
      miniCtx.arc(mx(r.pos.x), my(r.pos.y), r.isPlayer ? 3.4 : 2.2, 0, TAU);
      miniCtx.fill();
      if (r.isPlayer) {
        miniCtx.strokeStyle = 'rgba(255,255,255,.85)';
        miniCtx.lineWidth = 1;
        miniCtx.stroke();
      }
    }
  }

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------
  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawBackdrop();
    if (state === 'menu') return;

    const shakeX = (Math.random() * 2 - 1) * camera.shake;
    const shakeY = (Math.random() * 2 - 1) * camera.shake;

    ctx.save();
    ctx.translate(W / 2 + shakeX, H * 0.53 + shakeY);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // The menu is a single static frame behind a dark overlay. Skipping the
    // world grid/glow keeps its first paint light on software rasterisers.
    if (state !== 'menu') drawWorldBackdrop();
    if (trackCache) {
      const b = trackCacheBounds;
      ctx.drawImage(trackCache, b.minX, b.minY, b.w, b.h);
    } else {
      drawTrack(ctx);
    }
    drawBoostPads();
    drawTrails();
    drawRacers();
    drawParticles();

    ctx.restore();

    drawSpeedFx();
    drawMinimap();
  }

  // ------------------------------------------------------------
  // Main loop
  // ------------------------------------------------------------
  function tick(dt) {
    if (state === 'paused') {
      updateParticles(0);
      return;
    }

    if (state === 'countdown') {
      updateCountdown(dt);
      updateParticles(dt);
    } else if (state === 'racing') {
      updateRace(dt);
    } else if (state === 'finished') {
      updateFinished(dt);
    }

    updateCamera(dt);

    if (state !== 'racing') {
      document.body.classList.remove('boosting');
    } else if (player) {
      document.body.classList.toggle('boosting', player.boostActive);
    }
  }

  let rafId = 0;

  function loop(now) {
    rafId = 0;
    const dt = Math.min(0.033, Math.max(0.001, (now - lastFrame) / 1000));
    lastFrame = now;
    tick(dt);
    render();
    // The menu and pause screens are static: stop producing frames so phones
    // idle instead of burning battery on a background that never changes.
    if (state !== 'menu' && state !== 'paused') {
      rafId = requestAnimationFrame(loop);
    }
  }

  function ensureLoop() {
    if (rafId) return;
    lastFrame = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------
  // Input
  // ------------------------------------------------------------
  function bindHold(el, down, up) {
    let active = false;
    const onDown = (e) => {
      e.preventDefault();
      active = true;
      el.classList.add('active');
      try { el.setPointerCapture(e.pointerId); } catch {}
      down();
    };
    const onUp = (e) => {
      if (!active) return;
      e.preventDefault();
      active = false;
      el.classList.remove('active');
      up();
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('lostpointercapture', onUp);
  }

  bindHold(leftBtn, () => { touch.left = true; }, () => { touch.left = false; });
  bindHold(rightBtn, () => { touch.right = true; }, () => { touch.right = false; });
  bindHold(boostBtn, () => { touch.boost = true; }, () => { touch.boost = false; });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { keys.left = true; e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { keys.right = true; e.preventDefault(); }
    if (e.key === ' ' || e.key === 'Shift') { keys.boost = true; e.preventDefault(); }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (state === 'racing' || state === 'countdown') pauseRace();
      else if (state === 'paused') resumeRace();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
    if (e.key === ' ' || e.key === 'Shift') keys.boost = false;
  });

  window.addEventListener('blur', () => {
    keys.left = false;
    keys.right = false;
    keys.boost = false;
    touch.left = false;
    touch.right = false;
    touch.boost = false;
    leftBtn.classList.remove('active');
    rightBtn.classList.remove('active');
    boostBtn.classList.remove('active');
  });

  // Menu selection
  document.querySelectorAll('.top-card').forEach((card) => {
    card.addEventListener('click', () => {
      selectedTop = card.dataset.top;
      document.querySelectorAll('.top-card').forEach((c) => {
        const on = c === card;
        c.classList.toggle('selected', on);
        c.setAttribute('aria-checked', String(on));
      });
      const top = TOPS[selectedTop];
      document.documentElement.style.setProperty('--top-color', top.color);
      document.documentElement.style.setProperty('--top-deep', top.deep);
      if (heroCaption) heroCaption.innerHTML = `${top.name} <span>//</span> 06`;
      sound.init();
      sound.beep(560, 0.06, 'triangle', 0.03, 100);
    });
  });

  playBtn.addEventListener('click', startRace);
  againBtn.addEventListener('click', startRace);
  menuBtn.addEventListener('click', showMenu);
  pauseBtn.addEventListener('click', pauseRace);
  resumeBtn.addEventListener('click', resumeRace);
  restartBtn.addEventListener('click', () => { pausePanel.classList.add('hidden'); resetRace(); });
  quitBtn.addEventListener('click', quitToMenu);

  tiltBtn.addEventListener('click', toggleTilt);
  menuTiltBtn.addEventListener('click', toggleTilt);

  soundBtn.addEventListener('click', () => {
    const muted = !sound.muted;
    sound.setMuted(muted);
    soundState.textContent = muted ? 'OFF' : 'ON';
    soundBtn.classList.toggle('active', !muted);
    soundBtn.setAttribute('aria-pressed', String(!muted));
    if (!muted) {
      sound.init();
      sound.beep(620, 0.07, 'triangle', 0.03, 90);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (state === 'racing' || state === 'countdown')) pauseRace();
  });

  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  // ------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------
  resize();
  resetMenu();
  syncTiltUI();
  soundBtn.classList.add('active');
  updateHUD();
  ensureLoop();
})();
