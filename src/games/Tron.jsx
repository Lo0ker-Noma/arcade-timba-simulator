import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';

// Local hotseat light-cycles (Tron). Player 1: WASD, Player 2: Arrows.
// Crash into a wall or any trail and you lose the round. Also powers the
// "Snake Duel" mode (same mechanic, slower + thicker trail).
const CELL = 12;
const COLS = 48;
const ROWS = 30;

export default function Tron({ me, pair, names, variant = 'tron' }) {
  const reportResult = useGameStore((s) => s.reportResult);
  const canvasRef = useRef(null);
  const reportedRef = useRef(false);
  const [winner, setWinner] = useState(null);
  const dirRef = useRef({ p1: [1, 0], p2: [-1, 0] });

  const speed = variant === 'snake' ? 90 : 55; // ms per tick

  useEffect(() => {
    const map = {
      w: ['p1', [0, -1]], s: ['p1', [0, 1]], a: ['p1', [-1, 0]], d: ['p1', [1, 0]],
      W: ['p1', [0, -1]], S: ['p1', [0, 1]], A: ['p1', [-1, 0]], D: ['p1', [1, 0]],
      ArrowUp: ['p2', [0, -1]], ArrowDown: ['p2', [0, 1]], ArrowLeft: ['p2', [-1, 0]], ArrowRight: ['p2', [1, 0]],
    };
    const onKey = (e) => {
      const m = map[e.key];
      if (!m) return;
      e.preventDefault();
      const [who, nd] = m;
      const cur = dirRef.current[who];
      if (cur[0] + nd[0] === 0 && cur[1] + nd[1] === 0) return; // no 180°
      dirRef.current[who] = nd;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    let p1 = [8, ROWS >> 1], p2 = [COLS - 9, ROWS >> 1];
    grid[p1[1]][p1[0]] = 1; grid[p2[1]][p2[0]] = 2;
    let alive = true;

    const draw = () => {
      ctx.fillStyle = '#0a0e1a'; ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        if (grid[y][x] === 1) { ctx.fillStyle = '#22d3ee'; ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1); }
        else if (grid[y][x] === 2) { ctx.fillStyle = '#f59e0b'; ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1); }
      }
      ctx.fillStyle = '#e0fbff'; ctx.fillRect(p1[0] * CELL, p1[1] * CELL, CELL - 1, CELL - 1);
      ctx.fillStyle = '#fff7e0'; ctx.fillRect(p2[0] * CELL, p2[1] * CELL, CELL - 1, CELL - 1);
    };

    const hit = (pos) => pos[0] < 0 || pos[0] >= COLS || pos[1] < 0 || pos[1] >= ROWS || grid[pos[1]][pos[0]] !== 0;

    const finish = (winIdx) => {
      alive = false;
      const wp = pair[winIdx];
      setWinner(wp);
      if (!reportedRef.current) { reportedRef.current = true; reportResult(wp); }
    };

    const interval = setInterval(() => {
      if (!alive) return;
      const n1 = [p1[0] + dirRef.current.p1[0], p1[1] + dirRef.current.p1[1]];
      const n2 = [p2[0] + dirRef.current.p2[0], p2[1] + dirRef.current.p2[1]];
      const d1 = hit(n1), d2 = hit(n2) || (n1[0] === n2[0] && n1[1] === n2[1]);
      if (d1 && d2) { finish(0); }       // draw -> arbitrarily p1; rare
      else if (d1) { finish(1); }
      else if (d2) { finish(0); }
      else {
        p1 = n1; p2 = n2;
        grid[p1[1]][p1[0]] = 1; grid[p2[1]][p2[0]] = 2;
      }
      draw();
    }, speed);
    draw();
    return () => clearInterval(interval);
  }, [pair, reportResult, speed]);

  const meIdx = pair.indexOf(me);

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        width={COLS * CELL}
        height={ROWS * CELL}
        className="rounded-xl border border-arcade-purple/30 shadow-neon-purple max-w-full"
      />
      {winner ? (
        <div className="text-arcade-green text-sm">¡Ronda para {names[winner]}! Reportada al bote.</div>
      ) : (
        <div className="text-xs text-slate-500">
          <span className="text-arcade-cyan">WASD</span> vs <span className="text-arcade-amber">flechas</span> — no choques con los rastros
        </div>
      )}
      {meIdx === -1 && <div className="text-xs text-amber-400">Modo local: jugáis en el mismo dispositivo.</div>}
    </div>
  );
}
