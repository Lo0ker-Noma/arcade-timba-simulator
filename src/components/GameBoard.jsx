import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import Connect4 from '../games/Connect4';
import TicTacToe from '../games/TicTacToe';
import Pong from '../games/Pong';
import Tron from '../games/Tron';
import Tetris from '../games/Tetris';
import Kuka from '../games/Kuka';

// In a room, each player plays their own session vs the machine and submits a
// score; the host awards the round to the higher score.
export default function GameBoard({ room }) {
  const submitScore = useGameStore((s) => s.submitScore);
  const [submitted, setSubmitted] = useState(false);

  const onGameOver = (score) => { setSubmitted(true); submitScore(score); };
  const key = `${room.currentGame}-${room.round}`;
  // Everyone plays the same difficulty each round (= round number), so it's fair.
  const level = room.round || 1;
  const common = { onGameOver, level };

  let game = null;
  switch (room.currentGame) {
    case 'connect4': game = <Connect4 key={key} {...common} />; break;
    case 'tictactoe': game = <TicTacToe key={key} {...common} />; break;
    case 'pong': game = <Pong key={key} {...common} />; break;
    case 'tron': game = <Tron key={key} {...common} variant="tron" />; break;
    case 'snake': game = <Tron key={key} {...common} variant="snake" />; break;
    case 'tetris': game = <Tetris key={key} {...common} />; break;
    case 'kuka': game = <Kuka key={key} {...common} />; break;
    default: game = <div className="text-slate-400">Juego desconocido</div>;
  }

  // reset the "submitted" flag whenever a new round mounts
  return (
    <div className="w-full">
      {game}
      {submitted && (
        <div className="text-center text-xs text-arcade-amber mt-3 animate-flicker">
          Tu intento está enviado · esperando a que el rival termine su ronda…
        </div>
      )}
    </div>
  );
}
