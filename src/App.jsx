import { useCallback, useEffect, useState } from 'react';
import Shortcuts from './comp/Shortcuts.jsx';
import Login from './comp/Login.jsx';
import Cursor from './comp/Cursor.jsx';

export default function App() {
  const [auth, setAuth] = useState('checking');

  useEffect(() => {
    let live = true;
    fetch('/api/auth/me')
      .then((r) => { if (live) setAuth(r.ok ? 'in' : 'out'); })
      .catch(() => { if (live) setAuth('out'); });
    return () => { live = false; };
  }, []);

  const signOut = useCallback(async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* offline: still leave */ }
    setAuth('out');
  }, []);

  return (
    <>
      <Cursor />
      {auth === 'checking' && <div className="boot" aria-busy="true"><span /></div>}
      {auth === 'out' && <Login onSuccess={() => setAuth('in')} />}
      {auth === 'in' && <Shortcuts onSignOut={signOut} onUnauthorized={() => setAuth('out')} />}
    </>
  );
}
