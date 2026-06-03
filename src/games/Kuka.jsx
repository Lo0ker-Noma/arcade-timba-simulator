import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';

// 🪳 Kuka Exterminator — local first-person cockroach shooter.
// Each player gets 60s to splat as many roaches as possible (point & click).
// Turns are sequential on the same device (P1 then P2); most kills wins the
// round and is reported to the pot. Ties go to a quick reminder to replay.
const W = 640, H = 400, ROUND_MS = 60000, MAX_ROACHES = 6;

function spawnRoach() {
  const edge = Math.random() < 0.5;
  return {
    x: edge ? Math.random() * W : (Math.random() < 0.5 ? -20 : W + 20),
    y: edge ? (Math.random() < 0.5 ? -20 : H + 20) : Math.random() * H,
    vx: (Math.random() * 2 - 1) * 2.2,
    vy: (Math.random() * 2 - 1) * 2.2,
    size: 13 + Math.random() * 7,
    phase: Math.random() * Math.PI * 2,
    turn: Math.random() * 0.1,
  };
}

export default function Kuka({ me, pair, names }) {
  const reportResult = useGameStore((s) => s.reportResult);
  const reportedRef = useRef(false);
  const canvasRef = useRef(null);
  const roachesRef = useRef([]);
  const splatsRef = useRef([]);
  const killsRef = useRef(0);
  const mouseRef = useRef({ x: W / 2, y: H / 2, flash: 0 });

  const [phase, setPhase] = useState('ready0'); // ready0 | play0 | ready1 | play1 | done
  const [kills, setKills] = useState([0, 0]);
  const [timeLeft, setTimeLeft] = useState(60);

  const playerIdx = phase.startsWith('play') ? Number(phase.slice(-1)) : null;

  const startTurn = (idx) => {
    roachesRef.current = Array.from({ length: MAX_ROACHES }, spawnRoach);
    splatsRef.current = [];
    killsRef.current = 0;
    setPhase(`play${idx}`);
  };

  useEffect(() => {
    if (playerIdx === null) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const start = performance.now();
    let raf;

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      mouseRef.current.x = (e.clientX - r.left) * (W / r.width);
      mouseRef.current.y = (e.clientY - r.top) * (H / r.height);
    };
    const onShoot = () => {
      mouseRef.current.flash = 6;
      const { x, y } = mouseRef.current;
      // nearest roach within hitbox
      let best = -1, bestD = Infinity;
      roachesRef.current.forEach((rch, i) => {
        const d = Math.hypot(rch.x - x, rch.y - y);
        if (d < rch.size + 6 && d < bestD) { bestD = d; best = i; }
      });
      if (best >= 0) {
        const rch = roachesRef.current[best];
        splatsRef.current.push({ x: rch.x, y: rch.y, t: 1 });
        roachesRef.current[best] = spawnRoach();
        killsRef.current += 1;
        setKills((k) => { const n = [...k]; n[playerIdx] = killsRef.current; return n; });
      }
    };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mousedown', onShoot);

    const drawRoach = (r) => {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(Math.atan2(r.vy, r.vx));
      const wig = Math.sin(r.phase) * 2;
      // legs
      ctx.strokeStyle = '#2b1b12';
      ctx.lineWidth = 1.5;
      for (let s = -1; s <= 1; s += 2) {
        for (let l = -1; l <= 1; l++) {
          ctx.beginPath();
          ctx.moveTo(l * r.size * 0.3, s * r.size * 0.2);
          ctx.lineTo(l * r.size * 0.3 + s * (4 + wig), s * (r.size * 0.7));
          ctx.stroke();
        }
      }
      // antennae
      ctx.beginPath(); ctx.moveTo(r.size * 0.5, -2); ctx.lineTo(r.size * 0.9, -6 + wig); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r.size * 0.5, 2); ctx.lineTo(r.size * 0.9, 6 - wig); ctx.stroke();
      // body
      const g = ctx.createLinearGradient(-r.size, 0, r.size, 0);
      g.addColorStop(0, '#4a2f1d'); g.addColorStop(1, '#7a4a28');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, 0, r.size, r.size * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      // head
      ctx.fillStyle = '#2b1b12';
      ctx.beginPath(); ctx.ellipse(r.size * 0.6, 0, r.size * 0.3, r.size * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };

    const loop = (now) => {
      const elapsed = now - start;
      const left = Math.max(0, ROUND_MS - elapsed);
      setTimeLeft(Math.ceil(left / 1000));

      // background: dark kitchen floor with vignette
      const bg = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.7);
      bg.addColorStop(0, '#14110d'); bg.addColorStop(1, '#070605');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(120,90,60,0.06)';
      for (let i = 0; i < W; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); }
      for (let j = 0; j < H; j += 40) { ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(W, j); ctx.stroke(); }

      // splats
      splatsRef.current = splatsRef.current.filter((s) => s.t > 0);
      splatsRef.current.forEach((s) => {
        ctx.fillStyle = `rgba(80,40,20,${s.t * 0.6})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, 14 * (1.4 - s.t), 0, Math.PI * 2); ctx.fill();
        s.t -= 0.03;
      });

      // roaches scuttle
      roachesRef.current.forEach((r) => {
        r.phase += 0.4;
        if (Math.random() < 0.03) { r.vx += (Math.random() * 2 - 1); r.vy += (Math.random() * 2 - 1); }
        const sp = Math.hypot(r.vx, r.vy) || 1;
        const max = 3.2; if (sp > max) { r.vx = r.vx / sp * max; r.vy = r.vy / sp * max; }
        r.x += r.vx; r.y += r.vy;
        if (r.x < -30) r.x = W + 30; if (r.x > W + 30) r.x = -30;
        if (r.y < -30) r.y = H + 30; if (r.y > H + 30) r.y = -30;
        drawRoach(r);
      });

      // crosshair + muzzle flash
      const m = mouseRef.current;
      if (m.flash > 0) {
        ctx.fillStyle = `rgba(255,220,120,${m.flash / 6 * 0.5})`;
        ctx.beginPath(); ctx.arc(m.x, m.y, 26, 0, Math.PI * 2); ctx.fill();
        m.flash -= 1;
      }
      ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(m.x, m.y, 14, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(m.x - 20, m.y); ctx.lineTo(m.x - 6, m.y);
      ctx.moveTo(m.x + 6, m.y); ctx.lineTo(m.x + 20, m.y);
      ctx.moveTo(m.x, m.y - 20); ctx.lineTo(m.x, m.y - 6);
      ctx.moveTo(m.x, m.y + 6); ctx.lineTo(m.x, m.y + 20); ctx.stroke();

      if (left <= 0) {
        // end of this turn
        if (playerIdx === 0) setPhase('ready1');
        else setPhase('done');
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mousedown', onShoot);
    };
  }, [phase, playerIdx]);

  // Report winner once both turns are done.
  useEffect(() => {
    if (phase !== 'done' || reportedRef.current) return;
    reportedRef.current = true;
    const wIdx = kills[0] === kills[1] ? 0 : (kills[0] > kills[1] ? 0 : 1);
    reportResult(pair[wIdx]);
  }, [phase, kills, pair, reportResult]);

  const meIdx = pair.indexOf(me);
  const tie = kills[0] === kills[1];
  const winIdx = kills[0] >= kills[1] ? 0 : 1;

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <div className="flex items-center gap-6 pixel text-xs">
        <span className="text-arcade-cyan">{names[pair[0]] || 'P1'}: {kills[0]} 🪳</span>
        {playerIdx !== null && <span className="text-arcade-amber">⏱ {timeLeft}s</span>}
        <span className="text-arcade-amber">{names[pair[1]] || 'P2'}: {kills[1]} 🪳</span>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="rounded-xl border border-amber-900/40 max-w-full"
          style={{ cursor: playerIdx !== null ? 'none' : 'default', boxShadow: '0 0 24px rgba(120,60,20,0.25)' }}
        />

        {(phase === 'ready0' || phase === 'ready1') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 rounded-xl">
            <div className="text-4xl">🪳🔫</div>
            <div className="text-center">
              <div className="text-sm text-slate-300">Turno de</div>
              <div className="pixel text-arcade-cyan">{names[pair[phase === 'ready0' ? 0 : 1]] || (phase === 'ready0' ? 'P1' : 'P2')}</div>
              <div className="text-xs text-slate-500 mt-2">60 segundos · click para exterminar</div>
            </div>
            <button className="btn-neon" onClick={() => startTurn(phase === 'ready0' ? 0 : 1)}>
              Empezar 🔫
            </button>
          </div>
        )}

        {phase === 'done' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/75 rounded-xl">
            <div className="text-4xl animate-flicker">🏆</div>
            {tie ? (
              <div className="text-arcade-amber text-sm">¡Empate a {kills[0]}! Se reporta a {names[pair[0]]} — repetid la ronda si queréis desempate.</div>
            ) : (
              <div className="text-arcade-green text-sm">¡Gana {names[pair[winIdx]]} con {kills[winIdx]} kukas! Reportado al bote.</div>
            )}
          </div>
        )}
      </div>

      <div className="text-xs text-slate-500">
        Apunta con el ratón y <span className="text-arcade-cyan">click</span> para aplastar cucarachas. ¡El que más mate en 60s gana la ronda!
      </div>
      {meIdx === -1 && <div className="text-xs text-amber-400">Modo local: jugáis por turnos en el mismo dispositivo.</div>}
    </div>
  );
}
