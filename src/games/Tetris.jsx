import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';

// Local hotseat Tetris duel: two boards side by side on one canvas.
// Player 1 (cyan): A/D move · S soft-drop · W rotate · Space hard-drop.
// Player 2 (amber): ← → move · ↓ soft-drop · ↑ rotate · Enter hard-drop.
// The first player to top out loses the round; the other wins it.
const COLS = 10, ROWS = 20, CELL = 18;
const TICK = 650; // gravity ms

const SHAPES = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
};
const COLORS = { I: '#22d3ee', O: '#f59e0b', T: '#a855f7', S: '#34d399', Z: '#ec4899', J: '#60a5fa', L: '#fb923c' };
const KEYS = Object.keys(SHAPES);

function rotate(m) {
  const R = m.length, C = m[0].length;
  const out = Array.from({ length: C }, () => Array(R).fill(0));
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) out[c][R - 1 - r] = m[r][c];
  return out;
}

function newGame() {
  const pick = () => { const k = KEYS[(Math.random() * KEYS.length) | 0]; return { k, m: SHAPES[k].map((r) => [...r]), x: 3, y: 0 }; };
  return { grid: Array.from({ length: ROWS }, () => Array(COLS).fill(null)), piece: pick(), score: 0, dead: false, pick };
}

function collides(g, m, x, y) {
  for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) {
    if (!m[r][c]) continue;
    const nx = x + c, ny = y + r;
    if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
    if (ny >= 0 && g[ny][nx]) return true;
  }
  return false;
}

function merge(state) {
  const { grid, piece } = state;
  piece.m.forEach((row, r) => row.forEach((v, c) => {
    if (v && piece.y + r >= 0) grid[piece.y + r][piece.x + c] = COLORS[piece.k];
  }));
  // clear lines
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (grid[r].every((cell) => cell)) {
      grid.splice(r, 1); grid.unshift(Array(COLS).fill(null)); cleared++; r++;
    }
  }
  state.score += [0, 100, 300, 500, 800][cleared];
  const np = state.pick();
  if (collides(grid, np.m, np.x, np.y)) { state.dead = true; }
  state.piece = np;
}

export default function Tetris({ me, pair, names }) {
  const reportResult = useGameStore((s) => s.reportResult);
  const canvasRef = useRef(null);
  const reportedRef = useRef(false);
  const gamesRef = useRef([newGame(), newGame()]);
  const [winner, setWinner] = useState(null);

  const meIdx = pair.indexOf(me);

  useEffect(() => {
    const move = (i, dx) => { const s = gamesRef.current[i]; if (s.dead) return; if (!collides(s.grid, s.piece.m, s.piece.x + dx, s.piece.y)) s.piece.x += dx; };
    const soft = (i) => { const s = gamesRef.current[i]; if (s.dead) return; if (!collides(s.grid, s.piece.m, s.piece.x, s.piece.y + 1)) s.piece.y += 1; else merge(s); };
    const rot = (i) => { const s = gamesRef.current[i]; if (s.dead) return; const nm = rotate(s.piece.m); if (!collides(s.grid, nm, s.piece.x, s.piece.y)) s.piece.m = nm; };
    const hard = (i) => { const s = gamesRef.current[i]; if (s.dead) return; while (!collides(s.grid, s.piece.m, s.piece.x, s.piece.y + 1)) s.piece.y += 1; merge(s); };

    const map = {
      a: () => move(0, -1), A: () => move(0, -1), d: () => move(0, 1), D: () => move(0, 1),
      s: () => soft(0), S: () => soft(0), w: () => rot(0), W: () => rot(0), ' ': () => hard(0),
      ArrowLeft: () => move(1, -1), ArrowRight: () => move(1, 1), ArrowDown: () => soft(1),
      ArrowUp: () => rot(1), Enter: () => hard(1),
    };
    const onKey = (e) => { const f = map[e.key]; if (!f) return; e.preventDefault(); f(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    const BW = COLS * CELL, GAP = 40;
    const ox = [0, BW + GAP];

    const drawBoard = (s, x0, accent) => {
      ctx.fillStyle = '#0a0e1a'; ctx.fillRect(x0, 0, BW, ROWS * CELL);
      ctx.strokeStyle = accent + '40'; ctx.strokeRect(x0, 0, BW, ROWS * CELL);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (s.grid[r][c]) { ctx.fillStyle = s.grid[r][c]; ctx.fillRect(x0 + c * CELL, r * CELL, CELL - 1, CELL - 1); }
      }
      if (!s.dead) {
        ctx.fillStyle = COLORS[s.piece.k];
        s.piece.m.forEach((row, r) => row.forEach((v, c) => {
          if (v) ctx.fillRect(x0 + (s.piece.x + c) * CELL, (s.piece.y + r) * CELL, CELL - 1, CELL - 1);
        }));
      }
    };

    let last = performance.now();
    let raf;
    const loop = (t) => {
      if (t - last > TICK) {
        last = t;
        gamesRef.current.forEach((s) => {
          if (s.dead) return;
          if (!collides(s.grid, s.piece.m, s.piece.x, s.piece.y + 1)) s.piece.y += 1; else merge(s);
        });
      }
      drawBoard(gamesRef.current[0], ox[0], '#22d3ee');
      drawBoard(gamesRef.current[1], ox[1], '#f59e0b');

      const [g0, g1] = gamesRef.current;
      if ((g0.dead || g1.dead) && !reportedRef.current) {
        reportedRef.current = true;
        // loser = the dead one; if both, higher score wins
        let wIdx;
        if (g0.dead && g1.dead) wIdx = g0.score >= g1.score ? 0 : 1;
        else wIdx = g0.dead ? 1 : 0;
        setWinner(pair[wIdx]);
        reportResult(pair[wIdx]);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pair, reportResult]);

  const [s0, s1] = gamesRef.current;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-10 pixel text-xs">
        <span className="text-arcade-cyan">{names[pair[0]] || 'P1'}</span>
        <span className="text-slate-600">VS</span>
        <span className="text-arcade-amber">{names[pair[1]] || 'P2'}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={COLS * CELL * 2 + 40}
        height={ROWS * CELL}
        className="rounded-xl border border-arcade-purple/30 shadow-neon-purple max-w-full"
      />
      {winner ? (
        <div className="text-arcade-green text-sm">¡Ronda para {names[winner]}! Reportada al bote.</div>
      ) : (
        <div className="text-xs text-slate-500 text-center">
          <span className="text-arcade-cyan">A/D · S · W · Espacio</span> &nbsp;vs&nbsp; <span className="text-arcade-amber">← → · ↓ · ↑ · Enter</span>
          <div className="mt-1">El que se desborde primero pierde la ronda.</div>
        </div>
      )}
      {meIdx === -1 && <div className="text-xs text-amber-400">Modo local: jugáis en el mismo dispositivo.</div>}
    </div>
  );
}
