import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Download, Upload, HelpCircle, Search, Plus, Pencil, X, Pin, Sparkles, NotebookPen, StickyNote, Trash2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Link2 } from 'lucide-react';
import NotesPage from './NotesPage.jsx';

import '../css/style.css';

/* ---------- constants ---------- */

const PALETTE = [
  { name: 'Rose', grad: 'linear-gradient(135deg,#ec4899,#f43f5e)' },
  { name: 'Violet', grad: 'linear-gradient(135deg,#8b5cf6,#a855f7)' },
  { name: 'Sky', grad: 'linear-gradient(135deg,#22d3ee,#3b82f6)' },
  { name: 'Amber', grad: 'linear-gradient(135deg,#fbbf24,#f97316)' },
  { name: 'Mint', grad: 'linear-gradient(135deg,#34d399,#14b8a6)' },
  { name: 'Fuchsia', grad: 'linear-gradient(135deg,#d946ef,#ec4899)' },
];
const PINNED_GRAD = 'linear-gradient(135deg,#94a3b8,#71717a)';
const NOTE_COLORS = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fecdd3'];

const DEFAULT_CATEGORIES = [
  {
    id: 'cat_socials', name: 'Socials', color: PALETTE[0].grad, shortcuts: [
      { id: 'yt', label: 'YouTube', url: 'https://youtube.com', clicks: 0 },
      { id: 'ig', label: 'Instagram', url: 'https://instagram.com', clicks: 0 },
      { id: 'x', label: 'X', url: 'https://x.com', clicks: 0 },
      { id: 'tt', label: 'TikTok', url: 'https://tiktok.com', clicks: 0 },
    ]
  },
  {
    id: 'cat_work', name: 'Work', color: PALETTE[1].grad, shortcuts: [
      { id: 'li', label: 'LinkedIn', url: 'https://linkedin.com', clicks: 0 },
      { id: 'gh', label: 'GitHub', url: 'https://github.com', clicks: 0 },
    ]
  }
];

const DEFAULT_PINNED = [
  { id: 'p_gmail', label: 'Gmail', url: 'https://mail.google.com', clicks: 0 },
  { id: 'p_drive', label: 'Drive', url: 'https://drive.google.com', clicks: 0 },
];

const DEFAULT_SETTINGS = { background: { type: 'solid', value: '#000000' } };

function normalizeSettings() {
  return deepClone(DEFAULT_SETTINGS);
}

/* ---------- helpers ---------- */

function normalizeUrl(raw) {
  let u = (raw || '').trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}
function hostnameOf(raw) {
  try { return new URL(normalizeUrl(raw)).hostname; } catch (e) { return ''; }
}
function guessNameFromUrl(raw) {
  const host = hostnameOf(raw).replace(/^www\./, '');
  if (!host) return '';
  const parts = host.split('.');
  const core = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  return core.charAt(0).toUpperCase() + core.slice(1);
}
const faviconCache = new Map();

