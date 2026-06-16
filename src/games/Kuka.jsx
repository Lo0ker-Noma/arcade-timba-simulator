import React, { useEffect, useRef, useState } from 'react';
import { sfx } from '../lib/sound';

// 🪳 Kuka Exterminator — solo 60s score-attack inside a stone crypt.
// Splat as many roaches as you can; your kills are your score.
// Heavy art (crypt, gun, roaches, splats) is pre-rendered ONCE to offscreen
// canvases; the per-frame loop only blits sprites + draws cheap effects, so
// it stays smooth even on modest hardware.
const W = 600, H = 380, ROUND_MS = 60000;
const VPX = W / 2, VPY = H * 0.42; // vanishing point for the vault perspective
const GUN_W = 150, GUN_H = 230;
const ROACH_D = 64, ROACH_S = 16; // sprite canvas size / baseline body size

function spawnRoach(spd = 2.2) {
  const edge = Math.random() < 0.5;
  return {
    x: edge ? Math.random() * W : (Math.random() < 0.5 ? -20 : W + 20),
    y: edge ? (Math.random() < 0.5 ? -20 : H + 20) : Math.random() * H,
    vx: (Math.random() * 2 - 1) * spd, vy: (Math.random() * 2 - 1) * spd,
    size: 13 + Math.random() * 7, phase: Math.random() * Math.PI * 2,
  };
}

// ---------- one-time offscreen renderers ----------

