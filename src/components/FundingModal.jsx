import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { requestInvoice, hasWebLN, payWithWebLN, pollPaid } from '../lib/lightning';
import { useGameStore } from '../store/gameStore';

// Player funds their share of the pot — confirmed AUTOMATICALLY, no buttons.
//  - WebLN (Alby): pays and confirms on the returned preimage.
//  - QR fallback: polls the LUD-21 verify URL until settled, then confirms.
export default function FundingModal({ room, onClose }) {
  const confirmFunded = useGameStore((s) => s.confirmFunded);
  const [state, setState] = useState('loading'); // loading|paying|waiting|done|error
  const [invoice, setInvoice] = useState('');
  const [error, setError] = useState('');
  const cancelled = useRef(false);

  const sats = room.potPerPlayer;
  const escrow = room.hostLnAddress;

  useEffect(() => {
    cancelled.current = false;
    (async () => {
      try {
        const { invoice: inv, verify } = await requestInvoice(escrow, sats, `Bote ${room.name} · ${room.id.slice(0, 6)}`);
        if (cancelled.current) return;
        setInvoice(inv);

        // 1) WebLN: pay and auto-confirm on success.
        if (hasWebLN()) {
          setState('paying');
          try {
            await payWithWebLN(inv);
            if (cancelled.current) return;
            await confirmFunded();
            setState('done');
            return;
          } catch {
            // user may reject WebLN → fall through to QR + verify polling
          }
        }

        // 2) QR + automatic verify polling (no button).
        if (cancelled.current) return;
        setState('waiting');
        if (verify) {
          const paid = await pollPaid(verify);
          if (cancelled.current) return;
          if (paid) { await confirmFunded(); setState('done'); }
          else { setError('No se detectó el pago a tiempo.'); setState('error'); }
        }
        // If no verify URL, we keep showing the QR; settlement can't be auto-detected
        // for this wallet, but WebLN users never reach here.
      } catch (e) {
        if (!cancelled.current) { setError(e.message || 'Error'); setState('error'); }
      }
    })();
    return () => { cancelled.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel max-w-md w-full p-6">
        <h3 className="text-lg font-bold text-arcade-amber mb-1">⚡ Pon tu parte del bote</h3>
        <p className="text-sm text-slate-400 mb-4">
          Aportas <span className="text-arcade-cyan font-bold">{sats.toLocaleString()} sats</span> al bote.
          Se confirma <b className="text-slate-200">automáticamente</b> al pagar.
        </p>

        {state === 'loading' && <div className="text-center text-slate-400 py-8">Generando factura…</div>}
        {state === 'paying' && <div className="text-center text-slate-400 py-8">Pagando con tu wallet (WebLN)…</div>}

        {state === 'waiting' && (
          <div className="flex flex-col items-center gap-3">
            <div className="bg-white p-3 rounded-xl"><QRCodeSVG value={invoice} size={200} /></div>
            <button className="btn-ghost w-full text-xs break-all" onClick={() => navigator.clipboard.writeText(invoice)}>Copiar factura BOLT11</button>
            <div className="flex items-center gap-2 text-arcade-amber text-sm">
              <span className="inline-block w-2 h-2 rounded-full bg-arcade-amber animate-flicker" />
              Esperando confirmación del pago…
            </div>
            <p className="text-[11px] text-slate-500 text-center">Escanea con tu wallet Lightning. Se confirmará solo cuando el pago llegue.</p>
          </div>
        )}

        {state === 'done' && (
          <div className="text-center py-4">
            <div className="text-arcade-green text-3xl mb-2">✓</div>
            <p className="text-arcade-green font-semibold">¡Pago confirmado automáticamente!</p>
            <button className="btn-ghost mt-4" onClick={onClose}>Cerrar</button>
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
