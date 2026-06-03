import React, { useEffect, useState } from 'react';
import { GAMES } from '../lib/protocol';
import GamePreview from './GamePreview';

const DESC = {
  connect4: 'Alinea 4 fichas antes que tu rival.',
  tictactoe: 'El tres en raya de toda la vida.',
  pong: 'El clásico duelo de palas a 5 puntos.',
  snake: 'Crece sin chocar — duelo de serpientes.',
  tron: 'Estelas de luz: encierra a tu rival.',
  tetris: 'Encaja piezas; el que se desborde pierde.',
  kuka: 'Aplasta cucarachas en 60s. ¡El que más mate gana!',
};

export default function GamesCarousel() {
  const games = Object.values(GAMES);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((p) => (p + 1) % games.length), 3200);
    return () => clearInterval(t);
  }, [paused, games.length]);

  const g = games[i];

  return (
    <div
      className="glass-panel p-5"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold tracking-wide text-slate-300/90">LOS JUEGOS</span>
        <span className="glass-chip text-[10px] text-arcade-cyan">
          {g.online ? '🌐 online' : '🕹️ local'}
        </span>
      </div>

      <div key={g.id} className="fade-in">
        <GamePreview game={g.id} />
        <div className="flex items-center gap-3 mt-3">
          <span className="text-3xl">{g.emoji}</span>
          <div className="min-w-0">
            <div className="font-bold text-white leading-tight">{g.name}</div>
            <div className="text-xs text-slate-300/80 truncate">{DESC[g.id]}</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 mt-4">
        {games.map((gg, idx) => (
          <button
            key={gg.id}
            onClick={() => setI(idx)}
            aria-label={gg.name}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: idx === i ? 22 : 8,
              background: idx === i ? '#22d3ee' : 'rgba(255,255,255,0.25)',
              boxShadow: idx === i ? '0 0 8px rgba(34,211,238,0.6)' : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}