// Gothic crypt: receding arches, flagstones, cracks, skull niches, cobwebs,
// moss, torch brackets and vignette — everything static lives here.
function renderCryptBg() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#070504'; x.fillRect(0, 0, W, H);

  const archPath = (hw, bottom, springY, apexY) => {
    x.beginPath();
    x.moveTo(VPX - hw, bottom);
    x.lineTo(VPX - hw, springY);
    x.quadraticCurveTo(VPX - hw, apexY, VPX, apexY);
    x.quadraticCurveTo(VPX + hw, apexY, VPX + hw, springY);
    x.lineTo(VPX + hw, bottom);
    x.closePath();
  };

  const N = 9, base = 0.76;
  for (let i = 0; i < N; i++) {
    const s = Math.pow(base, i);
    const hw = (W * 0.66) * s;
    const bottom = VPY + (H * 0.66) * s;
    const springY = VPY - (H * 0.16) * s;
    const apexY = VPY - (H * 0.5) * s;
    const k = i / (N - 1); // 0 outer → 1 inner
    const lum = 1 - k;
    const r = Math.round(20 + 30 * lum), g = Math.round(15 + 22 * lum), b = Math.round(10 + 14 * lum);
    archPath(hw, bottom, springY, apexY);
    x.fillStyle = `rgb(${r},${g},${b})`; x.fill();
    // stone joints (mortar) — outline + staggered brick courses on the walls
    x.strokeStyle = `rgba(${r + 40},${g + 34},${b + 26},${0.5 - k * 0.4})`; x.lineWidth = 1; x.stroke();
    if (i < N - 2) {
      for (const fy of [0.22, 0.4, 0.56, 0.72, 0.87]) {
        const yy = springY + (bottom - springY) * fy;
        const len = 0.86 - (fy * 0.04);
        x.beginPath(); x.moveTo(VPX - hw, yy); x.lineTo(VPX - hw * len, yy);
        x.moveTo(VPX + hw, yy); x.lineTo(VPX + hw * len, yy); x.stroke();
        // vertical joints, staggered every other course
        const off = (Math.round(fy * 100) % 2) ? 0.95 : 0.9;
        x.beginPath(); x.moveTo(VPX - hw * off, yy); x.lineTo(VPX - hw * off, yy + (bottom - springY) * 0.1);
        x.moveTo(VPX + hw * off, yy); x.lineTo(VPX + hw * off, yy + (bottom - springY) * 0.1); x.stroke();
      }
    }
  }

  // warm glow seeping from the innermost doorway
  const dg = x.createRadialGradient(VPX, VPY - 6, 2, VPX, VPY - 6, 46);
  dg.addColorStop(0, 'rgba(255,150,50,0.30)'); dg.addColorStop(1, 'rgba(255,120,40,0)');
  x.fillStyle = dg; x.fillRect(VPX - 46, VPY - 52, 92, 92);

  // foreground floor flagstones
  x.strokeStyle = 'rgba(120,90,55,0.12)'; x.lineWidth = 1;
  for (let i = 1; i <= 5; i++) {
    const yy = VPY + (H - VPY) * (i / 5) * (i / 5);
    x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke();
  }
  for (let i = -3; i <= 3; i++) {
    x.beginPath(); x.moveTo(VPX, VPY + 20); x.lineTo(VPX + i * 120, H); x.stroke();
  }
  // uneven flagstone shading patches
  for (let i = 0; i < 16; i++) {
    const fx = (i * 173) % W, fy = VPY + 30 + ((i * 97) % (H - VPY - 30));
    x.fillStyle = `rgba(${i % 2 ? 50 : 12},${i % 2 ? 36 : 9},${i % 2 ? 20 : 6},0.10)`;
    x.beginPath(); x.ellipse(fx, fy, 36 + (i % 4) * 9, 10 + (i % 3) * 4, 0, 0, 7); x.fill();
  }

  // cracks in the masonry
  x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 1.2;
  const crack = (pts) => { x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.stroke(); };
  crack([[W * 0.16, VPY - 80], [W * 0.18, VPY - 52], [W * 0.155, VPY - 30], [W * 0.175, VPY - 6]]);
  crack([[W * 0.86, VPY - 110], [W * 0.84, VPY - 78], [W * 0.862, VPY - 60]]);
  crack([[W * 0.32, H - 30], [W * 0.4, H - 38], [W * 0.47, H - 32]]);

  // skull niches, one per side — it's La Crypta after all 💀
  const skullNiche = (nx, ny) => {
    x.fillStyle = '#0a0705';
    x.beginPath(); x.moveTo(nx - 14, ny + 12); x.lineTo(nx - 14, ny - 6);
    x.quadraticCurveTo(nx, ny - 22, nx + 14, ny - 6); x.lineTo(nx + 14, ny + 12); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(120,95,60,0.35)'; x.lineWidth = 1; x.stroke();
    // skull
    x.fillStyle = '#b8a888';
    x.beginPath(); x.ellipse(nx, ny - 2, 8, 7, 0, 0, 7); x.fill();
    x.fillRect(nx - 5, ny + 3, 10, 5); // jaw
    x.fillStyle = '#0a0705';
    x.beginPath(); x.ellipse(nx - 3.2, ny - 3, 2.2, 2.6, 0, 0, 7); x.fill();
    x.beginPath(); x.ellipse(nx + 3.2, ny - 3, 2.2, 2.6, 0, 0, 7); x.fill();
    x.beginPath(); x.moveTo(nx, ny); x.lineTo(nx - 1.5, ny + 2.5); x.lineTo(nx + 1.5, ny + 2.5); x.closePath(); x.fill();
    for (let tt = -3; tt <= 3; tt += 2) { x.fillRect(nx + tt - 0.5, ny + 4, 1, 3); }
  };
  skullNiche(W * 0.205, VPY + 28);
  skullNiche(W * 0.795, VPY + 28);

  // cobwebs in the top corners
  const cobweb = (cx2, cy2, dirX) => {
    x.strokeStyle = 'rgba(200,200,210,0.13)'; x.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const a = (Math.PI / 2) * (i / 4);
      x.beginPath(); x.moveTo(cx2, cy2);
      x.lineTo(cx2 + Math.cos(a) * 70 * dirX, cy2 + Math.sin(a) * 70); x.stroke();
    }
    for (let rr = 18; rr <= 62; rr += 15) {
      x.beginPath();
      for (let i = 0; i <= 4; i++) {
        const a = (Math.PI / 2) * (i / 4);
        const px2 = cx2 + Math.cos(a) * rr * dirX, py2 = cy2 + Math.sin(a) * rr;
        if (i === 0) x.moveTo(px2, py2); else x.quadraticCurveTo(cx2 + Math.cos(a - 0.2) * rr * 0.92 * dirX, cy2 + Math.sin(a - 0.2) * rr * 0.92, px2, py2);
      }
      x.stroke();
    }
  };
  cobweb(0, 0, 1);
  cobweb(W, 0, -1);

  // moss creeping up from the floor line
  for (let i = 0; i < 12; i++) {
    const mx = (i * 211 + 40) % W, my = VPY + 40 + ((i * 53) % 30);
    x.fillStyle = `rgba(60,${90 + (i % 3) * 14},45,0.10)`;
    x.beginPath(); x.ellipse(mx, my, 14 + (i % 3) * 8, 5 + (i % 2) * 3, 0, 0, 7); x.fill();
  }

  // torch brackets (flames are drawn live)
  for (const tx of [W * 0.1, W * 0.9]) {
    x.fillStyle = '#2a2018'; x.fillRect(tx - 3, VPY - 10, 6, 26);
    x.fillStyle = '#1a1410'; x.fillRect(tx - 5, VPY + 12, 10, 4);
  }

  // vignette
  const vg = x.createRadialGradient(VPX, VPY, 60, VPX, VPY, W * 0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.65)');
  x.fillStyle = vg; x.fillRect(0, 0, W, H);
  return c;
}

