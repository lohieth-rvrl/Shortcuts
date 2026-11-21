import { useLayoutEffect, useRef, useState } from 'react';
import { Code, Image as ImageIcon, Minus, Plus, Video, X } from 'lucide-react';
import { parseBlocks, safeImageUrl, serializeBlocks, uid, youtubeId } from './noteBlocks.js';

// Medium-style editor: text with a "+" menu to add an image, YouTube video, code block or divider at the cursor.

function useAutoGrow(ref, value) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [ref, value]);
}

// Joins neighbouring text blocks and makes sure there is always an empty line to type on at the end.
function tidy(blocks) {
  const out = [];
  for (const b of blocks) {
    const last = out[out.length - 1];
    if (b.type === 'text' && last?.type === 'text') out[out.length - 1] = { ...last, text: `${last.text}\n${b.text}` };
    else out.push(b);
  }
  if (!out.length || out[out.length - 1].type !== 'text') out.push({ id: uid(), type: 'text', text: '' });
  return out;
}

const TOOLS = [
  { type: 'image', label: 'Image', Icon: ImageIcon },
  { type: 'video', label: 'Video', Icon: Video },
  { type: 'code', label: 'Code block', Icon: Code },
  { type: 'divider', label: 'Divider', Icon: Minus },
];

function TextBlock({ block, onText, onInsert, autoFocus, placeholder }) {
  const ref = useRef(null);
  const caret = useRef(0);
  const [menu, setMenu] = useState(false);
  useAutoGrow(ref, block.text);
  const remember = () => { caret.current = ref.current?.selectionStart ?? 0; };

  return (
    <div className={`nbe-text ${block.text === '' ? 'is-empty' : ''}`}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setMenu(false); }}>
      <textarea ref={ref} rows={1} className="nbe-para" aria-label="Note text" value={block.text} placeholder={placeholder} autoFocus={autoFocus}
        onChange={(e) => { onText(e.target.value); remember(); }} onSelect={remember} onKeyUp={remember} onClick={remember} />
      <div className={`nbe-insert ${menu ? 'open' : ''}`}>
        <button type="button" className="nbe-plus" aria-expanded={menu} aria-label="Add image, video, code block or divider" onClick={() => setMenu((m) => !m)}>
          <Plus size={16} />
        </button>
        {menu && (
          <span className="nbe-tools" role="group" aria-label="Insert">
            {TOOLS.map(({ type, label, Icon }) => (
              <button key={type} type="button" className="nbe-tool" title={label} aria-label={`Add ${label.toLowerCase()}`}
                onClick={() => { setMenu(false); onInsert(block.id, type, caret.current); }}>
                <Icon size={16} />
              </button>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

function EmbedForm({ icon: Icon, label, placeholder, hint, check, onSubmit, onCancel }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  function submit(e) {
    e.preventDefault();
    const value = check(draft);
    if (!value) { setError(hint); return; }
    onSubmit(value);
  }
  return (
    <form className="nbe-form" onSubmit={submit}>
      <Icon size={17} aria-hidden="true" />
      <input autoFocus value={draft} placeholder={placeholder} aria-label={label} aria-invalid={Boolean(error)} inputMode="url" spellCheck={false}
        onChange={(e) => { setDraft(e.target.value); setError(''); }} onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }} />
      <button type="submit" className="nbe-go">Add</button>
      <button type="button" className="nbe-x" onClick={onCancel} aria-label={`Cancel ${label.toLowerCase()}`}><X size={15} /></button>
      {error && <span className="nbe-error" role="alert">{error}</span>}
    </form>
  );
}

function RemoveButton({ label, onClick }) {
  return <button type="button" className="nbe-x nbe-remove" onClick={onClick} aria-label={label}><X size={14} /></button>;
}

function ImageBlock({ block, onPatch, onRemove }) {
  const [broken, setBroken] = useState(false);
  const src = safeImageUrl(block.url);
  if (!src) {
    return <EmbedForm icon={ImageIcon} label="Image link" placeholder="Paste an image link, then press Enter" hint="Paste a full image link, like https://example.com/photo.jpg"
      check={safeImageUrl} onSubmit={(url) => onPatch({ url })} onCancel={onRemove} />;
  }
  return (
    <figure className="nbe-block nbe-figure">
      {broken
        ? <div className="nbe-broken">This image couldn’t be loaded. Check the link.</div>
        : <img src={src} alt={block.alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />}
      <input className="nbe-caption" aria-label="Image caption" value={block.alt} maxLength={160} placeholder="Add a caption (optional)"
        onChange={(e) => onPatch({ alt: e.target.value.replace(/[\]\n]/g, '') })} />
      <RemoveButton label="Remove image" onClick={onRemove} />
    </figure>
  );
}

function VideoBlock({ block, onPatch, onRemove }) {
  const id = youtubeId(block.url);
  if (!id) {
    return <EmbedForm icon={Video} label="YouTube link" placeholder="Paste a YouTube link, then press Enter" hint="Paste a YouTube link, like https://www.youtube.com/watch?v=…"
      check={(v) => { const vid = youtubeId(v); return vid ? `https://www.youtube.com/watch?v=${vid}` : ''; }} onSubmit={(url) => onPatch({ url })} onCancel={onRemove} />;
  }
  return (
    <div className="nbe-block nbe-video">
      <iframe src={`https://www.youtube-nocookie.com/embed/${id}`} title="YouTube video" loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" />
      <RemoveButton label="Remove video" onClick={onRemove} />
    </div>
  );
}

function CodeBlock({ block, onPatch, onRemove }) {
  const ref = useRef(null);
  useAutoGrow(ref, block.code);
  return (
    <div className="nbe-block nbe-code">
      <div className="nbe-code-bar">
        <input className="nbe-lang" aria-label="Code language" value={block.lang} maxLength={20} placeholder="language" spellCheck={false}
          onChange={(e) => onPatch({ lang: e.target.value.replace(/[\s`]/g, '') })} />
        <RemoveButton label="Remove code block" onClick={onRemove} />
      </div>
      <textarea ref={ref} rows={3} className="nbe-code-area" aria-label="Code" value={block.code} placeholder="Type or paste code…" autoFocus={block.code === ''}
        spellCheck={false} autoCapitalize="off" autoCorrect="off" onChange={(e) => onPatch({ code: e.target.value })} />
    </div>
  );
}

function DividerBlock({ onRemove }) {
  return (
    <div className="nbe-block nbe-divider">
      <hr />
      <RemoveButton label="Remove divider" onClick={onRemove} />
    </div>
  );
}

export default function NoteEditor({ content, onChange }) {
  const rootRef = useRef(null);
  const [blocks, setBlocks] = useState(() => parseBlocks(content));
  const [focusId, setFocusId] = useState(() => blocks[0]?.id);

  function commit(next) {
    setBlocks(next);
    onChange(serializeBlocks(next));
  }
  const patch = (id, change) => commit(blocks.map((b) => (b.id === id ? { ...b, ...change } : b)));
  const remove = (id) => commit(tidy(blocks.filter((b) => b.id !== id)));

  function insert(textId, type, caret) {
    const i = blocks.findIndex((b) => b.id === textId);
    if (i < 0) return;
    const text = blocks[i].text;
    const before = text.slice(0, caret).replace(/\n$/, '');
    const after = text.slice(caret).replace(/^\n/, '');
    const fresh = { id: uid(), type, ...({ image: { alt: '', url: '' }, video: { url: '' }, code: { lang: '', code: '' } }[type] || {}) };
    const tail = { id: uid(), type: 'text', text: after };
    const items = [...(before ? [{ ...blocks[i], text: before }] : []), fresh, tail];
    setFocusId(type === 'divider' ? tail.id : fresh.id);
    commit([...blocks.slice(0, i), ...items, ...blocks.slice(i + 1)]);
  }

  function focusEnd(e) {
    if (e.target !== e.currentTarget) return;
    const areas = rootRef.current?.querySelectorAll('textarea.nbe-para');
    areas?.[areas.length - 1]?.focus();
  }

  const onlyEmpty = blocks.length === 1 && blocks[0].type === 'text' && blocks[0].text === '';

  return (
    <div className="nbe" ref={rootRef} onClick={focusEnd}>
      {blocks.map((b, i) => {
        if (b.type === 'text') {
          return <TextBlock key={b.id} block={b} autoFocus={b.id === focusId} placeholder={onlyEmpty || i === blocks.length - 1 ? 'Start writing…' : ''}
            onText={(text) => patch(b.id, { text })} onInsert={insert} />;
        }
        const props = { block: b, onPatch: (change) => patch(b.id, change), onRemove: () => remove(b.id) };
        if (b.type === 'image') return <ImageBlock key={b.id} {...props} />;
        if (b.type === 'video') return <VideoBlock key={b.id} {...props} />;
        if (b.type === 'code') return <CodeBlock key={b.id} {...props} />;
        return <DividerBlock key={b.id} onRemove={() => remove(b.id)} />;
      })}
    </div>
  );
}
