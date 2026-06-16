import { useEffect, useState } from 'react';
import { supabaseConfigured } from '../../lib/supabase.js';
import { signIn, signOut, getSession, onAuthChange, getCommandAccess } from './commandApi.js';
import CommandCenter from './CommandCenter.jsx';

// DEV-only: preview the Command Center UI without an account (set localStorage 'lindol:cmd-preview').
// import.meta.env.DEV is false in production builds, so this is stripped from the live bundle.
const DEV_PREVIEW = import.meta.env.DEV
  && (() => { try { return localStorage.getItem('lindol:cmd-preview') === '1'; } catch { return false; } })();

export default function CommandPage() {
  const [session, setSession] = useState(null);
  const [access, setAccess] = useState('loading'); // 'loading' | null (denied) | { role, org }
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { getSession().then(setSession); return onAuthChange(setSession); }, []);
  useEffect(() => {
    if (!session) { setAccess('loading'); return undefined; }
    let alive = true;
    getCommandAccess().then((a) => { if (alive) setAccess(a); });
    return () => { alive = false; };
  }, [session]);

  if (DEV_PREVIEW) {
    return <CommandCenter access={{ role: 'pdrrmo', org: 'PDRRMO South Cotabato (preview)' }} email="preview@lindol.app" onSignOut={() => {}} />;
  }
  if (!supabaseConfigured) return <Shell>Command Center backend not configured.</Shell>;

  if (!session) {
    const submit = async (e) => {
      e.preventDefault(); setErr(''); setBusy(true);
      try { await signIn(email.trim(), pw); setSession(await getSession()); }
      catch (e2) { setErr(e2?.message || 'Sign-in failed'); }
      setBusy(false);
    };
    return (
      <Shell>
        <form onSubmit={submit} style={F.form}>
          <div style={F.brand}>LINDOL <span style={{ color: '#F5851B' }}>Command Center</span></div>
          <div style={F.sub}>Authorized agency access only.</div>
          <input style={F.input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          <input style={F.input} type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
          <button style={F.btn} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          {err && <div style={F.err}>{err}</div>}
          <a href="#" style={F.back}>← Back to LINDOL</a>
        </form>
      </Shell>
    );
  }
  if (access === 'loading') return <Shell>Checking access…</Shell>;
  if (!access) {
    return (
      <Shell>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Not authorized</div>
          <div style={{ color: '#9aa', fontSize: 13, marginBottom: 16 }}>This account isn’t enrolled in the Command Center. Contact your LINDOL administrator.</div>
          <button style={F.btn} onClick={signOut}>Sign out</button>
        </div>
      </Shell>
    );
  }
  return <CommandCenter access={access} email={session.user?.email} onSignOut={signOut} />;
}

function Shell({ children }) {
  return <div style={F.shell}>{children}</div>;
}

const F = {
  shell: { position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: '#0b1622', color: '#fff', fontFamily: 'var(--font)', padding: 24 },
  form: { width: 320, display: 'flex', flexDirection: 'column', gap: 10 },
  brand: { fontSize: 20, fontWeight: 800 },
  sub: { fontSize: 12.5, color: '#9fb0c0', marginBottom: 6 },
  input: { padding: '11px 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,.18)', background: 'rgba(255,255,255,.06)', color: '#fff', fontSize: 14 },
  btn: { padding: '11px 0', borderRadius: 9, border: 0, background: '#F5851B', color: '#161109', fontSize: 14, fontWeight: 800, cursor: 'pointer' },
  err: { color: '#ff8d7a', fontSize: 12.5 },
  back: { color: '#9fb0c0', fontSize: 12.5, textAlign: 'center', textDecoration: 'none', marginTop: 4 },
};
