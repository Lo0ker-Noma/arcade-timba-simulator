import React from 'react';
import { totalPot as computePot } from '../lib/protocol';

export default function Scoreboard({ room }) {
  const players = [...room.players].sort((a, b) => (room.scores[b.pubkey] || 0) - (room.scores[a.pubkey] || 0));
  const isRey = room.potMode === 'rey';
  const totalPot = computePot(room);

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-arcade-cyan">MARCADOR</h3>
        <span className="chip text-arcade-amber">🎯 primero a {room.winTarget}</span>
      </div>
      <div className="space-y-2">
        {players.map((p, i) => {
          const wins = room.scores[p.pubkey] || 0;
          const active = room.activePair?.includes(p.pubkey);
          return (
            <div key={p.pubkey} className={`flex items-center gap-3 p-2 rounded-lg ${active ? 'bg-arcade-cyan/5 border border-arcade-cyan/20' : ''}`}>
              <span className="text-xs text-slate-500 w-4">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate flex items-center gap-2">
                  {p.name}
                  {p.pubkey === room.host && <span className="text-[9px] text-arcade-purple">HOST</span>}
                </div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  {isRey
                    ? (p.pubkey === room.host ? <span className="text-arcade-amber">👑 admin (bote)</span> : <span className="text-slate-400">🎮 compite</span>)
                    : (p.funded ? <span className="text-arcade-green">⚡ pagó</span> : <span className="text-slate-600">sin pagar</span>)}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: room.winTarget }).map((_, k) => (
                  <span key={k} className={`w-2 h-4 rounded-sm ${k < wins ? 'bg-arcade-amber' : 'bg-slate-800'}`} />
                ))}
                <span className="ml-2 pixel text-arcade-amber text-sm w-6 text-right">{wins}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
        <span className="text-xs text-slate-400">{isRey ? 'BOTE DEL ADMIN 👑' : 'BOTE ACTUAL'}</span>
        <span className="pixel text-arcade-green text-sm">{totalPot.toLocaleString()} sats</span>
      </div>
    </div>
  );
}
