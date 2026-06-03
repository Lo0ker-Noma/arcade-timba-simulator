// Minimal Nostr relay WebSocket client with signature verification.
// All events forwarded to subscribers are verified via nostr-tools.verifyEvent
// to prevent relay-level spoofing of pubkeys / tampered payloads.
import { verifyEvent } from 'nostr-tools';

const DEV = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
const DEFAULT_RELAY = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_NOSTR_RELAY)
  || 'wss://relay.damus.io';

// Only allow wss:// (or ws:// for dev) to stop javascript: / data: injection
function isSafeRelayUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'wss:' || (DEV && u.protocol === 'ws:');
  } catch {
    return false;
  }
}

// Validate an incoming event's shape before attempting signature verification.
function hasValidShape(ev) {
  return !!ev
    && typeof ev.id === 'string' && /^[0-9a-f]{64}$/i.test(ev.id)
    && typeof ev.pubkey === 'string' && /^[0-9a-f]{64}$/i.test(ev.pubkey)
    && typeof ev.sig === 'string' && /^[0-9a-f]{128}$/i.test(ev.sig)
    && typeof ev.created_at === 'number' && Number.isFinite(ev.created_at)
    && typeof ev.kind === 'number'
    && Array.isArray(ev.tags)
    && typeof ev.content === 'string'
    && ev.content.length <= 64 * 1024; // 64KB cap — prevents memory DoS
}

// Wraps nostr-tools.verifyEvent with try/catch and shape check.
export function verifyNostrEvent(ev) {
  try {
    if (!hasValidShape(ev)) return false;
    return verifyEvent(ev);
  } catch {
    return false;
  }
}

export class NostrRelay {
  constructor(url) {
    if (!isSafeRelayUrl(url)) throw new Error('Unsafe relay URL');
    this.url = url;
    this.ws = null;
    this.subs = new Map(); // subId → callback
    this.ready = false;
    this.queue = [];
    this.seenEventIds = new Set(); // dedupe by id
    this._connect();
  }

  _connect() {
    try {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => {
        this.ready = true;
        this.queue.forEach(msg => this.ws.send(msg));
        this.queue = [];
        if (DEV) console.log('[Nostr] Connected');
      };
      this.ws.onmessage = ({ data }) => {
        // Limit message size to avoid memory blow-ups from hostile relays
        if (typeof data !== 'string' || data.length > 128 * 1024) return;
        let msg;
        try { msg = JSON.parse(data); } catch { return; }
        if (!Array.isArray(msg)) return;
        const [type, subId, payload] = msg;
        if (type !== 'EVENT' || typeof subId !== 'string') return;
        if (!this.subs.has(subId)) return;
        if (!verifyNostrEvent(payload)) {
          if (DEV) console.warn('[Nostr] Rejected invalid-signature event');
          return;
        }
        // Dedupe — a hostile relay could re-send the same signed event many times
        if (this.seenEventIds.has(payload.id)) return;
        this.seenEventIds.add(payload.id);
        if (this.seenEventIds.size > 5000) {
          // Keep the set bounded
          this.seenEventIds = new Set(Array.from(this.seenEventIds).slice(-2500));
        }
        try { this.subs.get(subId)(payload); } catch (e) { if (DEV) console.warn('[Nostr] sub callback threw', e); }
      };
      this.ws.onclose = () => {
        this.ready = false;
        if (DEV) console.log('[Nostr] Disconnected, reconnecting...');
        setTimeout(() => this._connect(), 3000);
      };
      this.ws.onerror = () => {
        try { this.ws.close(); } catch {}
      };
    } catch (e) {
      if (DEV) console.warn('[Nostr] connect error', e);
      setTimeout(() => this._connect(), 3000);
    }
  }

  _send(data) {
    const msg = JSON.stringify(data);
    if (this.ready && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    } else {
      if (this.queue.length > 200) return; // don't grow unbounded
      this.queue.push(msg);
    }
  }

  publish(event) {
    if (!hasValidShape(event)) {
      if (DEV) console.warn('[Nostr] refusing to publish malformed event');
      return;
    }
    this._send(['EVENT', event]);
  }

