import React, { useState } from 'react';
import { GAMES } from '../lib/protocol';
import GamePreview from './GamePreview';
import Connect4 from '../games/Connect4';
import TicTacToe from '../games/TicTacToe';
import Pong from '../games/Pong';
import Tron from '../games/Tron';
import Tetris from '../games/Tetris';
import Kuka from '../games/Kuka';

// Single-player / practice mode: pick any game and play it solo on one device,
// no Nostr login or pot. Turn-based games run in "hotseat" (you control both
// sides). reportResult/sendMove are no-ops here (the game store has no room).
const PAIR = ['p1', 'p2'];
const NAMES = { p1: 'Jugador 1', p2: 'Jugador 2' };

function renderGame(id, round) {
  const common = { me: 'p1', pair: PAIR, names: NAMES };
  const key = `${id}-${round}`;
  switch (id) {
    case 'connect4': return <Connect4 key={key} {...common} hotseat />;
    case 'tictactoe': return <TicTacToe key={key} {...common} hotseat />;
    case 'pong': return <Pong key={key} {...common} />;
    case 'tron': return <Tron key={key} {...common} variant="tron" />;
    case 'snake': return <Tron key={key} {...common} variant="snake" />;
    case 'tetris': return <Tetris key={key} {...common} />;
    case 'kuka': return <Kuka key={key} {...common} />;
    default: return null;
  }
}

export default function SinglePlay({ onExit }) {
  const [sel, setSel] = useState(null);
  const [round, setRound] = useState(0);
  const games = Object.values(GAMES);

  if (sel) {
    const g = GAMES[sel];
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <button className="text-xs text-slate-400 hover:text-arcade-cyan" onClick={() => setSel(null)}>← Elegir otro juego</button>
          <div className="flex items-center gap-2">
            <span className="glass-chip text-arcade-purple">{g.emoji} {g.name}</span>
            <button className="btn-ghost !py-1.5 !px-3 text-xs" onClick={() => setRound((r) => r + 1)}>↻ Reiniciar</button>
            <button className="btn-ghost !py-1.5 !px-3 text-xs" onClick={onExit}>Salir</button>
          </div>
        </div>
        <div className="glass-panel p-6 min-h-[440px] flex items-center justify-center arcade-grid">
          {renderGame(sel, round)}
        </div>
        <p className="text-center text-xs text-slate-500 mt-3">
          Modo práctica en solitario · sin bote ni login. Para jugar <b className="text-slate-300">online con un amigo a la vez</b>, entra a una sala con Nostr.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold neon-text text-arcade-cyan">SINGLE GAME</h2>
          <p className="text-sm text-slate-400">Prueba cualquier juego solo, sin login ni bote. Ideal para testear y dar feedback 🎮</p>
        </div>
        <button className="btn-ghost" onClick={onExit}>← Volver al inicio</button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {games.map((g) => (
          <button key={g.id} onClick={() => { setSel(g.id); setRound(0); }} className="glass-panel p-3 text-left hover:border-arcade-cyan/40 transition group">
            <GamePreview game={g.id} />
            <div className="flex items-center gap-2 mt-3">
              <span className="text-2xl">{g.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{g.name}</div>
                <div className="text-[10px] text-slate-400">{g.online ? '🌐 online por turnos' : '🕹️ local'}</div>
              </div>
              <span className="btn-neon !py-1.5 !px-3 text-xs group-hover:scale-105 transition">Jugar ▶</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
