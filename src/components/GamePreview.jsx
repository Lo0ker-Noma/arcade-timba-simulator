import React, { useEffect, useRef } from 'react';
import { kukaArt } from '../games/Kuka';

// Tiny looping canvas animations that act as a live "preview" of each game,
// so players understand what they're picking in the create-room modal.
// No video/gif assets — everything is drawn on a small canvas in real time.
const H = 130;

const CYAN = '#22d3ee', AMBER = '#f59e0b', PURPLE = '#a855f7', GREEN = '#34d399', PINK = '#ec4899';

// Games whose preview clears with a translucent fill, leaving ghost trails
// behind moving elements (same trick as the real Pong / Snake Duel).
const TRAIL = { pong: 0.25, snake: 0.16 };

const DRAW = {
  connect4(ctx, w, t) {
    const cols = 7, rows = 6, cell = Math.min((w - 20) / cols, (H - 16) / rows);
    const bw = cols * cell, bh = rows * cell;
    const ox = (w - bw) / 2, oy = (H - bh) / 2;
    ctx.fillStyle = 'rgba(168,85,247,0.12)';
    ctx.fillRect(ox - 4, oy - 4, bw + 8, bh + 8);
    const settled = { '5,2': CYAN, '5,3': AMBER, '4,3': CYAN, '5,4': AMBER, '5,1': AMBER };
    const col = Math.floor(t / 900) % cols;
    const prog = Math.min(1, (t % 900) / 700);
    const landRow = 4;
    const fallY = oy + (landRow * cell) * prog;
    const dropColor = (Math.floor(t / 900) % 2) ? CYAN : AMBER;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const cx = ox + c * cell + cell / 2, cy = oy + r * cell + cell / 2;
      const key = `${r},${c}`;
      ctx.beginPath(); ctx.arc(cx, cy, cell * 0.36, 0, 7);
      ctx.fillStyle = settled[key] || 'rgba(10,14,26,0.9)';
      ctx.fill();
    }
    ctx.beginPath(); ctx.arc(ox + col * cell + cell / 2, fallY + cell / 2, cell * 0.36, 0, 7);
    ctx.fillStyle = dropColor; ctx.shadowColor = dropColor; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
  },

  tictactoe(ctx, w, t) {
    const s = Math.min(w - 30, H - 20), ox = (w - s) / 2, oy = (H - s) / 2, c = s / 3;
    ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.lineWidth = 2;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(ox + i * c, oy); ctx.lineTo(ox + i * c, oy + s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ox, oy + i * c); ctx.lineTo(ox + s, oy + i * c); ctx.stroke();
    }
    const seq = [[0, CYAN], [4, PINK], [1, CYAN], [3, PINK], [2, CYAN]]; // X wins top row
    const step = Math.floor(t / 600) % (seq.length + 2);
    for (let k = 0; k < Math.min(step, seq.length); k++) {
      const [cell, col] = seq[k];
      const cx = ox + (cell % 3) * c + c / 2, cy = oy + Math.floor(cell / 3) * c + c / 2;
      ctx.lineWidth = 3; ctx.strokeStyle = col;
      if (col === CYAN) {
        ctx.beginPath(); ctx.moveTo(cx - c * 0.25, cy - c * 0.25); ctx.lineTo(cx + c * 0.25, cy + c * 0.25);
        ctx.moveTo(cx + c * 0.25, cy - c * 0.25); ctx.lineTo(cx - c * 0.25, cy + c * 0.25); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(cx, cy, c * 0.28, 0, 7); ctx.stroke();
      }
    }
  },

  pong(ctx, w, t) {
    ctx.strokeStyle = 'rgba(34,211,238,0.15)'; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(w / 2, 8); ctx.lineTo(w / 2, H - 8); ctx.stroke(); ctx.setLineDash([]);
    const by = H / 2 + Math.sin(t / 300) * (H / 2 - 24);
    const bx = w / 2 + Math.cos(t / 300) * (w / 2 - 40);
    const ph = 34;
    const ly = Math.max(ph / 2, Math.min(H - ph / 2, by));
    const ry = Math.max(ph / 2, Math.min(H - ph / 2, H - by + 20));
    ctx.save();
    ctx.shadowBlur = 10; ctx.shadowColor = CYAN;
    ctx.fillStyle = CYAN; ctx.fillRect(16, ly - ph / 2, 6, ph);
    ctx.shadowColor = AMBER;
    ctx.fillStyle = AMBER; ctx.fillRect(w - 22, ry - ph / 2, 6, ph);
    ctx.shadowColor = '#fff';
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, 5, 0, 7); ctx.fill();
    ctx.restore();
  },

  // Two grid-snapped light-snakes dueling — matches the real Snake Duel
  // (you vs the machine); the fading trails come from the translucent clear.
  snake(ctx, w, t) {
    const cell = 12;
    const snap = (v) => Math.round(v / cell) * cell + cell / 2;
    const px = snap(w / 2 + Math.cos(t / 740) * (w / 2 - 26));
    const py = snap(H / 2 + Math.sin(t / 470) * (H / 2 - 22));
    const ax = snap(w / 2 - Math.cos(t / 740) * (w / 2 - 26));
    const ay = snap(H / 2 - Math.sin(t / 470) * (H / 2 - 22));
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = CYAN; ctx.fillStyle = CYAN;
    ctx.fillRect(px - cell / 2 + 1, py - cell / 2 + 1, cell - 2, cell - 2);
    ctx.shadowColor = AMBER; ctx.fillStyle = AMBER;
    ctx.fillRect(ax - cell / 2 + 1, ay - cell / 2 + 1, cell - 2, cell - 2);
    ctx.restore();
  },

  tron(ctx, w, t) {
    const cycle = 2600, p = (t % cycle) / cycle;
    const steps = Math.floor(p * 60);
    ctx.save();
    ctx.lineWidth = 3;
    ctx.shadowBlur = 8; ctx.shadowColor = CYAN;
    let hx = 20, hy = H - 20;
    ctx.strokeStyle = CYAN; ctx.beginPath(); ctx.moveTo(20, H - 20);
    for (let i = 0; i <= steps; i++) { hx = 20 + i * ((w - 40) / 60); hy = H - 20 - (Math.floor(i / 8) % 2 === 0 ? (i % 8) * 6 : 0); ctx.lineTo(hx, hy); }
    ctx.stroke();
    ctx.fillStyle = '#e0fbff'; ctx.fillRect(hx - 3, hy - 3, 6, 6);
    ctx.shadowColor = AMBER;
    hx = w - 20; hy = 20;
    ctx.strokeStyle = AMBER; ctx.beginPath(); ctx.moveTo(w - 20, 20);
    for (let i = 0; i <= steps; i++) { hx = w - 20 - i * ((w - 40) / 60); hy = 20 + (Math.floor(i / 8) % 2 === 0 ? (i % 8) * 6 : 0); ctx.lineTo(hx, hy); }
    ctx.stroke();
    ctx.fillStyle = '#fff7e0'; ctx.fillRect(hx - 3, hy - 3, 6, 6);
    ctx.restore();
  },

  tetris(ctx, w, t) {
    const cell = 13, cols = 8, rows = Math.floor((H - 10) / cell);
    const bw = cols * cell, ox = (w - bw) / 2, oy = H - rows * cell;
    ctx.strokeStyle = 'rgba(168,85,247,0.25)'; ctx.strokeRect(ox, oy, bw, rows * cell);
    // settled bottom
    const stack = [[0, GREEN], [1, GREEN], [2, AMBER], [6, CYAN], [7, CYAN]];
    stack.forEach(([c, col]) => { ctx.fillStyle = col; ctx.fillRect(ox + c * cell + 1, oy + (rows - 1) * cell + 1, cell - 2, cell - 2); });
    // falling T piece
    const fall = Math.floor((t % 1600) / 1600 * (rows - 2));
    const col = PURPLE; ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 6;
    [[3, 0], [4, 0], [5, 0], [4, 1]].forEach(([c, r]) => ctx.fillRect(ox + c * cell + 1, oy + (fall + r) * cell + 1, cell - 2, cell - 2));
    ctx.shadowBlur = 0;
  },

  // Miniature of the real game: actual crypt background, roach sprites,
  // pixel pistol and starburst flash, all borrowed from Kuka's art cache.
  kuka(ctx, w, t) {
    const A = kukaArt();
    // crypt band cropped to the thumbnail aspect (keeps torches + skulls)
    const sh = Math.min(380, H * 600 / w);
    ctx.drawImage(A.bg, 0, (380 - sh) * 0.42, 600, sh, 0, 0, w, H);
    // roaches scuttling on looping paths
    for (let i = 0; i < 3; i++) {
      const ph = i * 2.3, spx = 500 + i * 90, spy = 320 + i * 70;
      const rx = w / 2 + Math.cos(t / spx + ph) * (w / 3);
      const ry = H * 0.5 + Math.sin(t / spy + ph) * (H / 3.4);
      const ang = Math.atan2(Math.cos(t / spy + ph) / spy, -Math.sin(t / spx + ph) / spx);
      const fr = A.roaches[(Math.floor(t / 100) + i) % 2];
      ctx.save(); ctx.translate(rx, ry); ctx.rotate(ang); ctx.scale(0.55, 0.55);
      ctx.drawImage(fr, -32, -32);
      ctx.restore();
    }
    // crosshair lagging behind the first roach
    const cxp = w / 2 + Math.cos((t - 260) / 500) * (w / 3);
    const cyp = H * 0.5 + Math.sin((t - 260) / 320) * (H / 3.4);
    const fire = (t % 1400) < 110;
    if (fire) { ctx.fillStyle = 'rgba(255,220,120,0.4)'; ctx.beginPath(); ctx.arc(cxp, cyp, 16, 0, 7); ctx.fill(); }
    ctx.strokeStyle = CYAN; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cxp, cyp, 10, 0, 7); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cxp - 15, cyp); ctx.lineTo(cxp - 5, cyp); ctx.moveTo(cxp + 5, cyp); ctx.lineTo(cxp + 15, cyp);
    ctx.moveTo(cxp, cyp - 15); ctx.lineTo(cxp, cyp - 5); ctx.moveTo(cxp, cyp + 5); ctx.lineTo(cxp, cyp + 15);
    ctx.stroke();
    // pixel pistol at the bottom, swaying toward the aim, firing periodically
    const gw = 150 * 0.5, gh = 230 * 0.5;
    const gx = w / 2 + (cxp - w / 2) * 0.15 - gw / 2;
    const gy = H - gh * 0.55 + (fire ? 3 : 0);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(A.gun, gx, gy, gw, gh);
    if (fire) { ctx.drawImage(A.flash, gx + gw / 2 - 32, gy - 42, 65, 65); }
    ctx.restore();
  },
};