function faviconUrls(raw) {
  try {
    const site = new URL(normalizeUrl(raw));
    const directory = new URL(site.href);
    directory.pathname = site.pathname.endsWith('/') ? site.pathname : `${site.pathname}/`;
    directory.search = '';
    directory.hash = '';
    return [
      new URL('favicon.ico', directory).href,
      new URL('/favicon.ico', site.origin).href,
      `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(site.href)}`,
      `https://icons.duckduckgo.com/ip3/${site.hostname}.ico`,
    ];
  } catch {
    return [];
  }
}
function resolveFaviconUrls(raw) {
  const address = normalizeUrl(raw);
  if (faviconCache.has(address)) return faviconCache.get(address);

  const fallbackUrls = faviconUrls(address);
  const pending = fetch(`https://api.microlink.io/?url=${encodeURIComponent(address)}`, { signal: AbortSignal.timeout(7000) })
    .then(response => response.ok ? response.json() : null)
    .then(result => {
      const discovered = [result?.data?.logo?.url, result?.data?.favicon?.url]
        .filter(url => typeof url === 'string' && /^https?:\/\//i.test(url));
      return [...new Set([...discovered, ...fallbackUrls])];
    })
    .catch(() => fallbackUrls);

  faviconCache.set(address, pending);
  return pending;
}
function initialsOf(label) {
  return ((label || '').trim().charAt(0) || '?').toUpperCase();
}
function formatStickyExpiry(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'tomorrow';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/* ---------- small building blocks ---------- */

function Tile({ shortcut, gradient, draggable, controls, onClick, onEdit, onRemove, dragHandlers, isDragging, isDropTarget, isJustDropped, style, className }) {
  const [imgOk, setImgOk] = useState(true);
  const [faviconIndex, setFaviconIndex] = useState(0);
  const [favicons, setFavicons] = useState(() => faviconUrls(shortcut.url));
  const [ripple, setRipple] = useState(null);
  const tileRef = useRef(null);
  const host = hostnameOf(shortcut.url).toLowerCase();
  const identity = `${shortcut.label} ${host}`.toLowerCase();
  const brandGlow = identity.includes('youtube') ? '#ff0033'
    : identity.includes('instagram') ? '#e1306c'
      : identity.includes('linkedin') ? '#0a66c2'
        : identity.includes('tiktok') ? '#25f4ee'
          : identity.includes('twitch') ? '#9146ff'
            : identity.includes('reddit') ? '#ff4500'
              : identity.includes('gmail') ? '#ea4335'
                : identity.includes('github') ? '#d7e4f5'
                  : '#a78bfa';

  useEffect(() => {
    let active = true;
    setFavicons(faviconUrls(shortcut.url));
    setFaviconIndex(0);
    setImgOk(true);
    resolveFaviconUrls(shortcut.url).then(urls => {
      if (!active) return;
      setFavicons(urls);
      setFaviconIndex(0);
      setImgOk(true);
    });
    return () => { active = false; };
  }, [shortcut.url]);

  function handlePointerMove(event) {
    if (event.pointerType === 'touch') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    event.currentTarget.style.setProperty('--tilt-x', `${-y * 12}deg`);
    event.currentTarget.style.setProperty('--tilt-y', `${x * 12}deg`);
  }

  function resetTilt(event) {
    event.currentTarget.style.setProperty('--tilt-x', '0deg');
    event.currentTarget.style.setProperty('--tilt-y', '0deg');
  }

  function handleTileClick(event) {
    const face = tileRef.current?.querySelector('.shortcut-face');
    if (face) {
      const bounds = face.getBoundingClientRect();
      setRipple({
        id: Date.now(),
        x: event.clientX ? event.clientX - bounds.left : bounds.width / 2,
        y: event.clientY ? event.clientY - bounds.top : bounds.height / 2,
      });
      window.setTimeout(() => setRipple(null), 540);
    }
    onClick?.(event);
  }

  return (
    <div
      ref={tileRef}
      className={`shortcut-tile position-relative ${isDragging ? 'is-dragging' : ''} ${isDropTarget ? 'is-drop-target' : ''} ${isJustDropped ? 'just-dropped' : ''} ${className || ''}`}
      style={{ ...style, '--tile-glow': brandGlow }}
      draggable={draggable}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
      {...(dragHandlers || {})}
    >
      {controls && (
        <div className="shortcut-controls position-absolute d-flex justify-content-center gap-1">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }}
            className="btn btn-sm shortcut-icon-button"
            title="Edit"
          >
            <Pencil size={10} />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
            className="btn btn-sm shortcut-icon-button shortcut-remove-button"
            title="Remove"
          >
            <X size={10} />
          </button>
        </div>
      )}
      <a
        href={shortcut.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleTileClick}
        className="d-flex flex-column align-items-center gap-2 text-decoration-none"
        style={{ color: 'inherit' }}
      >
        <div
          className="shortcut-face d-flex align-items-center justify-content-center fw-bold position-relative overflow-hidden"
          style={{ background: gradient }}
        >
          <span>{initialsOf(shortcut.label)}</span>
          {favicons[faviconIndex] && imgOk && (
            <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center">
              <img
                src={favicons[faviconIndex]}
                onError={() => {
                  if (faviconIndex + 1 < favicons.length) setFaviconIndex(faviconIndex + 1);
                  else setImgOk(false);
                }}
                alt=""
                className="shortcut-favicon object-fit-contain"
              />
            </div>
          )}
          {ripple && <span key={ripple.id} className="tile-ripple" style={{ left: ripple.x, top: ripple.y }} />}
        </div>
        <span className="shortcut-label text-center text-truncate w-100">{shortcut.label}</span>
      </a>
    </div>
  );
}

function AddTile({ label, onClick }) {
  return (
    <div className="shortcut-add-tile d-flex flex-column align-items-center gap-2" onClick={onClick}>
      <div className="shortcut-add-face d-flex align-items-center justify-content-center">
        <Plus size={22} />
      </div>
      <span className="shortcut-add-label">{label}</span>
    </div>
  );
}

function ToolbarButton({ icon, title, onClick }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="btn toolbar-button d-flex align-items-center justify-content-center"
    >
      {icon}
    </button>
  );
}

function ModalShell({ children, onClose, wide }) {
  return (
    <div
      className="modal-backdrop-custom position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3 anim-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`modal-card border p-4 p-md-5 shadow-lg anim-modal-in ${wide ? 'modal-card-wide' : ''}`}>
        {children}
      </div>
    </div>
  );
}

