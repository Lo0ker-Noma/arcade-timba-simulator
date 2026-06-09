import React from 'react';
import { useGameStore } from '../store/gameStore';

// Live in-progress scoreboard shown DURING a round: every participant's score
// updates in real time (via the ephemeral Nostr channel) as they play.
export default function LiveScores({ room, me }) {
  const liveScores = useGameStore((s) => s.liveScores);

  const participants = (room.activePair && room.activePair.length ? room.activePair : room.players.map((p) => p.pubkey));
  const nameOf = (pk) => room.players.find((p) => p.pubkey === pk)?.name || `${pk.slice(0, 6)}…`;
  const rows = participants
    .map((pk) => ({ pk, score: liveScores[pk] || 0 }))
    .sort((a, b) => b.score - a.score);
  const max = Math.max(1, ...rows.map((r) => r.score));

  return (
    <div className="glass-panel p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] tracking-widest text-slate-400">EN VIVO · TODOS JUGANDO</span>
        <span className="text-[10px] text-arcade-cyan animate-flicker">● live</span>
      </div>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={r.pk} className="flex items-center gap-2">
            <span className="w-5 text-center text-xs">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
            <span className={`text-xs w-24 truncate ${r.pk === me ? 'text-arcade-cyan font-bold' : 'text-slate-300'}`}>
              {nameOf(r.pk)}{r.pk === me ? ' (tú)' : ''}
            </span>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.round((r.score / max) * 100)}%`, background: r.pk === me ? '#22d3ee' : '#a855f7' }} />
            </div>
            <span className="pixel text-xs w-12 text-right text-arcade-amber">{r.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
