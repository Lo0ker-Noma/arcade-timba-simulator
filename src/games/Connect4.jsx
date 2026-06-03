import React, { useEffect, useRef, useState } from 'react';
import { useGameStore, onGameMessage } from '../store/gameStore';

// 7x6 Connect Four, online turn-based. Same deterministic move-replay model
// as TicTacToe: moves are columns, board rebuilt from the ordered sequence.
const COLS = 7;
const ROWS = 6;

function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function dropRow(board, col) {
  for (let r = ROWS - 1; r >= 0; r--) if (board[r][col] === 0) return r;
  return -1;
}

function checkWin(board, player) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] !== player) continue;
      for (const [dr, dc] of dirs) {
        let n = 1;
        while (n < 4) {
          const nr = r + dr * n, nc = c + dc * n;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== player) break;
          n++;
        }
        if (n === 4) return true;
      }
    }
  }
  return false;
}

export default function Connect4({ me, pair, names }) {
  const sendMove = useGameStore((s) => s.sendMove);
  const reportResult = useGameStore((s) => s.reportResult);
  const [board, setBoard] = useState(emptyBoard);
  const movesRef = useRef([]);
  const reportedRef = useRef(false);
  const [winner, setWinner] = useState(0);

  const meIdx = pair.indexOf(me); // 0 -> red(1), 1 -> yellow(2)
  const turnIdx = movesRef.current.length % 2;
  const myTurn = meIdx === turnIdx && winner === 0;

  const applyMove = (seq, col, byIdx) => {
    if (seq !== movesRef.current.length) return;
    setBoard((prev) => {
      const r = dropRow(prev, col);
      if (r === -1) return prev;
      const next = prev.map((row) => [...row]);
      const player = byIdx === 0 ? 1 : 2;
      next[r][col] = player;
      movesRef.current = [...movesRef.current, { col, byIdx }];
      if (checkWin(next, player)) setWinner(player);
      return next;
    });
  };

  useEffect(() => {
    const off = onGameMessage((msg, from) => {
      if (msg.type !== 'move' || msg.game !== 'connect4') return;
      const byIdx = pair.indexOf(from);
      if (byIdx === -1) return;
      const { seq, col } = msg.data || {};
      if (typeof seq !== 'number' || typeof col !== 'number') return;
      if (byIdx !== seq % 2) return;
      applyMove(seq, col, byIdx);
    });
    return off;
  }, [pair]);

  useEffect(() => {
    if (winner && !reportedRef.current) {
      reportedRef.current = true;
      reportResult(pair[winner - 1]);
    }
  }, [winner, pair, reportResult]);

  const play = (col) => {
    if (!myTurn || dropRow(board, col) === -1) return;
    const seq = movesRef.current.length;
    applyMove(seq, col, meIdx);
    sendMove({ seq, col });
  };

  const status = winner
    ? `¡Gana ${names[pair[winner - 1]] || '—'}!`
    : myTurn ? 'Tu turno' : meIdx === -1 ? 'Mirando partida' : 'Turno del rival';

  const color = (v) => v === 1 ? '#22d3ee' : v === 2 ? '#f59e0b' : 'transparent';

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-sm text-slate-300">{status}</div>
      <div className="grid grid-cols-7 gap-1 p-2 rounded-xl" style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)' }}>
        {Array.from({ length: COLS }).map((_, c) => (
          <button
            key={c}
            onClick={() => play(c)}
            disabled={!myTurn || dropRow(board, c) === -1}
            className="flex flex-col gap-1 px-1 group disabled:cursor-not-allowed"
          >
            {Array.from({ length: ROWS }).map((__, r) => (
              <span
                key={r}
                className="w-9 h-9 rounded-full"
                style={{
                  background: board[r][c] ? color(board[r][c]) : 'rgba(10,14,26,0.9)',
                  boxShadow: board[r][c] ? `0 0 10px ${color(board[r][c])}` : 'inset 0 0 0 1px rgba(148,163,184,0.15)',
                }}
              />
            ))}
          </button>
        ))}
      </div>
      <div className="text-xs text-slate-500">
        {names[pair[0]] || '?'} = <span style={{ color: '#22d3ee' }}>●</span> · {names[pair[1]] || '?'} = <span style={{ color: '#f59e0b' }}>●</span>
      </div>
    </div>
  );
}
