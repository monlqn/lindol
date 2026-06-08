import { useEffect, useState } from 'react';
import { supabaseConfigured } from '../../lib/supabase.js';
import { signIn, signOut, getSession, fetchModerationQueue, hideReport, restoreReport, deleteReport } from './adminApi.js';

export default function AdminPage() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [rows, setRows] = useState([]);

  useEffect(() => { getSession().then(setSession); }, []);
  useEffect(() => { if (session) load(); }, [session]);

  async function load() { try { setRows(await fetchModerationQueue()); } catch (e) { setErr(String(e.message || e)); } }
  async function doLogin(e) {
    e.preventDefault(); setErr('');
    try { await signIn(email, pw); setSession(await getSession()); }
    catch (e2) { setErr('Login failed: ' + (e2.message || e2)); }
  }
  async function act(fn, id) { await fn(id); load(); }

  if (!supabaseConfigured) return <div style={{ padding: 24 }}>Reports backend not configured.</div>;

  if (!session) {
    return (
      <div style={{ maxWidth: 360, margin: '60px auto', padding: 24 }}>
        <h2 style={{ fontWeight: 800, marginBottom: 12 }}>LINDÓL admin</h2>
        <form onSubmit={doLogin}>
          <input type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: 12, marginBottom: 8 }} />
          <input type="password" placeholder="password" value={pw} onChange={(e) => setPw(e.target.value)}
            style={{ width: '100%', padding: 12, marginBottom: 8 }} />
          <button className="submit" type="submit">Sign in</button>
        </form>
        {err && <p style={{ color: '#CC2A2A', marginTop: 10 }}>{err}</p>}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: '24px auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ fontWeight: 800 }}>Moderation queue</h2>
        <button className="flagbtn" onClick={() => signOut().then(() => setSession(null))}>Sign out</button>
      </div>
      {!rows.length && <p style={{ color: 'var(--ink-faint)' }}>Nothing flagged. 🎉</p>}
      {rows.map((r) => (
        <div className="report" key={r.id} style={{ marginBottom: 12 }}>
          <div className="rp-head">
            <span className="cat-tag" style={{ background: 'var(--ink)' }}>{r.category}</span>
            <span className="rp-dist">flags: {r.flagCount} · {r.status}</span>
          </div>
          {r.photoUrl && <div className="photo revealed" style={{ backgroundImage: `url('${r.photoUrl}')` }} />}
          {r.note && <div className="rp-body">{r.note}</div>}
          <div className="rp-foot" style={{ gap: 10 }}>
            {r.status !== 'hidden'
              ? <button className="flagbtn" onClick={() => act(hideReport, r.id)}>Hide</button>
              : <button className="flagbtn" onClick={() => act(restoreReport, r.id)}>Restore</button>}
            <button className="flagbtn" style={{ color: '#CC2A2A' }} onClick={() => act(deleteReport, r.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