// Roach sprite, two walking poses (tripod gait) — drawn facing +X.
function renderRoachFrames() {
  const S = ROACH_S;
  return [1, -1].map((sw) => {
    const c = document.createElement('canvas'); c.width = ROACH_D; c.height = ROACH_D;
    const x = c.getContext('2d');
    x.translate(ROACH_D / 2, ROACH_D / 2);
    // soft contact shadow
    x.fillStyle = 'rgba(0,0,0,0.32)';
    x.beginPath(); x.ellipse(0, S * 0.42, S, S * 0.4, 0, 0, 7); x.fill();
    // six jointed legs
    x.strokeStyle = '#170d06'; x.lineWidth = 2; x.lineCap = 'round';
    for (let side = -1; side <= 1; side += 2) {
      for (let l = -1; l <= 1; l++) {
        const ph = sw * (l === 0 ? -1 : 1) * side;
        const hipX = l * S * 0.38, hipY = side * S * 0.28;
        const kneeX = hipX + l * S * 0.08 + ph * 1.6, kneeY = side * S * 0.6;
        const footX = kneeX + ph * 2.6, footY = side * S * 0.88;
        x.beginPath(); x.moveTo(hipX, hipY); x.lineTo(kneeX, kneeY); x.lineTo(footX, footY); x.stroke();
      }
    }
    // antennae sweeping with the gait
    x.strokeStyle = '#241405'; x.lineWidth = 1.3;
    x.beginPath(); x.moveTo(S * 0.7, -S * 0.08);
    x.quadraticCurveTo(S * 1.25, -S * 0.5 - sw * 1.5, S * 1.65, -S * 0.3 - sw * 2.5); x.stroke();
    x.beginPath(); x.moveTo(S * 0.7, S * 0.08);
    x.quadraticCurveTo(S * 1.25, S * 0.5 + sw * 1.5, S * 1.65, S * 0.3 + sw * 2.5); x.stroke();
    // chitinous abdomen
    const g = x.createLinearGradient(-S, -S * 0.6, S * 0.6, S * 0.6);
    g.addColorStop(0, '#2c1a0c'); g.addColorStop(0.45, '#5d3a1e'); g.addColorStop(0.75, '#8a5a30'); g.addColorStop(1, '#3a2412');
    x.fillStyle = g;
    x.beginPath(); x.ellipse(-S * 0.1, 0, S * 0.85, S * 0.52, 0, 0, 7); x.fill();
    // wing/segment seams
    x.strokeStyle = 'rgba(20,10,4,0.55)'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(-S * 0.9, 0); x.lineTo(S * 0.35, 0); x.stroke();
    for (const tpos of [-0.5, -0.18, 0.12]) {
      const cxs = S * tpos;
      x.beginPath(); x.moveTo(cxs, -S * 0.42); x.quadraticCurveTo(cxs + 2, 0, cxs, S * 0.42); x.stroke();
    }
    // glossy highlight
    x.fillStyle = 'rgba(255,205,130,0.16)';
    x.beginPath(); x.ellipse(-S * 0.2, -S * 0.2, S * 0.45, S * 0.14, -0.2, 0, 7); x.fill();
    // pronotum + head + eyes
    x.fillStyle = '#241405';
    x.beginPath(); x.ellipse(S * 0.42, 0, S * 0.28, S * 0.38, 0, 0, 7); x.fill();
    x.fillStyle = '#1c1006';
    x.beginPath(); x.ellipse(S * 0.7, 0, S * 0.17, S * 0.22, 0, 0, 7); x.fill();
    x.fillStyle = '#caa46a';
    x.fillRect(S * 0.74, -S * 0.16, 1.6, 2.2); x.fillRect(S * 0.74, S * 0.06, 1.6, 2.2);
    return c;
  });
}

