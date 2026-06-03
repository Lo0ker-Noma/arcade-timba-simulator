import React, { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

export default function AuthBar() {
  const { isAuthenticated, user, pubkey, initNostr, checkExistingAuth, logout } = useAuthStore();

  useEffect(() => { checkExistingAuth(); }, [checkExistingAuth]);

  const login = async () => {
    if (!window.nostr) {
      alert('Necesitas una extensión Nostr (NIP-07) como Alby o nos2x para entrar.');
      return;
    }
    await initNostr();
  };

  return (
    <div className="flex items-center gap-3">
      {isAuthenticated ? (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <img
              src={user?.picture}
              alt=""
              className="w-9 h-9 rounded-full border border-arcade-cyan/40"
              onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
            />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-arcade-cyan">{user?.name || 'Jugador'}</div>
              <div className="text-[10px] text-slate-500 font-mono">{pubkey?.slice(0, 10)}…</div>
            </div>
          </div>
          <button className="btn-ghost !py-2 !px-3 text-sm" onClick={logout}>Salir</button>
        </div>
      ) : (
        <button className="btn-neon !py-2 !px-4 text-sm" onClick={login}>
          ⚡ Entrar con Nostr
        </button>
      )}
    </div>
  );
}
