import { create } from 'zustand';
import { getRelay } from '../lib/nostrRelay';
import {
  ROOM_KIND, MSG_KIND, APP_TAG, GAMES, newRoomId,
  buildRoomEvent, buildMsgEvent, parseContent, clampScore,
} from '../lib/protocol';
import { useAuthStore } from './authStore';
import { startRealtime, stopRealtime, bindSession, onRealtime, sendRealtime } from '../lib/realtime';

const DEV = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;

// In-memory move listeners (game components subscribe to live moves).
const moveListeners = new Set();
export function onGameMessage(fn) {
  moveListeners.add(fn);
  return () => moveListeners.delete(fn);
}

// Host-only, in-memory tally of per-round scores: { round: { pubkey: score } }.
const roundScoreStore = {};

// A plausible score for the demo bot per game/round, so the simulated rival is
// beatable but real — sometimes you win the round, sometimes CryptoBot does.
function demoBotScore(game, level) {
  const lvl = Math.max(1, level || 1);
  const rnd = (a, b) => Math.floor(a + Math.random() * (b - a));
  switch (game) {
    case 'kuka': return rnd(6, 16) * lvl;
    case 'pong': return rnd(3, 9) * lvl;
    case 'tron':
    case 'snake': return rnd(1500, 5000) * lvl;
    case 'connect4':
    case 'tictactoe': return [100, 500, 800][rnd(0, 3)] * lvl;
    case 'tetris': return rnd(800, 4000);
    default: return rnd(200, 800) * lvl;
  }
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
  demo: false,          // local single-device demo room (no Nostr, no Lightning)
  funding: { state: 'idle', invoice: null, error: null }, // idle|requesting|invoice|paid|error

  // Live in-progress scores broadcast during a round: { pubkey: score }.
  liveScores: {},
  _liveOff: null,

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
      hostLnAddress: String(hostLnAddress || '').trim().toLowerCase(),
      potMode: ['free', 'rey', 'timba'].includes(potMode) ? potMode : 'timba',
      potPerPlayer: Math.max(0, Math.floor(potPerPlayer || 0)),
      finalPot: Math.max(0, Math.floor(finalPot || 0)),
      winTarget: Math.floor(winTarget),
      status: 'lobby',
      currentGame: game,
      players: [{
        pubkey: auth.pubkey,
        name: profile.name || 'Host',
        lnAddress: String(hostLnAddress || '').trim().toLowerCase(),
        // No payment needed in "free"; host is the bankroll in "rey".
        funded: potMode === 'rey' || potMode === 'free',
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

  // ---- One-click DEMO room (no Nostr, no Lightning, no 2nd player) ----
  // Drops the human straight into a "Rey de la pista" room vs a simulated bot,
  // both already funded, so anyone can experience the full pot/round/payout
  // loop in 5 seconds. All authority runs locally; nothing is signed/published.
  startDemoRoom: () => {
    const human = useAuthStore.getState().pubkey;
    if (!human) return;
    for (const k in roundScoreStore) delete roundScoreStore[k]; // clear stale tallies
    const bot = 'bot-' + newRoomId();
    const room = {
      v: 1, type: 'room', id: 'demo-' + newRoomId(),
      name: 'Sala Demo · 👑 Rey de la pista',
      host: bot, hostLnAddress: '',
      potMode: 'rey', potPerPlayer: 0, finalPot: 5000,
      winTarget: 3,
      status: 'playing', currentGame: 'kuka',
      players: [
        { pubkey: human, name: 'Tú', lnAddress: '', funded: true },
        { pubkey: bot, name: '🤖 CryptoBot', lnAddress: '', funded: true },
      ],
      scores: { [human]: 0, [bot]: 0 },
      points: { [human]: 0, [bot]: 0 },
      round: 1,
      activePair: [human, bot],
      winner: null,
      demo: true,
      createdAt: Math.floor(Date.now() / 1000),
    };
    set({ room, isHost: true, demo: true });
  },

  // Host-only: publish updated room doc. In demo, mutate locally (no signing).
  publishRoom: async (mutator) => {
    const cur = get().room;
    if (!cur) return;
    if (get().demo) {
      const next = typeof mutator === 'function' ? mutator(structuredClone(cur)) : mutator;
      delete next._ts;
      set({ room: next });
      return;
    }
    if (!get().isHost) return;
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
    const wasDemo = get().demo;
    set({ room: null, roomUnsub: null, isHost: false, demo: false, funding: { state: 'idle', invoice: null, error: null } });
    // Leaving a demo drops the throwaway identity → back to the landing page.
    if (wasDemo) useAuthStore.getState().logout();
  },

  // ---- Host closes/cancels a room ----
  // Marks the (replaceable) room doc as 'closed' so it drops out of the lobby.
  // Works from inside the room or from the lobby list (by id).
  closeRoomById: async (roomId) => {
    const auth = useAuthStore.getState();
    const cur = get().room && get().room.id === roomId ? get().room : get().rooms[roomId];
    if (!cur || cur.host !== auth.pubkey) return false;
    const next = structuredClone(cur);
    delete next._ts;
    next.status = 'closed';
    const signed = await signAndPublish(buildRoomEvent(next));
    if (!signed) return false;
    // reflect locally
    set((s) => ({
      rooms: { ...s.rooms, [roomId]: { ...next, _ts: signed.created_at } },
      room: s.room && s.room.id === roomId ? { ...next, _ts: signed.created_at } : s.room,
    }));
    return true;
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
              // No payment needed in "free"/"rey": players compete without funding.
              funded: r.potMode === 'rey' || r.potMode === 'free',
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
        // A game reported a winner of the current round (legacy path).
        get()._applyResult(msg, fromPubkey);
      } else if (msg.type === 'score') {
        // Score-attack model: each player plays vs the machine and submits a
        // score; higher score wins the round.
        get()._recordScore(msg, fromPubkey);
      }
    }
    // Everyone forwards to local game listeners
    if (msg.type === 'move' || msg.type === 'gamestart' || msg.type === 'gameresult' || msg.type === 'score') {
      moveListeners.forEach((fn) => { try { fn(msg, fromPubkey); } catch {} });
    }
  },

  // Host: record a participant's score for the current round; once every active
  // participant has submitted, the highest score wins the round.
  _recordScore: (msg, fromPubkey) => {
    const r = get().room;
    if (!r || r.status !== 'playing') return;
    if (!r.activePair || !r.activePair.includes(fromPubkey)) return;
    const round = Number(msg.round);
    if (!Number.isFinite(round) || round !== r.round) return;
    roundScoreStore[round] = roundScoreStore[round] || {};
    if (roundScoreStore[round][fromPubkey] == null) {
      // Anti-cheat: clamp the client-reported score to a plausible ceiling.
      roundScoreStore[round][fromPubkey] = clampScore(r.currentGame, round, msg.score);
    }
    const participants = r.activePair;
    const got = roundScoreStore[round];
    if (!participants.every((p) => got[p] != null)) return; // wait for everyone
    // winner = highest score this round
    let winner = participants[0];
    for (const p of participants) if (got[p] > got[winner]) winner = p;
    get().publishRoom((rr) => {
      if (rr._lastRound === round || rr.status !== 'playing') return rr;
      rr.scores[winner] = (rr.scores[winner] || 0) + 1;
      rr.points = rr.points || {};
      participants.forEach((p) => { rr.points[p] = (rr.points[p] || 0) + (got[p] || 0); });
      rr._lastRound = round;
      rr.lastRoundScores = { ...got, winner };
      rr.round += 1;
      if (rr.scores[winner] >= rr.winTarget) { rr.status = 'finished'; rr.winner = winner; }
      return rr;
    });
  },

  // Player: submit this round's score (vs the machine) to the host.
  submitScore: async (score) => {
    const r = get().room;
    if (!r) return;
    // Demo: record our score locally and have the bot answer with a plausible
    // one, so the round resolves on a single device with no relay.
    if (get().demo) {
      const human = useAuthStore.getState().pubkey;
      get()._recordScore({ round: r.round, score }, human);
      const bot = r.players.find((p) => p.pubkey !== human)?.pubkey;
      const r2 = get().room;
      if (bot && r2 && r2.status === 'playing') {
        get()._recordScore({ round: r.round, score: demoBotScore(r2.currentGame, r2.round) }, bot);
      }
      return;
    }
    const auth = useAuthStore.getState();
    const payload = { v: 1, type: 'score', round: r.round, score: Math.round(Number(score) || 0) };
    // Host records its own score locally too (idempotent), in case the relay
    // doesn't echo the author's own event back.
    if (get().isHost && auth.pubkey) get()._recordScore(payload, auth.pubkey);
    await signAndPublish(buildMsgEvent(r.id, payload));
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
      // All players participate each round (vs the machine); highest score wins.
      r.activePair = r.players.map((p) => p.pubkey);
      r.points = r.points || {};
      r.players.forEach((p) => { if (r.points[p.pubkey] == null) r.points[p.pubkey] = 0; });
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

  // ---- Realtime (ephemeral session-key) channel for live in-progress scores ----
  beginRealtime: async () => {
    if (get().demo) return; // demo has no relay / live channel
    const r = get().room;
    if (!r) return;
    await startRealtime(r.id, async (m) => {
      await signAndPublish(buildMsgEvent(r.id, { v: 1, ...m }));
    });
    // Collect other players' live (in-progress) scores.
    const off = onRealtime((data, from) => {
      if (data.t !== 'live') return;
      set((s) => ({ liveScores: { ...s.liveScores, [from]: Number(data.score) || 0 } }));
    });
    set({ _liveOff: off, liveScores: {} });
  },
  endRealtime: () => {
    const off = get()._liveOff;
    if (off) off();
    stopRealtime();
    set({ liveScores: {}, _liveOff: null });
  },
  // Broadcast my in-progress score (signed locally with the session key) and
  // reflect it in my own live table immediately.
  sendLive: (score) => {
    const auth = useAuthStore.getState();
    const s = Math.round(Number(score) || 0);
    if (auth.pubkey) set((st) => ({ liveScores: { ...st.liveScores, [auth.pubkey]: s } }));
    sendRealtime({ t: 'live', score: s });
  },
  resetLive: () => set({ liveScores: {} }),

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
