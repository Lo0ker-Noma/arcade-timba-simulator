import React, { useEffect, useRef, useState } from 'react';
import { ticTacToeAI } from './ai';

// You (X) vs the machine (O). Score = win:1000-moves·10, draw:500, loss:100.
// Each player plays their own match vs the AI; higher score wins the round.
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const winnerOf = (c) => { for (const [a, b, d] of LINES) if (c[a] && c[a] === c[b] && c[a] === c[d]) return c[a]; return null; };

export default function TicTacToe({ onGameOver, soloMode }) {
  const [cells, setCells] = useState(Array(9).fill(null));
  const [turn, setTurn] = useState('X'); // X = you
  const movesRef = useRef(0);
  const endedRef = useRef(false);

  const finish = (c) => {
    if (endedRef.current) return; endedRef.current = true;
    const w = winnerOf(c);
    const score = w === 'X' ? Math.max(700, 1000 - movesRef.current * 10) : w === 'O' ? 100 : 500;
    setTimeout(() => onGameOver && onGameOver(score), 500);
  };

  // AI move when it's O's turn
  useEffect(() => {
    if (turn !== 'O' || endedRef.current) return;
    const t = setTimeout(() => {
      setCells((prev) => {
        if (winnerOf(prev) || !prev.includes(null)) return prev;
        const i = ticTacToeAI(prev);
        if (i == null || i < 0) return prev;
        const next = [...prev]; next[i] = 'O'; movesRef.current++;
        if (winnerOf(next) || !next.includes(null)) finish(next); else setTurn('X');
        return next;
      });
    }, 420);
    return () => clearTimeout(t);
  }, [turn]);

  const play = (i) => {
    if (turn !== 'X' || cells[i] || endedRef.current) return;
    const next = [...cells]; next[i] = 'X'; movesRef.current++;
    setCells(next);
    if (winnerOf(next) || !next.includes(null)) finish(next); else setTurn('O');
  };

  const w = winnerOf(cells);
  const full = !cells.includes(null);
  const status = w === 'X' ? '¡Ganaste a la máquina!' : w === 'O' ? 'Te ganó la máquina' : full ? 'Empate' : turn === 'X' ? 'Tu turno (X)' : 'La máquina piensa…';

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-sm text-slate-300">{status}</div>
      <div className="grid grid-cols-3 gap-2">
        {cells.map((c, i) => (
          <button key={i} onClick={() => play(i)} disabled={turn !== 'X' || !!c || endedRef.current}
            className={`w-20 h-20 rounded-xl text-3xl font-bold flex items-center justify-center transition
              ${c === 'X' ? 'text-arcade-cyan neon-text' : c === 'O' ? 'text-arcade-pink' : 'text-slate-600'}`}
            style={{ background: 'rgba(10,14,26,0.8)', border: '1px solid rgba(148,163,184,0.18)' }}>
            {c}
          </button>
        ))}
      </div>
      <div className="text-xs text-slate-500">Tú = <span className="text-arcade-cyan">X</span> · Máquina = <span className="text-arcade-pink">O</span></div>
    </div>
  );
}
