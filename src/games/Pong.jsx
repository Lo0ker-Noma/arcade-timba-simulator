import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { onRealtime, sendRealtime } from '../lib/realtime';

// Online Pong (host-authoritative netcode over Nostr session keys).
//  - host = pair[0] simulates the ball + scoring (left paddle).
//  - guest = pair[1] controls the right paddle and streams its Y.
//  - host broadcasts the world state ~16 Hz; guest predicts its own paddle
//    locally for responsiveness. First to 5 wins; host reports to the pot.
const W = 640, H = 360, PADDLE_H = 70, PADDLE_W = 10, BALL = 9, WIN_SCORE = 5;

export default function Pong({ me, pair, names }) {
  const reportResult = useGameStore((s) => s.reportResult);
  const canvasRef = useRef(null);
  const keys = useRef({});
  const reportedRef = useRef(false);
  const [score, setScore] = useState([0, 0]);

  const meIdx = pair.indexOf(me);
  const isHost = meIdx === 0;

  // Shared world (authoritative on host; mirrored on guest/spectator).
  const world = useRef({ ly: H / 2, ry: H / 2, bx: W / 2, by: H / 2, vx: 4.2, vy: 2.4, s: [0, 0] });
  const myPaddle = useRef(H / 2);        // local predicted paddle
  const remotePaddle = useRef(H / 2);    // last paddle Y received from the other side

  useEffect(() => {
    const down = (e) => { if (['ArrowUp', 'ArrowDown', 'w', 's', 'W', 'S'].includes(e.key)) e.preventDefault(); keys.current[e.key] = true; };
    const up = (e) => { keys.current[e.key] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useEffect(() => {
    const off = onRealtime((data, from) => {
      if (from !== pair[0] && from !== pair[1]) return;
      if (data.t === 's') {
        // authoritative state from host
        const w = world.current;
        w.bx = data.bx; w.by = data.by; w.ly = data.ly; w.s = data.s;
        if (!isHost) w.ry = data.ry;
        setScore([data.s[0], data.s[1]]);
      } else if (data.t === 'p') {
        // paddle update from the other player
        remotePaddle.current = data.y;
      }
    });
    return off;
  }, [pair, isHost]);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    const w = world.current;
    let raf, lastSend = 0;
    const reset = (dir) => { w.bx = W / 2; w.by = H / 2; w.vx = 4.2 * dir; w.vy = (Math.random() * 4 - 2); };

    const loop = (now) => {
      const k = keys.current;
      const SP = 6;
      // local paddle from keys
      if (k['w'] || k['W'] || k['ArrowUp']) myPaddle.current -= SP;
      if (k['s'] || k['S'] || k['ArrowDown']) myPaddle.current += SP;
      myPaddle.current = Math.max(PADDLE_H / 2, Math.min(H - PADDLE_H / 2, myPaddle.current));

      if (isHost) {
        w.ly = myPaddle.current;
        w.ry = remotePaddle.current;
        // simulate
        w.bx += w.vx; w.by += w.vy;
        if (w.by < BALL || w.by > H - BALL) w.vy *= -1;
        if (w.bx < PADDLE_W + BALL && Math.abs(w.by - w.ly) < PADDLE_H / 2 + BALL) { w.vx = Math.abs(w.vx) * 1.04; w.vy += (w.by - w.ly) * 0.05; }
        if (w.bx > W - PADDLE_W - BALL && Math.abs(w.by - w.ry) < PADDLE_H / 2 + BALL) { w.vx = -Math.abs(w.vx) * 1.04; w.vy += (w.by - w.ry) * 0.05; }
        if (w.bx < 0) { w.s[1]++; setScore([...w.s]); reset(1); }
        if (w.bx > W) { w.s[0]++; setScore([...w.s]); reset(-1); }
        if (now - lastSend > 55) { lastSend = now; sendRealtime({ t: 's', bx: w.bx, by: w.by, ly: w.ly, ry: w.ry, s: w.s }); }
      } else if (meIdx === 1) {
        w.ry = myPaddle.current; // predict own paddle
        if (now - lastSend > 45) { lastSend = now; sendRealtime({ t: 'p', y: myPaddle.current }); }
      }

      // draw
      ctx.fillStyle = '#0a0e1a'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(34,211,238,0.15)'; ctx.setLineDash([6, 10]);
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#22d3ee'; ctx.fillRect(0, w.ly - PADDLE_H / 2, PADDLE_W, PADDLE_H);
      ctx.fillStyle = '#f59e0b'; ctx.fillRect(W - PADDLE_W, w.ry - PADDLE_H / 2, PADDLE_W, PADDLE_H);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w.bx, w.by, BALL, 0, Math.PI * 2); ctx.fill();

      const done = w.s[0] >= WIN_SCORE || w.s[1] >= WIN_SCORE;
      if (done && isHost && !reportedRef.current) {
        reportedRef.current = true;
        reportResult(pair[w.s[0] >= WIN_SCORE ? 0 : 1]);
      }
      if (!done) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pair, isHost, meIdx, reportResult]);

  const done = score[0] >= WIN_SCORE || score[1] >= WIN_SCORE;
  const sideLabel = meIdx === 0 ? 'Eres la pala izquierda (cyan)' : meIdx === 1 ? 'Eres la pala derecha (ámbar)' : 'Mirando partida';

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-8 text-lg pixel">
        <span className="text-arcade-cyan">{score[0]}</span>
        <span className="text-slate-600 text-xs">VS</span>
        <span className="text-arcade-amber">{score[1]}</span>
      </div>
      <canvas ref={canvasRef} width={W} height={H} className="rounded-xl border border-arcade-cyan/30 shadow-neon max-w-full" />
      {done ? (
        <div className="text-arcade-green text-sm">¡Ronda para {names[pair[score[0] >= WIN_SCORE ? 0 : 1]]}!</div>
      ) : (
        <div className="text-xs text-slate-500">{sideLabel} · muévete con <span className="text-arcade-cyan">↑ / ↓</span> (o W/S) — primero a {WIN_SCORE}</div>
      )}
    </div>
  );
}
