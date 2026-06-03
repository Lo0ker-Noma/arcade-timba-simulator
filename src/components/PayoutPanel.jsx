import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { requestInvoice, hasWebLN, payWithWebLN } from '../lib/lightning';

// Shown when a room finishes. The escrow holder (host) pays the full pot to the
// winner's Lightning Address. If WebLN is present we try to auto-pay.
export default function PayoutPanel({ room, isHost }) {
  const totalPot = room.potPerPlayer * room.players.filter((p) => p.funded).length;
  const winner = room.players.find((p) => p.pubkey === room.winner);
  const [state, setState] = useState('idle'); // idle|loading|invoice|paying|done|error
  const [invoice, setInvoice] = useState('');
  const [error, setError] = useState('');

  const winnerAddr = winner?.lnAddress;

  const pay = async () => {
    if (!winnerAddr) { setError('El ganador no configuró Lightning Address'); setState('error'); return; }
    setState('loading'); setError('');
    try {
      const inv = await requestInvoice(winnerAddr, totalPot, `Bote ${room.name} 🏆`);
      setInvoice(inv);
      setState('invoice');
      if (hasWebLN()) {
        setState('paying');
        await payWithWebLN(inv);
        setState('done');
      }
    } catch (e) {
      setError(e.message || 'Error'); setState('error');
    }
  };

  // Auto-trigger payout attempt for the host on mount.
  useEffect(() => { if (isHost && state === 'idle') pay(); /* eslint-disable-line */ }, []);

  return (
    <div className="panel p-6 text-center max-w-md mx-auto">
      <div className="text-5xl mb-2 animate-flicker">🏆</div>
      <h2 className="text-2xl font-bold text-arcade-amber neon-text mb-1">¡{winner?.name || 'Ganador'} gana el bote!</h2>
      <p className="text-slate-400 mb-1">{room.scores[room.winner]} victorias · primero a {room.winTarget}</p>
      <div className="text-3xl font-bold text-arcade-green my-3">{totalPot.toLocaleString()} sats</div>

      {!isHost && (
        <p className="text-sm text-slate-400">
          El escrow (host) está enviando el bote a <span className="font-mono text-arcade-cyan">{winnerAddr}</span>.
        </p>
      )}

      {isHost && (
        <div className="mt-2">
          {state === 'loading' && <p className="text-slate-400">Generando factura del ganador…</p>}
          {state === 'paying' && <p className="text-slate-400">Pagando el bote con tu wallet…</p>}
          {state === 'invoice' && (
            <div className="flex flex-col items-center gap-3">
              <div className="bg-white p-3 rounded-xl"><QRCodeSVG value={invoice} size={190} /></div>
              <button className="btn-ghost w-full text-xs break-all" onClick={() => navigator.clipboard.writeText(invoice)}>
                Copiar factura del ganador
              </button>
              <p className="text-[11px] text-slate-500">Paga esta factura para entregar el bote completo al ganador.</p>
              <button className="btn-neon" onClick={() => setState('done')}>Bote enviado ✓</button>
            </div>
          )}
          {state === 'done' && <p className="text-arcade-green font-semibold mt-2">✓ Bote entregado al ganador</p>}
          {state === 'error' && (
            <div>
              <p className="text-red-400 text-sm mb-2">{error}</p>
              <button className="btn-ghost" onClick={pay}>Reintentar pago</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
