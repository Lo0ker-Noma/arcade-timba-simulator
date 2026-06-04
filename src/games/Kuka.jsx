import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { onRealtime, sendRealtime } from '../lib/realtime';

// 🪳 Kuka Exterminator — ONLINE & simultaneous. Both players run their own 60s
// roach-shooting session at the same time and stream their kill count; you see
// the opponent's score live. Most kills when both finish wins the round.
const W = 560, H = 360, ROUND_MS = 60000, MAX_ROACHES = 6;

function spawnRoach() {
  const edge = Math.random() < 0.5;
  return {
    x: edge ? Math.random() * W : (Math.random() < 0.5 ? -20 : W + 20),
    y: edge ? (Math.random() < 0.5 ? -20 : H + 20) : Math.random() * H,
    vx: (Math.random() * 2 - 1) * 2.2, vy: (Math.random() * 2 - 1) * 2.2,
    size: 13 + Math.random() * 7, phase: Math.random() * Math.PI * 2,
  };
}

export default function Kuka({ me, pair, names }) {
  const reportResult = useGameStore((s) => s.reportResult);
  const reportedRef = useRef(false);
  const canvasRef = useRef(null);
  const roaches = useRef([]);
  const splats = useRef([]);
  const killsRef = useRef(0);
  const mouse = useRef({ x: W / 2, y: H / 2, flash: 0 });

  const [kills, setKills] = useState(0);
  const [oppKills, setOppKills] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [done, setDone] = useState(false);
  const [over, setOver] = useState(null);

  const meIdx = pair.indexOf(me);
  const oppIdx = meIdx === 0 ? 1 : 0;
  const finals = useRef({ me: null, opp: null });

  const tryResolve = () => {
    const f = finals.current;
    if (f.me == null || f.opp == null || reportedRef.current) return;
    reportedRef.current = true;
    const winIdx = f.me >= f.opp ? meIdx : oppIdx; // tie → me (host de-dupes)
    setOver(pair[winIdx]);
    reportResult(pair[winIdx]);
  };

  useEffect(() => {
    const off = onRealtime((data, from) => {
      if (from !== pair[oppIdx] || data.t !== 'k') return;
      setOppKills(data.kills);
      if (data.done) { finals.current.opp = data.kills; tryResolve(); }
    });
    return off;
  }, [pair, oppIdx]);

  useEffect(() => {
    if (meIdx === -1) return; // spectator: no play
    roaches.current = Array.from({ length: MAX_ROACHES }, spawnRoach);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const start = performance.now();
    let raf, lastSend = 0;

    const onMove = (e) => { const r = canvas.getBoundingClientRect(); mouse.current.x = (e.clientX - r.left) * (W / r.width); mouse.current.y = (e.clientY - r.top) * (H / r.height); };
    const onShoot = () => {
      if (finals.current.me != null) return;
      mouse.current.flash = 6; const { x, y } = mouse.current;
      let best = -1, bestD = Infinity;
      roaches.current.forEach((rch, i) => { const d = Math.hypot(rch.x - x, rch.y - y); if (d < rch.size + 6 && d < bestD) { bestD = d; best = i; } });
      if (best >= 0) { splats.current.push({ x: roaches.current[best].x, y: roaches.current[best].y, t: 1 }); roaches.current[best] = spawnRoach(); killsRef.current++; setKills(killsRef.current); }
    };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mousedown', onShoot);

    const drawRoach = (r) => {
      ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(Math.atan2(r.vy, r.vx)); const wig = Math.sin(r.phase) * 2;
      ctx.strokeStyle = '#2b1b12'; ctx.lineWidth = 1.5;
      for (let s = -1; s <= 1; s += 2) for (let l = -1; l <= 1; l++) { ctx.beginPath(); ctx.moveTo(l * r.size * 0.3, s * r.size * 0.2); ctx.lineTo(l * r.size * 0.3 + s * (4 + wig), s * (r.size * 0.7)); ctx.stroke(); }
      const g = ctx.createLinearGradient(-r.size, 0, r.size, 0); g.addColorStop(0, '#4a2f1d'); g.addColorStop(1, '#7a4a28');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r.size, r.size * 0.6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#2b1b12'; ctx.beginPath(); ctx.ellipse(r.size * 0.6, 0, r.size * 0.3, r.size * 0.35, 0, 0, 7); ctx.fill(); ctx.restore();
    };

    const loop = (now) => {
      const elapsed = now - start, left = Math.max(0, ROUND_MS - elapsed);
      setTimeLeft(Math.ceil(left / 1000));
      const bg = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.7); bg.addColorStop(0, '#14110d'); bg.addColorStop(1, '#070605');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      splats.current = splats.current.filter((s) => s.t > 0);
      splats.current.forEach((s) => { ctx.fillStyle = `rgba(80,40,20,${s.t * 0.6})`; ctx.beginPath(); ctx.arc(s.x, s.y, 14 * (1.4 - s.t), 0, 7); ctx.fill(); s.t -= 0.03; });
      if (left > 0) roaches.current.forEach((r) => {
        r.phase += 0.4; if (Math.random() < 0.03) { r.vx += (Math.random() * 2 - 1); r.vy += (Math.random() * 2 - 1); }
        const sp = Math.hypot(r.vx, r.vy) || 1, max = 3.2; if (sp > max) { r.vx = r.vx / sp * max; r.vy = r.vy / sp * max; }
        r.x += r.vx; r.y += r.vy;
        if (r.x < -30) r.x = W + 30; if (r.x > W + 30) r.x = -30; if (r.y < -30) r.y = H + 30; if (r.y > H + 30) r.y = -30;
        drawRoach(r);
      });
      const m = mouse.current;
      if (m.flash > 0) { ctx.fillStyle = `rgba(255,220,120,${m.flash / 6 * 0.5})`; ctx.beginPath(); ctx.arc(m.x, m.y, 26, 0, 7); ctx.fill(); m.flash -= 1; }
      ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(m.x, m.y, 14, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(m.x - 20, m.y); ctx.lineTo(m.x - 6, m.y); ctx.moveTo(m.x + 6, m.y); ctx.lineTo(m.x + 20, m.y); ctx.moveTo(m.x, m.y - 20); ctx.lineTo(m.x, m.y - 6); ctx.moveTo(m.x, m.y + 6); ctx.lineTo(m.x, m.y + 20); ctx.stroke();

      if (now - lastSend > 300) { lastSend = now; sendRealtime({ t: 'k', kills: killsRef.current, done: false }); }
      if (left <= 0 && finals.current.me == null) {
        finals.current.me = killsRef.current; setDone(true);
        sendRealtime({ t: 'k', kills: killsRef.current, done: true });
        tryResolve();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); canvas.removeEventListener('mousemove', onMove); canvas.removeEventListener('mousedown', onShoot); };
  }, [meIdx, pair]);

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <div className="flex items-center gap-6 pixel text-xs">
        <span className="text-arcade-cyan">{names[pair[meIdx]] || 'Tú'}: {kills} 🪳</span>
        <span className="text-arcade-amber">⏱ {timeLeft}s</span>
        <span className="text-slate-300">{names[pair[oppIdx]] || 'Rival'}: {oppKills} 🪳</span>
      </div>
      <div className="relative">
        <canvas ref={canvasRef} width={W} height={H} className="rounded-xl border border-amber-900/40 max-w-full" style={{ cursor: meIdx !== -1 && !done ? 'none' : 'default', boxShadow: '0 0 24px rgba(120,60,20,0.25)' }} />
        {done && !over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 rounded-xl">
            <div className="text-3xl">⏱</div><div className="text-sm text-slate-300">Tu tiempo acabó. Esperando al rival…</div>
          </div>
        )}
        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/75 rounded-xl">
            <div className="text-4xl animate-flicker">🏆</div>
            <div className="text-arcade-green text-sm">{over === pair[meIdx] ? '¡Ganaste la ronda!' : `Gana ${names[over]}`} ({kills} vs {oppKills})</div>
          </div>
        )}
        {meIdx === -1 && <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl text-amber-400 text-sm">Mirando partida</div>}
      </div>
      <div className="text-xs text-slate-500">Apunta y <span className="text-arcade-cyan">click</span> para aplastar. ¡Más kukas que tu rival en 60s gana!</div>
    </div>
  );
}
