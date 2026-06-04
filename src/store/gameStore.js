import { create } from 'zustand';
import { getRelay } from '../lib/nostrRelay';
import {
  ROOM_KIND, MSG_KIND, APP_TAG, GAMES, newRoomId,
  buildRoomEvent, buildMsgEvent, parseContent,
} from '../lib/protocol';
import { useAuthStore } from './authStore';
import { startRealtime, stopRealtime, bindSession } from '../lib/realtime';

const DEV = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;

// In-memory move listeners (game components subscribe to live moves).
const moveListeners = new Set();
export function onGameMessage(fn) {
  moveListeners.add(fn);
  return () => moveListeners.delete(fn);
}

async function signAndPublish(unsigned) {
  const auth = useAuthStore.getState();
  const signed = await auth.signEvent(unsigned);
  if (!signed) return null;
  getRelay().publish(signed);
  return signed;
}

export const useGameStore = create((set, get) => ({
  // Lobby
  rooms: {},            // roomId -> room doc (latest)
  lobbyUnsub: null,

  // Active room
  room: null,           // current room doc
  roomUnsub: null,
  isHost: false,
  funding: { state: 'idle', invoice: null, error: null }, // idle|requesting|invoice|paid|error

  // Single-player / practice mode (no Nostr, no pot) — for testing all games.
  soloMode: false,
  enterSolo: () => set({ soloMode: true }),
  exitSolo: () => set({ soloMode: false }),

  // ---- Lobby subscription ----
  startLobby: () => {
    if (get().lobbyUnsub) return;
    const relay = getRelay();
    const unsub = relay.subscribe(
      { kinds: [ROOM_KIND], '#t': [APP_TAG], limit: 100 },
      (ev) => {
        const room = parseContent(ev);
        if (!room || room.type !== 'room' || typeof room.id !== 'string') return;
        // host authenticity: room doc must be authored by declared host
        if (room.host !== ev.pubkey) return;
        set((s) => {
          const prev = s.rooms[room.id];
          if (prev && prev._ts && prev._ts >= ev.created_at) return s;
          return { rooms: { ...s.rooms, [room.id]: { ...room, _ts: ev.created_at } } };
        });
        // keep active room fresh if it's this one and we're not host
        const cur = get().room;
        if (cur && cur.id === room.id && !get().isHost) {
          set({ room: { ...room, _ts: ev.created_at } });
        }
      }
    );
    set({ lobbyUnsub: unsub });
  },
  stopLobby: () => {
    const u = get().lobbyUnsub;
    if (u) u();
    set({ lobbyUnsub: null, rooms: {} });
  },

  // ---- Create a room (host) ----
  createRoom: async ({ name, game, potPerPlayer, winTarget, hostLnAddress, potMode = 'timba', finalPot = 0 }) => {
    const auth = useAuthStore.getState();
    if (!auth.pubkey) return null;
    const id = newRoomId();
    const profile = auth.user || {};
    const room = {
      v: 1, type: 'room', id,
      name: String(name || 'Sala arcade').slice(0, 60),
      host: auth.pubkey,
      hostLnAddress: String(hostLnAddress).trim().toLowerCase(),
      potMode: potMode === 'rey' ? 'rey' : 'timba',
      potPerPlayer: Math.max(0, Math.floor(potPerPlayer || 0)),
      finalPot: Math.max(0, Math.floor(finalPot || 0)),
      winTarget: Math.floor(winTarget),
      status: 'lobby',
      currentGame: game,
      players: [{
        pubkey: auth.pubkey,
        name: profile.name || 'Host',
        lnAddress: String(hostLnAddress).trim().toLowerCase(),
        // In "rey" mode the host is the bankroll: counts as funded from the start.
        funded: potMode === 'rey',
      }],
      scores: { [auth.pubkey]: 0 },
      round: 0,
      activePair: null,   // [pubkeyA, pubkeyB] currently playing
      winner: null,
      createdAt: Math.floor(Date.now() / 1000),
    };
    const signed = await signAndPublish(buildRoomEvent(room));
    if (!signed) return null;
    set({ room: { ...room, _ts: signed.created_at }, isHost: true });
    get().subscribeRoom(id);
    return id;
  },

  // Host-only: publish updated room doc.
  publishRoom: async (mutator) => {
    if (!get().isHost) return;
    const cur = get().room;
    if (!cur) return;
    const next = typeof mutator === 'function' ? mutator(structuredClone(cur)) : mutator;
    delete next._ts;
    const signed = await signAndPublish(buildRoomEvent(next));
    if (signed) set({ room: { ...next, _ts: signed.created_at } });
  },

  // ---- Subscribe to a single room's channel ----
  subscribeRoom: (roomId) => {
    const prev = get().roomUnsub;
    if (prev) prev();
    const relay = getRelay();
    const unsub = relay.subscribe(
      { kinds: [ROOM_KIND, MSG_KIND], '#d': [roomId], limit: 200 },
      (ev) => {
        if (ev.kind === ROOM_KIND) {
          const room = parseContent(ev);
          if (!room || room.id !== roomId || room.host !== ev.pubkey) return;
          if (!get().isHost) {
            const cur = get().room;
            if (!cur || !cur._ts || ev.created_at >= cur._ts) {
              set({ room: { ...room, _ts: ev.created_at } });
            }
          }
          return;
        }
        if (ev.kind === MSG_KIND) {
          const msg = parseContent(ev);
          if (!msg || typeof msg.type !== 'string') return;
          get()._handleMsg(msg, ev.pubkey);
        }
      }
    );
    set({ roomUnsub: unsub });
  },

  // ---- Join a room (player) ----
  joinRoom: async (roomId, lnAddress) => {
    const room = get().rooms[roomId];
    const auth = useAuthStore.getState();
    if (!auth.pubkey) return false;
    set({ room: room || null, isHost: room?.host === auth.pubkey });
    get().subscribeRoom(roomId);
    if (room?.host === auth.pubkey) return true;
    await signAndPublish(buildMsgEvent(roomId, {
      v: 1, type: 'join',
      name: auth.user?.name || `${auth.pubkey.slice(0, 8)}…`,
      lnAddress: String(lnAddress || '').trim().toLowerCase(),
    }));
    return true;
  },

  leaveRoom: () => {
    const u = get().roomUnsub;
    if (u) u();
    set({ room: null, roomUnsub: null, isHost: false, funding: { state: 'idle', invoice: null, error: null } });
  },

  // ---- Message handling ----
  _handleMsg: (msg, fromPubkey) => {
    const isHost = get().isHost;
    // Session-key binding for realtime (signed by the real key, so trusted).
    if (msg.type === 'session' && typeof msg.sessionPubkey === 'string') {
      bindSession(fromPubkey, msg.sessionPubkey);
      return;
    }
    // Host applies authoritative state transitions
    if (isHost) {
      if (msg.type === 'join') {
        get().publishRoom((r) => {
          if (r.status !== 'lobby') return r;
          if (!r.players.some((p) => p.pubkey === fromPubkey)) {
            r.players.push({
              pubkey: fromPubkey,
              name: String(msg.name || `${fromPubkey.slice(0, 8)}…`).slice(0, 40),
              lnAddress: String(msg.lnAddress || '').trim().toLowerCase(),
              // "rey" mode: players compete for free, so no funding required.
              funded: r.potMode === 'rey',
            });
            r.scores[fromPubkey] = 0;
          }
          return r;
        });
      } else if (msg.type === 'funded') {
        get().publishRoom((r) => {
          const p = r.players.find((x) => x.pubkey === fromPubkey);
          if (p) p.funded = true;
          return r;
        });
      } else if (msg.type === 'gameresult') {
        // A game reported a winner of the current round.
        get()._applyResult(msg, fromPubkey);
      }
    }
    // Everyone forwards moves to local game listeners
    if (msg.type === 'move' || msg.type === 'gamestart' || msg.type === 'gameresult') {
      moveListeners.forEach((fn) => { try { fn(msg, fromPubkey); } catch {} });
    }
  },

  // Host: increment score for round winner, check win target, set winner.
  _applyResult: (msg, fromPubkey) => {
    get().publishRoom((r) => {
      if (r.status !== 'playing') return r;
      const w = msg.winner;
      if (!w || !(w in r.scores)) return r;
      // Only count a result authored by a participant of the active pair.
      if (r.activePair && !r.activePair.includes(fromPubkey)) return r;
      if (r._lastRound === r.round) return r; // dedupe per round
      r.scores[w] = (r.scores[w] || 0) + 1;
      r._lastRound = r.round;
      r.round += 1;
      if (r.scores[w] >= r.winTarget) {
        r.status = 'finished';
        r.winner = w;
      }
      return r;
    });
  },

  // Host: start the match (lobby -> playing) once everyone funded.
  startMatch: async () => {
    if (!get().isHost) return;
    await get().publishRoom((r) => {
      if (r.players.length < 2) return r;
      r.status = 'playing';
      r.round = 1;
      r.activePair = [r.players[0].pubkey, r.players[1].pubkey];
      return r;
    });
    const r = get().room;
    if (r) {
      await signAndPublish(buildMsgEvent(r.id, {
        v: 1, type: 'gamestart', game: r.currentGame, round: r.round, pair: r.activePair,
      }));
    }
  },

  // Host: switch which game is being played.
  setGame: async (game) => {
    if (!get().isHost) return;
    await get().publishRoom((r) => { r.currentGame = game; return r; });
  },

  // Any player publishes a move to the room channel.
  sendMove: async (data) => {
    const r = get().room;
    if (!r) return;
    await signAndPublish(buildMsgEvent(r.id, { v: 1, type: 'move', game: r.currentGame, data }));
  },

  // ---- Realtime (ephemeral session-key) channel for action games ----
  beginRealtime: async () => {
    const r = get().room;
    if (!r) return;
    await startRealtime(r.id, async (m) => {
      await signAndPublish(buildMsgEvent(r.id, { v: 1, ...m }));
    });
  },
  endRealtime: () => stopRealtime(),

  // Report a finished round's winner to the host.
  reportResult: async (winnerPubkey) => {
    const r = get().room;
    if (!r) return;
    await signAndPublish(buildMsgEvent(r.id, {
      v: 1, type: 'gameresult', game: r.currentGame, round: r.round, winner: winnerPubkey,
    }));
  },

  // Funding flow (player pays their share into the escrow / host address).
  setFunding: (f) => set({ funding: { ...get().funding, ...f } }),
  confirmFunded: async () => {
    const r = get().room;
    if (!r) return;
    await signAndPublish(buildMsgEvent(r.id, { v: 1, type: 'funded' }));
    set({ funding: { state: 'paid', invoice: get().funding.invoice, error: null } });
  },
}));