// Goo splat sprite — drawn once, blitted with decay alpha + per-splat rotation.
function renderSplatSprite() {
  const D = 72;
  const c = document.createElement('canvas'); c.width = D; c.height = D;
  const x = c.getContext('2d');
  x.translate(D / 2, D / 2);
  const g = x.createRadialGradient(0, 0, 2, 0, 0, 26);
  g.addColorStop(0, 'rgba(122,116,44,0.95)'); g.addColorStop(0.55, 'rgba(74,62,22,0.85)'); g.addColorStop(1, 'rgba(46,36,12,0)');
  x.fillStyle = g;
  x.beginPath(); x.ellipse(0, 0, 17, 13, 0.4, 0, 7); x.fill();
  // streaks + droplets radiating out
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.35;
    const d = 15 + (i % 3) * 7;
    x.strokeStyle = 'rgba(74,62,22,0.7)'; x.lineWidth = 2 - (i % 2) * 0.8;
    x.beginPath(); x.moveTo(Math.cos(a) * 8, Math.sin(a) * 6);
    x.lineTo(Math.cos(a) * d * 0.8, Math.sin(a) * d * 0.8); x.stroke();
    x.fillStyle = 'rgba(96,84,30,0.85)';
    x.beginPath(); x.arc(Math.cos(a) * d, Math.sin(a) * d, 2.4 - (i % 2), 0, 7); x.fill();
  }
  return c;
}

// Pixel-art FPS pistol seen from behind, held by a fist (hand + forearm),
// hand-placed on a 30×46 grid and scaled up with no smoothing for crisp
// chunky pixels — classic retro shooter look.
const PXS = 5; // pixel scale: 30×46 grid → 150×230 sprite
function renderGunSprite() {
  const c = document.createElement('canvas'); c.width = GUN_W; c.height = GUN_H;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  const px = (col, row, w, h, color) => { x.fillStyle = color; x.fillRect(col * PXS, row * PXS, w * PXS, h * PXS); };
  // palette
  const K = '#0c0e12', D = '#23272e', G = '#3f4754', L = '#9aa6ba', W2 = '#e8edf5';
  const R = '#7a3b2a', Rl = '#a45438';
  const S = '#d9956b', Sl = '#ecb287', Sd = '#b06f4a', So = '#7a4730';

  // ---- forearm + fist (gun is drawn on top) ----
  for (let r = 31; r <= 45; r++) {
    const grow = Math.floor((r - 31) / 4);
    const lft = Math.max(6, 9 - grow), rgt = Math.min(23, 20 + grow);
    px(lft, r, rgt - lft + 1, 1, S);
    px(rgt - 2, r, 3, 1, Sd);          // shade on the right
    px(lft, r, 1, 1, So); px(rgt, r, 1, 1, So); // outlines
  }
  // wrist crease + tendon wrinkles
  px(10, 33, 9, 1, Sd);
  px(12, 37, 2, 1, So); px(16, 39, 2, 1, So);
  // fist block
  px(8, 19, 14, 12, S);
  px(19, 19, 3, 12, Sd);               // right shading
  px(7, 20, 1, 10, So); px(22, 20, 1, 10, So);
  px(8, 30, 14, 1, So);
  // knuckle bumps along the top
  px(9, 18, 3, 1, S); px(13, 18, 3, 1, S); px(17, 18, 3, 1, S);
  px(9, 18, 1, 1, So); px(12, 18, 1, 1, So); px(16, 18, 1, 1, So); px(19, 18, 1, 1, So);
  // wrapped finger creases + per-finger highlight
  px(8, 22, 11, 1, So); px(8, 25, 11, 1, So); px(8, 28, 11, 1, So);
  px(9, 20, 2, 1, Sl); px(9, 23, 2, 1, Sl); px(9, 26, 2, 1, Sl); px(9, 29, 2, 1, Sl);

  // ---- pistol over the fist ----
  // front sight + muzzle tip (far end)
  px(13, 0, 4, 1, K);
  px(12, 1, 1, 1, K); px(13, 1, 4, 1, R); px(17, 1, 1, 1, K);
  px(12, 2, 1, 1, K); px(13, 2, 1, 1, Rl); px(14, 2, 3, 1, R); px(17, 2, 1, 1, K);
  px(12, 3, 6, 1, K);
  // slide: perspective bands widening toward the viewer
  // band A (rows 4-7)
  px(9, 4, 12, 4, G); px(9, 4, 1, 4, K); px(20, 4, 1, 4, K);
  px(10, 4, 1, 4, W2); px(19, 4, 1, 4, W2);
  px(13, 5, 4, 3, D);
  // band B (rows 8-10)
  px(8, 8, 14, 3, G); px(8, 8, 1, 3, K); px(21, 8, 1, 3, K);
  px(9, 8, 1, 3, W2); px(20, 8, 1, 3, W2);
  px(12, 8, 6, 3, D);
  // band C (rows 11-13)
  px(7, 11, 16, 3, G); px(7, 11, 1, 3, K); px(22, 11, 1, 3, K);
  px(8, 11, 1, 3, W2); px(21, 11, 1, 3, W2);
  px(12, 11, 6, 3, D);
  // band D (rows 14-16) + rear sight (closest to the eye)
  px(6, 14, 18, 3, G); px(6, 14, 1, 3, K); px(23, 14, 1, 3, K);
  px(7, 14, 4, 1, L); px(19, 14, 4, 1, L);   // lit post tops
  px(7, 15, 4, 2, D); px(19, 15, 4, 2, D);   // post bodies
  px(11, 14, 8, 3, K);                       // sight notch shadow
  px(6, 17, 18, 1, K);                       // slide base outline
  // frame sliver before the fist swallows the grip
  px(9, 18, 1, 1, K); px(10, 18, 10, 1, D); px(20, 18, 1, 1, K);
  return c;
}

