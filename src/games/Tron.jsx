import React, { useEffect, useRef, useState } from 'react';

// You (cyan) vs the machine (amber). Survive longer than the AI. Score =
// seconds survived ×100, +5000 bonus if you outlast the machine.
const CELL = 12, COLS = 48, ROWS = 30;

export default function Tron({ onGameOver, variant = 'tron' }) {
  const canvasRef = useRef(null);
  const endedRef = useRef(false);
  const [result, setResult] = useState(null); // 'win' | 'lose'
  const dirRef = useRef([1, 0]);
  const speed = variant === 'snake' ? 90 : 55;

  useEffect(() => {
    const map = { w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const onKey = (e) => { const nd = map[e.key]; if (!nd) return; e.preventDefault(); const cur = dirRef.current; if (cur[0] + nd[0] === 0 && cur[1] + nd[1] === 0) return; dirRef.current = nd; };
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
      ctx.fillStyle = '#0a0e1a'; ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        if (grid[y][x] === 1) { ctx.fillStyle = '#22d3ee'; ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1); }
        else if (grid[y][x] === 2) { ctx.fillStyle = '#f59e0b'; ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1); }
      }
      ctx.fillStyle = '#e0fbff'; ctx.fillRect(me[0] * CELL, me[1] * CELL, CELL - 1, CELL - 1);
      ctx.fillStyle = '#fff7e0'; ctx.fillRect(ai[0] * CELL, ai[1] * CELL, CELL - 1, CELL - 1);
    };

    const end = (won) => {
      if (endedRef.current) return; endedRef.current = true; alive = false;
      const secs = (performance.now() - start) / 1000;
      const score = Math.round(secs * 100) + (won ? 5000 : 0);
      setResult(won ? 'win' : 'lose');
      setTimeout(() => onGameOver && onGameOver(score), 500);
    };

    const interval = setInterval(() => {
      if (!alive) return;
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
        <div className={result === 'win' ? 'text-arcade-green text-sm' : 'text-amber-400 text-sm'}>{result === 'win' ? '¡Venciste a la máquina!' : 'Chocaste — fin de tu intento'}</div>
      ) : (
        <div className="text-xs text-slate-500">Tu moto con <span className="text-arcade-cyan">WASD o flechas</span> — aguanta más que la máquina</div>
      )}
    </div>
  );
}
