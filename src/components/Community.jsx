import { useState, useEffect } from 'react';
import { getNickname, saveNickname, fetchMyStats, fetchLeaderboard, levelFor, nextLevel } from '../lib/rewards.js';
import { renderResponderCard } from '../lib/responderCard.js';
import { getShareImageFile } from '../lib/share.js';
import { supabaseConfigured } from '../lib/supabase.js';

export default function Community() {
  const [nick, setNick] = useState(getNickname());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(nick);
  const [stats, setStats] = useState(null);
  const [board, setBoard] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) return;
    fetchMyStats().then(setStats).catch(() => {});
    fetchLeaderboard(10).then(setBoard).catch(() => {});
  }, []);

  if (!supabaseConfigured) return null;

  const points = stats?.points ?? 0;
  const lv = levelFor(points);
  const next = nextLevel(points);

  const save = async () => {
    setSaving(true);
    try { const c = await saveNickname(draft); setNick(c); setEditing(false); }
    catch { /* ignore */ } finally { setSaving(false); }
  };

  const share = async () => {
    const file = (await renderResponderCard({
      nickname: nick || 'Anonymous', levelName: lv.name, levelIcon: lv.icon, points, stats,
    })) || (await getShareImageFile());
    const text = `I'm a ${lv.icon} ${lv.name} on LINDOL, helping keep my community informed during the earthquakes. Join in:`;
    const url = `${window.location.origin}/`;
    try {
      if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ text: `${text} ${url}`, files: [file] });
      } else if (navigator.share) {
        await navigator.share({ text, url });
      }
    } catch { /* cancelled */ }
  };

  return (
    <div className="community">
      <div className="impact-card">
        <div className="impact-top">
          <span className="impact-lv">{lv.icon}</span>
          <div className="impact-id">
            <div className="impact-name">{nick || 'You'}</div>
            <div className="impact-role">{lv.name}</div>
          </div>
          <div className="impact-pts">{points}<span>pts</span></div>
        </div>

        {next && (
          <div className="impact-prog">
            <div className="impact-bar"><i style={{ width: `${Math.min(100, Math.round((points / next.min) * 100))}%` }} /></div>
            <small>{next.min - points} pts to {next.icon} {next.name}</small>
          </div>
        )}

        {stats && (
          <div className="impact-stats">
            <span><b>{stats.verifiedReports}</b> verified</span>
            <span><b>{stats.confirmsGiven}</b> confirms</span>
            <span><b>{stats.resolvesGiven}</b> resolves</span>
          </div>
        )}

        {editing ? (
          <div className="nick-edit">
            <input value={draft} maxLength={20} placeholder="Pick a nickname" onChange={(e) => setDraft(e.target.value)} />
            <button onClick={save} disabled={saving}>{saving ? '…' : 'Save'}</button>
          </div>
        ) : (
          <div className="impact-actions">
            <button className="impact-btn" onClick={() => { setDraft(nick); setEditing(true); }}>
              {nick ? 'Edit nickname' : 'Set a nickname'}
            </button>
            <button className="impact-btn primary" onClick={share}>Share my badge</button>
          </div>
        )}

        <p className="impact-note">Points come only from reports others confirm and from helping verify reports, never from just posting.</p>
      </div>

      {board.length > 0 && (
        <div className="leaderboard">
          <div className="lb-title">🏆 Top contributors</div>
          {board.map((row, i) => (
            <div className={`lb-row${row.nickname === nick && nick ? ' me' : ''}`} key={i}>
              <span className="lb-rank">{i + 1}</span>
              <span className="lb-name">{row.nickname}</span>
              <span className="lb-pts">{row.points} pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
