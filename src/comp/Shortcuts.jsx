import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Download, Upload, HelpCircle, Search, Plus, Pencil, X, Pin, NotebookPen, Link2, LogOut } from 'lucide-react';
import NotesPage from './NotesPage.jsx';
import StickyNotesPanel from './StickyBoard.jsx';
import { useLogo } from './logo.js';
import DefaultLogo from './DefaultLogo.jsx';


/* ---------- constants ---------- */

const PALETTE = [
  { name: 'Rose', grad: 'linear-gradient(135deg,#ec4899,#f43f5e)' },
  { name: 'Violet', grad: 'linear-gradient(135deg,#8b5cf6,#a855f7)' },
  { name: 'Sky', grad: 'linear-gradient(135deg,#22d3ee,#3b82f6)' },
  { name: 'Amber', grad: 'linear-gradient(135deg,#fbbf24,#f97316)' },
  { name: 'Mint', grad: 'linear-gradient(135deg,#34d399,#14b8a6)' },
  { name: 'Fuchsia', grad: 'linear-gradient(135deg,#d946ef,#ec4899)' },
];
const NOTE_COLORS = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fecdd3'];

const DEFAULT_CATEGORIES = [];

const DEFAULT_PINNED = [];


const SEEDED_IDS = new Set(['yt', 'ig', 'x', 'tt', 'li', 'gh', 'p_gmail', 'p_drive']);
function dropSeededSamples(state) {
  try { if (localStorage.getItem('samples-removed-v1')) return state; } catch { return state; }
  const keep = (list) => list.filter((s) => !(SEEDED_IDS.has(s.id) && !s.clicks));
  const categories = state.categories
    .map((c) => ({ ...c, shortcuts: keep(c.shortcuts || []) }))
    .filter((c) => !(['cat_socials', 'cat_work'].includes(c.id) && c.shortcuts.length === 0));
  try { localStorage.setItem('samples-removed-v1', '1'); } catch { /* ignore */ }
  return { ...state, categories, pinned: keep(state.pinned || []) };
}

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
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/* ---------- small building blocks ---------- */

function Tile({ shortcut, draggable, controls, onClick, onEdit, onRemove, dragHandlers, isDragging, isDropTarget, isJustDropped, style, className }) {
  const [brokenSrc, setBrokenSrc] = useState(null);
  const logo = useLogo(shortcut.url);
  return (
    <div
      className={`tile ${isDragging ? 'is-dragging' : ''} ${isDropTarget ? 'is-drop-target' : ''} ${isJustDropped ? 'just-dropped' : ''} ${className || ''}`}
      style={style}
      draggable={draggable}
      {...(dragHandlers || {})}
    >
      {controls && (
        <div className="tile-controls">
          <button type="button" className="chip" title="Edit" aria-label={`Edit ${shortcut.label}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }}><Pencil size={11} /></button>
          <button type="button" className="chip chip-danger" title="Remove" aria-label={`Remove ${shortcut.label}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}><X size={12} /></button>
        </div>
      )}
      <a href={shortcut.url} target="_blank" rel="noopener noreferrer" onClick={onClick} className="tile-link" draggable={false}>
        <span className={`tile-face ${logo === undefined ? 'is-loading' : ''}`}>
          {logo && brokenSrc !== logo
            ? <img key={logo} src={logo} alt="" draggable={false} referrerPolicy="no-referrer" onError={() => setBrokenSrc(logo)} className="tile-img" />
            : <DefaultLogo label={shortcut.label} url={shortcut.url} />}
        </span>
        <span className="tile-label">{shortcut.label}</span>
      </a>
    </div>
  );
}

function AddTile({ label, onClick, className = '' }) {
  return (
    <div className={`tile tile-add ${className}`}>
      <button type="button" className="tile-link" onClick={onClick} aria-label={label}>
        <span className="tile-face"><Plus size={24} /></span>
        <span className="tile-label">{label}</span>
      </button>
    </div>
  );
}

function IconButton({ icon, title, onClick, className = '' }) {
  return <button type="button" className={`icon-btn ${className}`} title={title} aria-label={title} onClick={onClick}>{icon}</button>;
}

function ModalShell({ children, onClose, wide }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`sheet ${wide ? 'sheet-wide' : ''}`} role="dialog" aria-modal="true">{children}</div>
    </div>
  );
}

