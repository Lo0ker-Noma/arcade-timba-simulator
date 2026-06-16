import React, { useEffect, useRef, useState } from 'react';
import { sfx } from '../lib/sound';

// Solo Tetris score-attack: rack up the highest score before you top out.
// Each player plays their own board; higher score wins the round.
const COLS = 10, ROWS = 20, CELL = 20, SIDE = 110;
const BASE_TICK = 700;
const gravityFor = (lvl) => Math.max(90, BASE_TICK - lvl * 65);

const SHAPES = { I: [[1, 1, 1, 1]], O: [[1, 1], [1, 1]], T: [[0, 1, 0], [1, 1, 1]], S: [[0, 1, 1], [1, 1, 0]], Z: [[1, 1, 0], [0, 1, 1]], J: [[1, 0, 0], [1, 1, 1]], L: [[0, 0, 1], [1, 1, 1]] };
const COLORS = { I: '#22d3ee', O: '#f59e0b', T: '#a855f7', S: '#34d399', Z: '#ec4899', J: '#60a5fa', L: '#fb923c' };
const KEYS = Object.keys(SHAPES);
const rotate = (m) => { const R = m.length, C = m[0].length, o = Array.from({ length: C }, () => Array(R).fill(0)); for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) o[c][R - 1 - r] = m[r][c]; return o; };
const randKey = () => KEYS[(Math.random() * KEYS.length) | 0];
const spawn = (k) => ({ k, m: SHAPES[k].map((r) => [...r]), x: 3, y: 0 });
function newGame(startLevel = 0) { return { grid: Array.from({ length: ROWS }, () => Array(COLS).fill(null)), piece: spawn(randKey()), nextKey: randKey(), score: 0, lines: 0, level: startLevel, baseLevel: startLevel, dead: false, acc: 0 }; }
function collides(g, m, x, y) { for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) { if (!m[r][c]) continue; const nx = x + c, ny = y + r; if (nx < 0 || nx >= COLS || ny >= ROWS) return true; if (ny >= 0 && g[ny][nx]) return true; } return false; }
function merge(s) {
  const { grid, piece } = s;
  piece.m.forEach((row, r) => row.forEach((v, c) => { if (v && piece.y + r >= 0) grid[piece.y + r][piece.x + c] = COLORS[piece.k]; }));
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) if (grid[r].every((c) => c)) { grid.splice(r, 1); grid.unshift(Array(COLS).fill(null)); cleared++; r++; }
  if (cleared > 0) sfx.line(); else sfx.drop();
  s.score += [0, 100, 300, 500, 800][cleared] * (s.level + 1);
  s.lines += cleared; s.level = (s.baseLevel || 0) + Math.floor(s.lines / 10);
  const np = spawn(s.nextKey); s.nextKey = randKey();
  if (collides(grid, np.m, np.x, np.y)) s.dead = true;
  s.piece = np;
}

