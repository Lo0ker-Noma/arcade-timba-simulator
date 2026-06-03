import React, { useEffect, useRef } from 'react';

// Animated LED dot-matrix marquee. Renders `text` as scrolling pixel glyphs
// (5x7 font) that slide right-to-left, like an arcade scoreboard sign.
const FONT = {
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
};
const ROWS = 7;
const GLYPH_W = 5;
const SPACING = 1; // blank columns between glyphs

// Build a column-major bitmap (array of columns, each an array of 7 bits).
function buildColumns(text) {
  const cols = [];
  for (const ch of text.toUpperCase()) {
    const g = FONT[ch] || FONT[' '];
    for (let c = 0; c < GLYPH_W; c++) {
      const col = [];
      for (let r = 0; r < ROWS; r++) col.push(g[r][c] === '1' ? 1 : 0);
      cols.push(col);
    }
    for (let s = 0; s < SPACING; s++) cols.push(new Array(ROWS).fill(0));
  }
  return cols;
}

export default function DotMatrix({
  text = 'HDMP GAMING BTC',
  pitch = 11,           // px between dot centers
  speed = 42,           // px per second
  lit = '#7dd3fc',      // lighter blue (encendido)
  dim = 'rgba(34,211,238,0.08)',
  gap = 8,              // trailing blank columns before the loop repeats
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const cols = buildColumns(text);
    for (let i = 0; i < gap; i++) cols.push(new Array(ROWS).fill(0));
    const totalCols = cols.length;
    const totalW = totalCols * pitch;

    let cssW = 0, cssH = ROWS * pitch;
    const resize = () => {
      cssW = canvas.parentElement.clientWidth;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    const radius = pitch * 0.38;
    let offset = 0;
    let last = performance.now();
    let raf;

    const draw = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      offset = (offset + speed * dt) % totalW;

      ctx.clearRect(0, 0, cssW, cssH);
      const visibleCols = Math.ceil(cssW / pitch) + 1;
      const startCol = Math.floor(offset / pitch);
      const sub = offset % pitch;

      for (let sx = 0; sx < visibleCols; sx++) {
        const colIdx = (startCol + sx) % totalCols;
        const col = cols[colIdx];
        const x = sx * pitch - sub + pitch / 2;
        for (let r = 0; r < ROWS; r++) {
          const y = r * pitch + pitch / 2;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          if (col[r]) {
            ctx.fillStyle = lit;
            ctx.shadowColor = lit;
            ctx.shadowBlur = pitch * 0.6;
          } else {
            ctx.fillStyle = dim;
            ctx.shadowBlur = 0;
          }
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [text, pitch, speed, lit, dim, gap]);

  return (
    <div className="w-full overflow-hidden rounded-lg" style={{ background: 'rgba(2,6,16,0.6)' }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
