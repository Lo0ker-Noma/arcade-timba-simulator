import React, { useState } from 'react';
import { requestInvoice, hasWebLN, payWithWebLN, pollPaid } from '../lib/lightning';
import { useGameStore } from '../store/gameStore';

// Host closes a room. If the match never started and players already funded
// (timba mode), their contributions are refunded AUTOMATICALLY before closing.
export default function CloseRoomModal({ room, onClose, onDone }) {
  const closeRoomById = useGameStore((s) => s.closeRoomById);
  const leaveRoom = useGameStore((s) => s.leaveRoom);

  // Who gets a refund: funded players (excluding the host, who holds the escrow)
  // with a Lightning Address. Only in timba mode and before the match started.
  const refundable = room.potMode === 'timba' && room.status === 'lobby'
    ? room.players.filter((p) => p.funded && p.pubkey !== room.host && p.lnAddress)
    : [];

  const [state, setState] = useState('confirm'); // confirm|refunding|closing|done|error
  const [progress, setProgress] = useState({}); // pubkey -> 'paying'|'ok'|'fail'
  const [error, setError] = useState('');

  const refundOne = async (p) => {
    setProgress((x) => ({ ...x, [p.pubkey]: 'paying' }));
    try {
      const { invoice, verify } = await requestInvoice(p.lnAddress, room.potPerPlayer, `Reembolso ${room.name}`);
      if (hasWebLN()) {
        try { await payWithWebLN(invoice); setProgress((x) => ({ ...x, [p.pubkey]: 'ok' })); return true; } catch { /* try verify */ }
      }
      if (verify) {
        const paid = await pollPaid(verify, { timeout: 120000 });
        setProgress((x) => ({ ...x, [p.pubkey]: paid ? 'ok' : 'fail' }));
        return paid;
      }
      setProgress((x) => ({ ...x, [p.pubkey]: 'fail' }));
      return false;
    } catch {
      setProgress((x) => ({ ...x, [p.pubkey]: 'fail' }));
      return false;
    }
  };

  const doClose = async () => {
    if (refundable.length) {
      setState('refunding');
      for (const p of refundable) await refundOne(p); // sequential (WebLN prompts one at a time)
    }
    setState('closing');
    await closeRoomById(room.id);
    setState('done');
    if (onDone) onDone();
  };

  const nameOf = (pk) => room.players.find((x) => x.pubkey === pk)?.name || `${pk.slice(0, 6)}…`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && state === 'confirm') onClose(); }}>
      <div className="panel max-w-md w-full p-6">
        <h3 className="text-lg font-bold text-red-400 mb-2">Cerrar sala</h3>

        {state === 'confirm' && (
          <>
            <p className="text-sm text-slate-400 mb-4">
              {refundable.length
                ? <>Se reembolsará automáticamente <b className="text-arcade-cyan">{room.potPerPlayer.toLocaleString()} sats</b> a cada jugador que ya pagó ({refundable.length}) y luego se cerrará la sala.</>
                : <>¿Seguro que quieres cerrar <b className="text-slate-200">{room.name}</b>? Desaparecerá del lobby.</>}
            </p>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={onClose}>Cancelar</button>
              <button className="btn-neon flex-1" style={{ background: 'linear-gradient(135deg,#ef4444,#f97316)' }} onClick={doClose}>
                {refundable.length ? 'Reembolsar y cerrar' : 'Cerrar sala'}
              </button>
            </div>
          </>
        )}

        {(state === 'refunding' || state === 'closing') && (
          <div className="py-2">
            <p className="text-sm text-slate-300 mb-3">{state === 'closing' ? 'Cerrando sala…' : 'Reembolsando a los jugadores…'}</p>
            <div className="space-y-2">
              {refundable.map((p) => (
                <div key={p.pubkey} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300 truncate">{nameOf(p.pubkey)}</span>
                  <span className="text-xs">
                    {progress[p.pubkey] === 'ok' ? <span className="text-arcade-green">✓ reembolsado</span>
                      : progress[p.pubkey] === 'fail' ? <span className="text-red-400">✕ falló</span>
                      : progress[p.pubkey] === 'paying' ? <span className="text-arcade-amber animate-flicker">pagando…</span>
                      : <span className="text-slate-500">en cola</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {state === 'done' && (
          <div className="text-center py-3">
            <div className="text-arcade-green text-3xl mb-2">✓</div>
            <p className="text-arcade-green font-semibold">Sala cerrada{refundable.length ? ' y reembolsos enviados' : ''}.</p>
            {refundable.some((p) => progress[p.pubkey] === 'fail') && (
              <p className="text-[11px] text-amber-400 mt-2">Algún reembolso no se pudo confirmar; revisa tu wallet y reenvía manualmente si hace falta.</p>
            )}
            <button className="btn-ghost mt-4" onClick={() => { leaveRoom(); onClose(); }}>Volver al lobby</button>
          </div>
        )}

        {state === 'error' && (
          <div className="text-center py-2">
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <button className="btn-ghost" onClick={onClose}>Cerrar</button>
          </div>
        )}
      </div>
    </div>
  );
}
