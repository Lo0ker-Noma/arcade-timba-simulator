import { create } from 'zustand';
import { nip19 } from 'nostr-tools';
import { fetchNostrProfile } from '../lib/nostrRelay';

const DEV = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;

function isValidHexPubkey(str) {
  return typeof str === 'string' && /^[0-9a-f]{64}$/i.test(str);
}

// Use nostr-tools nip19 (audited, full checksum verification) — never trust
// raw client input to address a user. Reject anything > 200 chars or non-string.
function decodePubkeyInput(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 200) return null;
  if (isValidHexPubkey(trimmed)) return trimmed.toLowerCase();
  try {
    const { type, data } = nip19.decode(trimmed);
    if (type === 'npub' && isValidHexPubkey(data)) return data.toLowerCase();
  } catch {}
  return null;
}

export const useAuthStore = create((set, get) => ({
  isAuthenticated: false,
  user: null,
  pubkey: null,
  nostrWindow: null,
  isReadOnly: false,

  // NIP-07 login (browser extension)
  initNostr: async () => {
    if (!window.nostr) return false;
    try {
      const pubkey = await window.nostr.getPublicKey();
      if (!isValidHexPubkey(pubkey)) return false;
      set({ pubkey, isAuthenticated: true, nostrWindow: window.nostr, isReadOnly: false });
      // Fetch real Nostr profile (kind:0) with name + avatar
      const userData = await fetchNostrProfile(pubkey);
      set({ user: userData });
      return true;
    } catch (error) {
      if (DEV) console.error('Error connecting to Nostr:', error);
      return false;
    }
  },

  // Login with npub or hex pubkey — read-only mode
  loginWithPubkey: async (input) => {
    const hexPubkey = decodePubkeyInput(input);
    if (!hexPubkey) return false;

    const userData = await fetchNostrProfile(hexPubkey);
    set({
      pubkey: hexPubkey,
      user: userData,
      isAuthenticated: true,
      nostrWindow: null,
      isReadOnly: true,
    });
    return true;
  },

  // Sign a Nostr event (NIP-07 only)
  signEvent: async (event) => {
    if (get().isReadOnly) {
      if (DEV) console.warn('Cannot sign in read-only mode');
      return null;
    }
    if (!window.nostr) return null;
    try {
      return await window.nostr.signEvent(event);
    } catch (error) {
      if (DEV) console.error('Error signing event:', error);
      return null;
    }
  },

  // Check for existing NIP-07 session on app load
  checkExistingAuth: async () => {
    if (!window.nostr) return;
    try {
      const pubkey = await window.nostr.getPublicKey();
      if (!isValidHexPubkey(pubkey)) return;
      const userData = await fetchNostrProfile(pubkey);
      set({
        pubkey,
        user: userData,
        isAuthenticated: true,
        nostrWindow: window.nostr,
        isReadOnly: false,
      });
    } catch {
      if (DEV) console.log('No existing NIP-07 auth');
    }
  },

  logout: () => {
    set({ isAuthenticated: false, user: null, pubkey: null, nostrWindow: null, isReadOnly: false });
  },
}));
