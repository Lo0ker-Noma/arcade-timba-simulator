import React from 'react';
import Connect4 from '../games/Connect4';
import TicTacToe from '../games/TicTacToe';
import Pong from '../games/Pong';
import Tron from '../games/Tron';

// Re-mounts the game on round change (key) so each round starts fresh.
export default function GameBoard({ room, me }) {
  const pair = room.activePair || [];
  const names = Object.fromEntries(room.players.map((p) => [p.pubkey, p.name]));
  const common = { me, pair, names };
  const key = `${room.currentGame}-${room.round}`;

  switch (room.currentGame) {
    case 'connect4': return <Connect4 key={key} {...common} />;
    case 'tictactoe': return <TicTacToe key={key} {...common} />;
    case 'pong': return <Pong key={key} {...common} />;
    case 'tron': return <Tron key={key} {...common} variant="tron" />;
    case 'snake': return <Tron key={key} {...common} variant="snake" />;
    default: return <div className="text-slate-400">Juego desconocido</div>;
  }
}
