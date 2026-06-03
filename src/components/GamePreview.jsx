import React, { useEffect, useRef } from 'react';

// Tiny looping canvas animations that act as a live "preview" of each game,
// so players understand what they're picking in the create-room modal.
// No video/gif assets — everything is drawn on a small canvas in real time.
const H = 130;

const CYAN = '#22d3ee', AMBER = '#f59e0b', PURPLE = '#a855f7', GREEN = '#34d399', PINK = '#ec4899';

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
    ctx.fillStyle = CYAN; ctx.fillRect(16, ly - ph / 2, 6, ph);
    ctx.fillStyle = AMBER; ctx.fillRect(w - 22, ry - ph / 2, 6, ph);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, 5, 0, 7); ctx.fill();
  },

  snake(ctx, w, t) {
    const cell = 14, cols = Math.floor((w - 20) / cell), rows = Math.floor((H - 16) / cell);
    const ox = (w - cols * cell) / 2, oy = (H - rows * cell) / 2;
    const head = Math.floor(t / 140);
    const len = 6;
    const path = (i) => { const p = (head - i); const r = Math.floor(p / cols) % rows; const c = ((p % cols) + cols) % cols; return [(c + rows) % cols, (Math.floor(p / cols) % rows + rows) % rows]; };
    for (let i = 0; i < len; i++) {
      const [c, r] = path(i);
      ctx.fillStyle = i === 0 ? '#e0fbff' : GREEN;
      ctx.fillRect(ox + c * cell + 1, oy + r * cell + 1, cell - 2, cell - 2);
    }
    ctx.fillStyle = PINK;
    const fx = (head * 7) % cols, fy = (head * 3) % rows;
    ctx.fillRect(ox + fx * cell + 3, oy + fy * cell + 3, cell - 6, cell - 6);
  },

  tron(ctx, w, t) {
    const cycle = 2600, p = (t % cycle) / cycle;
    const steps = Math.floor(p * 60);
    ctx.lineWidth = 3;
    ctx.strokeStyle = CYAN; ctx.beginPath(); ctx.moveTo(20, H - 20);
    for (let i = 0; i <= steps; i++) { const x = 20 + i * ((w - 40) / 60); const y = H - 20 - (Math.floor(i / 8) % 2 === 0 ? (i % 8) * 6 : 0); ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.strokeStyle = AMBER; ctx.beginPath(); ctx.moveTo(w - 20, 20);
    for (let i = 0; i <= steps; i++) { const x = w - 20 - i * ((w - 40) / 60); const y = 20 + (Math.floor(i / 8) % 2 === 0 ? (i % 8) * 6 : 0); ctx.lineTo(x, y); }
    ctx.stroke();
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

  kuka(ctx, w, t) {
    const g = ctx.createRadialGradient(w / 2, H / 2, 20, w / 2, H / 2, w * 0.6);
    g.addColorStop(0, '#14110d'); g.addColorStop(1, '#070605');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, H);
    // roach scuttling on a path
    const rx = w / 2 + Math.cos(t / 500) * (w / 3);
    const ry = H / 2 + Math.sin(t / 320) * (H / 3);
    const ang = Math.atan2(Math.cos(t / 320) * (H / 3) / 320, -Math.sin(t / 500) * (w / 3) / 500);
    ctx.save(); ctx.translate(rx, ry); ctx.rotate(ang);
    ctx.strokeStyle = '#2b1b12'; ctx.lineWidth = 1.4;
    for (let s = -1; s <= 1; s += 2) for (let l = -1; l <= 1; l++) { ctx.beginPath(); ctx.moveTo(l * 4, s * 2); ctx.lineTo(l * 4 + s * 6, s * 9); ctx.stroke(); }
    ctx.fillStyle = '#6b4226'; ctx.beginPath(); ctx.ellipse(0, 0, 13, 8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#2b1b12'; ctx.beginPath(); ctx.ellipse(8, 0, 4, 5, 0, 0, 7); ctx.fill();
    ctx.restore();
    // crosshair lagging behind
    const cxp = w / 2 + Math.cos((t - 220) / 500) * (w / 3);
    const cyp = H / 2 + Math.sin((t - 220) / 320) * (H / 3);
    const flash = (t % 1400) < 90;
    if (flash) { ctx.fillStyle = 'rgba(255,220,120,0.4)'; ctx.beginPath(); ctx.arc(cxp, cyp, 18, 0, 7); ctx.fill(); }
    ctx.strokeStyle = CYAN; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cxp, cyp, 11, 0, 7); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cxp - 16, cyp); ctx.lineTo(cxp - 5, cyp); ctx.moveTo(cxp + 5, cyp); ctx.lineTo(cxp + 16, cyp);
    ctx.moveTo(cxp, cyp - 16); ctx.lineTo(cxp, cyp - 5); ctx.moveTo(cxp, cyp + 5); ctx.lineTo(cxp, cyp + 16);
    ctx.stroke();
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
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas.parentElement);
    const fn = DRAW[game] || (() => {});
    const t0 = performance.now();
    let raf;
    const loop = (now) => {
      ctx.fillStyle = '#0a0e1a'; ctx.fillRect(0, 0, w, H);
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
