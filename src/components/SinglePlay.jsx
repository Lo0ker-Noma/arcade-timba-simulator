import React, { useState } from 'react';
import { GAMES } from '../lib/protocol';
import GamePreview from './GamePreview';
import GameStage from './GameStage';
import Connect4 from '../games/Connect4';
import TicTacToe from '../games/TicTacToe';
import Pong from '../games/Pong';
import Tron from '../games/Tron';
import Tetris from '../games/Tetris';
import Kuka from '../games/Kuka';

// Single-player / practice mode: pick any game and play it solo on one device,
// no Nostr login or pot. Turn-based games run in "hotseat" (you control both
// sides). reportResult/sendMove are no-ops here (the game store has no room).
function renderGame(id, round, onGameOver, level) {
  const common = { onGameOver, level };
  const key = `${id}-${round}`;
  switch (id) {
    case 'connect4': return <Connect4 key={key} {...common} />;
    case 'tictactoe': return <TicTacToe key={key} {...common} />;
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
  const [level, setLevel] = useState(1);
  const [lastScore, setLastScore] = useState(null);
  const [lastWon, setLastWon] = useState(false);
  const [total, setTotal] = useState(0);
  const games = Object.values(GAMES);

  const openGame = (id) => { setSel(id); setRound(0); setLevel(1); setTotal(0); setLastScore(null); };
  const replay = () => { setLastScore(null); setRound((r) => r + 1); };
  const onGameOver = (score, won) => {
    setLastScore(score); setLastWon(won); setTotal((t) => t + score);
    if (won) setLevel((l) => l + 1); // win → next level a bit harder
  };

  if (sel) {
    const g = GAMES[sel];
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <button className="text-xs text-slate-400 hover:text-arcade-cyan" onClick={() => setSel(null)}>← Elegir otro juego</button>
          <div className="flex items-center gap-2">
            <span className="glass-chip text-arcade-purple">{g.emoji} {g.name}</span>
            <button className="btn-ghost !py-1.5 !px-3 text-xs" onClick={replay}>↻ Reiniciar</button>
            <button className="btn-ghost !py-1.5 !px-3 text-xs" onClick={onExit}>Salir</button>
          </div>
        </div>

        {/* Big scoreboard: level · last points · running total */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="glass-panel py-3 text-center">
            <div className="text-[10px] tracking-widest text-slate-400">NIVEL</div>
            <div className="pixel text-2xl text-arcade-purple neon-text-purple mt-1">{level}</div>
          </div>
          <div className="glass-panel py-3 text-center">
            <div className="text-[10px] tracking-widest text-slate-400">ÚLTIMA PARTIDA</div>
            <div className="pixel text-2xl text-arcade-cyan neon-text mt-1">{lastScore != null ? lastScore : '—'}</div>
          </div>
          <div className="glass-panel py-3 text-center">
            <div className="text-[10px] tracking-widest text-slate-400">TOTAL</div>
            <div className="pixel text-2xl text-arcade-green mt-1">{total}</div>
          </div>
        </div>

        <div className="glass-panel p-6 min-h-[440px] flex items-center justify-center arcade-grid">
          <GameStage
            key={`${sel}-${round}`}
            render={(handleOver) => renderGame(sel, round, handleOver, level)}
            onGameOver={onGameOver}
            onReplay={replay}
            gameName={`${g.emoji} ${g.name}`}
          />
        </div>

        {lastScore != null ? (
          <div className="text-center mt-3">
            <span className="glass-chip text-arcade-green">
              {lastWon ? `🏆 ¡Ganaste! +${lastScore} pts · subes a nivel ${level}` : `🏁 +${lastScore} pts · sigue en nivel ${level}`}
            </span>
            <button className="btn-neon !py-1.5 !px-4 text-xs ml-2" onClick={replay}>Jugar otra ▶</button>
          </div>
        ) : (
          <p className="text-center text-xs text-slate-500 mt-3">
            Juegas <b className="text-slate-300">contra la máquina</b>. Cada victoria sube el nivel (más difícil = más puntos). En una sala con Nostr, tu puntuación compite por el bote y verás el ranking de todos.
          </p>
        )}
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
          <button key={g.id} onClick={() => openGame(g.id)} className="glass-panel p-3 text-left hover:border-arcade-cyan/40 transition group">
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