export default function Tetris({ onGameOver, onProgress, level = 1 }) {
  const canvasRef = useRef(null);
  const game = useRef(newGame(level - 1));
  const endedRef = useRef(false);
  const lastProg = useRef(0);
  const [over, setOver] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const move = (dx) => { const s = game.current; if (s.dead) return; if (!collides(s.grid, s.piece.m, s.piece.x + dx, s.piece.y)) s.piece.x += dx; };
    const soft = () => { const s = game.current; if (s.dead) return; if (!collides(s.grid, s.piece.m, s.piece.x, s.piece.y + 1)) s.piece.y += 1; else merge(s); };
    const rot = () => { const s = game.current; if (s.dead) return; const nm = rotate(s.piece.m); if (!collides(s.grid, nm, s.piece.x, s.piece.y)) { s.piece.m = nm; sfx.blip(); } };
    const hard = () => { const s = game.current; if (s.dead) return; while (!collides(s.grid, s.piece.m, s.piece.x, s.piece.y + 1)) s.piece.y += 1; merge(s); };
    const map = { ArrowLeft: () => move(-1), a: () => move(-1), A: () => move(-1), ArrowRight: () => move(1), d: () => move(1), D: () => move(1), ArrowDown: () => soft(), s: () => soft(), S: () => soft(), ArrowUp: () => rot(), w: () => rot(), W: () => rot(), ' ': () => hard() };
    const onKey = (e) => { const f = map[e.key]; if (!f) return; e.preventDefault(); f(); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    const BW = COLS * CELL;
    let last = performance.now(), raf;
    const loop = (t) => {
      const s = game.current;
      if (!s.dead) { s.acc += t - last; const tick = gravityFor(s.level); while (s.acc >= tick) { s.acc -= tick; if (!collides(s.grid, s.piece.m, s.piece.x, s.piece.y + 1)) s.piece.y += 1; else { merge(s); break; } } }
      last = t;
      ctx.fillStyle = '#0a0e1a'; ctx.fillRect(0, 0, BW, ROWS * CELL);
      // Subtle cell grid inside the well, echoing the landing's arcade grid.
      ctx.strokeStyle = 'rgba(168,85,247,0.06)'; ctx.beginPath();
      for (let gx = CELL; gx < BW; gx += CELL) { ctx.moveTo(gx, 0); ctx.lineTo(gx, ROWS * CELL); }
      for (let gy = CELL; gy < ROWS * CELL; gy += CELL) { ctx.moveTo(0, gy); ctx.lineTo(BW, gy); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(168,85,247,0.25)'; ctx.strokeRect(0, 0, BW, ROWS * CELL);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (s.grid[r][c]) { ctx.fillStyle = s.grid[r][c]; ctx.fillRect(c * CELL, r * CELL, CELL - 1, CELL - 1); }
      if (!s.dead) {
        ctx.save();
        ctx.shadowBlur = 12; ctx.shadowColor = COLORS[s.piece.k];
        ctx.fillStyle = COLORS[s.piece.k];
        s.piece.m.forEach((row, r) => row.forEach((v, c) => { if (v) ctx.fillRect((s.piece.x + c) * CELL, (s.piece.y + r) * CELL, CELL - 1, CELL - 1); }));
        ctx.restore();
      }
      // side panel
      const px = BW + 14;
      ctx.fillStyle = 'rgba(148,163,184,0.7)'; ctx.font = '10px "Press Start 2P", monospace'; ctx.fillText('NEXT', px, 16);
      ctx.fillStyle = COLORS[s.nextKey]; const nm = SHAPES[s.nextKey], cs = 16;
      nm.forEach((row, r) => row.forEach((v, c) => { if (v) ctx.fillRect(px + c * cs, 26 + r * cs, cs - 1, cs - 1); }));
      ctx.fillStyle = '#22d3ee'; ctx.fillText('SCORE', px, 110); ctx.fillStyle = '#e2e8f0'; ctx.fillText(String(s.score), px, 128);
      ctx.fillStyle = '#22d3ee'; ctx.fillText('LINES', px, 156); ctx.fillStyle = '#e2e8f0'; ctx.fillText(String(s.lines), px, 174);
      ctx.fillStyle = '#22d3ee'; ctx.fillText('LEVEL', px, 202); ctx.fillStyle = '#e2e8f0'; ctx.fillText(String(s.level), px, 220);
      setScore(s.score);
      if (onProgress && t - lastProg.current > 800) { lastProg.current = t; onProgress(s.score); }
      if (s.dead && !endedRef.current) { endedRef.current = true; setOver(true); setTimeout(() => onGameOver && onGameOver(s.score, s.lines > 0), 600); }
      if (!s.dead) raf = requestAnimationFrame(loop); else raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [onGameOver]);

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas ref={canvasRef} width={COLS * CELL + SIDE} height={ROWS * CELL} className="rounded-xl border border-arcade-purple/30 shadow-neon-purple max-w-full" />
      {over ? (
        <div className="pixel text-[10px] text-arcade-green">GAME OVER · PUNTUACIÓN: {score}</div>
      ) : (
        <div className="text-xs text-slate-500 text-center"><span className="text-arcade-cyan">← → mover · ↓ bajar · ↑ rotar · Espacio caída</span><div className="mt-1">Haz la máxima puntuación antes de desbordarte.</div></div>
      )}
    </div>
  );
}
