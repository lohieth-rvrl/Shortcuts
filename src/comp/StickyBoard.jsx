import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

const COLORS = ['#ffe680', '#b9f2c6', '#b8daff', '#ffc2cc', '#dcc8ff', '#ffd3a1'];
const W = 176;
const H = 176;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const slot = (i) => ({ x: 14 + (i % 2) * (W + 12) + ((i * 37) % 12), y: 20 + Math.floor(i / 2) * (H + 18) + ((i * 53) % 14) });
const when = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? 'tomorrow' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };

// A cork sticky notes. Notes are pinned or taped anywhere; drag them by the pin, or focus it and use arrow keys.
export default function StickyBoard({ stickyNotes, onAddStickyNote, onChangeStickyNote, onDeleteStickyNote, entranceDelay, showHeading = true, compact = false, className = '' }) {
  const boardRef = useRef(null);
  const timers = useRef(new Map());
  const [drag, setDrag] = useState(null);
  const [leaving, setLeaving] = useState(() => new Set());

  useEffect(() => { const t = timers.current; return () => t.forEach((id) => clearTimeout(id)); }, []);

  const at = (n, i) => ({ x: n.x ?? slot(i).x, y: n.y ?? slot(i).y });
  const rot = (n) => n.rot ?? ((hash(n.id) % 90) / 10 - 4.5);
  const top = Math.max(0, ...stickyNotes.map((n) => n.z || 0));

  function raise(n) { if ((n.z || 0) < top || !n.z) onChangeStickyNote(n.id, 'z', top + 1); }

  function start(e, n, i) {
    if (e.button > 0) return;
    const box = boardRef.current.getBoundingClientRect();
    const p = at(n, i);
    e.currentTarget.setPointerCapture(e.pointerId);
    raise(n);
    setDrag({ id: n.id, x: p.x, y: p.y, dx: e.clientX - box.left - p.x, dy: e.clientY - box.top - p.y });
  }
  function move(e) {
    if (!drag) return;
    const box = boardRef.current.getBoundingClientRect();
    setDrag((d) => ({ ...d, x: clamp(e.clientX - box.left - d.dx, 0, box.width - W), y: clamp(e.clientY - box.top - d.dy, 0, box.height - H) }));
  }
  function end() {
    if (!drag) return;
    onChangeStickyNote(drag.id, 'x', Math.round(drag.x));
    onChangeStickyNote(drag.id, 'y', Math.round(drag.y));
    setDrag(null);
  }
  function nudge(e, n, i) {
    const d = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] }[e.key];
    if (!d) return;
    e.preventDefault();
    const p = at(n, i);
    onChangeStickyNote(n.id, 'x', Math.max(0, p.x + d[0]));
    onChangeStickyNote(n.id, 'y', Math.max(0, p.y + d[1]));
  }
  function remove(id) {
    setLeaving((s) => new Set(s).add(id));
    timers.current.set(id, setTimeout(() => {
      onDeleteStickyNote(id);
      setLeaving((s) => { const x = new Set(s); x.delete(id); return x; });
      timers.current.delete(id);
    }, 340));
  }

  const height = Math.max(compact ? 360 : 500, ...stickyNotes.map((n, i) => at(n, i).y + H + 28));

  return (
    <aside className={`sticky-notes-rail search-dimmable ${className}`} style={{ animationDelay: entranceDelay }}>
      <div className="cork-frame">
        {showHeading && (
          <div className="board-plate">
            <span className="board-title">Sticky notes</span>
            <span className="board-count">{stickyNotes.length}</span>
            <button type="button" className="board-add" onClick={onAddStickyNote} aria-label="Add a new sticky note"><Plus size={14} /> New note</button>
          </div>
        )}
        <div className="cork" ref={boardRef} style={{ minHeight: height }}>
          {stickyNotes.length === 0 && <p className="cork-empty">Nothing pinned yet.<br />Tap “new note”.</p>}
          {stickyNotes.map((n, i) => {
            const p = drag?.id === n.id ? drag : at(n, i);
            const taped = hash(n.id) % 3 === 0;
            return (
              <article
                key={n.id}
                className={`pin-note ${taped ? 'is-taped' : ''} ${drag?.id === n.id ? 'is-dragging' : ''} ${leaving.has(n.id) ? 'is-leaving' : ''}`}
                style={{ left: `min(${p.x}px, calc(100% - ${W + 6}px))`, top: p.y, width: W, minHeight: H, zIndex: drag?.id === n.id ? 9999 : n.z || i + 1, '--rot': `${rot(n)}deg`, '--paper': n.color || COLORS[i % COLORS.length], animationDelay: `${i * 60}ms` }}
              >
                <div className="note-grip" role="button" tabIndex={0} aria-label={`Move note ${n.title || i + 1}. Drag, or use arrow keys.`}
                  onPointerDown={(e) => start(e, n, i)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onKeyDown={(e) => nudge(e, n, i)}>
                  {taped ? <span className="tape" /> : <span className="pin" />}
                </div>
                <input className="note-title" aria-label="Note title" value={n.title} maxLength={40} placeholder="Title" onFocus={() => raise(n)} onChange={(e) => onChangeStickyNote(n.id, 'title', e.target.value)} />
                <textarea className="note-text" aria-label="Note text" value={n.text} placeholder="Write here…" onFocus={() => raise(n)} onChange={(e) => onChangeStickyNote(n.id, 'text', e.target.value)} />
                <footer className="note-foot">
                  <span className="note-dots" role="group" aria-label="Note colour">
                    {COLORS.map((c) => <button key={c} type="button" className={`dot ${c === (n.color || COLORS[i % COLORS.length]) ? 'on' : ''}`} style={{ background: c }} aria-label={`Colour ${c}`} onClick={() => onChangeStickyNote(n.id, 'color', c)} />)}
                  </span>
                  <button type="button" className="note-del" aria-label="Take this note down" title={`Expires ${when(n.expiresAt)}`} onClick={() => remove(n.id)}><Trash2 size={13} /></button>
                </footer>
              </article>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
