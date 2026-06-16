import React, { useEffect, useRef, useState } from 'react';
import { sfx } from '../lib/sound';

// You (cyan) vs the machine (amber). Survive longer than the AI. Score =
// seconds survived ×100, +5000 bonus if you outlast the machine.
const CELL = 12, COLS = 48, ROWS = 30;

export default function Tron({ onGameOver, onProgress, variant = 'tron', level = 1 }) {
  const canvasRef = useRef(null);
  const endedRef = useRef(false);
  const [result, setResult] = useState(null); // 'win' | 'lose'
  const dirRef = useRef([1, 0]);
  const speed = Math.max(28, (variant === 'snake' ? 90 : 55) - (level - 1) * 4);

  useEffect(() => {
    const map = { w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const onKey = (e) => { const nd = map[e.key]; if (!nd) return; e.preventDefault(); const cur = dirRef.current; if (cur[0] + nd[0] === 0 && cur[1] + nd[1] === 0) return; if (cur[0] !== nd[0] || cur[1] !== nd[1]) sfx.blip(); dirRef.current = nd; };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    let me = [8, ROWS >> 1], ai = [COLS - 9, ROWS >> 1];
    let aiDir = [-1, 0];
    grid[me[1]][me[0]] = 1; grid[ai[1]][ai[0]] = 2;
    const start = performance.now();
    let alive = true;

    const hit = (p) => p[0] < 0 || p[0] >= COLS || p[1] < 0 || p[1] >= ROWS || grid[p[1]][p[0]] !== 0;

    // AI picks a safe direction, preferring to keep going straight.
    const aiChoose = () => {
      const opts = [aiDir, [aiDir[1], -aiDir[0]], [-aiDir[1], aiDir[0]]]; // straight, turns
      const safe = opts.filter((d) => !hit([ai[0] + d[0], ai[1] + d[1]]));
      if (!safe.length) return aiDir;
      if (Math.random() < 0.18 && safe.length > 1) return safe[1 + ((Math.random() * (safe.length - 1)) | 0)];
      return safe[0];
    };

    const draw = () => {
      const PW = COLS * CELL, PH = ROWS * CELL;
      ctx.fillStyle = '#0a0e1a'; ctx.fillRect(0, 0, PW, PH);
      // Subtle arcade grid, same motif as the landing background.
      ctx.strokeStyle = 'rgba(34,211,238,0.05)'; ctx.beginPath();
      for (let gx = CELL * 3; gx < PW; gx += CELL * 3) { ctx.moveTo(gx, 0); ctx.lineTo(gx, PH); }
      for (let gy = CELL * 3; gy < PH; gy += CELL * 3) { ctx.moveTo(0, gy); ctx.lineTo(PW, gy); }
      ctx.stroke();
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        if (grid[y][x] === 1) { ctx.fillStyle = 'rgba(34,211,238,0.8)'; ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1); }
        else if (grid[y][x] === 2) { ctx.fillStyle = 'rgba(245,158,11,0.8)'; ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1); }
      }
      // Bloom pass: re-draw the frame blurred and additive so the light
      // trails glow like neon tubes (cheap one-call fake bloom).
      if (typeof ctx.filter === 'string') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.filter = 'blur(5px)';
        ctx.globalAlpha = 0.5;
        ctx.drawImage(ctx.canvas, 0, 0);
        ctx.restore();
      }
      // Neon-glowing heads so each bike pops against its own trail.
      ctx.save();
      ctx.shadowBlur = 14; ctx.shadowColor = '#22d3ee';
      ctx.fillStyle = '#e0fbff'; ctx.fillRect(me[0] * CELL, me[1] * CELL, CELL - 1, CELL - 1);
      ctx.shadowColor = '#f59e0b';
      ctx.fillStyle = '#fff7e0'; ctx.fillRect(ai[0] * CELL, ai[1] * CELL, CELL - 1, CELL - 1);
      ctx.restore();
    };

    const end = (won) => {
      if (endedRef.current) return; endedRef.current = true; alive = false;
      sfx.crash();
      const secs = (performance.now() - start) / 1000;
      const score = Math.round((secs * 100 + (won ? 3000 : 0)) * level);
      setResult(won ? 'win' : 'lose');
      setTimeout(() => onGameOver && onGameOver(score, won), 500);
    };

    let lastProg = 0;
    const interval = setInterval(() => {
      if (!alive) return;
      const nowt = performance.now();
      if (onProgress && nowt - lastProg > 800) { lastProg = nowt; onProgress(Math.round(((nowt - start) / 1000) * 100 * level)); }
      aiDir = aiChoose();
      const nMe = [me[0] + dirRef.current[0], me[1] + dirRef.current[1]];
      const nAi = [ai[0] + aiDir[0], ai[1] + aiDir[1]];
      const dMe = hit(nMe), dAi = hit(nAi) || (nMe[0] === nAi[0] && nMe[1] === nAi[1]);
      if (dMe) { draw(); end(false); return; }
      if (dAi) { me = nMe; grid[nMe[1]][nMe[0]] = 1; draw(); end(true); return; }
      me = nMe; ai = nAi; grid[nMe[1]][nMe[0]] = 1; grid[nAi[1]][nAi[0]] = 2; draw();
    }, speed);
    draw();
    return () => clearInterval(interval);
  }, [onGameOver, speed]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="pixel text-xs"><span className="text-arcade-cyan">TÚ</span> <span className="text-slate-600">vs</span> <span className="text-arcade-amber">MÁQUINA</span></div>
      <canvas ref={canvasRef} width={COLS * CELL} height={ROWS * CELL} className="rounded-xl border border-arcade-purple/30 shadow-neon-purple max-w-full" />
      {result ? (
        <div className={`pixel text-[10px] ${result === 'win' ? 'text-arcade-green' : 'text-amber-400'}`}>{result === 'win' ? '¡VENCISTE A LA MÁQUINA!' : 'CHOCASTE — FIN DE TU INTENTO'}</div>
      ) : (
        <div className="text-xs text-slate-500">Tu moto con <span className="text-arcade-cyan">WASD o flechas</span> — aguanta más que la máquina</div>
      )}
    </div>
  );
}