// Pixel starburst muzzle flash: white core, orange fringe, red sparks —
// drawn once, blitted with alpha fade + 1px jitter while firing.
const FLASH_G = 26, FLASH_PX = 5, FLASH_S = FLASH_G * FLASH_PX;
function renderFlashSprite() {
  const c = document.createElement('canvas'); c.width = FLASH_S; c.height = FLASH_S;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  const px = (col, row, w, h, color) => { x.fillStyle = color; x.fillRect(col * FLASH_PX, row * FLASH_PX, w * FLASH_PX, h * FLASH_PX); };
  const W2 = '#fff7e8', O = '#ff8a2a', E = '#d23818';
  // white vertical burst rows: [row, leftCol, width]
  const core = [
    [2, 12, 2], [3, 12, 2], [4, 11, 4], [5, 11, 4], [6, 10, 6], [7, 10, 6],
    [8, 9, 8], [9, 9, 8], [10, 8, 10], [11, 8, 10], [12, 9, 8], [13, 9, 8],
    [14, 10, 6], [15, 11, 4], [16, 12, 2],
  ];
  // orange silhouette = core expanded by 1px all around
  core.forEach(([r, l, w]) => px(l - 1, r - 1, w + 2, 3, O));
  // side spikes (orange first, then white core)
  px(1, 9, 7, 3, O); px(18, 9, 7, 3, O);
  px(2, 10, 6, 1, W2); px(18, 10, 6, 1, W2);
  // diagonal nubs
  px(5, 4, 2, 2, O); px(19, 4, 2, 2, O); px(4, 16, 2, 2, O); px(20, 16, 2, 2, O);
  core.forEach(([r, l, w]) => px(l, r, w, 1, W2));
  // scattered red sparks
  const sparks = [[2, 2, 1], [23, 3, 1], [0, 8, 1], [25, 7, 1], [3, 15, 1], [22, 15, 1], [8, 0, 1], [17, 0, 2], [12, 19, 1], [5, 20, 1], [20, 20, 1], [25, 13, 1], [0, 13, 1], [10, 22, 1], [15, 21, 1], [24, 18, 1]];
  sparks.forEach(([sx, sy, sw]) => px(sx, sy, sw, sw, E));
  return c;
}

// The game's pre-rendered art, shared with GamePreview so the picker
// thumbnail shows the real crypt/gun/roaches. Memoized — rendered once.
let _art = null;
export function kukaArt() {
  if (!_art) _art = { bg: renderCryptBg(), gun: renderGunSprite(), roaches: renderRoachFrames(), flash: renderFlashSprite() };
  return _art;
}

