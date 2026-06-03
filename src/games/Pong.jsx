import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';

// Local hotseat Pong (same device): left paddle W/S, right paddle ↑/↓.
// First to 5 points wins the round; winner is reported to the pot.
// (Real-time relay sync is rough over public relays; turn-based games are the
// true remote-multiplayer modes — Pong is the couch/LAN-party mode.)
const W = 640, H = 360, PADDLE_H = 70, PADDLE_W = 10, BALL = 9, WIN_SCORE = 5;

export default function Pong({ me, pair, names }) {
  const reportResult = useGameStore((s) => s.reportResult);
  const canvasRef = useRef(null);
  const keys = useRef({});
  const reportedRef = useRef(false);
  const [score, setScore] = useState([0, 0]);
  const stateRef = useRef({
    ly: H / 2, ry: H / 2, bx: W / 2, by: H / 2, vx: 4, vy: 2.5, s: [0, 0],
  });

  const meIdx = pair.indexOf(me);

  useEffect(() => {
    const down = (e) => {
      if (['ArrowUp', 'ArrowDown', 'w', 's', 'W', 'S'].includes(e.key)) e.preventDefault();
      keys.current[e.key] = true;
    };
    const up = (e) => { keys.current[e.key] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useEffect(() => {
    let raf;
    const ctx = canvasRef.current.getContext('2d');
    const st = stateRef.current;

    const reset = (dir) => { st.bx = W / 2; st.by = H / 2; st.vx = 4 * dir; st.vy = (Math.random() * 4 - 2); };

    const loop = () => {
      const k = keys.current;
      const SP = 6;
      if (k['w'] || k['W']) st.ly -= SP;
      if (k['s'] || k['S']) st.ly += SP;
      if (k['ArrowUp']) st.ry -= SP;
      if (k['ArrowDown']) st.ry += SP;
      st.ly = Math.max(PADDLE_H / 2, Math.min(H - PADDLE_H / 2, st.ly));
      st.ry = Math.max(PADDLE_H / 2, Math.min(H - PADDLE_H / 2, st.ry));

      st.bx += st.vx; st.by += st.vy;
      if (st.by < BALL || st.by > H - BALL) st.vy *= -1;
      // left paddle
      if (st.bx < PADDLE_W + BALL && Math.abs(st.by - st.ly) < PADDLE_H / 2 + BALL) {
        st.vx = Math.abs(st.vx) * 1.04; st.vy += (st.by - st.ly) * 0.05;
      }
      // right paddle
      if (st.bx > W - PADDLE_W - BALL && Math.abs(st.by - st.ry) < PADDLE_H / 2 + BALL) {
        st.vx = -Math.abs(st.vx) * 1.04; st.vy += (st.by - st.ry) * 0.05;
      }
      if (st.bx < 0) { st.s[1]++; setScore([...st.s]); reset(1); }
      if (st.bx > W) { st.s[0]++; setScore([...st.s]); reset(-1); }

      // draw
      ctx.fillStyle = '#0a0e1a'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(34,211,238,0.15)';
      ctx.setLineDash([6, 10]); ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#22d3ee'; ctx.fillRect(0, st.ly - PADDLE_H / 2, PADDLE_W, PADDLE_H);
      ctx.fillStyle = '#f59e0b'; ctx.fillRect(W - PADDLE_W, st.ry - PADDLE_H / 2, PADDLE_W, PADDLE_H);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(st.bx, st.by, BALL, 0, Math.PI * 2); ctx.fill();

      const done = st.s[0] >= WIN_SCORE || st.s[1] >= WIN_SCORE;
      if (done && !reportedRef.current) {
        reportedRef.current = true;
        const wIdx = st.s[0] >= WIN_SCORE ? 0 : 1;
        reportResult(pair[wIdx]);
      }
      if (!done) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pair, reportResult]);

  const done = score[0] >= WIN_SCORE || score[1] >= WIN_SCORE;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-8 text-lg pixel">
        <span className="text-arcade-cyan">{score[0]}</span>
        <span className="text-slate-600 text-xs">VS</span>
        <span className="text-arcade-amber">{score[1]}</span>
      </div>
      <canvas ref={canvasRef} width={W} height={H} className="rounded-xl border border-arcade-cyan/30 shadow-neon max-w-full" />
      {done ? (
        <div className="text-arcade-green text-sm">¡Ronda para {names[pair[score[0] >= WIN_SCORE ? 0 : 1]]}! Reportada al bote.</div>
      ) : (
        <div className="text-xs text-slate-500">
          Izquierda <span className="text-arcade-cyan">W / S</span> · Derecha <span className="text-arcade-amber">↑ / ↓</span> — primero a {WIN_SCORE}
        </div>
      )}
      {meIdx === -1 && <div className="text-xs text-amber-400">Modo local: jugáis en el mismo dispositivo.</div>}
    </div>
  );
}
