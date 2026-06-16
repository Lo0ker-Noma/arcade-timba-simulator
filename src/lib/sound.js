// Procedural chiptune SFX via Web Audio — no assets, generated on the fly.
// All helpers are fire-and-forget and safe to call before user interaction
// (errors from a suspended/blocked AudioContext are swallowed).
let ctx;
const ac = () => {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};

function tone({ freq = 440, end, type = 'square', dur = 0.08, vol = 0.15, delay = 0 }) {
  try {
    const a = ac();
    const t0 = a.currentTime + delay;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, end || freq), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  } catch {}
}

function noise({ dur = 0.12, vol = 0.18, delay = 0 }) {
  try {
    const a = ac();
    const t0 = a.currentTime + delay;
    const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = a.createBufferSource();
    src.buffer = buf;
    const g = a.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(g).connect(a.destination);
    src.start(t0);
  } catch {}
}

export const sfx = {
  // gameplay
  blip: () => tone({ freq: 520, dur: 0.05, vol: 0.08 }),
  bounce: () => tone({ freq: 220, end: 340, dur: 0.05 }),
  score: () => { tone({ freq: 523 }); tone({ freq: 784, delay: 0.09 }); },
  bad: () => tone({ freq: 220, end: 110, type: 'sawtooth', dur: 0.2, vol: 0.12 }),
  drop: () => tone({ freq: 160, end: 90, dur: 0.07, vol: 0.1 }),
  line: () => { tone({ freq: 660 }); tone({ freq: 880, delay: 0.07 }); tone({ freq: 1175, delay: 0.14, dur: 0.12 }); },
  splat: () => { noise({ dur: 0.1 }); tone({ freq: 150, end: 60, dur: 0.09, vol: 0.1 }); },
  shot: () => tone({ freq: 900, end: 300, dur: 0.05, vol: 0.07 }),
  crash: () => { noise({ dur: 0.25, vol: 0.22 }); tone({ freq: 130, end: 50, type: 'sawtooth', dur: 0.3, vol: 0.14 }); },
  // countdown & results
  tick: () => tone({ freq: 440, dur: 0.09, vol: 0.18 }),
  go: () => { tone({ freq: 660, dur: 0.1 }); tone({ freq: 880, delay: 0.1, dur: 0.2 }); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, delay: i * 0.11, dur: 0.14 })),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, type: 'triangle', delay: i * 0.14, dur: 0.18, vol: 0.16 })),
  coin: () => { tone({ freq: 988, dur: 0.06 }); tone({ freq: 1319, delay: 0.06, dur: 0.22 }); },
};
