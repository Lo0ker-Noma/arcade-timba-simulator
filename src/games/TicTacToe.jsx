import React, { useEffect, useRef, useState } from 'react';
import { useGameStore, onGameMessage } from '../store/gameStore';

// Online turn-based. Board state is derived from the ordered list of moves;
// each move carries its seq so both clients converge deterministically.
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function winnerOf(cells) {
  for (const [a, b, c] of LINES) {
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) return cells[a];
  }
  return null;
}

export default function TicTacToe({ me, pair, names }) {
  const sendMove = useGameStore((s) => s.sendMove);
  const reportResult = useGameStore((s) => s.reportResult);
  const [cells, setCells] = useState(Array(9).fill(null));
  const movesRef = useRef([]);
  const reportedRef = useRef(false);

  const meIdx = pair.indexOf(me);      // 0 -> X, 1 -> O, -1 -> spectator
  const turnIdx = movesRef.current.length % 2;
  const myTurn = meIdx === turnIdx && winnerOf(cells) === null && cells.includes(null);

  const applyMove = (seq, cell, byIdx) => {
    if (seq !== movesRef.current.length) return; // out of order / dupe
    setCells((prev) => {
      if (prev[cell]) return prev;
      const next = [...prev];
      next[cell] = byIdx === 0 ? 'X' : 'O';
      movesRef.current = [...movesRef.current, { cell, byIdx }];
      return next;
    });
  };

  useEffect(() => {
    const off = onGameMessage((msg, from) => {
      if (msg.type !== 'move' || msg.game !== 'tictactoe') return;
      const byIdx = pair.indexOf(from);
      if (byIdx === -1) return;
      const { seq, cell } = msg.data || {};
      if (typeof seq !== 'number' || typeof cell !== 'number') return;
      if (byIdx !== seq % 2) return; // wrong player's turn
      applyMove(seq, cell, byIdx);
    });
    return off;
  }, [pair]);

  // Report winner once a line completes.
  useEffect(() => {
    const w = winnerOf(cells);
    if (w && !reportedRef.current) {
      reportedRef.current = true;
      const winnerPubkey = pair[w === 'X' ? 0 : 1];
      reportResult(winnerPubkey);
    }
  }, [cells, pair, reportResult]);

  const play = (i) => {
    if (!myTurn || cells[i]) return;
    const seq = movesRef.current.length;
    applyMove(seq, i, meIdx);
    sendMove({ seq, cell: i });
  };

  const w = winnerOf(cells);
  const full = !cells.includes(null);
  const status = w
    ? `¡Gana ${names[pair[w === 'X' ? 0 : 1]] || '—'}!`
    : full ? 'Empate — nueva ronda' : myTurn ? 'Tu turno' : meIdx === -1 ? 'Mirando partida' : 'Turno del rival';

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-sm text-slate-300">{status}</div>
      <div className="grid grid-cols-3 gap-2">
        {cells.map((c, i) => (
          <button
            key={i}
            onClick={() => play(i)}
            disabled={!myTurn || !!c}
            className={`w-20 h-20 rounded-xl text-3xl font-bold flex items-center justify-center transition
              ${c === 'X' ? 'text-arcade-cyan neon-text' : c === 'O' ? 'text-arcade-pink' : 'text-slate-600'}
              ${myTurn && !c ? 'hover:border-arcade-cyan/60' : ''}`}
            style={{ background: 'rgba(10,14,26,0.8)', border: '1px solid rgba(148,163,184,0.18)' }}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="text-xs text-slate-500">
        {names[pair[0]] || '?'} = <span className="text-arcade-cyan">X</span> · {names[pair[1]] || '?'} = <span className="text-arcade-pink">O</span>
      </div>
    </div>
  );
}
