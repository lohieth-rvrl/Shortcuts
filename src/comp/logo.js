import { useEffect, useState } from 'react';

// Finds a real logo for a site. Any icon smaller than 32px (including the generic globe
// that icon services return for unknown sites) is rejected, and DefaultLogo is shown instead.
const memory = new Map();
const pending = new Map();

export function hostOf(raw) {
  try {
    let u = (raw || '').trim();
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    return new URL(u).hostname;
  } catch { return ''; }
}

const candidates = (host) => [
  `https://www.google.com/s2/favicons?sz=128&domain=${host}`,
  `https://icon.horse/icon/${host}`,
  `https://icons.duckduckgo.com/ip3/${host}.ico`,
  `https://${host}/apple-touch-icon.png`,
  `https://${host}/favicon.ico`,
];

const probe = (src) => new Promise((resolve) => {
  const img = new Image();
  const timer = setTimeout(() => resolve(false), 4500);
  img.onload = () => { clearTimeout(timer); resolve(img.naturalWidth >= 32 && img.naturalHeight >= 32); };
  img.onerror = () => { clearTimeout(timer); resolve(false); };
  img.referrerPolicy = 'no-referrer';
  img.src = src;
});

function stored(host) {
  try { return localStorage.getItem(`logo:${host}`); } catch { return null; }
}

export function resolveLogo(host) {
  if (memory.has(host)) return Promise.resolve(memory.get(host));
  const saved = stored(host);
  if (saved) { memory.set(host, saved); return Promise.resolve(saved); }
  if (pending.has(host)) return pending.get(host);
  const list = candidates(host);
  const job = (async () => {
    for (const group of [list.slice(0, 3), list.slice(3)]) {
      const ok = await Promise.all(group.map(probe));
      const hit = ok.indexOf(true);
      if (hit >= 0) return group[hit];
    }
    return null;
  })().then((found) => {
    memory.set(host, found);
    pending.delete(host);
    if (found) { try { localStorage.setItem(`logo:${host}`, found); } catch { /* storage full */ } }
    return found;
  });
  pending.set(host, job);
  return job;
}

// undefined = still looking, null = none found, string = logo url
export function useLogo(url) {
  const host = hostOf(url);
  const [result, setResult] = useState(() => ({ host, src: memory.get(host) ?? stored(host) ?? undefined }));
  useEffect(() => {
    let live = true;
    if (host) resolveLogo(host).then((src) => { if (live) setResult({ host, src }); });
    return () => { live = false; };
  }, [host]);
  if (!host) return null;
  return result.host === host ? result.src : undefined;
}

