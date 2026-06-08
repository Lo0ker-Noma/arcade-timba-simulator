import React, { useEffect, useRef, useState } from 'react';
import { connect4AI } from './ai';

// You (cyan) vs the machine (amber). Score = win:1000-moves·8, draw:500, loss:100.
const COLS = 7, ROWS = 6;
const emptyBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(0));
const dropRow = (b, c) => { for (let r = ROWS - 1; r >= 0; r--) if (b[r][c] === 0) return r; return -1; };
function checkWin(b, p) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (b[r][c] !== p) continue;
    for (const [dr, dc] of dirs) { let n = 1; while (n < 4) { const nr = r + dr * n, nc = c + dc * n; if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || b[nr][nc] !== p) break; n++; } if (n === 4) return true; }
  }
  return false;
}

export default function Connect4({ onGameOver, level = 1 }) {
  const [board, setBoard] = useState(emptyBoard);
  const [turn, setTurn] = useState(1); // 1 = you, 2 = AI
  const [winner, setWinner] = useState(0);
  const movesRef = useRef(0);
  const endedRef = useRef(false);

  const finish = (win, draw) => {
    if (endedRef.current) return; endedRef.current = true;
    const base = win === 1 ? Math.max(700, 1000 - movesRef.current * 8) : win === 2 ? 100 : 500;
    setTimeout(() => onGameOver && onGameOver(base * level, win === 1), 600);
  };

  useEffect(() => {
    if (turn !== 2 || winner || endedRef.current) return;
    const t = setTimeout(() => {
      setBoard((prev) => {
        const col = connect4AI(prev.map((r) => [...r]), level);
        if (col < 0) return prev;
        const r = dropRow(prev, col); if (r === -1) return prev;
        const next = prev.map((row) => [...row]); next[r][col] = 2; movesRef.current++;
        if (checkWin(next, 2)) { setWinner(2); finish(2); }
        else if (next.every((row) => row.every((c) => c))) finish(0, true);
        else setTurn(1);
        return next;
      });
    }, 480);
    return () => clearTimeout(t);
  }, [turn, winner]);

  const play = (col) => {
    if (turn !== 1 || winner || endedRef.current || dropRow(board, col) === -1) return;
    setBoard((prev) => {
      const r = dropRow(prev, col); if (r === -1) return prev;
      const next = prev.map((row) => [...row]); next[r][col] = 1; movesRef.current++;
      if (checkWin(next, 1)) { setWinner(1); finish(1); }
      else if (next.every((row) => row.every((c) => c))) finish(0, true);
      else setTurn(2);
      return next;
    });
  };

  const status = winner === 1 ? '¡Ganaste a la máquina!' : winner === 2 ? 'Te ganó la máquina' : turn === 1 ? 'Tu turno' : 'La máquina piensa…';
  const color = (v) => v === 1 ? '#22d3ee' : v === 2 ? '#f59e0b' : 'transparent';

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-sm text-slate-300">{status}</div>
      <div className="grid grid-cols-7 gap-1 p-2 rounded-xl" style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)' }}>
        {Array.from({ length: COLS }).map((_, c) => (
          <button key={c} onClick={() => play(c)} disabled={turn !== 1 || !!winner || dropRow(board, c) === -1} className="flex flex-col gap-1 px-1 disabled:cursor-not-allowed">
            {Array.from({ length: ROWS }).map((__, r) => (
              <span key={r} className="w-9 h-9 rounded-full" style={{ background: board[r][c] ? color(board[r][c]) : 'rgba(10,14,26,0.9)', boxShadow: board[r][c] ? `0 0 10px ${color(board[r][c])}` : 'inset 0 0 0 1px rgba(148,163,184,0.15)' }} />
            ))}
          </button>
        ))}
      </div>
      <div className="text-xs text-slate-500">Tú = <span style={{ color: '#22d3ee' }}>●</span> · Máquina = <span style={{ color: '#f59e0b' }}>●</span></div>
    </div>
  );
}
