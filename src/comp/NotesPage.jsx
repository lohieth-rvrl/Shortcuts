import { useEffect, useRef, useState } from 'react';
import { FilePlus2, FileText, FolderOpen, NotebookPen, Trash2 } from 'lucide-react';

export default function NotesPage({ notes, activeNoteId, onCreate, onSelect, onUpdate, onDelete }) {
  const activeNote = notes.find(note => note.id === activeNoteId) || null;
  const [removingIds, setRemovingIds] = useState(() => new Set());
  const removalTimers = useRef(new Map());

  useEffect(() => () => {
    removalTimers.current.forEach(timer => window.clearTimeout(timer));
  }, []);

  function removeFile(id) {
    setRemovingIds(prev => new Set(prev).add(id));
    const timer = window.setTimeout(() => {
      onDelete(id);
      setRemovingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      removalTimers.current.delete(id);
    }, 200);
    removalTimers.current.set(id, timer);
  }

  return (
    <section className="note-manager notes-page">
      <header className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div className="d-flex align-items-center gap-2">
          <NotebookPen size={16} className="text-success" />
          <h2 className="h6 fw-semibold mb-0">notepad</h2>
          <span className="small text-white-50">{notes.length} {notes.length === 1 ? 'note' : 'notes'}</span>
        </div>
        <button
          type="button"
          onClick={onCreate}
          title="Create a note"
          className="btn btn-sm btn-success d-inline-flex align-items-center gap-2"
        >
          <FilePlus2 size={15} />
          <span>new note</span>
        </button>
      </header>

      <div className="row g-3 note-manager-grid">
        <aside className="col-12 col-md-4 col-lg-3 note-file-list rounded-3 border p-2">
          <div className="d-flex align-items-center gap-2 mb-2 px-2 py-1 small text-uppercase text-white-50">
            <FolderOpen size={13} />
            <span>my notes</span>
          </div>
          {notes.length === 0 && <p className="px-2 py-3 small text-white-50">Your notes will appear here.</p>}
          <div className="d-flex flex-column gap-1 note-file-list-items">
            {notes.map(note => (
              <div
                key={note.id}
                className={`note-file-row ${note.id === activeNoteId ? 'is-active' : ''} ${removingIds.has(note.id) ? 'is-removing' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(note.id)}
                  className="btn note-file-select d-flex align-items-center gap-2 text-start"
                  aria-current={note.id === activeNoteId ? 'page' : undefined}
                >
                  <FileText size={14} className="flex-shrink-0 text-success" />
                  <span className="note-file-name">{note.title || 'Untitled note'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => removeFile(note.id)}
                  title={`Delete ${note.title || 'untitled note'}`}
                  aria-label={`Delete ${note.title || 'untitled note'}`}
                  className="btn btn-sm note-file-delete flex-shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </aside>

        <div className="col note-editor rounded-3 border p-3 p-sm-4">
          {activeNote ? (
            <>
              <div className="d-flex align-items-center gap-3 border-bottom pb-3">
                <FileText size={16} className="flex-shrink-0 text-success" />
                <input
                  aria-label="Note name"
                  value={activeNote.title}
                  onChange={event => onUpdate(activeNote.id, 'title', event.target.value)}
                  placeholder="Untitled note"
                  maxLength={64}
                  className="form-control note-title-input"
                />
                <span className="d-none d-md-inline small text-white-50">autosaved</span>
              </div>
              <textarea
                aria-label="Note content"
                value={activeNote.content}
                onChange={event => onUpdate(activeNote.id, 'content', event.target.value)}
                placeholder="Start writing..."
                className="form-control typing-field note-content-input mt-3"
              />
              <div className="mt-2 text-end small text-white-50">{activeNote.content.length} characters</div>
            </>
          ) : (
            <div className="d-flex flex-column align-items-center justify-content-center text-center note-empty-state">
              <FolderOpen size={24} className="text-white-50" />
              <p className="mt-3 mb-1">No note open</p>
              <p className="small text-white-50">Create a note or choose one from your files.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
