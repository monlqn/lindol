import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { getDeviceId } from '../../lib/device.js';
import { getNickname, saveNickname } from '../../lib/rewards.js';
import { relativeTime } from '../../lib/time.js';
import { fetchComments, addComment, flagComment } from './reportsApi.js';

const CFKEY = 'lindol:cflagged';
const readFlagged = () => { try { return new Set(JSON.parse(localStorage.getItem(CFKEY) || '[]')); } catch { return new Set(); } };
const rememberFlag = (id) => {
  try {
    const a = JSON.parse(localStorage.getItem(CFKEY) || '[]');
    if (!a.includes(id)) { a.push(id); localStorage.setItem(CFKEY, JSON.stringify(a)); }
  } catch { /* ignore */ }
};

// Community coordination thread on a "Need help" report. Closes once the report is resolved.
export default function ReportComments({ reportId, resolved }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState(null); // null = not yet loaded
  const [body, setBody] = useState('');
  const [nick, setNick] = useState(() => getNickname());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const flagged = readFlagged();
  const hasName = !!getNickname();

  useEffect(() => {
    if (!open || comments !== null || !supabase) return;
    fetchComments(supabase, reportId).then(setComments).catch(() => setComments([]));
  }, [open, comments, reportId]);

  const send = async () => {
    const text = body.trim();
    if (!text || busy || !supabase) return;
    setBusy(true); setErr('');
    try {
      const name = nick.trim();
      if (name && name !== getNickname()) { try { await saveNickname(name); } catch { /* keep going */ } }
      const c = await addComment(supabase, reportId, getDeviceId(), text, name);
      if (c) setComments((list) => [...(list || []), c]);
      setBody('');
    } catch (e) {
      setErr(/rate/.test(e?.message || '') ? 'Slow down a moment.' : 'Could not send.');
    }
    setBusy(false);
  };

  const flag = async (id) => {
    if (flagged.has(id) || !supabase) return;
    rememberFlag(id);
    setComments((list) => (list || []).filter((c) => c.id !== id));
    try { await flagComment(supabase, id, getDeviceId()); } catch { /* ignore */ }
  };

  const count = comments?.length ?? 0;

  return (
    <div className="rc">
      <button className="rc-toggle" onClick={() => setOpen((o) => !o)}>
        💬 {open ? 'Hide replies' : count ? `Replies · ${count}` : 'Reply / coordinate'}
      </button>
      {open && (
        <div className="rc-body">
          <p className="rc-warn">
            Community coordination - <b>not an emergency dispatch</b>. For life-threatening help, call <a href="tel:911">911</a>.
          </p>
          <div className="rc-list">
            {comments === null && <p className="rc-empty">Loading…</p>}
            {comments !== null && count === 0 && <p className="rc-empty">No replies yet. Offer help, info, or status.</p>}
            {(comments || []).map((c) => (
              <div key={c.id} className="rc-item">
                <div className="rc-meta">
                  <b>{c.nickname}</b> · {relativeTime(c.createdAt)}
                  <button className="rc-flag" onClick={() => flag(c.id)} aria-label="Flag comment" title="Flag">⚑</button>
                </div>
                <div className="rc-text">{c.body}</div>
              </div>
            ))}
          </div>
          {resolved ? (
            <p className="rc-closed">✅ Resolved — replies are closed.</p>
          ) : (
            <>
              {!hasName && (
                <input className="rc-nick" value={nick} maxLength={20} placeholder="Your name (shown on your replies)"
                  onChange={(e) => setNick(e.target.value)} />
              )}
              <div className="rc-input">
                <input value={body} maxLength={280}
                  placeholder="Reply (e.g. &quot;on my way&quot;, &quot;DRRMO notified&quot;)…"
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
                <button onClick={send} disabled={busy || !body.trim()}>Send</button>
              </div>
            </>
          )}
          {err && <p className="rc-err">{err}</p>}
        </div>
      )}
    </div>
  );
}
