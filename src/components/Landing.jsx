import React from 'react';
import { useAuthStore } from '../store/authStore';
import { GAMES } from '../lib/protocol';

export default function Landing() {
  const initNostr = useAuthStore((s) => s.initNostr);
  const login = async () => {
    if (!window.nostr) { alert('Instala una extensión Nostr (NIP-07) como Alby o nos2x.'); return; }
    await initNostr();
  };

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 arcade-grid opacity-60" />
      <div className="relative max-w-6xl mx-auto px-4 pt-16 pb-12">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="chip text-arcade-green mb-4">🎮 HACKATON #04 · LA CRYPTA</span>
            <h1 className="text-6xl sm:text-7xl font-black tracking-tight leading-none">
              <span className="neon-text text-white">ARCADE</span><br />
              <span className="neon-text-purple text-arcade-purple">TIMBA</span>
            </h1>
            <p className="text-lg text-slate-300 mt-4 max-w-md">
              Juega con tus amigos a clásicos del arcade. Cada uno rellena el <b className="text-arcade-amber">bote</b>,
              configuras a cuántas victorias se gana, y el ganador se lleva todos los <b className="text-arcade-cyan">sats por Lightning</b> automáticamente.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              <button className="btn-neon" onClick={login}>⚡ Entrar con Nostr</button>
              <a className="btn-ghost" href="https://lacrypta.dev/" target="_blank" rel="noreferrer">La Crypta ↗</a>
            </div>
            <div className="flex flex-wrap gap-2 mt-6">
              {Object.values(GAMES).map((g) => (
                <span key={g.id} className="chip text-slate-300">{g.emoji} {g.name}</span>
              ))}
            </div>
          </div>

          <div className="panel p-6 relative">
            <div className="absolute top-4 right-4 chip text-arcade-amber pixel text-[9px]">PRESS START</div>
            <div className="grid grid-cols-8 gap-2">
              {Array.from({ length: 40 }).map((_, i) => {
                const on = [1, 3, 4, 9, 11, 16, 18, 19, 24, 27, 32, 34, 35].includes(i % 40);
                return <div key={i} className="aspect-square rounded-md" style={{ background: on ? '#22d3ee' : 'rgba(34,211,238,0.07)', boxShadow: on ? '0 0 10px rgba(34,211,238,0.6)' : 'none' }} />;
              })}
            </div>
            <div className="flex items-center justify-between mt-5">
              <span className="chip text-arcade-purple pixel text-[9px]">BOSS LEVEL</span>
              <div className="w-10 h-10 rounded-full grid place-items-center text-arcade-amber" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)' }}>⚡</div>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mt-14">
          {[
            ['1. Crea o únete', 'Login con Nostr (NIP-07). Crea una sala y fija el bote y a cuántas victorias se gana.'],
            ['2. Rellenad el bote', 'Cada jugador paga su parte por Lightning al escrow de la sala. El marcador es en tiempo real vía Nostr.'],
            ['3. Cobra automático', 'Al llegar al objetivo, el bote entero se envía al ganador por un zap de Lightning.'],
          ].map(([t, d]) => (
            <div key={t} className="panel p-5">
              <h3 className="font-bold text-arcade-cyan mb-1">{t}</h3>
              <p className="text-sm text-slate-400">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
