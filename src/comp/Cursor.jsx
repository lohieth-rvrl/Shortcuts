import { useEffect, useRef } from 'react';

// iPadOS-style pointer: a soft dot that glides after the mouse, morphs into the shape of whatever
// you hover (buttons, links, tiles), turns into a text bar over inputs, squishes on press and pulses on click.
const HOVER = 'a[href], button:not(:disabled), [role="button"], summary, select, label[for], input[type="checkbox"], [data-cursor]';
const TEXT = 'input:not([type="checkbox"]):not([type="range"]):not([type="file"]), textarea, [contenteditable="true"]';
const lerp = (a, b, k) => a + (b - a) * k;

export default function Cursor() {
  const box = useRef(null);
  const fill = useRef(null);

  useEffect(() => {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const el = box.current, inner = fill.current, root = document.documentElement;
    root.classList.add('has-cursor');
    const s = { px: -200, py: -200, x: -200, y: -200, w: 16, h: 16, r: 8, mode: 'free', target: null, seen: false };
    let raf = 0, lastCheck = 0;

    const setMode = (mode) => {
      if (s.mode === mode) return;
      s.mode = mode; inner.dataset.mode = mode;
    };

    function resolve(t) {
      const text = t?.closest(TEXT);
      const hover = !text && t?.closest(HOVER);
      if (text) { s.target = null; setMode('text'); }
      else if (hover) { s.target = hover; setMode('magnet'); }
      else { s.target = null; setMode('free'); }
    }
    function onMove(e) {
      s.px = e.clientX; s.py = e.clientY;
      if (!s.seen) { s.seen = true; s.x = s.px; s.y = s.py; el.style.opacity = '1'; }
      resolve(e.target instanceof Element ? e.target : null);
    }
    const down = (e) => {
      inner.classList.add('is-down');
      const ring = document.createElement('span');
      ring.className = 'cursor-pulse'; ring.style.left = `${e.clientX}px`; ring.style.top = `${e.clientY}px`;
      ring.addEventListener('animationend', () => ring.remove());
      document.body.appendChild(ring);
    };
    const up = () => inner.classList.remove('is-down');
    const leave = () => { el.style.opacity = '0'; s.seen = false; };

    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (s.seen && now - lastCheck > 90) { lastCheck = now; resolve(document.elementFromPoint(s.px, s.py)); }
      let tx = s.px, ty = s.py, tw = 16, th = 16, tr = 8, k = 0.34;
      if (s.mode === 'text') { tw = 3; th = 24; tr = 2; k = 0.5; }
      else if (s.mode === 'magnet' && s.target?.isConnected) {
        const b = s.target.getBoundingClientRect();
        if (b.width > 420 || b.height > 220) { tw = 44; th = 44; tr = 22; }
        else {
          const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
          tw = b.width + 14; th = b.height + 10;
          const br = parseFloat(getComputedStyle(s.target).borderRadius) || 10;
          tr = Math.min(br + 6, Math.min(tw, th) / 2);
          tx = cx + (s.px - cx) * 0.14; ty = cy + (s.py - cy) * 0.14; k = 0.24;
        }
      }
      s.x = lerp(s.x, tx, k); s.y = lerp(s.y, ty, k);
      s.w = lerp(s.w, tw, 0.24); s.h = lerp(s.h, th, 0.24); s.r = lerp(s.r, tr, 0.24);
      el.style.width = `${s.w}px`; el.style.height = `${s.h}px`; el.style.borderRadius = `${s.r}px`;
      el.style.transform = `translate3d(${s.x - s.w / 2}px, ${s.y - s.h / 2}px, 0)`;
    }

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', down, { passive: true });
    window.addEventListener('pointerup', up, { passive: true });
    document.documentElement.addEventListener('mouseleave', leave);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerdown', down); window.removeEventListener('pointerup', up);
      document.documentElement.removeEventListener('mouseleave', leave);
      root.classList.remove('has-cursor');
    };
  }, []);

  return <div className="cursor" ref={box} aria-hidden="true"><span className="cursor-fill" ref={fill} data-mode="free" /></div>;
}
