import React, { useEffect, useState } from 'react';
import { sfx } from '../lib/sound';
import { broadcastEvent } from '../lib/nostrRelay';

const APP_URL = 'https://arcade-timba-simulator.vercel.app';

// Arcade ritual around every game: a 3·2·1·GO! countdown before the match
// starts, and a dramatic game-over overlay (count-up score + INSERT COIN +
// publish-to-Nostr). `render(handleGameOver)` builds the game element; the
// game only mounts once the countdown finishes so its timers start fair.
export default function GameStage({ render, onGameOver, onReplay, gameName,
  replayLabel = '▶ INSERT COIN TO CONTINUE', replayDisabled = false, replayHint = null }) {
  const [count, setCount] = useState(3); // 3,2,1 → 0 = GO! → -1 = playing
  const [result, setResult] = useState(null); // { score, won }
  const [shown, setShown] = useState(0); // animated count-up of the score
  const [pub, setPub] = useState(null); // null | 'sending' | 'ok' | 'err'

  useEffect(() => {
    if (count < 0) return;
    if (count > 0) sfx.tick(); else sfx.go();
    const t = setTimeout(() => setCount((c) => c - 1), count === 0 ? 600 : 850);
    return () => clearTimeout(t);
  }, [count]);

  useEffect(() => {
    if (!result) return;
    const step = Math.max(1, Math.ceil(result.score / 45));
    let v = 0;
    const id = setInterval(() => {
      v = Math.min(result.score, v + step);
      setShown(v);
      if (v >= result.score) clearInterval(id);
    }, 28);
    return () => clearInterval(id);
  }, [result]);

  const handleGameOver = (score, won) => {
    setResult({ score, won });
    setShown(0);
    setPub(null);
    (won ? sfx.win : sfx.lose)();
    onGameOver && onGameOver(score, won);
  };

  const continueGame = () => {
    sfx.coin();
    if (onReplay) onReplay(); else setResult(null);
  };

  // Publish the score as a kind-1 note signed with the player's NIP-07
  // profile (Alby, nos2x…) and send it to the relay.
  const publishScore = async () => {
    if (!window.nostr) {
      alert('Instala una extensión Nostr (NIP-07) como Alby o nos2x para publicar tu puntuación.');
      return;
    }
    setPub('sending');
    try {
      const content = `${result.won ? '🏆 ¡VICTORIA!' : '🕹️ GAME OVER'} — ${result.score} puntos en ${gameName || 'el arcade'} ⚡\n\n¿Me superas? Juega en ${APP_URL}\n\n#ArcadeTimba #HDMP`;
      const signed = await window.nostr.signEvent({
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', 'arcadetimba'], ['t', 'hdmp'], ['r', APP_URL]],
        content,
      });
      if (!signed || !signed.id || !signed.sig) throw new Error('sign rejected');
      // Broadcast to several relays and only celebrate if at least one accepts.
      const { ok } = await broadcastEvent(signed);
      if (ok > 0) { setPub('ok'); sfx.coin(); }
      else { setPub('err'); }
    } catch {
      setPub('err');
    }
  };

  if (count >= 0) {
    return (
      <div className="min-h-[380px] w-full grid place-items-center">
        <div className="text-center select-none">
          <div className="pixel text-[10px] tracking-widest text-slate-400 mb-6">PREPÁRATE</div>
          <div
            key={count}
            className={`pixel countdown-pop ${count === 0 ? 'text-arcade-green' : 'text-arcade-cyan neon-text'}`}
            style={{ fontSize: count === 0 ? '3.5rem' : '5rem', lineHeight: 1 }}
          >
            {count === 0 ? 'GO!' : count}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full flex justify-center">
      {render(handleGameOver)}
      {result && (
        <div className="absolute inset-0 z-10 grid place-items-center rounded-xl"
          style={{ background: 'rgba(7,9,18,0.82)', backdropFilter: 'blur(3px)' }}>
          <div className="text-center select-none px-6">
            <div className={`pixel text-2xl sm:text-3xl mb-5 ${result.won ? 'text-arcade-green' : 'text-arcade-pink neon-text-purple'}`}>
              {result.won ? '¡VICTORIA!' : 'GAME OVER'}
            </div>
            <div className="pixel text-[10px] tracking-widest text-slate-400">PUNTUACIÓN</div>
            <div className="pixel text-4xl sm:text-5xl text-arcade-amber mt-2 mb-6" style={{ textShadow: '0 0 12px rgba(245,158,11,0.6)' }}>
              {shown}
            </div>
            <button
              className="pixel text-xs text-arcade-cyan press-start hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-arcade-cyan"
              onClick={continueGame}
              disabled={replayDisabled}
            >
              {replayLabel}
            </button>
            {replayHint && (
              <div className="pixel text-[9px] text-slate-400 mt-2 leading-relaxed">{replayHint}</div>
            )}
            <div className="mt-5">
              {pub === 'ok' ? (
                <span className="pixel text-[9px] text-arcade-green">✓ PUBLICADO EN NOSTR</span>
              ) : (
                <button
                  className="pixel text-[9px] text-arcade-purple hover:text-white disabled:opacity-50"
                  disabled={pub === 'sending'}
                  onClick={publishScore}
                >
                  {pub === 'sending' ? 'PUBLICANDO…' : pub === 'err' ? '⚠ ERROR — REINTENTAR' : '📣 PUBLICAR EN NOSTR'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
