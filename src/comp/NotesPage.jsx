import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Clock, Plus, Search, Trash2 } from 'lucide-react';

// Notepad as a shelf of note cards. Pick one to open it in a focused editor.
const COVERS = ['#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2', '#ff375f'];
const words = (t) => (t.trim().match(/\S+/g) || []).length;
const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const coverOf = (n) => n.color || COVERS[hash(n.id) % COVERS.length];
const ago = (iso) => {
  const t = Date.parse(iso);
  if (!t) return 'new';
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function NotesPage({ notes, activeNoteId, onCreate, onSelect, onUpdate, onDelete }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [leaving, setLeaving] = useState(() => new Set());
  const timers = useRef(new Map());
  const active = notes.find((n) => n.id === activeNoteId) || null;
  const desk = open && active;

  useEffect(() => { const t = timers.current; return () => t.forEach((id) => clearTimeout(id)); }, []);
  useEffect(() => {
    if (!desk) return undefined;
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [desk]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...notes]
      .filter((n) => !q || `${n.title} ${n.content}`.toLowerCase().includes(q))
      .sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
  }, [notes, query]);

  function remove(id) {
    setLeaving((s) => new Set(s).add(id));
    timers.current.set(id, setTimeout(() => {
      onDelete(id);
      setLeaving((s) => { const x = new Set(s); x.delete(id); return x; });
      timers.current.delete(id);
      setOpen(false);
    }, 280));
  }
  function create() { onCreate(); setOpen(true); }
  function openNote(id) { onSelect(id); setOpen(true); }

  if (desk) {
    return (
      <section className="nb-desk" aria-label="Notebook">
        <div className="nb-bar">
          <button type="button" className="nb-btn" onClick={() => setOpen(false)}><ArrowLeft size={15} /> All notes</button>
          <div className="nb-covers" role="group" aria-label="Cover colour">
            {COVERS.map((c) => (
              <button key={c} type="button" className={`nb-cover-dot ${c === coverOf(active) ? 'on' : ''}`} style={{ background: c }}
                aria-label={`Cover ${c}`} onClick={() => onUpdate(active.id, 'color', c)} />
            ))}
          </div>
          <span className="nb-meta"><Clock size={13} /> saved {ago(active.updatedAt)}</span>
          <span className="nb-meta nb-hide-sm">{words(active.content)} words · {Math.max(1, Math.ceil(words(active.content) / 200))} min read</span>
          <button type="button" className={`nb-btn nb-danger ${leaving.has(active.id) ? 'is-busy' : ''}`} onClick={() => remove(active.id)} aria-label="Delete this note"><Trash2 size={15} /></button>
        </div>
        <div className={`nb-paper ${leaving.has(active.id) ? 'is-leaving' : ''}`} style={{ '--cover': coverOf(active) }}>
          <input className="nb-title" aria-label="Note name" value={active.title} maxLength={64} placeholder="Untitled note"
            onChange={(e) => onUpdate(active.id, 'title', e.target.value)} />
          <textarea className="nb-body" aria-label="Note content" value={active.content} placeholder="Start writing…" autoFocus
            onChange={(e) => onUpdate(active.id, 'content', e.target.value)} />
        </div>
      </section>
    );
  }

  return (
    <section className="nb-shelf" aria-label="Notes">
      <header className="nb-head">
        <div>
          <h2 className="nb-heading">Notes</h2>
          <p className="nb-sub">{notes.length} {notes.length === 1 ? 'note' : 'notes'}</p>
        </div>
        <label className="nb-search">
          <Search size={15} aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes" aria-label="Search notes" />
        </label>
      </header>
      <div className="nb-grid">
        <button type="button" className="nb-card nb-new" onClick={create}>
          <Plus size={26} aria-hidden="true" /><span>New note</span>
        </button>
        {shown.map((n, i) => (
          <article key={n.id} className={`nb-card ${leaving.has(n.id) ? 'is-leaving' : ''}`} style={{ '--cover': coverOf(n), animationDelay: `${i * 45}ms` }}>
            <button type="button" className="nb-open" onClick={() => openNote(n.id)} aria-label={`Open ${n.title || 'untitled note'}`}>
              <span className="nb-spine" aria-hidden="true" />
              <strong className="nb-card-title">{n.title || 'Untitled note'}</strong>
              <span className="nb-preview">{n.content.trim() || 'Empty page'}</span>
              <span className="nb-card-foot"><span>{ago(n.updatedAt)}</span><span>{words(n.content)} words</span></span>
            </button>
            <button type="button" className="nb-x" onClick={() => remove(n.id)} aria-label={`Delete ${n.title || 'untitled note'}`}><Trash2 size={13} /></button>
          </article>
        ))}
      </div>
      {notes.length > 0 && shown.length === 0 && <p className="nb-none">No note matches “{query}”.</p>}
    </section>
  );
}
