import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { requestInvoice, hasWebLN, payWithWebLN } from '../lib/lightning';
import { useGameStore } from '../store/gameStore';

// Player funds their share of the pot by paying an invoice from the room's
// escrow Lightning Address (the host's address — Option A).
export default function FundingModal({ room, onClose }) {
  const confirmFunded = useGameStore((s) => s.confirmFunded);
  const [state, setState] = useState('idle'); // idle|loading|invoice|paying|done|error
  const [invoice, setInvoice] = useState('');
  const [error, setError] = useState('');

  const sats = room.potPerPlayer;
  const escrow = room.hostLnAddress;

  const generate = async () => {
    setState('loading'); setError('');
    try {
      const inv = await requestInvoice(escrow, sats, `Bote ${room.name} · ${room.id.slice(0, 6)}`);
      setInvoice(inv);
      setState('invoice');
      if (hasWebLN()) {
        setState('paying');
        await payWithWebLN(inv);
        await confirmFunded();
        setState('done');
      }
    } catch (e) {
      setError(e.message || 'Error');
      setState('error');
    }
  };

  const markPaid = async () => { await confirmFunded(); setState('done'); };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="panel max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-arcade-amber mb-1">⚡ Pon tu parte del bote</h3>
        <p className="text-sm text-slate-400 mb-4">
          Aportas <span className="text-arcade-cyan font-bold">{sats.toLocaleString()} sats</span> al bote.
          Se pagan al escrow de la sala (<span className="font-mono text-xs">{escrow}</span>) y el ganador se lo lleva entero.
        </p>

        {state === 'idle' && (
          <button className="btn-neon w-full" onClick={generate}>Generar factura</button>
        )}
        {state === 'loading' && <div className="text-center text-slate-400 py-6">Resolviendo Lightning Address…</div>}
        {state === 'paying' && <div className="text-center text-slate-400 py-6">Pagando con tu wallet (WebLN)…</div>}

        {(state === 'invoice') && (
          <div className="flex flex-col items-center gap-3">
            <div className="bg-white p-3 rounded-xl"><QRCodeSVG value={invoice} size={200} /></div>
            <button
              className="btn-ghost w-full text-xs break-all"
              onClick={() => navigator.clipboard.writeText(invoice)}
            >Copiar factura BOLT11</button>
            <button className="btn-neon w-full" onClick={markPaid}>Ya pagué ✓</button>
            <p className="text-[11px] text-slate-500 text-center">Escanea con tu wallet Lightning. Cuando pagues, pulsa “Ya pagué”.</p>
          </div>
        )}

        {state === 'done' && (
          <div className="text-center py-4">
            <div className="text-arcade-green text-3xl mb-2">✓</div>
            <p className="text-arcade-green font-semibold">¡Aportación confirmada!</p>
            <button className="btn-ghost mt-4" onClick={onClose}>Cerrar</button>
          </div>
        )}
        {state === 'error' && (
          <div className="text-center py-2">
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <button className="btn-ghost" onClick={() => setState('idle')}>Reintentar</button>
          </div>
        )}
      </div>
    </div>
  );
}