export default function ShortcutsApp({ onSignOut, onUnauthorized }) {
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
  const [modal, setModal] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [justDroppedId, setJustDroppedId] = useState(null);

  const dragRef = useRef(null);
  const toastTimer = useRef(null);
  const searchRef = useRef(null);
  const saveQueue = useRef(Promise.resolve());

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
        if (response.status === 401) { onUnauthorized?.(); return; }
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

        state = dropSeededSamples(state);
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
        if (response.status === 401) { onUnauthorized?.(); return; }
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
      rot: Math.round((Math.random() * 9 - 4.5) * 10) / 10,
      z: prev.reduce((m, n) => Math.max(m, n.z || 0), 0) + 1,
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

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const hello = greeting().replace(/^./, (c) => c.toUpperCase());

  if (!loaded) {
    return <div className="boot" aria-busy="true"><span /></div>;
  }

  if (databaseError) {
    return (
      <main className="center-screen">
        <div className="notice">
          <h1>Can’t reach the database</h1>
          <p>{databaseError} Check that MongoDB is running and <code>MONGODB_URI</code> is set, then try again.</p>
          <button type="button" onClick={() => window.location.reload()} className="btn btn-primary">Try again</button>
        </div>
      </main>
    );
  }

  const stickyProps = {
    stickyNotes,
    onAddStickyNote: addStickyNote,
    onChangeStickyNote: updateStickyNote,
    onDeleteStickyNote: (id) => setStickyNotes((prev) => prev.filter((note) => note.id !== id)),
  };

  return (
    <div className={`app ${searchFocused ? 'is-searching' : ''}`}>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand"><span className="brand-mark"><Link2 size={15} strokeWidth={2.4} /></span><span>Shortcuts</span></div>
          <nav className="segmented" aria-label="Workspace pages">
            <button type="button" onClick={() => navigateTo('links')} aria-current={activePage === 'links' ? 'page' : undefined} className={activePage === 'links' ? 'active' : ''}><Link2 size={14} />Links</button>
            <button type="button" onClick={() => navigateTo('notes')} aria-current={activePage === 'notes' ? 'page' : undefined} className={activePage === 'notes' ? 'active' : ''}><NotebookPen size={14} />Notes<span className="seg-count">{notes.length}</span></button>
          </nav>
          <div className="topbar-actions">
            <IconButton className="hide-sm" icon={<Download size={17} />} title="Export shortcuts" onClick={handleExport} />
            <IconButton className="hide-sm" icon={<Upload size={17} />} title="Import shortcuts" onClick={() => importInputRef.current?.click()} />
            <IconButton icon={<HelpCircle size={17} />} title="Set as homepage" onClick={() => setModal({ type: 'help' })} />
            <IconButton icon={<LogOut size={17} />} title="Sign out" onClick={onSignOut} />
            <input ref={importInputRef} type="file" accept="application/json" hidden onChange={(e) => { handleImportFile(e.target.files[0]); e.target.value = ''; }} />
          </div>
        </div>
      </header>

      <main className="page">
        {activePage === 'notes' ? (
          <NotesPage
            notes={notes}
            activeNoteId={activeNoteId}
            onCreate={addNote}
            onSelect={setActiveNoteId}
            onUpdate={updateNote}
            onDelete={deleteNote}
          />
        ) : (
          <>
            <section className="hero">
              <p className="eyebrow">{today}</p>
              <h1>{hello}.</h1>
              <div className="spotlight">
                <Search size={19} className="spotlight-icon" aria-hidden="true" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
                  placeholder="Search Google"
                  aria-label="Search Google"
                />
                <kbd>/</kbd>
              </div>
            </section>

            <section className="dock-wrap dimmable" aria-label="Pinned links">
              <div className="dock">
                {pinned.map((shortcut, index) => (
                  <Tile
                    key={shortcut.id}
                    shortcut={shortcut}
                    controls
                    onClick={() => registerClick(shortcut.id)}
                    onEdit={() => setModal({ type: 'shortcut', existing: shortcut, forcePinned: true })}
                    onRemove={() => removeShortcut(shortcut.id)}
                    style={{ animationDelay: `${index * 45}ms` }}
                    className="tile-dock"
                  />
                ))}
                <AddTile label="Pin a link" className="tile-dock" onClick={() => setModal({ type: 'shortcut', forcePinned: true })} />
              </div>
            </section>

            <div className="columns">
              <section className="groups dimmable" aria-label="Groups">
                <div className="section-head">
                  <h2>Groups</h2>
                  <button type="button" onClick={() => setModal({ type: 'category' })} className="btn btn-tint"><Plus size={14} />New group</button>
                </div>

                {categories.length === 0 && (
                  <div className="empty">
                    <p>No groups yet</p>
                    <span>Create a group to start collecting links.</span>
                    <button type="button" className="btn btn-primary" onClick={() => setModal({ type: 'category' })}>Create your first group</button>
                  </div>
                )}

                <div className="group-list">
                  {categories.map((cat, categoryIndex) => (
                    <article key={cat.id} className="group" style={{ animationDelay: `${categoryIndex * 60}ms` }}>
                      <header className="group-head">
                        <span className="group-dot" style={{ background: cat.color }} />
                        <h3>{cat.name}</h3>
                        <span className="group-count">{cat.shortcuts.length}</span>
                        <span className="group-actions">
                          <button type="button" className="text-btn" onClick={() => setModal({ type: 'category', existing: cat })}>Edit</button>
                          <button type="button" className="text-btn text-btn-danger" onClick={() => removeCategory(cat.id)}>Delete</button>
                        </span>
                      </header>
                      <div
                        className="tiles"
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
                            draggable
                            controls
                            isDragging={draggingId === s.id}
                            isDropTarget={dropTargetId === s.id}
                            isJustDropped={justDroppedId === s.id}
                            onClick={() => registerClick(s.id)}
                            onEdit={() => setModal({ type: 'shortcut', catId: cat.id, existing: s })}
                            onRemove={() => removeShortcut(s.id)}
                            style={{ animationDelay: `${i * 40}ms` }}
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
                        <AddTile label="Add" onClick={() => setModal({ type: 'shortcut', catId: cat.id })} />
                      </div>
                    </article>
                  ))}
                </div>
                <p className="hint">Drag a shortcut to reorder it or move it to another group. Press 1–9 to open one, / to search.</p>
              </section>

              <StickyNotesPanel {...stickyProps} className="rail dimmable" />
            </div>
          </>
        )}
      </main>

      {toast && <div className="toast" role="status">{toast}</div>}

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
    setPin(!!modal.forcePinned);
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
      <h2 className="sheet-title">{existing ? 'Edit shortcut' : 'New shortcut'}</h2>
      <label className="field"><span>Link</span>
        <input autoFocus value={url} onChange={(e) => handleUrlChange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }} placeholder="instagram.com/yourname" className="input" />
      </label>
      <label className="field"><span>Name</span>
        <input value={label} onChange={(e) => { setLabel(e.target.value); setLabelManual(true); }} onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }} maxLength={20} placeholder="Instagram" className="input" />
      </label>
      <label className="check"><input type="checkbox" checked={pin} onChange={(e) => setPin(e.target.checked)} /><span><Pin size={13} /> Pin to the dock</span></label>
      {!pin && (
        <label className="field"><span>Group</span>
          <select value={catId} onChange={(e) => setCatId(e.target.value)} className="input">
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      )}
      <div className="sheet-actions">
        <button type="button" onClick={onClose} className="btn">Cancel</button>
        <button type="button" onClick={handleSave} className="btn btn-primary">{existing ? 'Save' : 'Add'}</button>
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
      <h2 className="sheet-title">{existing ? 'Edit group' : 'New group'}</h2>
      <label className="field"><span>Name</span>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }} maxLength={24} placeholder="Work, Fun, News" className="input" />
      </label>
      <div className="field"><span>Colour</span>
        <div className="swatches">
          {PALETTE.map((p) => (
            <button key={p.grad} type="button" onClick={() => setColor(p.grad)} title={p.name} aria-label={p.name} aria-pressed={color === p.grad} className={`swatch ${color === p.grad ? 'on' : ''}`} style={{ background: p.grad }} />
          ))}
        </div>
      </div>
      <div className="sheet-actions">
        <button type="button" onClick={onClose} className="btn">Cancel</button>
        <button type="button" onClick={handleSave} className="btn btn-primary">{existing ? 'Save' : 'Create'}</button>
      </div>
    </ModalShell>
  );
}

function HelpModal({ onClose }) {
  return (
    <ModalShell onClose={onClose} wide>
      <h2 className="sheet-title">Set as your homepage</h2>
      <div className="help-copy">
        <p><b>Chrome:</b> Settings → On startup → Open a specific page → add this page’s address.</p>
        <p><b>Firefox:</b> Settings → Home → Homepage and new windows → Custom URLs.</p>
        <p><b>Edge:</b> Settings → Start, home, and new tabs → add this page’s address.</p>
        <p><b>Safari:</b> Settings → General → Homepage → add this page’s address.</p>
        <p className="muted">Tip: host this page somewhere permanent first, then point your browser to that link.</p>
      </div>
      <div className="sheet-actions"><button type="button" onClick={onClose} className="btn btn-primary">Done</button></div>
    </ModalShell>
  );
}