  subscribe(filter, onEvent) {
    const subId = `s${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    this.subs.set(subId, onEvent);
    this._send(['REQ', subId, filter]);
    return () => {
      this._send(['CLOSE', subId]);
      this.subs.delete(subId);
    };
  }
}

// Singleton relay instance
let _relay = null;

export function getRelay() {
  if (!_relay) {
    _relay = new NostrRelay(DEFAULT_RELAY);
  }
  return _relay;
}

// Bech32-safe string sanitizer — remove control chars, cap length.
function cleanStr(raw, maxLen) {
  if (typeof raw !== 'string') return null;
  // Strip C0/C1 controls but keep standard punctuation/emoji
  const cleaned = raw.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
  return cleaned.slice(0, maxLen);
}

function safeUrl(raw, maxLen = 500) {
  if (typeof raw !== 'string') return null;
  if (raw.length > maxLen) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}

// Relays queried in parallel for profile metadata (kind:0). purplepag.es and
// relay.nostr.band specialize in profile/outbox data, so a user's avatar/name
// is far more likely to be found than hitting a single general relay.
const PROFILE_RELAYS = [
  DEFAULT_RELAY,
  'wss://purplepag.es',
  'wss://relay.nostr.band',
  'wss://relay.primal.net',
  'wss://nos.lol',
];

// Parse a verified kind:0 event into a sanitized profile, or null if invalid.
function profileFromEvent(pubkey, event, fallback) {
  let meta;
  try { meta = JSON.parse(event.content); } catch { return null; }
  if (!meta || typeof meta !== 'object') return null;
  // lud16 = LUD-16 Lightning Address (user@domain) declared in kind:0.
  const rawLud16 = cleanStr(meta.lud16, 120);
  const lud16 = rawLud16 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawLud16) ? rawLud16.toLowerCase() : null;
  return {
    pubkey,
    name: cleanStr(meta.display_name, 60) || cleanStr(meta.name, 60) || fallback.name,
    picture: safeUrl(meta.picture) || fallback.picture,
    nip05: cleanStr(meta.nip05, 120) || null,
    about: cleanStr(meta.about, 500) || '',
    lud16,
    _createdAt: typeof event.created_at === 'number' ? event.created_at : 0,
  };
}

// One-shot metadata fetch for a pubkey (kind 0). Races several relays and keeps
// the newest valid (signature-verified) profile. Signatures are verified and
// untrusted string fields are sanitized.
export function fetchNostrProfile(pubkey) {
  return new Promise((resolve) => {
    const fallback = {
      pubkey,
      name: `${pubkey.slice(0, 8)}...`,
      picture: `https://api.dicebear.com/7.x/avataaars/svg?seed=${pubkey}`,
      nip05: null,
      lud16: null,
    };
    if (!/^[0-9a-f]{64}$/i.test(pubkey || '')) { resolve(fallback); return; }

    let resolved = false;
    let best = null;            // newest profile seen so far
    const sockets = [];
    const cleanup = () => { sockets.forEach((ws) => { try { ws.close(); } catch {} }); };
    const finish = (v) => { if (!resolved) { resolved = true; clearTimeout(timer); cleanup(); resolve(v); } };

    // Grace window: once we have a profile, wait briefly for a possibly-newer
    // one from another relay, then resolve with the best.
    let graceTimer = null;
    const settleSoon = () => {
      if (graceTimer) return;
      graceTimer = setTimeout(() => finish(best || fallback), 800);
    };
    const timer = setTimeout(() => finish(best || fallback), 6000);

    const onProfile = (p) => {
      if (!p) return;
      if (!best || p._createdAt > best._createdAt) best = p;
      settleSoon();
    };

    for (const url of PROFILE_RELAYS) {
      if (!isSafeRelayUrl(url)) continue;
      try {
        const ws = new WebSocket(url);
        sockets.push(ws);
        ws.onopen = () => {
          try { ws.send(JSON.stringify(['REQ', 'meta', { kinds: [0], authors: [pubkey], limit: 1 }])); } catch {}
        };
        ws.onmessage = ({ data }) => {
          if (typeof data !== 'string' || data.length > 64 * 1024) return;
          let parsed;
          try { parsed = JSON.parse(data); } catch { return; }
          if (!Array.isArray(parsed)) return;
          const [type, , event] = parsed;
          if (type !== 'EVENT' || !event || event.kind !== 0) return;
          if (!verifyNostrEvent(event)) return;
          onProfile(profileFromEvent(pubkey, event, fallback));
        };
        ws.onerror = () => { try { ws.close(); } catch {} };
      } catch { /* skip this relay */ }
    }
  });
}
