// Notes stay a plain string in the database. Rich blocks are stored as simple lines inside it:
//   ---                  divider
//   ![caption](url)      image
//   @[video](url)        YouTube video
//   ```lang ... ```      code block
// Anything else is ordinary text, so notes written before blocks existed still open as they were.

let counter = 0;
export const uid = () => `b${++counter}`;

const IMG = /^!\[([^\]]*)\]\((.*)\)$/;
const VID = /^@\[video\]\((.*)\)$/;
// A text line that would be mistaken for a block gets a leading backslash when saved, and loses it when read.
const LOOKS_SPECIAL = /^\\*(?:---$|```|!\[[^\]]*\]\(.*\)$|@\[video\]\(.*\)$)/;
const esc = (line) => (LOOKS_SPECIAL.test(line) ? `\\${line}` : line);
const unesc = (line) => (line.startsWith('\\') && LOOKS_SPECIAL.test(line) ? line.slice(1) : line);
const cleanAlt = (s = '') => String(s).replace(/[\r\n\]]/g, '');
const cleanUrl = (s = '') => String(s).replace(/\s/g, '');

export function parseBlocks(content) {
  const lines = String(content ?? '').split('\n');
  const out = [];
  let buf = null;
  const flush = () => {
    if (buf) out.push({ id: uid(), type: 'text', text: buf.map(unesc).join('\n') });
    buf = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    if (line === '---') {
      flush();
      out.push({ id: uid(), type: 'divider' });
    } else if ((m = line.match(IMG))) {
      flush();
      out.push({ id: uid(), type: 'image', alt: m[1], url: m[2] });
    } else if ((m = line.match(VID))) {
      flush();
      out.push({ id: uid(), type: 'video', url: m[1] });
    } else if (line.startsWith('```') && lines.indexOf('```', i + 1) !== -1) {
      flush();
      const end = lines.indexOf('```', i + 1);
      out.push({ id: uid(), type: 'code', lang: line.slice(3).trim(), code: lines.slice(i + 1, end).map(unesc).join('\n') });
      i = end;
    } else {
      (buf ||= []).push(line);
    }
  }
  flush();
  if (!out.length || out[out.length - 1].type !== 'text') out.push({ id: uid(), type: 'text', text: '' });
  return out;
}

export function serializeBlocks(blocks) {
  return blocks.map((b) => {
    if (b.type === 'divider') return '---';
    if (b.type === 'image') return `![${cleanAlt(b.alt)}](${cleanUrl(b.url)})`;
    if (b.type === 'video') return `@[video](${cleanUrl(b.url)})`;
    if (b.type === 'code') return `\`\`\`${cleanAlt(b.lang)}\n${b.code.split('\n').map(esc).join('\n')}\n\`\`\``;
    return b.text.split('\n').map(esc).join('\n');
  }).join('\n');
}

// Readable text only (no block syntax), for card previews, word counts and search.
export function toPlain(content) {
  return parseBlocks(content)
    .map((b) => (b.type === 'text' ? b.text : b.type === 'code' ? b.code : b.type === 'image' ? b.alt : ''))
    .filter(Boolean)
    .join('\n');
}

const withScheme = (s) => (/^https?:\/\//i.test(s) ? s : `https://${s}`);

export function safeImageUrl(url) {
  try {
    const u = new URL(withScheme(String(url ?? '').trim()));
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.includes('.') ? u.href : '';
  } catch {
    return '';
  }
}

export function youtubeId(url) {
  try {
    const u = new URL(withScheme(String(url ?? '').trim()));
    const host = u.hostname.replace(/^(www|m)\./, '');
    let id = '';
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v') || '';
      else id = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?]+)/)?.[1] || '';
    }
    return /^[\w-]{11}$/.test(id) ? id : '';
  } catch {
    return '';
  }
}
