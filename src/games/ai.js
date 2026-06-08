// Simple AI opponents for the turn-based games (you vs the machine).

// ---- Connect 4 ---- board[r][c]: 0 empty, 1 you, 2 AI. Returns a column.
const C4_ROWS = 6, C4_COLS = 7;
function c4DropRow(board, col) { for (let r = C4_ROWS - 1; r >= 0; r--) if (board[r][col] === 0) return r; return -1; }
function c4Wins(board, player) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < C4_ROWS; r++) for (let c = 0; c < C4_COLS; c++) {
    if (board[r][c] !== player) continue;
    for (const [dr, dc] of dirs) {
      let n = 1;
      while (n < 4) { const nr = r + dr * n, nc = c + dc * n; if (nr < 0 || nr >= C4_ROWS || nc < 0 || nc >= C4_COLS || board[nr][nc] !== player) break; n++; }
      if (n === 4) return true;
    }
  }
  return false;
}
export function connect4AI(board) {
  const valid = [];
  for (let c = 0; c < C4_COLS; c++) if (c4DropRow(board, c) !== -1) valid.push(c);
  if (!valid.length) return -1;
  // win now
  for (const c of valid) { const r = c4DropRow(board, c); board[r][c] = 2; const w = c4Wins(board, 2); board[r][c] = 0; if (w) return c; }
  // block your win
  for (const c of valid) { const r = c4DropRow(board, c); board[r][c] = 1; const w = c4Wins(board, 1); board[r][c] = 0; if (w) return c; }
  // avoid giving you an immediate win on top
  const safe = valid.filter((c) => {
    const r = c4DropRow(board, c); board[r][c] = 2;
    let bad = false; const r2 = c4DropRow(board, c);
    if (r2 !== -1) { board[r2][c] = 1; if (c4Wins(board, 1)) bad = true; board[r2][c] = 0; }
    board[r][c] = 0; return !bad;
  });
  const pool = safe.length ? safe : valid;
  // center-biased
  pool.sort((a, b) => Math.abs(3 - a) - Math.abs(3 - b));
  const top = pool.slice(0, Math.min(2, pool.length));
  return top[(Math.random() * top.length) | 0];
}

// ---- Tic Tac Toe ---- cells: array(9) of 'X'(you) | 'O'(ai) | null. Returns index.
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
function tttWinner(c) { for (const [a, b, d] of LINES) if (c[a] && c[a] === c[b] && c[a] === c[d]) return c[a]; return null; }
function minimax(cells, ai) {
  const w = tttWinner(cells);
  if (w === 'O') return { s: 10 };
  if (w === 'X') return { s: -10 };
  if (cells.every((x) => x)) return { s: 0 };
  let best = ai ? { s: -Infinity } : { s: Infinity };
  for (let i = 0; i < 9; i++) {
    if (cells[i]) continue;
    cells[i] = ai ? 'O' : 'X';
    const r = minimax(cells, !ai); cells[i] = null;
    if (ai ? r.s > best.s : r.s < best.s) best = { s: r.s, i };
  }
  return best;
}
export function ticTacToeAI(cells) {
  // small chance of a non-optimal move so it's beatable
  const empties = cells.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
  if (!empties.length) return -1;
  if (Math.random() < 0.12) return empties[(Math.random() * empties.length) | 0];
  return minimax([...cells], true).i ?? empties[0];
}
