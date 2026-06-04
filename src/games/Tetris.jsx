import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { onRealtime, sendRealtime } from '../lib/realtime';

// Online Tetris duel (parallel netcode over Nostr session keys). Each player
// runs their own board locally and broadcasts a compact snapshot ~5x/sec; the
// opponent's board is rendered from those snapshots. First to top out loses;
// the loser reports the opponent as winner (host de-dupes per round).
const COLS = 10, ROWS = 20, CELL = 18, SIDE = 92;
const BASE_TICK = 700;
const gravityFor = (lvl) => Math.max(90, BASE_TICK - lvl * 65);

const SHAPES = {
  I: [[1, 1, 1, 1]], O: [[1, 1], [1, 1]], T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]], Z: [[1, 1, 0], [0, 1, 1]], J: [[1, 0, 0], [1, 1, 1]], L: [[0, 0, 1], [1, 1, 1]],
};
const COLORS = { I: '#22d3ee', O: '#f59e0b', T: '#a855f7', S: '#34d399', Z: '#ec4899', J: '#60a5fa', L: '#fb923c' };
const IDX = { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 };
const IDX2COLOR = ['', '#22d3ee', '#f59e0b', '#a855f7', '#34d399', '#ec4899', '#60a5fa', '#fb923c'];
const KEYS = Object.keys(SHAPES);

const rotate = (m) => { const R = m.length, C = m[0].length, o = Array.from({ length: C }, () => Array(R).fill(0)); for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) o[c][R - 1 - r] = m[r][c]; return o; };
const randKey = () => KEYS[(Math.random() * KEYS.length) | 0];
const spawn = (k) => ({ k, m: SHAPES[k].map((r) => [...r]), x: 3, y: 0 });

function newGame() {
  return { grid: Array.from({ length: ROWS }, () => Array(COLS).fill(null)), piece: spawn(randKey()), nextKey: randKey(), score: 0, lines: 0, level: 0, dead: false, acc: 0 };
}
function collides(g, m, x, y) {
  for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) {
    if (!m[r][c]) continue; const nx = x + c, ny = y + r;
    if (nx < 0 || nx >= COLS || ny >= ROWS) return true; if (ny >= 0 && g[ny][nx]) return true;
  } return false;
}
function merge(s) {
  const { grid, piece } = s;
  piece.m.forEach((row, r) => row.forEach((v, c) => { if (v && piece.y + r >= 0) grid[piece.y + r][piece.x + c] = COLORS[piece.k]; }));
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) if (grid[r].every((c) => c)) { grid.splice(r, 1); grid.unshift(Array(COLS).fill(null)); cleared++; r++; }
  s.score += [0, 100, 300, 500, 800][cleared] * (s.level + 1);
  s.lines += cleared; s.level = Math.floor(s.lines / 10);
  const np = spawn(s.nextKey); s.nextKey = randKey();
  if (collides(grid, np.m, np.x, np.y)) s.dead = true;
  s.piece = np;
}
// Compact wire snapshot: grid as 200-char index string + piece cells.
function encode(s) {
  let g = '';
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const v = s.grid[r][c]; g += v ? String(IDX2COLOR.indexOf(v)) : '0';
  }
  const cells = [];
  s.piece.m.forEach((row, r) => row.forEach((v, c) => { if (v) cells.push([s.piece.x + c, s.piece.y + r]); }));
  return { t: 'b', g, pk: s.piece.k, cells, score: s.score, lines: s.lines, level: s.level, dead: s.dead };
}

