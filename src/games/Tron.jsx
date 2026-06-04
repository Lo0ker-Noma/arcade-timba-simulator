import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { onRealtime, sendRealtime } from '../lib/realtime';

// Online light-cycles (Tron) / Snake duel — host-authoritative over Nostr.
//  - host = pair[0] (cyan) simulates both cycles each tick and broadcasts head
//    positions; clients rebuild the trails locally from those positions.
//  - guest = pair[1] (amber) streams only its direction inputs to the host.
// Crash into a wall or any trail and you lose the round.
const CELL = 12, COLS = 48, ROWS = 30;

export default function Tron({ me, pair, names, variant = 'tron' }) {
  const reportResult = useGameStore((s) => s.reportResult);
  const canvasRef = useRef(null);
  const reportedRef = useRef(false);
  const [winner, setWinner] = useState(null);
  const speed = variant === 'snake' ? 90 : 55;

  const meIdx = pair.indexOf(me);
  const isHost = meIdx === 0;

  const grid = useRef(Array.from({ length: ROWS }, () => Array(COLS).fill(0)));
  const p1 = useRef([8, ROWS >> 1]);
  const p2 = useRef([COLS - 9, ROWS >> 1]);
  const myDir = useRef(isHost ? [1, 0] : [-1, 0]);
  const guestDir = useRef([-1, 0]); // host's view of guest direction

  // keyboard → my direction (no 180° reversal)
  useEffect(() => {
    const map = {
      w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0],
      ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    };
    const onKey = (e) => {
      const nd = map[e.key]; if (!nd) return; e.preventDefault();
      const cur = myDir.current;
      if (cur[0] + nd[0] === 0 && cur[1] + nd[1] === 0) return;
      myDir.current = nd;
      if (!isHost) sendRealtime({ t: 'd', dir: nd });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isHost]);

  // receive host state (clients) or guest direction (host)
  useEffect(() => {
    const off = onRealtime((data, from) => {
      if (from !== pair[0] && from !== pair[1]) return;
      if (data.t === 'd' && isHost && from === pair[1]) {
        const nd = data.dir, cur = guestDir.current;
        if (Array.isArray(nd) && !(cur[0] + nd[0] === 0 && cur[1] + nd[1] === 0)) guestDir.current = nd;
      } else if (data.t === 's' && !isHost) {
        const g = grid.current;
        if (data.p1) { p1.current = data.p1; if (inBounds(data.p1)) g[data.p1[1]][data.p1[0]] = 1; }
        if (data.p2) { p2.current = data.p2; if (inBounds(data.p2)) g[data.p2[1]][data.p2[0]] = 2; }
        if (data.dead) finish(data.winnerIdx, false);
      }
    });
    return off;
  }, [pair, isHost]);

  const inBoundsRef = useRef(null);
  function inBounds(pos) { return pos[0] >= 0 && pos[0] < COLS && pos[1] >= 0 && pos[1] < ROWS; }

  const finishRef = useRef(null);
  function finish(winIdx, broadcast) {
    if (reportedRef.current) return;
    reportedRef.current = true;
    const wp = pair[winIdx];
    setWinner(wp);
    if (broadcast && isHost) reportResult(wp);
  }
  finishRef.current = finish;

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    const g = grid.current;
    if (isHost) { g[p1.current[1]][p1.current[0]] = 1; g[p2.current[1]][p2.current[0]] = 2; }
    let alive = true;

    const draw = () => {
      ctx.fillStyle = '#0a0e1a'; ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        if (g[y][x] === 1) { ctx.fillStyle = '#22d3ee'; ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1); }
        else if (g[y][x] === 2) { ctx.fillStyle = '#f59e0b'; ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1); }
      }
      ctx.fillStyle = '#e0fbff'; ctx.fillRect(p1.current[0] * CELL, p1.current[1] * CELL, CELL - 1, CELL - 1);
      ctx.fillStyle = '#fff7e0'; ctx.fillRect(p2.current[0] * CELL, p2.current[1] * CELL, CELL - 1, CELL - 1);
    };

    let interval, rafa;
    if (isHost) {
      const hit = (pos) => !inBounds(pos) || g[pos[1]][pos[0]] !== 0;
      interval = setInterval(() => {
        if (!alive) return;
        const n1 = [p1.current[0] + myDir.current[0], p1.current[1] + myDir.current[1]];
        const n2 = [p2.current[0] + guestDir.current[0], p2.current[1] + guestDir.current[1]];
        const d1 = hit(n1), d2 = hit(n2) || (n1[0] === n2[0] && n1[1] === n2[1]);
        if (d1 || d2) {
          const winIdx = d1 && d2 ? 0 : d1 ? 1 : 0;
          sendRealtime({ t: 's', p1: p1.current, p2: p2.current, dead: true, winnerIdx: winIdx });
          alive = false; draw(); finish(winIdx, true); return;
        }
        p1.current = n1; p2.current = n2;
        g[n1[1]][n1[0]] = 1; g[n2[1]][n2[0]] = 2;
        sendRealtime({ t: 's', p1: n1, p2: n2 });
        draw();
      }, speed);
    } else {
      const render = () => { draw(); rafa = requestAnimationFrame(render); };
      rafa = requestAnimationFrame(render);
    }
    draw();
    return () => { clearInterval(interval); cancelAnimationFrame(rafa); };
  }, [isHost, speed, pair]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-6 pixel text-xs">
        <span className="text-arcade-cyan">{names[pair[0]] || 'P1'}</span>
        <span className="text-slate-600">VS</span>
        <span className="text-arcade-amber">{names[pair[1]] || 'P2'}</span>
      </div>
      <canvas ref={canvasRef} width={COLS * CELL} height={ROWS * CELL} className="rounded-xl border border-arcade-purple/30 shadow-neon-purple max-w-full" />
      {winner ? (
        <div className="text-arcade-green text-sm">¡Ronda para {names[winner]}!</div>
      ) : (
        <div className="text-xs text-slate-500">
          Mueve tu moto con <span className={meIdx === 0 ? 'text-arcade-cyan' : 'text-arcade-amber'}>WASD o flechas</span> — no choques con los rastros
        </div>
      )}
      {meIdx === -1 && <div className="text-xs text-amber-400">Mirando partida</div>}
    </div>
  );
}
