import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { requestInvoice, hasWebLN, payWithWebLN, pollPaid } from '../lib/lightning';
import { totalPot as computePot } from '../lib/protocol';
import { useGameStore } from '../store/gameStore';

// Shown when a room finishes. The escrow holder (host) pays the full pot to the
// winner's Lightning Address — AUTOMATICALLY (WebLN, or QR + verify polling).
export default function PayoutPanel({ room, isHost }) {
  const totalPot = computePot(room);
  const isFree = room.potMode === 'free' || totalPot <= 0;
  const winner = room.players.find((p) => p.pubkey === room.winner);
  const [state, setState] = useState('loading'); // loading|paying|waiting|done|error
  const [invoice, setInvoice] = useState('');
  const [error, setError] = useState('');
  const cancelled = useRef(false);
  const startDemoRoom = useGameStore((s) => s.startDemoRoom);
  const leaveRoom = useGameStore((s) => s.leaveRoom);

  const winnerAddr = winner?.lnAddress;

  useEffect(() => {
    if (!isHost || isFree || room.demo) return;
    cancelled.current = false;
    (async () => {
      if (!winnerAddr) { setError('El ganador no configuró Lightning Address'); setState('error'); return; }
      try {
        const { invoice: inv, verify } = await requestInvoice(winnerAddr, totalPot, `Bote ${room.name} 🏆`);
        if (cancelled.current) return;
        setInvoice(inv);
        if (hasWebLN()) {
          setState('paying');
          try { await payWithWebLN(inv); if (!cancelled.current) setState('done'); return; }
          catch { /* fall through to QR + polling */ }
        }
        if (cancelled.current) return;
        setState('waiting');
        if (verify) {
          const paid = await pollPaid(verify);
          if (cancelled.current) return;
          setState(paid ? 'done' : 'error');
          if (!paid) setError('No se detectó el pago del bote a tiempo.');
        }
      } catch (e) {
        if (!cancelled.current) { setError(e.message || 'Error'); setState('error'); }
      }
    })();
    return () => { cancelled.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Demo: celebrate the result without touching real Lightning.
  if (room.demo) {
    const youWon = room.winner && !room.winner.startsWith('bot-');
    return (
      <div className="panel p-6 text-center max-w-md mx-auto">
        <div className="text-5xl mb-2 animate-flicker">{youWon ? '🏆' : '🤖'}</div>
        <h2 className="text-2xl font-bold text-arcade-amber neon-text mb-1">
          {youWon ? '¡Ganaste la demo!' : 'CryptoBot gana esta ronda'}
        </h2>
        <p className="text-slate-400 mb-1">{room.scores[room.winner]} victorias · primero a {room.winTarget}</p>
        <div className="text-3xl font-bold text-arcade-green my-3">⚡ {room.finalPot.toLocaleString()} sats</div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          🎬 Esto es una <b>demo</b>. En una sala real, el bote se envía solo al ganador por
          <b className="text-arcade-cyan"> Lightning</b> — sin custodia y sin backend.
        </p>
        <div className="flex gap-2 mt-4">
          <button className="btn-neon flex-1" onClick={() => startDemoRoom()}>↻ Jugar otra</button>
          <button className="btn-ghost flex-1" onClick={() => leaveRoom()}>Salir</button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel p-6 text-center max-w-md mx-auto">
      <div className="text-5xl mb-2 animate-flicker">🏆</div>
      <h2 className="text-2xl font-bold text-arcade-amber neon-text mb-1">¡{winner?.name || 'Ganador'} gana!</h2>
      <p className="text-slate-400 mb-1">{room.scores[room.winner]} victorias · primero a {room.winTarget}</p>

      {isFree ? (
        <p className="text-arcade-cyan mt-3">Partida sin timba — ¡solo por la gloria! 🕹️</p>
      ) : (
        <>
          <div className="text-3xl font-bold text-arcade-green my-3">{totalPot.toLocaleString()} sats</div>
          {!isHost && (
            <p className="text-sm text-slate-400">
              El bote se está enviando automáticamente a <span className="font-mono text-arcade-cyan">{winnerAddr}</span>.
            </p>
          )}
          {isHost && (
            <div className="mt-2">
              {state === 'loading' && <p className="text-slate-400">Generando factura del ganador…</p>}
              {state === 'paying' && <p className="text-slate-400">Pagando el bote con tu wallet…</p>}
              {state === 'waiting' && (
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-white p-3 rounded-xl"><QRCodeSVG value={invoice} size={180} /></div>
                  <button className="btn-ghost w-full text-xs break-all" onClick={() => navigator.clipboard.writeText(invoice)}>Copiar factura del ganador</button>
                  <div className="flex items-center gap-2 text-arcade-amber text-sm">
                    <span className="inline-block w-2 h-2 rounded-full bg-arcade-amber animate-flicker" />
                    Esperando confirmación del envío…
                  </div>
                </div>
              )}
              {state === 'done' && <p className="text-arcade-green font-semibold mt-2">✓ Bote entregado automáticamente al ganador</p>}
              {state === 'error' && <p className="text-red-400 text-sm mb-2">{error}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
