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
  pong: { id: 'pong', name: 'Pong', online: false, players: 2, emoji: '🏓' },
  snake: { id: 'snake', name: 'Snake Duel', online: false, players: 2, emoji: '🐍' },
  tron: { id: 'tron', name: 'Tron', online: false, players: 2, emoji: '🏍️' },
  tetris: { id: 'tetris', name: 'Tetris', online: false, players: 2, emoji: '🧱' },
};

export const WIN_TARGETS = [3, 5, 7, 10, 12];

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
