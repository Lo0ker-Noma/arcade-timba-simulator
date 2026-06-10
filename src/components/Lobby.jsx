import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { GAMES, WIN_TARGETS, POT_MODES } from '../lib/protocol';
import { isValidLightningAddress } from '../lib/lightning';
import GamePreview from './GamePreview';
import CloseRoomModal from './CloseRoomModal';

export default function Lobby() {
  const { rooms, startLobby, stopLobby, createRoom, joinRoom } = useGameStore();
  const pubkey = useAuthStore((s) => s.pubkey);
  const detectedLn = useAuthStore((s) => s.user?.lud16) || '';
  const [showCreate, setShowCreate] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [lnAddr, setLnAddr] = useState('');
  const [lnTouched, setLnTouched] = useState(false);
  const [closingRoom, setClosingRoom] = useState(null);

  useEffect(() => { startLobby(); return () => stopLobby(); }, []);

  // Auto-fill the Lightning Address from the user's Nostr profile (lud16),
  // unless they've already typed their own.
  useEffect(() => {
    if (detectedLn && !lnTouched && !lnAddr) setLnAddr(detectedLn);
  }, [detectedLn, lnTouched, lnAddr]);

  const list = Object.values(rooms)
    .filter((r) => r.status === 'lobby')
    .sort((a, b) => b.createdAt - a.createdAt);

  const doJoin = async (id) => {
    const target = rooms[id];
    const isFree = target && target.potMode === 'free';
    const addr = lnAddr.trim().toLowerCase();
    if (!isFree && !isValidLightningAddress(addr)) { alert('Pon tu Lightning Address (ej. tu@walletofsatoshi.com) para poder cobrar el bote.'); return; }
    await joinRoom(id, isFree ? '' : addr);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold neon-text text-arcade-cyan">SALAS ABIERTAS</h2>
          <p className="text-sm text-slate-400">Únete a una timba o crea la tuya. El que llegue al objetivo se lleva el bote ⚡</p>
        </div>
        <button className="btn-neon" onClick={() => setShowCreate(true)}>+ Crear sala</button>
      </div>

      <div className="panel p-4 mb-6 flex flex-col sm:flex-row gap-3 items-center">
        <div className="text-sm text-slate-400 whitespace-nowrap">
          Tu Lightning Address
          {detectedLn && lnAddr === detectedLn && (
            <span className="block text-[10px] text-arcade-green">⚡ detectada de tu perfil Nostr</span>
          )}
        </div>
        <input
          className="flex-1 w-full"
          placeholder="tu@walletofsatoshi.com (para cobrar el bote)"
          value={lnAddr}
          onChange={(e) => { setLnTouched(true); setLnAddr(e.target.value); }}
        />
        <div className="flex gap-2 w-full sm:w-auto">
          <input className="flex-1" placeholder="código de sala" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
          <button className="btn-ghost" onClick={() => joinCode && doJoin(joinCode.trim())}>Unirme</button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="text-center text-slate-500 py-12">
          <div className="text-4xl mb-3 animate-flicker">👾</div>
          No hay salas abiertas. ¡Sé el primero en crear una!
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((r) => {
            const g = GAMES[r.currentGame];
            return (
              <div key={r.id} className="panel p-4 hover:border-arcade-cyan/40 transition">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{g?.emoji}</span>
                  <span className="chip text-arcade-amber">🎯 {r.winTarget}</span>
                </div>
                <h3 className="font-bold truncate">{r.name}</h3>
                <div className="text-xs text-slate-500 mb-3">
                  {g?.name} · {r.players.length} jugador(es) · {r.potMode === 'free' ? '🎮 Sin timba' : r.potMode === 'rey' ? '👑 Rey de la pista' : '🪙 Timba'}
                </div>
                <div className="flex items-center justify-between">
                  <span className="pixel text-arcade-green text-xs">
                    {r.potMode === 'free'
                      ? '🎮 gratis'
                      : r.potMode === 'rey'
                        ? `${(r.finalPot || 0).toLocaleString()} sats`
                        : `${(r.potPerPlayer || 0).toLocaleString()} sats c/u`}
                  </span>
                  <div className="flex items-center gap-2">
                    {r.host === pubkey && (
                      <button className="text-xs text-red-400 hover:text-red-300" onClick={() => setClosingRoom(r)}>✕ Cerrar</button>
                    )}
                    <button className="btn-neon !py-2 !px-3 text-xs" onClick={() => doJoin(r.id)}>{r.host === pubkey ? 'Entrar' : 'Unirme'}</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} createRoom={createRoom} defaultLn={lnAddr || detectedLn} detectedLn={detectedLn} />}
      {closingRoom && <CloseRoomModal room={closingRoom} onClose={() => setClosingRoom(null)} onDone={() => {}} />}
    </div>
  );
}

function CreateModal({ onClose, createRoom, defaultLn, detectedLn }) {
  const [name, setName] = useState('');
  const [game, setGame] = useState('connect4');
  const [potMode, setPotMode] = useState('timba');
  const [pot, setPot] = useState(1000);
  const [finalPot, setFinalPot] = useState(10000);
  const [target, setTarget] = useState(7);
  const [ln, setLn] = useState(defaultLn || '');
  const [busy, setBusy] = useState(false);

  const isFree = potMode === 'free';
  const submit = async () => {
    if (!isFree && !isValidLightningAddress(ln)) { alert('Necesitas una Lightning Address válida (será el escrow del bote).'); return; }
    setBusy(true);
    await createRoom({
      name: name || 'Sala arcade', game, winTarget: Number(target),
      hostLnAddress: isFree ? '' : ln.trim().toLowerCase(),
      potMode,
      potPerPlayer: potMode === 'timba' ? Number(pot) : 0,
      finalPot: potMode === 'rey' ? Number(finalPot) : 0,
    });
    setBusy(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel max-w-md w-full p-6">
        <h3 className="text-lg font-bold text-arcade-cyan mb-4">Crear sala</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400">Nombre de la sala</label>
            <input className="w-full mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="La timba del finde" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Juego inicial</label>
            <div className="grid grid-cols-7 gap-2 mt-1">
              {Object.values(GAMES).map((g) => (
                <button key={g.id} onClick={() => setGame(g.id)}
                  className={`p-2 rounded-lg text-center ${game === g.id ? 'bg-arcade-cyan/15 border border-arcade-cyan/40' : 'btn-ghost !p-2'}`}>
                  <div className="text-lg">{g.emoji}</div>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2 mb-1">
              <span className="text-xs font-semibold text-arcade-cyan">{GAMES[game].emoji} {GAMES[game].name}</span>
              <span className="text-[10px] text-slate-500">🌐 online · vs máquina</span>
            </div>
            <GamePreview game={game} />
          </div>
          <div>
            <label className="text-xs text-slate-400">Modalidad</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {Object.values(POT_MODES).map((m) => (
                <button key={m.id} type="button" onClick={() => setPotMode(m.id)}
                  className={`p-2 rounded-lg text-left ${potMode === m.id ? 'bg-arcade-cyan/15 border border-arcade-cyan/40' : 'btn-ghost !p-2'}`}>
                  <div className="text-xs font-semibold">{m.emoji} {m.name}</div>
                  <div className="text-[9px] text-slate-400 leading-tight mt-0.5">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              {isFree ? (
                <>
                  <label className="text-xs text-slate-400">Sin bote</label>
                  <div className="mt-1 px-3 py-2 rounded-lg text-sm text-arcade-cyan" style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.25)' }}>🎮 Gratis</div>
                </>
              ) : potMode === 'timba' ? (
                <>
                  <label className="text-xs text-slate-400">Bote por jugador (sats)</label>
                  <input type="number" min={0} className="w-full mt-1" value={pot} onChange={(e) => setPot(e.target.value)} />
                </>
              ) : (
                <>
                  <label className="text-xs text-slate-400">Bote final que pones tú (sats)</label>
                  <input type="number" min={0} className="w-full mt-1" value={finalPot} onChange={(e) => setFinalPot(e.target.value)} />
                </>
              )}
            </div>
            <div>
              <label className="text-xs text-slate-400">Primero a… victorias</label>
              <select className="w-full mt-1" value={target} onChange={(e) => setTarget(e.target.value)}>
                {WIN_TARGETS.map((t) => <option key={t} value={t}>{t === 1 ? '1 (a una partida)' : t}</option>)}
              </select>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 -mt-2">
            {isFree
              ? '🎮 Sin dinero: jugáis online por la gloria y el ranking. No hace falta Lightning.'
              : potMode === 'timba'
                ? '🪙 Cada jugador paga su parte; el bote es la suma de todos. El pago se confirma solo.'
                : '👑 Tú (admin) pones el bote final. Los jugadores compiten gratis y el ganador se lo lleva.'}
          </div>
          {!isFree && (
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400">Tu Lightning Address (escrow del bote)</label>
                {detectedLn && ln !== detectedLn && (
                  <button type="button" className="text-[10px] text-arcade-green hover:underline" onClick={() => setLn(detectedLn)}>
                    ⚡ usar la de mi perfil
                  </button>
                )}
              </div>
              <input className="w-full mt-1" value={ln} onChange={(e) => setLn(e.target.value)} placeholder="tu@walletofsatoshi.com" />
              {detectedLn && ln === detectedLn
                ? <div className="text-[10px] text-arcade-green mt-1">⚡ detectada de tu perfil Nostr · puedes cambiarla</div>
                : <div className="text-[10px] text-slate-500 mt-1">Puedes escribir otra dirección manualmente.</div>}
            </div>
          )}
          <button className="btn-neon w-full" disabled={busy} onClick={submit}>
            {busy ? 'Creando…' : 'Crear y entrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