function StickyNotesPanel({ stickyNotes, onAddStickyNote, onChangeStickyNote, onDeleteStickyNote, entranceDelay, showHeading = true, compact = false, className = '' }) {
  const [removingIds, setRemovingIds] = useState(() => new Set());
  const [activeIndex, setActiveIndex] = useState(0);
  const removalTimers = useRef(new Map());

  useEffect(() => () => {
    removalTimers.current.forEach(timer => window.clearTimeout(timer));
  }, []);

  useEffect(() => {
    setActiveIndex(index => stickyNotes.length ? index % stickyNotes.length : 0);
  }, [stickyNotes.length]);

  useEffect(() => {
    if (stickyNotes.length < 2) return undefined;
    const interval = window.setInterval(() => {
      setActiveIndex(index => (index + 1) % stickyNotes.length);
    }, 6500);
    return () => window.clearInterval(interval);
  }, [stickyNotes.length]);

  function removeNote(id) {
    setRemovingIds(prev => new Set(prev).add(id));
    const previousTimer = removalTimers.current.get(id);
    if (previousTimer) window.clearTimeout(previousTimer);
    const timer = window.setTimeout(() => {
      onDeleteStickyNote(id);
      setRemovingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      removalTimers.current.delete(id);
    }, 240);
    removalTimers.current.set(id, timer);
  }

  function moveSlide(amount) {
    setActiveIndex(index => (index + amount + stickyNotes.length) % stickyNotes.length);
  }

  const activeNote = stickyNotes[activeIndex] || null;
  const previousNote = stickyNotes.length > 1 ? stickyNotes[(activeIndex - 1 + stickyNotes.length) % stickyNotes.length] : null;
  const nextNote = stickyNotes.length > 1 ? stickyNotes[(activeIndex + 1) % stickyNotes.length] : null;

  return (
    <aside className={`sticky-notes-rail search-dimmable ${compact ? 'compact-sticky-notes' : ''} ${className}`} style={{ animationDelay: entranceDelay }}>
      {showHeading && (
        <div className="d-flex align-items-center justify-content-between border-bottom border-light border-opacity-10 pb-3 mb-3">
          <div className="d-flex align-items-center gap-2">
            <StickyNote size={16} className="text-warning" />
            <h2 className="h6 fw-semibold mb-0">sticky notes</h2>
            <span className="small text-white-50">{stickyNotes.length}</span>
          </div>
          <button
            type="button"
            onClick={onAddStickyNote}
            title="Add sticky note"
            aria-label="Add sticky note"
            className="btn btn-sm btn-outline-light square-action"
          >
            <Plus size={16} />
          </button>
        </div>
      )}

      {activeNote ? (
        <div className="sticky-note-deck">
          {previousNote && <div className="sticky-note-back sticky-note-back-previous" style={{ background: previousNote.color || NOTE_COLORS[0] }} />}
          {nextNote && <div className="sticky-note-back sticky-note-back-next" style={{ background: nextNote.color || NOTE_COLORS[0] }} />}
          <article
            key={activeNote.id}
            className={`sticky-note rounded-3 p-3 shadow ${removingIds.has(activeNote.id) ? 'is-removing' : ''}`}
            style={{ background: activeNote.color || NOTE_COLORS[0] }}
          >
            <div className="d-flex align-items-center gap-2">
              <input
                aria-label="Sticky note title"
                value={activeNote.title}
                onChange={(event) => onChangeStickyNote(activeNote.id, 'title', event.target.value)}
                placeholder="Title"
                maxLength={60}
                className="form-control form-control-sm sticky-note-title"
              />
              <button
                type="button"
                onClick={() => removeNote(activeNote.id)}
                title="Delete sticky note"
                aria-label="Delete sticky note"
                className="btn btn-sm sticky-note-delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <textarea
              aria-label="Sticky note text"
              value={activeNote.text}
              onChange={(event) => onChangeStickyNote(activeNote.id, 'text', event.target.value)}
              placeholder="Type a note..."
              className="form-control typing-field sticky-note-content mt-2"
            />
            <footer className="sticky-note-footer d-flex align-items-center justify-content-between mt-3">
              <span className="small">Expires {formatStickyExpiry(activeNote.expiresAt)}</span>
              {stickyNotes.length > 1 && <span className="small">{activeIndex + 1} / {stickyNotes.length}</span>}
            </footer>
          </article>
          {stickyNotes.length > 1 && (
            <div className="sticky-note-navigation d-flex justify-content-center gap-2 mt-3">
              <button type="button" className="btn btn-sm btn-outline-light" aria-label="Previous sticky note" onClick={() => moveSlide(-1)}><ChevronLeft size={16} /></button>
              <button type="button" className="btn btn-sm btn-outline-light" aria-label="Next sticky note" onClick={() => moveSlide(1)}><ChevronRight size={16} /></button>
            </div>
          )}
        </div>
      ) : showHeading ? <p className="py-2 small text-white-50">No sticky notes yet.</p> : null}
    </aside>
  );
}

/* ---------- main app ---------- */

