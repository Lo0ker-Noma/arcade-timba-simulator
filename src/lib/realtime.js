// Real-time transport over Nostr using EPHEMERAL SESSION KEYS.
//
// Problem: signing every frame with the NIP-07 extension is impossible (slow,
// would prompt). Solution: at match start each player generates a throwaway
// keypair *in the browser*, announces the binding (realPubkey → sessionPubkey)
// ONCE via a NIP-07-signed message, and then signs all high-frequency game
// events LOCALLY with the session key (schnorr sign ≈ 1ms, no extension).
//
// Receivers map the session pubkey back to the real player via the announced
// binding, so spoofing is still prevented (the binding is signed by the real
// key; the relay verifies every signature).
//
// Events go on an ephemeral kind (24420): relays broadcast them to live
// subscribers but don't store them — perfect for transient gameplay state.
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import { getRelay } from './nostrRelay';

export const RT_KIND = 24420;

let state = null;
// state = { roomId, sk, pk, sessionMap: Map<sessionPk, realPk>, listeners:Set, unsub }

// Start the realtime channel for a room. `announce` is provided by the caller
// and must publish a NIP-07-signed message binding real→session pubkeys.
export async function startRealtime(roomId, announce) {
  if (state && state.roomId === roomId) return state.pk;
  stopRealtime();

  const sk = generateSecretKey();
  const pk = getPublicKey(sk);
  state = { roomId, sk, pk, sessionMap: new Map(), listeners: new Set(), unsub: null };

  const relay = getRelay();
  state.unsub = relay.subscribe({ kinds: [RT_KIND], '#d': [roomId] }, (ev) => {
    if (!state) return;
    if (ev.pubkey === state.pk) return; // ignore our own echoes
    const real = state.sessionMap.get(ev.pubkey);
    if (!real) return; // unknown / unannounced session
    let data;
    try { data = JSON.parse(ev.content); } catch { return; }
    if (!data || typeof data !== 'object') return;
    state.listeners.forEach((fn) => { try { fn(data, real); } catch {} });
  });

  // Announce our session binding on the durable channel (NIP-07 signed).
  try { await announce({ type: 'session', sessionPubkey: pk }); } catch {}
  return pk;
}

// Register a real→session binding learned from a signed 'session' message.
export function bindSession(realPubkey, sessionPubkey) {
  if (!state) return;
  if (!/^[0-9a-f]{64}$/i.test(sessionPubkey || '')) return;
  state.sessionMap.set(sessionPubkey, realPubkey);
}

// Broadcast a realtime game event, signed locally with the session key.
export function sendRealtime(data) {
  if (!state) return;
  try {
    const ev = finalizeEvent({
      kind: RT_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['d', state.roomId]],
      content: JSON.stringify(data),
    }, state.sk);
    getRelay().publish(ev);
  } catch { /* ignore */ }
}

// Subscribe to incoming realtime events. fn(data, realPubkey).
export function onRealtime(fn) {
  if (!state) return () => {};
  state.listeners.add(fn);
  return () => { if (state) state.listeners.delete(fn); };
}

export function realtimeReady() {
  return !!state;
}

export function stopRealtime() {
  if (state?.unsub) { try { state.unsub(); } catch {} }
  state = null;
}
