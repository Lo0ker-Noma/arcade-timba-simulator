// Nostr-based arcade room protocol.
//
// Two event kinds over a public relay, every event signed (verified in
// nostrRelay.js so pubkeys can't be spoofed):
//
//   ROOM_KIND  (30420, parameterized-replaceable): the authoritative room
//              document, authored ONLY by the host. Latest replaces previous.
//              Used for lobby discovery and shared room/scoreboard state.
//
//   MSG_KIND   (2420, regular append-only): signed messages from any player —
//              join requests, funding confirmations, and in-game moves.
//
// Both carry a single-letter indexable tag ['d', roomId] so a subscription on
// {'#d':[roomId]} receives the room doc and all messages. Lobby discovery uses
// the ['t', APP_TAG] tag on the room doc.

export const ROOM_KIND = 30420;
export const MSG_KIND = 2420;
export const APP_TAG = 'arcade-timba-v1';

export const GAMES = {
  connect4: { id: 'connect4', name: 'Conecta 4', online: true, players: 2, emoji: '🔴' },
  tictactoe: { id: 'tictactoe', name: 'Tic Tac Toe', online: true, players: 2, emoji: '⭕' },
  pong: { id: 'pong', name: 'Pong', online: true, players: 2, emoji: '🏓' },
  snake: { id: 'snake', name: 'Snake Duel', online: true, players: 2, emoji: '🐍' },
  tron: { id: 'tron', name: 'Tron', online: true, players: 2, emoji: '🏍️' },
  tetris: { id: 'tetris', name: 'Tetris', online: true, players: 2, emoji: '🧱' },
  kuka: { id: 'kuka', name: 'Kuka Exterminator', online: true, players: 2, emoji: '🪳' },
};

export const WIN_TARGETS = [1, 3, 5, 7, 10, 12];

// Pot modes:
//  - timba: every player contributes the same sats; pot = sum of contributions.
//  - rey:   an admin (host) puts up the whole final pot; players compete free
//           and the winner takes the admin's pot ("Rey de la pista").
export const POT_MODES = {
  free: { id: 'free', name: 'Sin timba', emoji: '🎮', desc: 'Juega online gratis, solo por la gloria y el ranking.' },
  timba: { id: 'timba', name: 'Timba', emoji: '🪙', desc: 'Cada jugador aporta los mismos sats al bote.' },
  rey: { id: 'rey', name: 'Rey de la pista', emoji: '👑', desc: 'El admin pone el bote final; los demás juegan gratis.' },
};

// Total pot in sats for a room, regardless of mode.
export function totalPot(room) {
  if (!room) return 0;
  if (room.potMode === 'free') return 0;
  if (room.potMode === 'rey') return Math.max(0, Math.floor(room.finalPot || 0));
  const funded = (room.players || []).filter((p) => p.funded).length;
  return Math.max(0, Math.floor(room.potPerPlayer || 0)) * funded;
}

// Anti-cheat: scores are computed client-side (each player vs the machine), so
// a tampered client could submit an absurd number when real sats are on the
// line. The HOST clamps every incoming score to a plausible ceiling per game
// and level before counting it. Ceilings are deliberately generous — they only
// cut off the physically impossible (e.g. 999999), never a great honest run.
const SCORE_CEILINGS = {
  connect4: (lvl) => 1200 * lvl,   // base ≤1000 × level
  tictactoe: (lvl) => 1200 * lvl,
  pong: (lvl) => 60 * lvl,         // goals scored × level
  tron: (lvl) => 14000 * lvl,      // survival secs ×100 (+3000 win) × level
  snake: (lvl) => 14000 * lvl,
  tetris: () => 80000,             // raw Tetris score (not level-scaled)
  kuka: (lvl) => 250 * lvl,        // kills × level over 60s
};

export function clampScore(game, level, score) {
  const n = Number(score);
  if (!Number.isFinite(n) || n < 0) return 0;
  const lvl = Math.max(1, Math.floor(Number(level) || 1));
  const ceil = SCORE_CEILINGS[game];
  const max = ceil ? ceil(lvl) : 100000;
  return Math.min(Math.floor(n), Math.floor(max));
}

export function newRoomId() {
  const a = new Uint8Array(8);
  (globalThis.crypto || window.crypto).getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Build the unsigned ROOM_KIND event for a room document.
export function buildRoomEvent(room) {
  return {
    kind: ROOM_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', room.id],
      ['t', APP_TAG],
    ],
    content: JSON.stringify(room),
  };
}

// Build an unsigned MSG_KIND event.
export function buildMsgEvent(roomId, msg) {
  return {
    kind: MSG_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['d', roomId]],
    content: JSON.stringify(msg),
  };
}

// Safe parse of event content with a size guard already enforced upstream.
export function parseContent(ev) {
  try {
    const data = JSON.parse(ev.content);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}
