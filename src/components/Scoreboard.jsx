import React from 'react';
import { totalPot as computePot } from '../lib/protocol';

const MEDAL = ['🥇', '🥈', '🥉'];

export default function Scoreboard({ room }) {
  const isRey = room.potMode === 'rey';
  const isFree = room.potMode === 'free';
  const totalPot = computePot(room);
  const points = room.points || {};
  const playing = room.status !== 'lobby';

  // During play, rank by accumulated points; in lobby, by round wins.
  const players = [...room.players].sort((a, b) => {
    if (playing) return (points[b.pubkey] || 0) - (points[a.pubkey] || 0);
    return (room.scores[b.pubkey] || 0) - (room.scores[a.pubkey] || 0);
  });

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-arcade-cyan">{playing ? 'RANKING' : 'JUGADORES'}</h3>
        <span className="chip text-arcade-amber">🎯 primero a {room.winTarget}</span>
      </div>
      <div className="space-y-2">
        {players.map((p, i) => {
          const wins = room.scores[p.pubkey] || 0;
          const pts = points[p.pubkey] || 0;
          const active = room.activePair?.includes(p.pubkey);
          return (
            <div key={p.pubkey} className={`flex items-center gap-2 p-2 rounded-lg ${active && playing ? 'bg-arcade-cyan/5 border border-arcade-cyan/20' : ''}`}>
              <span className="w-5 text-center text-sm">{playing && i < 3 ? MEDAL[i] : <span className="text-xs text-slate-500">{i + 1}</span>}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate flex items-center gap-2">
                  {p.name}
                  {p.pubkey === room.host && <span className="text-[9px] text-arcade-purple">HOST</span>}
                </div>
                <div className="text-[10px] text-slate-500 flex items-center gap-2">
                  <span className="text-arcade-amber">{wins} 🏅</span>
                  {!playing && (isFree
                    ? <span className="text-arcade-cyan">🎮 listo</span>
                    : isRey
                      ? (p.pubkey === room.host ? <span className="text-arcade-amber">👑 admin</span> : <span className="text-slate-400">compite</span>)
                      : (p.funded ? <span className="text-arcade-green">⚡ pagó</span> : <span className="text-slate-600">sin pagar</span>))}
                </div>
              </div>
              {playing && (
                <div className="text-right">
                  <div className="pixel text-arcade-cyan text-sm">{pts.toLocaleString()}</div>
                  <div className="text-[9px] text-slate-500">pts</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
        <span className="text-xs text-slate-400">{isFree ? 'MODO' : isRey ? 'BOTE DEL ADMIN 👑' : 'BOTE'}</span>
        <span className="pixel text-arcade-green text-sm">{isFree ? '🎮 sin timba' : `${totalPot.toLocaleString()} sats`}</span>
      </div>
    </div>
  );
}
