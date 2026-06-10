import React, { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { GAMES, totalPot } from '../lib/protocol';
import Scoreboard from './Scoreboard';
import GameBoard from './GameBoard';
import LiveScores from './LiveScores';
import FundingModal from './FundingModal';
import PayoutPanel from './PayoutPanel';
import CloseRoomModal from './CloseRoomModal';

export default function Room() {
  const room = useGameStore((s) => s.room);
  const isHost = useGameStore((s) => s.isHost);
  const startMatch = useGameStore((s) => s.startMatch);
  const setGame = useGameStore((s) => s.setGame);
  const leaveRoom = useGameStore((s) => s.leaveRoom);
  const beginRealtime = useGameStore((s) => s.beginRealtime);
  const endRealtime = useGameStore((s) => s.endRealtime);
  const resetLive = useGameStore((s) => s.resetLive);
  const pubkey = useAuthStore((s) => s.pubkey);
  const [showFund, setShowFund] = useState(false);
  const [showClose, setShowClose] = useState(false);

  const status = room?.status;
  const round = room?.round;
  // Open the realtime channel while the match is underway (for live scores).
  useEffect(() => {
    if (status === 'playing') { beginRealtime(); return () => endRealtime(); }
  }, [status, beginRealtime, endRealtime]);
  // Clear the live table each new round.
  useEffect(() => { resetLive(); }, [round, resetLive]);

  if (!room) return null;
  const me = room.players.find((p) => p.pubkey === pubkey);
  const isRey = room.potMode === 'rey';
  const isFree = room.potMode === 'free';
  const canStart = room.players.length >= 2 && (isRey || isFree || room.players.every((p) => p.funded));
  const game = GAMES[room.currentGame];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-3">
            <button className="text-xs text-slate-500 hover:text-arcade-cyan" onClick={leaveRoom}>← Salir de la sala</button>
            {isHost && room.status !== 'finished' && (
              <button className="text-xs text-red-400 hover:text-red-300" onClick={() => setShowClose(true)}>✕ Cerrar sala</button>
            )}
          </div>
          <h1 className="text-xl font-bold mt-1">{room.name}</h1>
          <div className="text-xs text-slate-500 font-mono">
            sala {room.id.slice(0, 8)} · {isFree
              ? '🎮 Sin timba · gratis'
              : isRey
                ? `👑 Rey de la pista · bote ${room.finalPot.toLocaleString()} sats`
                : `🪙 Timba · ${room.potPerPlayer.toLocaleString()} sats/jugador`}
          </div>
        </div>
        <span className={`chip ${room.status === 'playing' ? 'text-arcade-green' : room.status === 'finished' ? 'text-arcade-amber' : 'text-slate-400'}`}>
          {room.status === 'lobby' ? '⏳ esperando' : room.status === 'playing' ? '🎮 en juego' : '🏆 terminada'}
        </span>
      </div>

      <div className="grid md:grid-cols-[300px_1fr] gap-4">
        <div className="space-y-4">
          <Scoreboard room={room} />

          {room.status === 'lobby' && (
            <div className="panel p-4 space-y-3">
              {isFree ? (
                <div className="text-center text-sm text-arcade-cyan">🎮 Sin timba — jugáis gratis por el ranking.</div>
              ) : isRey ? (
                <div className="text-center text-sm">
                  <div className="text-arcade-amber">👑 Bote del admin: <b>{room.finalPot.toLocaleString()} sats</b></div>
                  <div className="text-slate-400 text-xs mt-1">
                    {isHost ? 'Tú pones el bote. Pagarás al ganador al final.' : 'Juegas gratis. El ganador se lleva el bote del admin.'}
                  </div>
                </div>
              ) : !me?.funded ? (
                <button className="btn-neon w-full" onClick={() => setShowFund(true)}>
                  ⚡ Pagar mi parte ({room.potPerPlayer.toLocaleString()} sats)
                </button>
              ) : (
                <div className="text-center text-arcade-green text-sm">✓ Ya pusiste tu parte</div>
              )}
              {isHost && (
                <button className="btn-ghost w-full" disabled={!canStart} onClick={startMatch}>
                  {canStart ? 'Empezar partida' : isRey ? 'Esperando jugadores…' : 'Esperando que todos paguen…'}
                </button>
              )}
              <p className="text-[11px] text-slate-500 text-center">
                Comparte el código <span className="font-mono text-arcade-cyan">{room.id.slice(0, 8)}</span> con tus amigos.
              </p>
            </div>
          )}

          {isHost && room.status === 'playing' && (
            <div className="panel p-4">
              <div className="text-xs text-slate-400 mb-2">Cambiar juego (host)</div>
              <div className="grid grid-cols-3 gap-2">
                {Object.values(GAMES).map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGame(g.id)}
                    className={`p-2 rounded-lg text-xs ${room.currentGame === g.id ? 'bg-arcade-cyan/15 border border-arcade-cyan/40 text-arcade-cyan' : 'btn-ghost !py-2 !px-2'}`}
                  >
                    <div className="text-lg">{g.emoji}</div>
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="panel p-6 min-h-[420px] flex items-center justify-center arcade-grid">
          {room.status === 'finished' ? (
            <PayoutPanel room={room} isHost={isHost} />
          ) : room.status === 'playing' ? (
            <div className="w-full">
              <div className="text-center mb-3">
                <span className="chip text-arcade-purple">{game?.emoji} {game?.name}</span>
                <span className="ml-2 text-[11px] text-slate-400">ronda {room.round} · juegas vs la máquina</span>
                {room.lastRoundScores && (
                  <div className="text-[11px] text-arcade-green mt-1">
                    Ronda anterior: {room.players.find((p) => p.pubkey === room.lastRoundScores.winner)?.name || '—'} ganó
                  </div>
                )}
              </div>
              <LiveScores room={room} me={pubkey} />
              <GameBoard key={room.round} room={room} />
            </div>
          ) : (
            <div className="text-center text-slate-500">
              <div className="text-5xl mb-3 animate-flicker">{game?.emoji}</div>
              <div className="pixel text-arcade-amber press-start text-lg my-3">PRESS START</div>
              <div>{canStart ? (isHost ? 'Pulsa “Empezar partida” para arrancar.' : 'Esperando a que el host arranque…') : 'Esperando jugadores…'}</div>
              <div className="text-xs mt-2">{room.players.length} en la sala</div>
            </div>
          )}
        </div>
      </div>

      {showFund && <FundingModal room={room} onClose={() => setShowFund(false)} />}
      {showClose && <CloseRoomModal room={room} onClose={() => setShowClose(false)} onDone={() => {}} />}
    </div>
  );
}