export default function ShortcutsApp() {
  const [categories, setCategories] = useState([]);
  const [pinned, setPinned] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [stickyNotes, setStickyNotes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [databaseError, setDatabaseError] = useState('');
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [activePage, setActivePage] = useState(() => window.location.hash === '#notes' ? 'notes' : 'links');
  const [compactNotesOpen, setCompactNotesOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [justDroppedId, setJustDroppedId] = useState(null);

  const dragRef = useRef(null);
  const toastTimer = useRef(null);
  const searchRef = useRef(null);
  const saveQueue = useRef(Promise.resolve());

  useEffect(() => {
    const breakpoint = window.matchMedia('(max-width: 1023px)');
    const handleBreakpointChange = (event) => {
      if (event.matches) setCompactNotesOpen(false);
    };
    breakpoint.addEventListener('change', handleBreakpointChange);
    return () => breakpoint.removeEventListener('change', handleBreakpointChange);
  }, []);

  useEffect(() => {
    const handleRouteChange = () => setActivePage(window.location.hash === '#notes' ? 'notes' : 'links');
    window.addEventListener('hashchange', handleRouteChange);
    return () => window.removeEventListener('hashchange', handleRouteChange);
  }, []);

  /* ----- load ----- */
  useEffect(() => {
    let cancelled = false;
    const readLegacyValue = (key, fallback) => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : deepClone(fallback);
      } catch {
        return deepClone(fallback);
      }
    };

    async function loadWorkspace() {
      try {
        const response = await fetch('/api/state');
        if (!response.ok) throw new Error('The workspace could not be loaded.');
        const result = await response.json();
        let state = result.state;

        if (result.isNew) {
          state = {
            categories: readLegacyValue('shortcut_categories', DEFAULT_CATEGORIES),
            pinned: readLegacyValue('shortcut_pinned', DEFAULT_PINNED),
            settings: readLegacyValue('shortcut_settings', DEFAULT_SETTINGS),
            notepad: '',
            notes: [],
            activeNoteId: null,
            stickyNotes: [],
          };
          const migration = await fetch('/api/state', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state),
          });
          if (!migration.ok) throw new Error('Existing shortcuts could not be imported into MongoDB.');
        }

        if (cancelled) return;
        setCategories(state.categories);
        setPinned(state.pinned);
        setSettings(normalizeSettings(state.settings));
        const storedNotes = Array.isArray(state.notes) ? state.notes : [];
        const restoredNotes = storedNotes.length > 0
          ? storedNotes
          : state.notepad
            ? [{ id: `imported-${Date.now()}`, title: 'Imported note', content: state.notepad }]
            : storedNotes;
        setNotes(restoredNotes);
        setActiveNoteId(restoredNotes.some(note => note.id === state.activeNoteId)
          ? state.activeNoteId
          : restoredNotes[0]?.id || null);
        setStickyNotes(state.stickyNotes || []);
        setDatabaseError('');
      } catch (error) {
        if (!cancelled) setDatabaseError(error.message || 'Could not connect to MongoDB.');
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    loadWorkspace();
    return () => { cancelled = true; };
  }, []);

  /* ----- persist workspace to MongoDB ----- */
  useEffect(() => {
    if (!loaded || databaseError) return undefined;
    const timer = setTimeout(() => {
      const activeNote = notes.find(note => note.id === activeNoteId);
      const state = { categories, pinned, settings, notepad: activeNote?.content || '', notes, activeNoteId, stickyNotes };
      saveQueue.current = saveQueue.current.then(async () => {
        const response = await fetch('/api/state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state),
        });
        if (!response.ok) throw new Error('Your changes could not be saved to MongoDB.');
      }).catch((error) => {
        setDatabaseError(error.message || 'Could not save to MongoDB.');
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [categories, pinned, settings, notes, activeNoteId, stickyNotes, loaded, databaseError]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1600);
  }, []);

  useEffect(() => {
    if (!loaded) return undefined;
    const legacyNotes = stickyNotes.some(note => !note.expiresAt);
    if (legacyNotes) {
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString();
      setStickyNotes(prev => prev.map(note => note.expiresAt ? note : {
        ...note,
        createdAt: note.createdAt || createdAt.toISOString(),
        expiresAt,
      }));
      return undefined;
    }

    const expiryTimes = stickyNotes.map(note => Date.parse(note.expiresAt)).filter(Number.isFinite);
    if (expiryTimes.length === 0) return undefined;
    const timer = window.setTimeout(() => {
      const now = Date.now();
      const expiredCount = stickyNotes.filter(note => Date.parse(note.expiresAt) <= now).length;
      if (expiredCount === 0) return;
      setStickyNotes(prev => prev.filter(note => Date.parse(note.expiresAt) > now));
      showToast(expiredCount === 1 ? 'Sticky note expired' : 'Sticky notes expired');
    }, Math.max(0, Math.min(...expiryTimes) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [stickyNotes, loaded, showToast]);

  function navigateTo(page) {
    const nextHash = page === 'notes' ? '#notes' : '#links';
    setActivePage(page);
    if (window.location.hash !== nextHash) window.location.hash = nextHash;
  }

  /* ----- locating shortcuts ----- */
  const locate = useCallback((id) => {
    for (const cat of categories) {
      const idx = cat.shortcuts.findIndex(s => s.id === id);
      if (idx !== -1) return { type: 'category', catId: cat.id, idx };
    }
    const pIdx = pinned.findIndex(p => p.id === id);
    if (pIdx !== -1) return { type: 'pinned', idx: pIdx };
    return null;
  }, [categories, pinned]);

  const getShortcut = useCallback((loc) => {
    if (!loc) return null;
    if (loc.type === 'category') {
      const cat = categories.find(c => c.id === loc.catId);
      return cat ? cat.shortcuts[loc.idx] : null;
    }
    return pinned[loc.idx];
  }, [categories, pinned]);

  /* ----- clicks ----- */
  function registerClick(id) {
    setCategories(prev => prev.map(cat => ({
      ...cat,
      shortcuts: cat.shortcuts.map(s => s.id === id ? { ...s, clicks: (s.clicks || 0) + 1 } : s)
    })));
    setPinned(prev => prev.map(s => s.id === id ? { ...s, clicks: (s.clicks || 0) + 1 } : s));
  }

  /* ----- CRUD: shortcuts ----- */
  function upsertShortcut({ id, label, url, pin, catId }) {
    const existingLoc = id ? locate(id) : null;

    if (existingLoc) {
      const current = getShortcut(existingLoc);
      const updated = { ...current, label, url };

      if (existingLoc.type === 'category') {
        setCategories(prev => prev.map(cat =>
          cat.id === existingLoc.catId ? { ...cat, shortcuts: cat.shortcuts.filter(s => s.id !== id) } : cat
        ));
      } else {
        setPinned(prev => prev.filter(s => s.id !== id));
      }

      if (pin) {
        setPinned(prev => [...prev, updated]);
      } else {
        setCategories(prev => prev.map(cat =>
          cat.id === catId ? { ...cat, shortcuts: [...cat.shortcuts, updated] } : cat
        ));
      }
    } else {
      const newItem = { id: 's' + Date.now(), label, url, clicks: 0 };
      if (pin) {
        setPinned(prev => [...prev, newItem]);
      } else {
        setCategories(prev => prev.map(cat =>
          cat.id === catId ? { ...cat, shortcuts: [...cat.shortcuts, newItem] } : cat
        ));
      }
    }
  }

  function removeShortcut(id) {
    const loc = locate(id);
    if (!loc) return;
    if (loc.type === 'category') {
      setCategories(prev => prev.map(cat =>
        cat.id === loc.catId ? { ...cat, shortcuts: cat.shortcuts.filter(s => s.id !== id) } : cat
      ));
    } else {
      setPinned(prev => prev.filter(s => s.id !== id));
    }
    showToast('Removed');
  }

  /* ----- drag & drop (category grids only) ----- */
  function moveShortcut(shortcutId, targetCatId, beforeId) {
    setCategories(prev => {
      let item = null;
      const withoutItem = prev.map(cat => {
        const idx = cat.shortcuts.findIndex(s => s.id === shortcutId);
        if (idx !== -1) {
          item = cat.shortcuts[idx];
          return { ...cat, shortcuts: cat.shortcuts.filter(s => s.id !== shortcutId) };
        }
        return cat;
      });
      if (!item) return prev;
      return withoutItem.map(cat => {
        if (cat.id !== targetCatId) return cat;
        const shortcuts = [...cat.shortcuts];
        if (beforeId) {
          const idx = shortcuts.findIndex(s => s.id === beforeId);
          shortcuts.splice(idx, 0, item);
        } else {
          shortcuts.push(item);
        }
        return { ...cat, shortcuts };
      });
    });
  }

  function finishDrop(shortcutId) {
    dragRef.current = null;
    setDraggingId(null);
    setDropTargetId(null);
    if (!shortcutId) return;
    setJustDroppedId(shortcutId);
    window.setTimeout(() => {
      setJustDroppedId(current => current === shortcutId ? null : current);
    }, 450);
  }

  /* ----- CRUD: categories ----- */
  function addCategory(name, color) {
    setCategories(prev => [...prev, { id: 'cat' + Date.now(), name, color, shortcuts: [] }]);
  }
  function updateCategory(id, name, color) {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name, color } : c));
  }
  function removeCategory(id) {
    setCategories(prev => prev.filter(c => c.id !== id));
    showToast('Group deleted');
  }

  function addNote() {
    const note = { id: `note${Date.now()}`, title: 'Untitled note', content: '', updatedAt: new Date().toISOString() };
    setNotes(prev => [note, ...prev]);
    setActiveNoteId(note.id);
  }

  function updateNote(id, field, value) {
    setNotes(prev => prev.map(note => note.id === id
      ? { ...note, [field]: value, updatedAt: new Date().toISOString() }
      : note));
  }

  function deleteNote(id) {
    const remaining = notes.filter(note => note.id !== id);
    setNotes(remaining);
    if (activeNoteId === id) setActiveNoteId(remaining[0]?.id || null);
    showToast('Note deleted');
  }

  function addStickyNote() {
    const createdAt = new Date();
    setStickyNotes(prev => [...prev, {
      id: `note${Date.now()}`,
      title: '',
      text: '',
      color: NOTE_COLORS[prev.length % NOTE_COLORS.length],
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    }]);
  }

  function updateStickyNote(id, field, value) {
    setStickyNotes(prev => prev.map(note => note.id === id ? { ...note, [field]: value } : note));
  }

  /* ----- export / import ----- */
  function handleExport() {
    const activeNote = notes.find(note => note.id === activeNoteId);
    const data = JSON.stringify({ categories, pinned, settings, notes, activeNoteId, notepad: activeNote?.content || '', stickyNotes }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'shortcuts-backup.json'; a.click();
    URL.revokeObjectURL(url);
    showToast('Exported');
  }

  const importInputRef = useRef(null);
  async function handleImportFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.categories) throw new Error('bad format');
      if (window.confirm('This will replace your current shortcuts. Continue?')) {
        setCategories(parsed.categories);
        setPinned(parsed.pinned || []);
        setSettings(normalizeSettings(parsed.settings));
        const savedNotes = Array.isArray(parsed.notes) ? parsed.notes : [];
        const importedNotes = savedNotes.length > 0
          ? savedNotes
          : parsed.notepad
            ? [{ id: `imported-${Date.now()}`, title: 'Imported note', content: parsed.notepad }]
            : savedNotes;
        setNotes(importedNotes);
        setActiveNoteId(importedNotes.some(note => note.id === parsed.activeNoteId)
          ? parsed.activeNoteId
          : importedNotes[0]?.id || null);
        setStickyNotes(parsed.stickyNotes || []);
        showToast('Imported!');
      }
    } catch (e) {
      showToast('Invalid file');
    }
  }

  /* ----- search + keyboard shortcuts ----- */
  function runSearch() {
    const q = search.trim();
    if (q) window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank');
  }

  useEffect(() => {
    function onKeyDown(e) {
      const tag = document.activeElement.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.key === '/' && !typing) { e.preventDefault(); searchRef.current?.focus(); }
      if (!typing && /^[1-9]$/.test(e.key)) {
        const flat = categories.flatMap(c => c.shortcuts);
        const idx = parseInt(e.key, 10) - 1;
        if (flat[idx]) { registerClick(flat[idx].id); window.open(flat[idx].url, '_blank'); }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [categories]);

  function greeting() {
    const hour = new Date().getHours();
    return hour < 12 ? 'good morning' : hour < 18 ? 'good afternoon' : 'good evening';
  }

  if (!loaded) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center text-white-50 small">
        <span className="anim-pulse-fade">loading your shortcuts…</span>
      </div>
    );
  }

  if (databaseError) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center px-3 text-light">
        <div className="database-error text-center">
          <h1 className="h4 fw-semibold">MongoDB connection needed</h1>
          <p className="mt-3 text-white-50">{databaseError} Start MongoDB and configure <code>MONGODB_URI</code> in your local .env file, then reload this page.</p>
          <button onClick={() => window.location.reload()} className="btn btn-outline-light mt-3">Retry connection</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-shell min-vh-100 text-light ${searchFocused ? 'is-searching' : ''}`}>
      {/* main column */}
      <div className="container-fluid app-content py-4 py-lg-5 anim-slide-in">

        <div className="search-dimmable d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
          <div className="anim-enter-down">
            <div className="small text-white-50 mb-1 d-flex align-items-center gap-2">
              <Sparkles size={13} className="text-info anim-float-badge" />
              {greeting()}
            </div>
            <h1 className="display-6 fw-bold mb-0">your world, one tap away</h1>
          </div>
          <div className="d-flex flex-wrap gap-2 flex-shrink-0">
            <ToolbarButton icon={<Download size={16} />} title="Export shortcuts" onClick={handleExport} />
            <ToolbarButton icon={<Upload size={16} />} title="Import shortcuts" onClick={() => importInputRef.current?.click()} />
            <ToolbarButton icon={<HelpCircle size={16} />} title="Set as homepage" onClick={() => setModal({ type: 'help' })} />
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              className="d-none"
              onChange={(e) => { handleImportFile(e.target.files[0]); e.target.value = ''; }}
            />
          </div>
        </div>

        <nav className="page-switcher nav nav-pills gap-1 mb-4" aria-label="Workspace pages">
          <button
            type="button"
            onClick={() => navigateTo('links')}
            aria-current={activePage === 'links' ? 'page' : undefined}
            className={`nav-link d-inline-flex align-items-center gap-2 ${activePage === 'links' ? 'active' : ''}`}
          >
            <Link2 size={15} />
            <span>links</span>
          </button>
          <button
            type="button"
            onClick={() => navigateTo('notes')}
            aria-current={activePage === 'notes' ? 'page' : undefined}
            className={`nav-link d-inline-flex align-items-center gap-2 ${activePage === 'notes' ? 'active' : ''}`}
          >
            <NotebookPen size={15} />
            <span>notepad</span>
            <span className="small text-white-50">{notes.length}</span>
          </button>
        </nav>

        {activePage === 'notes' ? (
          <NotesPage
            notes={notes}
            activeNoteId={activeNoteId}
            onCreate={addNote}
            onSelect={setActiveNoteId}
            onUpdate={updateNote}
            onDelete={deleteNote}
            className="notes-page"
          />
        ) : (
          <>
            <div className="search-shell position-relative mb-4 anim-enter-down" style={{ animationDelay: '90ms' }}>
              <Search size={16} className="search-icon position-absolute text-white-50" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
                placeholder="Search Google"
                className="form-control search-input"
              />
              <kbd className="search-hotkey position-absolute">/</kbd>
            </div>



            <div className="mb-3 d-flex justify-content-end d-lg-none">
              <button
                type="button"
                onClick={() => setCompactNotesOpen(open => !open)}
                aria-expanded={compactNotesOpen}
                className="btn btn-sm btn-outline-light d-inline-flex align-items-center gap-2"
              >
                <StickyNote size={14} className="text-warning" />
                <span>{compactNotesOpen ? 'hide sticky notes' : `show sticky notes (${stickyNotes.length})`}</span>
                {compactNotesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {compactNotesOpen && (
              <StickyNotesPanel
                stickyNotes={stickyNotes}
                side="all"
                compact
                onAddStickyNote={addStickyNote}
                onChangeStickyNote={updateStickyNote}
                onDeleteStickyNote={(id) => setStickyNotes(prev => prev.filter(note => note.id !== id))}
                className="mb-4 d-lg-none"
              />
            )}

            <div className="row g-4 g-lg-5">
              <StickyNotesPanel
                stickyNotes={stickyNotes}
                side="all"
                showHeading
                entranceDelay="220ms"
                onAddStickyNote={addStickyNote}
                onChangeStickyNote={updateStickyNote}
                onDeleteStickyNote={(id) => setStickyNotes(prev => prev.filter(note => note.id !== id))}
                className="d-none d-lg-block col-lg-6 col-xl-5"
              />

              <section className="col-12 col-lg-6 col-xl-7 search-dimmable">
                <div className="search-dimmable mb-4 anim-stagger-in text-center" style={{ animationDelay: '170ms' }}>
                  <div className="mb-3 d-flex align-items-center justify-content-center gap-2 small text-white-75">
                    <Pin size={14} className="text-success" />
                    <h2 className="fw-semibold mb-0">pinned links</h2>
                  </div>
                  <div className="d-flex flex-wrap justify-content-center gap-3">
                    {pinned.map((shortcut, index) => (
                      <Tile
                        key={shortcut.id}
                        shortcut={shortcut}
                        gradient={PINNED_GRAD}
                        draggable={false}
                        controls
                        onClick={() => registerClick(shortcut.id)}
                        onEdit={() => setModal({ type: 'shortcut', existing: shortcut, forcePinned: true })}
                        onRemove={() => removeShortcut(shortcut.id)}
                        style={{ animationDelay: `${index * 50}ms` }}
                        className="anim-pop-in"
                      />
                    ))}
                    <AddTile label="pin new" onClick={() => setModal({ type: 'shortcut', forcePinned: true })} />
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="small text-white-50 text-uppercase">your groups</span>
                  <button
                    onClick={() => setModal({ type: 'category' })}
                    className="btn btn-sm btn-outline-light"
                  >
                    + new group
                  </button>
                </div>

                <div className="d-flex flex-column gap-4 mt-3">
                  {categories.map((cat, categoryIndex) => (
                    <div key={cat.id} className="group-section anim-stagger-in" style={{ animationDelay: `${220 + categoryIndex * 55}ms` }}>
                      <div className="d-flex align-items-center gap-2 mb-3">
                        <span className="category-color-dot rounded-circle" style={{ background: cat.color }} />
                        <h2 className="h6 fw-semibold text-white-75 mb-0">{cat.name}</h2>
                        <button onClick={() => setModal({ type: 'category', existing: cat })} className="btn btn-sm btn-link link-light p-0 group-action">edit</button>
                        <button onClick={() => removeCategory(cat.id)} className="btn btn-sm btn-link link-danger p-0 group-action">delete</button>
                      </div>
                      <div
                        className="d-flex flex-wrap gap-3 p-2 shortcut-group-grid"
                        style={{ minHeight: '92px' }}
                        onDragOver={(e) => { e.preventDefault(); setDropTargetId(null); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const shortcutId = dragRef.current?.shortcutId;
                          if (shortcutId) moveShortcut(shortcutId, cat.id, null);
                          finishDrop(shortcutId);
                        }}
                      >
                        {cat.shortcuts.map((s, i) => (
                          <Tile
                            key={s.id}
                            shortcut={s}
                            gradient={cat.color}
                            draggable
                            controls
                            isDragging={draggingId === s.id}
                            isDropTarget={dropTargetId === s.id}
                            isJustDropped={justDroppedId === s.id}
                            onClick={() => registerClick(s.id)}
                            onEdit={() => setModal({ type: 'shortcut', catId: cat.id, existing: s })}
                            onRemove={() => removeShortcut(s.id)}
                            style={{ animationDelay: `${i * 50}ms` }}
                            className="anim-pop-in"
                            dragHandlers={{
                              onDragStart: () => { dragRef.current = { catId: cat.id, shortcutId: s.id }; setDraggingId(s.id); setDropTargetId(null); },
                              onDragEnd: () => { setDraggingId(null); setDropTargetId(null); },
                              onDragOver: (e) => { e.preventDefault(); e.stopPropagation(); setDropTargetId(s.id); },
                              onDrop: (e) => {
                                e.preventDefault(); e.stopPropagation();
                                const shortcutId = dragRef.current?.shortcutId;
                                if (shortcutId && shortcutId !== s.id) moveShortcut(shortcutId, cat.id, s.id);
                                finishDrop(shortcutId);
                              },
                            }}
                          />
                        ))}
                        <AddTile label="add" onClick={() => setModal({ type: 'shortcut', catId: cat.id })} />
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-center small text-white-50 mt-5">drag any shortcut to reorder or move it into another group · press 1–9 to jump to a shortcut</p>
              </section>
            </div>
          </>
        )}
      </div>

      {toast && (
        <div className="position-fixed bottom-0 start-50 translate-middle-x mb-4 px-3 py-2 rounded-pill border toast-message small anim-modal-in">
          {toast}
        </div>
      )}

      {modal?.type === 'shortcut' && (
        <ShortcutModal
          modal={modal}
          categories={categories}
          onClose={() => setModal(null)}
          onSave={(data) => { upsertShortcut(data); setModal(null); showToast(data.id ? 'Saved' : 'Added'); }}
        />
      )}

      {modal?.type === 'category' && (
        <CategoryModal
          modal={modal}
          categoriesCount={categories.length}
          onClose={() => setModal(null)}
          onSave={(name, color, existingId) => {
            if (existingId) updateCategory(existingId, name, color);
            else addCategory(name, color);
            setModal(null);
            showToast(existingId ? 'Group updated' : 'Group created');
          }}
        />
      )}

      {modal?.type === 'help' && <HelpModal onClose={() => setModal(null)} />}
    </div>
  );
}

/* ---------- modals ---------- */

function ShortcutModal({ modal, categories, onClose, onSave }) {
  const existing = modal.existing || null;
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [pin, setPin] = useState(false);
  const [catId, setCatId] = useState('');
  const [labelManual, setLabelManual] = useState(false);

  useEffect(() => {
    setLabel(existing ? existing.label : '');
    setUrl(existing ? existing.url : '');
    setLabelManual(!!existing);
    const shouldPin = !!modal.forcePinned;
    setPin(shouldPin);
    setCatId(modal.catId || (categories[0] && categories[0].id) || '');
  }, [modal]);

  function handleUrlChange(v) {
    setUrl(v);
    if (!labelManual) {
      const guess = guessNameFromUrl(v);
      if (guess) setLabel(guess);
    }
  }

  function handleSave() {
    if (!label.trim() || !url.trim()) return;
    onSave({ id: existing ? existing.id : null, label: label.trim(), url: normalizeUrl(url), pin, catId });
  }

  return (
    <ModalShell onClose={onClose}>
      <h2 className="h5 fw-semibold mb-4">{existing ? 'edit shortcut' : 'add a shortcut'}</h2>

      <div className="mb-4">
        <label className="form-label small text-white-50 mb-1">link</label>
        <input
          autoFocus
          value={url}
          onChange={(e) => handleUrlChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          placeholder="e.g. instagram.com/yourname"
          className="form-control app-form-control"
        />
      </div>

      <div className="mb-4">
        <label className="form-label small text-white-50 mb-1">name</label>
        <input
          value={label}
          onChange={(e) => { setLabel(e.target.value); setLabelManual(true); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          maxLength={20}
          placeholder="e.g. Instagram"
          className="form-control app-form-control"
        />
      </div>

      <div className="form-check d-flex align-items-center gap-2 mb-4">
        <input type="checkbox" id="pinCheck" checked={pin} onChange={(e) => setPin(e.target.checked)} className="form-check-input mt-0" />
        <label htmlFor="pinCheck" className="form-check-label small text-white-75 d-flex align-items-center gap-1"><Pin size={12} /> pin to side (always visible, never moves)</label>
      </div>

      {!pin && (
        <div className="mb-5">
          <label className="form-label small text-white-50 mb-1">group</label>
          <select
            value={catId}
            onChange={(e) => setCatId(e.target.value)}
            className="form-select app-form-control"
          >
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      <div className="d-flex justify-content-end gap-2 mt-3">
        <button onClick={onClose} className="btn btn-link text-white-50 text-decoration-none">cancel</button>
        <button
          onClick={handleSave}
          className="btn btn-primary"
        >
          {existing ? 'save changes' : 'add'}
        </button>
      </div>
    </ModalShell>
  );
}

function CategoryModal({ modal, categoriesCount, onClose, onSave }) {
  const existing = modal.existing || null;
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[0].grad);

  useEffect(() => {
    setName(existing ? existing.name : '');
    setColor(existing ? existing.color : PALETTE[categoriesCount % PALETTE.length].grad);
  }, [modal]);

  function handleSave() {
    if (!name.trim()) return;
    onSave(name.trim(), color, existing ? existing.id : null);
  }

  return (
    <ModalShell onClose={onClose}>
      <h2 className="h5 fw-semibold mb-4">{existing ? 'edit group' : 'name this group'}</h2>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
        maxLength={24}
        placeholder="e.g. Work, Fun, News"
        className="form-control app-form-control mb-4"
      />
      <label className="form-label small text-white-50 mb-2">color</label>
      <div className="d-flex flex-wrap gap-2 mb-4">
        {PALETTE.map(p => (
          <button
            key={p.grad}
            onClick={() => setColor(p.grad)}
            title={p.name}
            className="btn palette-swatch"
            style={{ background: p.grad, outline: color === p.grad ? '2px solid white' : 'none', outlineOffset: '2px' }}
          />
        ))}
      </div>
      <div className="d-flex justify-content-end gap-2">
        <button onClick={onClose} className="btn btn-link text-white-50 text-decoration-none">cancel</button>
        <button
          onClick={handleSave}
          className="btn btn-info text-dark"
        >
          {existing ? 'save changes' : 'create'}
        </button>
      </div>
    </ModalShell>
  );
}

function HelpModal({ onClose }) {
  return (
    <ModalShell onClose={onClose} wide>
      <h2 className="h5 fw-semibold mb-3">set this as your homepage</h2>
      <div className="text-white-75 help-copy">
        <p><b className="text-light">Chrome:</b> Settings → On startup → Open a specific page → add this page's location.</p>
        <p><b className="text-light">Firefox:</b> Settings → Home → Homepage and new windows → Custom URLs → add this page's location.</p>
        <p><b className="text-light">Edge:</b> Settings → Start, home, and new tabs → add this page's location.</p>
        <p><b className="text-light">Safari:</b> Settings → General → Homepage → add this page's location.</p>
        <p className="text-white-50">Tip: host this page somewhere permanent first, then point your browser to that link.</p>
      </div>
      <div className="d-flex justify-content-end mt-4">
        <button onClick={onClose} className="btn btn-link text-white-50 text-decoration-none">got it</button>
      </div>
    </ModalShell>
  );
}