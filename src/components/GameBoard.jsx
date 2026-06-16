import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { GAMES } from '../lib/protocol';
import GameStage from './GameStage';
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
  const sendLive = useGameStore((s) => s.sendLive);
  const pubkey = useAuthStore((s) => s.pubkey);
  // Local, button-driven match counter: a new match only starts when the player
  // presses "SIGUIENTE PARTIDA", so we keep playing rounds until winTarget.
  const [matchKey, setMatchKey] = useState(0);
  const [submittedRound, setSubmittedRound] = useState(null);

  const onGameOver = (score) => { setSubmittedRound(room.round); sendLive(score); submitScore(score); };
  const key = `${room.currentGame}-${matchKey}`;
  // Everyone plays the same difficulty each round (= round number), so it's fair.
  const level = room.round || 1;

  // The host advances room.round once every player has submitted the current
  // round, so a higher room.round means our match was scored and the next one
  // is ready. Until then we wait for the rest of the players.
  const roundResolved = submittedRound != null && room.round > submittedRound;
  const myWins = room.scores?.[pubkey] || 0;
  const nextMatch = () => { setSubmittedRound(null); setMatchKey((k) => k + 1); };

  const renderGame = (handleOver) => {
    // onProgress streams the in-progress score to the live table.
    const common = { onGameOver: handleOver, level, onProgress: sendLive };
    switch (room.currentGame) {
      case 'connect4': return <Connect4 key={key} {...common} />;
      case 'tictactoe': return <TicTacToe key={key} {...common} />;
      case 'pong': return <Pong key={key} {...common} />;
      case 'tron': return <Tron key={key} {...common} variant="tron" />;
      case 'snake': return <Tron key={key} {...common} variant="snake" />;
      case 'tetris': return <Tetris key={key} {...common} />;
      case 'kuka': return <Kuka key={key} {...common} />;
      default: return <div className="text-slate-400">Juego desconocido</div>;
    }
  };

  return (
    <div className="w-full">
      <GameStage
        key={key}
        render={renderGame}
        onGameOver={onGameOver}
        onReplay={nextMatch}
        replayDisabled={!roundResolved}
        replayLabel={roundResolved ? '▶ SIGUIENTE PARTIDA' : '⏳ ESPERANDO A LOS DEMÁS…'}
        replayHint={roundResolved
          ? `Llevas ${myWins}/${room.winTarget} victorias · sigue jugando hasta ganar el bote`
          : 'Tu intento está enviado · esperando a que todos terminen su ronda'}
        gameName={GAMES[room.currentGame] ? `${GAMES[room.currentGame].emoji} ${GAMES[room.currentGame].name}` : 'el arcade'}
      />
    </div>
  );
}