export default function GamePreview({ game }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    let w = 0;
    const resize = () => {
      w = canvas.parentElement.clientWidth;
      canvas.width = w * dpr; canvas.height = H * dpr;
      canvas.style.width = w + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#0a0e1a'; ctx.fillRect(0, 0, w, H); // opaque base for trail clears
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas.parentElement);
    const fn = DRAW[game] || (() => {});
    const clearA = TRAIL[game] || 1;
    const t0 = performance.now();
    let raf;
    const loop = (now) => {
      ctx.fillStyle = clearA === 1 ? '#0a0e1a' : `rgba(10,14,26,${clearA})`;
      ctx.fillRect(0, 0, w, H);
      if (game !== 'kuka') {
        // Subtle arcade grid, scaled by the clear alpha so trail games
        // converge to the same faint brightness as opaque ones.
        ctx.strokeStyle = `rgba(34,211,238,${0.035 * clearA})`; ctx.beginPath();
        for (let gx = 24; gx < w; gx += 24) { ctx.moveTo(gx, 0); ctx.lineTo(gx, H); }
        for (let gy = 24; gy < H; gy += 24) { ctx.moveTo(0, gy); ctx.lineTo(w, gy); }
        ctx.stroke();
      }
      fn(ctx, w, now - t0);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [game]);

  return (
    <div className="w-full rounded-lg overflow-hidden border border-slate-700/50" style={{ background: '#0a0e1a' }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
