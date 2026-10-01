import { useId } from 'react';
import { hostOf } from './logo.js';

// Our own fallback mark: a colour picked from the site name, a faint globe and the first letter.
export default function DefaultLogo({ label, url }) {
  const uid = useId();
  const seed = hostOf(url) || label || 'link';
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  const letter = ((label || seed).trim().charAt(0) || '?').toUpperCase();
  return (
    <svg viewBox="0 0 64 64" className="default-logo" role="img" aria-label={`${label || seed} logo`}>
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 82% 62%)`} />
          <stop offset="1" stopColor={`hsl(${(hue + 45) % 360} 78% 42%)`} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" fill={`url(#${uid})`} />
      <rect width="64" height="32" fill="rgba(255,255,255,.14)" />
      <text x="32" y="33" textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="32" fontWeight="800"
        fontFamily="system-ui, sans-serif" style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,.25)', strokeWidth: 3 }}>{letter}</text>
    </svg>
  );
}
