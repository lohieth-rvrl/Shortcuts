import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, Link2, LoaderCircle } from 'lucide-react';

export default function Login({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(0);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) { onSuccess(); return; }
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Could not sign in.');
    } catch {
      setError('Cannot reach the server. Check your connection.');
    }
    setShake((n) => n + 1); setPassword(''); setBusy(false);
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit} noValidate>
        <span className="login-mark" aria-hidden="true"><Link2 size={34} strokeWidth={2.2} /></span>
        <h1 className="login-title">Sign in to Shortcuts</h1>
        <p className="login-sub">Your links, notes and stickies, all in one place.</p>
        <div key={shake} className={`id-group ${shake ? 'is-shaking' : ''}`}>
          <input type="email" name="email" autoComplete="username" autoFocus required placeholder="Email" aria-label="Email"
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="id-row">
            <input type={show ? 'text' : 'password'} name="password" autoComplete="current-password" required placeholder="Password" aria-label="Password"
              value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="id-eye" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button type="submit" className="id-go" disabled={busy || !email || !password} aria-label="Sign in">
              {busy ? <LoaderCircle size={18} className="spin" /> : <ArrowRight size={18} />}
            </button>
          </div>
        </div>
        <p className="login-error" role="alert">{error}</p>
      </form>
    </main>
  );
}
