import React from 'react';
import { useAuthStore } from './store/authStore';
import { useGameStore } from './store/gameStore';
import AuthBar from './components/AuthBar';
import Landing from './components/Landing';
import Lobby from './components/Lobby';
import Room from './components/Room';

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const room = useGameStore((s) => s.room);

  return (
    <div className="min-h-screen crt">
      <header className="sticky top-0 z-30 border-b border-slate-800/60 backdrop-blur bg-arcade-bg/70">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">👾</span>
            <span className="font-bold tracking-tight">Arcade <span className="text-arcade-purple">Timba</span></span>
            <span className="chip text-[9px] text-slate-500 hidden sm:inline">LIGHTNING ARCADE</span>
          </div>
          <AuthBar />
        </div>
      </header>

      <main>
        {!isAuthenticated ? <Landing /> : room ? <Room /> : <Lobby />}
      </main>

      <footer className="text-center text-xs text-slate-600 py-8">
        Construido con Bitcoin ⚡ Lightning + Nostr · Hackaton #04{' '}
        <a className="text-arcade-cyan hover:underline" href="https://lacrypta.dev/" target="_blank" rel="noreferrer">lacrypta.dev</a>
      </footer>
    </div>
  );
}