export default function Kuka({ onGameOver, onProgress, level = 1 }) {
  const roachCount = 6 + (level - 1);
  const roachSpeed = 2.2 + (level - 1) * 0.4;
  const canvasRef = useRef(null);
  const roaches = useRef([]);
  const splats = useRef([]);
  const killsRef = useRef(0);
  const mouse = useRef({ x: W / 2, y: H / 2, flash: 0 });
  const recoil = useRef(0);
  const gibs = useRef([]);    // chitin/goo bits flying off a splatted roach
  const pops = useRef([]);    // floating "+N" score popups
  const bats = useRef([]);    // ambient bats flapping across the crypt
  const shake = useRef(0);    // screen-shake impulse on a hit
  const endedRef = useRef(false);
  const [kills, setKills] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [over, setOver] = useState(false);

  useEffect(() => {
    roaches.current = Array.from({ length: roachCount }, () => spawnRoach(roachSpeed));
    const canvas = canvasRef.current; const ctx = canvas.getContext('2d');
    // expensive art rendered once per mount
    const bg = renderCryptBg();
    const roachFrames = renderRoachFrames();
    const splatSprite = renderSplatSprite();
    const gunSprite = renderGunSprite();
    const flashSprite = renderFlashSprite();
    const motes = Array.from({ length: 14 }, (_, i) => ({
      x: Math.random() * W, y: Math.random() * H * 0.75,
      vx: 0.05 + Math.random() * 0.1, ph: i * 1.7,
    }));
    const start = performance.now(); let raf, lastProg = 0;

    const onMove = (e) => { const r = canvas.getBoundingClientRect(); mouse.current.x = (e.clientX - r.left) * (W / r.width); mouse.current.y = (e.clientY - r.top) * (H / r.height); };
    const onShoot = () => {
      if (endedRef.current) return;
      mouse.current.flash = 12; recoil.current = 1;
      sfx.shot();
      const { x, y } = mouse.current;
      let best = -1, bestD = Infinity;
      roaches.current.forEach((rch, i) => { const d = Math.hypot(rch.x - x, rch.y - y); if (d < rch.size + 6 && d < bestD) { bestD = d; best = i; } });
      if (best >= 0) {
        sfx.splat();
        const rx = roaches.current[best].x, ry = roaches.current[best].y, rsz = roaches.current[best].size;
        splats.current.push({ x: rx, y: ry, t: 1, rot: Math.random() * 6.28, sc: 0.8 + Math.random() * 0.5 });
        // burst of chitin shards + green goo droplets
        for (let i = 0; i < 12; i++) {
          const a = Math.random() * 6.28, sp = 1.5 + Math.random() * 4;
          gibs.current.push({
            x: rx, y: ry, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
            t: 1, sz: 1.4 + Math.random() * 2.6, rot: Math.random() * 6.28,
            vr: (Math.random() * 2 - 1) * 0.45, goo: Math.random() < 0.5,
          });
        }
        pops.current.push({ x: rx, y: ry - rsz - 6, t: 1, val: level });
        shake.current = 1;            // punchy hit feedback
        roaches.current[best] = spawnRoach(roachSpeed); killsRef.current++; setKills(killsRef.current);
      }
    };
    canvas.addEventListener('mousemove', onMove); canvas.addEventListener('mousedown', onShoot);

    // live torch flame + glow (bracket is baked into the bg)
    const drawFlame = (tx, ty, t) => {
      const fl = 0.7 + Math.sin(t / 90 + tx) * 0.3 + Math.random() * 0.06;
      const glow = ctx.createRadialGradient(tx, ty, 4, tx, ty, 90);
      glow.addColorStop(0, `rgba(255,170,60,${0.5 * fl})`); glow.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = glow; ctx.fillRect(tx - 90, ty - 90, 180, 180);
      ctx.beginPath();
      ctx.moveTo(tx, ty - 18 * fl); ctx.quadraticCurveTo(tx + 8, ty - 4, tx + 4, ty + 4);
      ctx.quadraticCurveTo(tx, ty + 8, tx - 4, ty + 4); ctx.quadraticCurveTo(tx - 8, ty - 4, tx, ty - 18 * fl);
      const fg = ctx.createLinearGradient(tx, ty - 18, tx, ty + 6); fg.addColorStop(0, '#ffe08a'); fg.addColorStop(0.5, '#ff9a30'); fg.addColorStop(1, '#c2410c');
      ctx.fillStyle = fg; ctx.fill();
      // hot core
      ctx.fillStyle = `rgba(255,240,190,${0.55 * fl})`;
      ctx.beginPath(); ctx.ellipse(tx, ty - 4, 2.4, 5 * fl, 0, 0, 7); ctx.fill();
    };

    // Ambient bat: dark silhouette with flapping membrane wings, drifting across.
    const drawBat = (b) => {
      const fl = Math.sin(b.ph) * 0.7;          // -0.7..0.7 wing-beat
      ctx.save();
      ctx.translate(b.x, b.y + Math.sin(b.ph * 0.5) * 4);
      ctx.scale(b.dir, 1);
      ctx.fillStyle = 'rgba(8,6,10,0.9)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 4, 5, 0, 0, 7);          // body
      ctx.fill();
      // ears
      ctx.beginPath(); ctx.moveTo(-2, -4); ctx.lineTo(-3, -8); ctx.lineTo(-0.5, -5);
      ctx.moveTo(2, -4); ctx.lineTo(3, -8); ctx.lineTo(0.5, -5); ctx.fill();
      // wings (membrane scallops), folding with the beat
      const wy = fl * 6;
      ctx.beginPath();
      ctx.moveTo(0, -1);
      ctx.quadraticCurveTo(-10, -6 + wy, -20, 2 + wy * 1.6);
      ctx.quadraticCurveTo(-14, 3 + wy, -12, 7 + wy);
      ctx.quadraticCurveTo(-9, 4 + wy, -6, 7 + wy);
      ctx.quadraticCurveTo(-4, 4 + wy, 0, 4);
      ctx.lineTo(0, -1); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -1);
      ctx.quadraticCurveTo(10, -6 + wy, 20, 2 + wy * 1.6);
      ctx.quadraticCurveTo(14, 3 + wy, 12, 7 + wy);
      ctx.quadraticCurveTo(9, 4 + wy, 6, 7 + wy);
      ctx.quadraticCurveTo(4, 4 + wy, 0, 4);
      ctx.lineTo(0, -1); ctx.fill();
      ctx.restore();
    };

    const drawReticle = (m) => {
      ctx.save();
      if (m.flash > 0) { ctx.fillStyle = `rgba(255,220,120,${m.flash / 12 * 0.4})`; ctx.beginPath(); ctx.arc(m.x, m.y, 30, 0, 7); ctx.fill(); }
      ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 1.6; ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(m.x, m.y, 13, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(m.x, m.y, 2, 0, 7); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(m.x - 22, m.y); ctx.lineTo(m.x - 8, m.y); ctx.moveTo(m.x + 8, m.y); ctx.lineTo(m.x + 22, m.y);
      ctx.moveTo(m.x, m.y - 22); ctx.lineTo(m.x, m.y - 8); ctx.moveTo(m.x, m.y + 8); ctx.lineTo(m.x, m.y + 22);
      ctx.stroke(); ctx.restore();
    };

    // Upright FPS revolver: sways toward the crosshair, bobs at idle,
    // climbs on recoil, muzzle flash at the barrel tip.
    const drawGun = (m, t) => {
      const sway = (m.x - W / 2) * 0.12;
      const bob = Math.sin(t / 480) * 2.5;
      const px = W / 2 + sway;
      const py = H - 148 + bob - recoil.current * 24;
      const tilt = (m.x - W / 2) * 0.0005 - recoil.current * 0.05;
      ctx.save();
      ctx.translate(px, py + 170);
      ctx.rotate(tilt);
      ctx.drawImage(gunSprite, -GUN_W / 2, -170);
      if (m.flash > 0) {
        const f = m.flash / 12;
        const fy = -168; // muzzle tip in sprite-local coords
        const jx = (m.flash % 2) * 4 - 2; // 1-px grid jitter so it crackles
        ctx.globalAlpha = Math.min(1, f * 1.6);
        ctx.drawImage(flashSprite, -FLASH_S / 2 + jx, fy - FLASH_S * 0.62);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    };

    const loop = (now) => {
      const left = Math.max(0, ROUND_MS - (now - start)); setTimeLeft(Math.ceil(left / 1000));
      recoil.current *= 0.82;
      const t = now;

      ctx.drawImage(bg, 0, 0);

      // screen-shake: the crypt world jolts on each hit; reticle/gun stay steady
      const shk = shake.current; shake.current *= 0.85;
      const sx = shk > 0.02 ? (Math.random() * 2 - 1) * 5 * shk : 0;
      const sy = shk > 0.02 ? (Math.random() * 2 - 1) * 5 * shk : 0;
      ctx.save(); ctx.translate(sx, sy);

      // splats (under the roaches)
      splats.current = splats.current.filter((s) => s.t > 0);
      splats.current.forEach((s) => {
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot);
        const sc2 = s.sc * (1.35 - s.t * 0.35);
        ctx.scale(sc2, sc2); ctx.globalAlpha = Math.min(1, s.t * 1.4);
        ctx.drawImage(splatSprite, -36, -36);
        ctx.restore();
        s.t -= 0.012;
      });

      // roaches: sprite frames alternated for a scuttling gait
      if (left > 0) roaches.current.forEach((r) => {
        r.phase += 0.4; if (Math.random() < 0.03) { r.vx += (Math.random() * 2 - 1); r.vy += (Math.random() * 2 - 1); }
        const sp = Math.hypot(r.vx, r.vy) || 1, max = 3.2 + (level - 1) * 0.5; if (sp > max) { r.vx = r.vx / sp * max; r.vy = r.vy / sp * max; }
        r.x += r.vx; r.y += r.vy;
        if (r.x < -30) r.x = W + 30; if (r.x > W + 30) r.x = -30; if (r.y < -30) r.y = H + 30; if (r.y > H + 30) r.y = -30;
        const frame = roachFrames[Math.floor(r.phase / 1.2) % 2];
        ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(Math.atan2(r.vy, r.vx));
        const sc = r.size / ROACH_S; ctx.scale(sc, sc);
        ctx.drawImage(frame, -ROACH_D / 2, -ROACH_D / 2);
        ctx.restore();
      });

      // flying gibs: chitin shards + green goo, with gravity and spin
      gibs.current = gibs.current.filter((g) => g.t > 0);
      gibs.current.forEach((g) => {
        g.x += g.vx; g.y += g.vy; g.vy += 0.22; g.vx *= 0.99; g.rot += g.vr; g.t -= 0.02;
        ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.rot);
        ctx.globalAlpha = Math.min(1, g.t * 1.6);
        ctx.fillStyle = g.goo ? '#7a742c' : '#5d3a1e';
        ctx.fillRect(-g.sz, -g.sz * 0.6, g.sz * 2, g.sz * 1.2);
        ctx.restore();
      });
      ctx.globalAlpha = 1;

      // floating "+N" score popups
      pops.current = pops.current.filter((p) => p.t > 0);
      pops.current.forEach((p) => {
        p.y -= 0.8; p.t -= 0.018;
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.t * 1.5);
        ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
        ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
        ctx.fillStyle = '#fbbf24';
        ctx.fillText(`+${p.val}`, p.x, p.y);
        ctx.restore();
      });
      ctx.globalAlpha = 1;

      // ambient bats: occasionally one flaps across the upper crypt
      if (bats.current.length < 2 && Math.random() < 0.004) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        bats.current.push({ x: dir > 0 ? -30 : W + 30, y: 24 + Math.random() * 120, dir, sp: 1.4 + Math.random() * 1.6, ph: Math.random() * 6.28 });
      }
      bats.current = bats.current.filter((b) => b.x > -50 && b.x < W + 50);
      bats.current.forEach((b) => { b.x += b.dir * b.sp; b.ph += 0.32; drawBat(b); });

      // drifting low fog along the floor
      const fo = (t / 35) % W;
      ctx.save(); ctx.globalAlpha = 0.5;
      ctx.fillStyle = 'rgba(150,160,150,0.045)';
      for (let i = 0; i < 5; i++) {
        const fx = ((i * 140 + fo) % (W + 160)) - 80;
        ctx.beginPath(); ctx.ellipse(fx, H - 26 - (i % 2) * 14, 90, 17, 0, 0, 7); ctx.fill();
      }
      ctx.restore();

      // floating dust motes / embers near the torches
      motes.forEach((mt) => {
        mt.x += mt.vx; if (mt.x > W) mt.x = -2;
        const a = 0.05 + 0.06 * (1 + Math.sin(t / 300 + mt.ph)) * 0.5;
        ctx.fillStyle = `rgba(255,215,150,${a})`;
        ctx.fillRect(mt.x, mt.y + Math.sin(t / 900 + mt.ph) * 6, 1.6, 1.6);
      });

      drawFlame(W * 0.1, VPY - 10, t);
      drawFlame(W * 0.9, VPY - 10, t);

      ctx.restore(); // end screen-shake transform (reticle/gun stay anchored)

      const m = mouse.current;
      drawReticle(m);
      drawGun(m, t);
      if (m.flash > 0) m.flash -= 1;

      if (onProgress && now - lastProg > 800) { lastProg = now; onProgress(killsRef.current * level); }
      if (left <= 0 && !endedRef.current) { endedRef.current = true; setOver(true); setTimeout(() => onGameOver && onGameOver(killsRef.current * level, killsRef.current > 0), 500); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); canvas.removeEventListener('mousemove', onMove); canvas.removeEventListener('mousedown', onShoot); };
  }, [onGameOver, level, roachCount, roachSpeed]);

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <div className="flex items-center gap-6 pixel text-xs">
        <span className="text-arcade-cyan">{kills} 🪳</span>
        <span className="text-arcade-amber">⏱ {timeLeft}s</span>
      </div>
      <div className="relative">
        <canvas ref={canvasRef} width={W} height={H} className="rounded-xl border border-amber-900/40 max-w-full" style={{ cursor: over ? 'default' : 'none', boxShadow: '0 0 30px rgba(120,60,20,0.35)' }} />
        {over && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 rounded-xl"><div className="text-3xl">🪳</div><div className="pixel text-[10px] text-arcade-green">¡{kills} CUCARACHAS APLASTADAS!</div></div>}
      </div>
      <div className="text-xs text-slate-500">Apunta y <span className="text-arcade-cyan">click</span> — extermina las kukas de la cripta. ¡Más kukas en 60s gana!</div>
    </div>
  );
}