export default function Tetris({ me, pair, names }) {
  const reportResult = useGameStore((s) => s.reportResult);
  const canvasRef = useRef(null);
  const reportedRef = useRef(false);
  const mine = useRef(newGame());
  const opp = useRef(null); // decoded opponent snapshot
  const [over, setOver] = useState(null); // winner pubkey

  const meIdx = pair.indexOf(me);
  const oppIdx = meIdx === 0 ? 1 : 0;

  useEffect(() => {
    const off = onRealtime((data, from) => {
      if (from !== pair[oppIdx] || data.t !== 'b') return;
      opp.current = data;
      if (data.dead && !reportedRef.current) { reportedRef.current = true; setOver(pair[meIdx]); reportResult(pair[meIdx]); }
    });
    return off;
  }, [pair, meIdx, oppIdx, reportResult]);

  // input
  useEffect(() => {
    if (meIdx === -1) return;
    const move = (dx) => { const s = mine.current; if (s.dead) return; if (!collides(s.grid, s.piece.m, s.piece.x + dx, s.piece.y)) s.piece.x += dx; };
    const soft = () => { const s = mine.current; if (s.dead) return; if (!collides(s.grid, s.piece.m, s.piece.x, s.piece.y + 1)) s.piece.y += 1; else merge(s); };
    const rot = () => { const s = mine.current; if (s.dead) return; const nm = rotate(s.piece.m); if (!collides(s.grid, nm, s.piece.x, s.piece.y)) s.piece.m = nm; };
    const hard = () => { const s = mine.current; if (s.dead) return; while (!collides(s.grid, s.piece.m, s.piece.x, s.piece.y + 1)) s.piece.y += 1; merge(s); };
    const map = { ArrowLeft: () => move(-1), a: () => move(-1), A: () => move(-1), ArrowRight: () => move(1), d: () => move(1), D: () => move(1), ArrowDown: () => soft(), s: () => soft(), S: () => soft(), ArrowUp: () => rot(), w: () => rot(), W: () => rot(), ' ': () => hard() };
    const onKey = (e) => { const f = map[e.key]; if (!f) return; e.preventDefault(); f(); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [meIdx]);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    const BW = COLS * CELL, GAP = 36, UNIT = BW + SIDE;
    // my board on the left, opponent on the right
    const ox = [0, UNIT + GAP];

    const drawBoardCells = (x0, cellsAt, accent, label, name) => {
      ctx.fillStyle = '#0a0e1a'; ctx.fillRect(x0, 0, BW, ROWS * CELL);
      ctx.strokeStyle = accent + '40'; ctx.strokeRect(x0, 0, BW, ROWS * CELL);
      cellsAt(x0);
      ctx.fillStyle = accent; ctx.font = '9px "Press Start 2P", monospace';
      ctx.fillText(label, x0 + BW + 10, 14);
      ctx.fillStyle = '#cbd5e1'; ctx.fillText((name || '').slice(0, 8), x0 + BW + 10, 30);
    };

    const drawMine = (x0) => {
      const s = mine.current;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (s.grid[r][c]) { ctx.fillStyle = s.grid[r][c]; ctx.fillRect(x0 + c * CELL, r * CELL, CELL - 1, CELL - 1); }
      if (!s.dead) { ctx.fillStyle = COLORS[s.piece.k]; s.piece.m.forEach((row, r) => row.forEach((v, c) => { if (v) ctx.fillRect(x0 + (s.piece.x + c) * CELL, (s.piece.y + r) * CELL, CELL - 1, CELL - 1); })); }
      ctx.fillStyle = '#e2e8f0'; ctx.font = '9px "Press Start 2P", monospace'; ctx.fillText('SCORE ' + s.score, x0 + BW + 10, 50); ctx.fillText('LV ' + s.level, x0 + BW + 10, 66);
    };
    const drawOpp = (x0) => {
      const o = opp.current; if (!o) { ctx.fillStyle = 'rgba(148,163,184,0.4)'; ctx.font = '8px "Press Start 2P", monospace'; ctx.fillText('esperando…', x0 + 18, ROWS * CELL / 2); return; }
      for (let i = 0; i < o.g.length; i++) { const v = +o.g[i]; if (v) { ctx.fillStyle = IDX2COLOR[v]; const c = i % COLS, r = (i / COLS) | 0; ctx.fillRect(x0 + c * CELL, r * CELL, CELL - 1, CELL - 1); } }
      if (o.cells) { ctx.fillStyle = COLORS[o.pk] || '#fff'; o.cells.forEach(([c, r]) => { if (r >= 0) ctx.fillRect(x0 + c * CELL, r * CELL, CELL - 1, CELL - 1); }); }
      ctx.fillStyle = '#e2e8f0'; ctx.font = '9px "Press Start 2P", monospace'; ctx.fillText('SCORE ' + o.score, x0 + BW + 10, 50); ctx.fillText('LV ' + o.level, x0 + BW + 10, 66);
    };

    let last = performance.now(), lastSend = 0, raf;
    const loop = (t) => {
      const s = mine.current;
      if (meIdx !== -1 && !s.dead) {
        s.acc += t - last;
        const tick = gravityFor(s.level);
        while (s.acc >= tick) { s.acc -= tick; if (!collides(s.grid, s.piece.m, s.piece.x, s.piece.y + 1)) s.piece.y += 1; else { merge(s); break; } }
      }
      last = t;
      drawBoardCells(ox[0], drawMine, '#22d3ee', 'TÚ', names[pair[meIdx]] || 'Tú');
      drawBoardCells(ox[1], drawOpp, '#f59e0b', 'RIVAL', names[pair[oppIdx]] || 'Rival');

      if (meIdx !== -1 && t - lastSend > 180) { lastSend = t; sendRealtime(encode(s)); }
      if (s.dead && !reportedRef.current && meIdx !== -1) { reportedRef.current = true; sendRealtime(encode(s)); setOver(pair[oppIdx]); reportResult(pair[oppIdx]); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pair, meIdx, oppIdx, names, reportResult]);

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas ref={canvasRef} width={(COLS * CELL + SIDE) * 2 + 36} height={ROWS * CELL} className="rounded-xl border border-arcade-purple/30 shadow-neon-purple max-w-full" />
      {over ? (
        <div className="text-arcade-green text-sm">¡Ronda para {names[over]}!</div>
      ) : (
        <div className="text-xs text-slate-500 text-center">
          <span className="text-arcade-cyan">← → mover · ↓ bajar · ↑ rotar · Espacio caída</span>
          <div className="mt-1">El que se desborde primero pierde.</div>
        </div>
      )}
      {meIdx === -1 && <div className="text-xs text-amber-400">Mirando partida</div>}
    </div>
  );
}
