import React, { useEffect, useRef, useState } from 'react';

// You (left, cyan) vs the machine (right, amber). 45s match. Score = your goals.
// Each player plays their own match vs the AI; more goals wins the round.
const W = 640, H = 360, PADDLE_H = 70, PADDLE_W = 10, BALL = 9, MATCH_MS = 45000;

export default function Pong({ onGameOver, level = 1 }) {
  const canvasRef = useRef(null);
  const keys = useRef({});
  const endedRef = useRef(false);
  const [score, setScore] = useState([0, 0]);
  const [timeLeft, setTimeLeft] = useState(45);
  const ballSpeed = 4.2 + (level - 1) * 0.7;
  const aiSpeed = 5.0 + (level - 1) * 0.45;
  const st = useRef({ ly: H / 2, ry: H / 2, bx: W / 2, by: H / 2, vx: ballSpeed, vy: 2.4, s: [0, 0] });

  useEffect(() => {
    const down = (e) => { if (['ArrowUp', 'ArrowDown', 'w', 's', 'W', 'S'].includes(e.key)) e.preventDefault(); keys.current[e.key] = true; };
    const up = (e) => { keys.current[e.key] = false; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    const s = st.current;
    const start = performance.now();
    let raf;
    const reset = (dir) => { s.bx = W / 2; s.by = H / 2; s.vx = ballSpeed * dir; s.vy = (Math.random() * 4 - 2); };

    const loop = (now) => {
      const left = Math.max(0, MATCH_MS - (now - start));
      setTimeLeft(Math.ceil(left / 1000));
      const SP = 6;
      if (keys.current['w'] || keys.current['W'] || keys.current['ArrowUp']) s.ly -= SP;
      if (keys.current['s'] || keys.current['S'] || keys.current['ArrowDown']) s.ly += SP;
      s.ly = Math.max(PADDLE_H / 2, Math.min(H - PADDLE_H / 2, s.ly));

      // AI paddle: tracks ball with limited speed + small reaction error
      const target = s.by + (Math.sin(now / 240) * 14);
      const diff = target - s.ry;
      s.ry += Math.max(-aiSpeed, Math.min(aiSpeed, diff));
      s.ry = Math.max(PADDLE_H / 2, Math.min(H - PADDLE_H / 2, s.ry));

      s.bx += s.vx; s.by += s.vy;
      if (s.by < BALL || s.by > H - BALL) s.vy *= -1;
      if (s.bx < PADDLE_W + BALL && Math.abs(s.by - s.ly) < PADDLE_H / 2 + BALL) { s.vx = Math.abs(s.vx) * 1.04; s.vy += (s.by - s.ly) * 0.05; }
      if (s.bx > W - PADDLE_W - BALL && Math.abs(s.by - s.ry) < PADDLE_H / 2 + BALL) { s.vx = -Math.abs(s.vx) * 1.04; s.vy += (s.by - s.ry) * 0.05; }
      if (s.bx < 0) { s.s[1]++; setScore([...s.s]); reset(1); }
      if (s.bx > W) { s.s[0]++; setScore([...s.s]); reset(-1); }

      ctx.fillStyle = '#0a0e1a'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(34,211,238,0.15)'; ctx.setLineDash([6, 10]);
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#22d3ee'; ctx.fillRect(0, s.ly - PADDLE_H / 2, PADDLE_W, PADDLE_H);
      ctx.fillStyle = '#f59e0b'; ctx.fillRect(W - PADDLE_W, s.ry - PADDLE_H / 2, PADDLE_W, PADDLE_H);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.bx, s.by, BALL, 0, Math.PI * 2); ctx.fill();

      if (left <= 0 && !endedRef.current) { endedRef.current = true; const won = s.s[0] >= s.s[1]; setTimeout(() => onGameOver && onGameOver(s.s[0] * level, won), 400); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [onGameOver, ballSpeed, aiSpeed, level]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-8 text-lg pixel">
        <span className="text-arcade-cyan">{score[0]}</span>
        <span className="text-slate-500 text-xs">⏱ {timeLeft}s</span>
        <span className="text-arcade-amber">{score[1]}</span>
      </div>
      <canvas ref={canvasRef} width={W} height={H} className="rounded-xl border border-arcade-cyan/30 shadow-neon max-w-full" />
      <div className="text-xs text-slate-500">Tú (cyan) muévete con <span className="text-arcade-cyan">↑ / ↓</span> (o W/S) vs la máquina — ¡más goles en 45s gana!</div>
    </div>
  );
}
