import React from 'react';
import { useAuthStore } from '../store/authStore';
import { GAMES } from '../lib/protocol';
import DotMatrix from './DotMatrix';
import GamesCarousel from './GamesCarousel';

export default function Landing({ onSolo, onDemo }) {
  const initNostr = useAuthStore((s) => s.initNostr);
  const login = async () => {
    if (!window.nostr) { alert('Instala una extensión Nostr (NIP-07) como Alby o nos2x.'); return; }
    await initNostr();
  };

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 arcade-grid opacity-60" />
      <div className="relative max-w-6xl mx-auto px-4 pt-16 pb-12">
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <span className="chip text-arcade-green mb-4">🎮 HACKATON #04 · LA CRYPTA</span>
            <h1 className="text-6xl sm:text-7xl font-black tracking-tight leading-none">
              <span className="glitch neon-text text-white" data-text="ARCADE">ARCADE</span><br />
              <span className="glitch neon-text-purple text-arcade-purple" data-text="TIMBA">TIMBA</span>
            </h1>
            <p className="text-lg text-slate-300 mt-4 max-w-md">
              Juega con tus amigos a clásicos del arcade. Cada uno rellena el <b className="text-arcade-amber">bote</b>,
              configuras a cuántas victorias se gana, y el ganador se lleva todos los <b className="text-arcade-cyan">sats por Lightning</b> automáticamente.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              <button className="btn-neon" onClick={() => onDemo && onDemo()}>▶ Probar sala demo</button>
              <button className="btn-ghost" onClick={login}>⚡ Entrar con Nostr</button>
              <button className="btn-ghost" onClick={onSolo}>🕹️ Single game</button>
              <a className="btn-ghost" href="https://lacrypta.dev/" target="_blank" rel="noreferrer">La Crypta ↗</a>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              <b className="text-arcade-green">Sala demo</b>: juega una timba completa vs un bot — sin login ni sats, en 5 segundos. O entra en <b className="text-slate-300">Single game</b> para probar juegos sueltos.
            </p>
            <div className="flex flex-wrap gap-2 mt-6">
              {Object.values(GAMES).map((g) => (
                <span key={g.id} className="chip text-slate-300">{g.emoji} {g.name}</span>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <GamesCarousel />
            <div className="panel p-6 relative">
              <DotMatrix text="DENLE AMOR ⚡️ HDMP · " />
              <div className="flex items-center justify-between mt-5">
                <span className="chip text-arcade-purple pixel text-[9px]">BOSS LEVEL</span>
                <div className="w-10 h-10 rounded-full grid place-items-center text-arcade-amber" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)' }}>⚡</div>
              </div>
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
