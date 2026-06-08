import { useEffect, useRef, useState } from 'react';
import { CATEGORIES } from './reportSchema.js';
import { rejectFile } from '../../lib/image.js';
import { getDeviceId } from '../../lib/device.js';
import { checkReportRate, recordReport } from '../../lib/rateLimit.js';

const newId = () => crypto?.randomUUID?.() ?? `r-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

// onSubmit(report) -> Promise<{ok, queued}>. report: {id, category, note, lat, lng, photoFile, deviceId}
export default function ReportSheet({ open, onClose, onSubmit, onToast }) {
  const [cat, setCat] = useState(null);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [coords, setCoords] = useState(null);
  const [geoState, setGeoState] = useState('idle');
  const [busy, setBusy] = useState(false);
  const [posted, setPosted] = useState(null);
  const fileRef = useRef(null);
  const sheetRef = useRef(null);
  const dragStart = useRef(null);

  useEffect(() => {
    if (!open) return;
    setGeoState('locating');
    navigator.geolocation?.getCurrentPosition(
      (p) => { setCoords([p.coords.latitude, p.coords.longitude]); setGeoState('ok'); },
      () => setGeoState('denied'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [open]);

  function reset() {
    setCat(null); setNote(''); setPhoto(null);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(''); setBusy(false); setPosted(null);
  }
  function close() { reset(); onClose(); }

  // Drag the handle down to dismiss.
  function dragStartH(e) {
    dragStart.current = (e.touches?.[0] ?? e).clientY;
    if (sheetRef.current) sheetRef.current.style.transition = 'none';
  }
  function dragMoveH(e) {
    if (dragStart.current == null || !sheetRef.current) return;
    const dy = (e.touches?.[0] ?? e).clientY - dragStart.current;
    if (dy > 0) sheetRef.current.style.transform = `translateY(${dy}px)`;
  }
  function dragEndH(e) {
    if (dragStart.current == null) return;
    const dy = (e.changedTouches?.[0] ?? e).clientY - dragStart.current;
    dragStart.current = null;
    if (sheetRef.current) { sheetRef.current.style.transition = ''; sheetRef.current.style.transform = ''; }
    if (dy > 110) close();
  }

  function onPickPhoto(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const err = rejectFile(f);
    if (err) { onToast(err, '#CC2A2A'); return; }
    setPhoto(f);
    setPhotoUrl(URL.createObjectURL(f));
  }

  async function submit() {
    if (!cat || !coords) return;
    const rate = checkReportRate();
    if (!rate.ok) {
      onToast(`Too many reports - please wait ~${rate.waitMin} min.`, '#C08A1E');
      return;
    }
    setBusy(true);
    recordReport();
    const id = newId();
    const res = await onSubmit({
      id, category: cat, note: note.trim(), lat: coords[0], lng: coords[1],
      photoFile: photo, deviceId: getDeviceId(),
    });
    if (res && res.rateLimited) {
      onToast('Sending too fast - please wait a few minutes.', '#C08A1E');
      setBusy(false);
      return;
    }
    onToast(
      res.queued ? 'No signal - report queued, will send when back online' : 'Report posted to the live map',
      res.queued ? '#C08A1E' : '#3F7D43',
    );
    setBusy(false);
    if (res && !res.queued) {
      // Show the share step (a queued report has no live link yet, so just close).
      setPosted({ id, category: cat, note: note.trim(), lat: coords[0], lng: coords[1],
        photoUrl, createdAt: Date.now(), distanceKm: 0 });
    } else {
      close();
    }
  }

  async function sharePosted() {
    if (!posted) return;
    const url = `${window.location.origin}/r/${posted.id}`;
    const label = LABEL[posted.category] ?? 'Report';
    const text = `⚠️ ${label} reported near ${posted.lat.toFixed(2)}, ${posted.lng.toFixed(2)} on LINDOL. Live earthquake updates & citizen reports for the area.`;
    try {
      const { renderReportCard } = await import('../../lib/reportCard.js');
      const file = await renderReportCard(posted);
      if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'LINDOL citizen report', text: `${text} ${url}`, files: [file] });
        return;
      }
      if (navigator.share) { await navigator.share({ title: 'LINDOL citizen report', text, url }); return; }
      await navigator.clipboard.writeText(`${text} ${url}`);
      onToast('Link copied - share it anywhere', '#3F7D43');
    } catch { /* cancelled */ }
  }

  const canSubmit = cat && coords && !busy;

  return (
    <div className={`scrim${open ? ' open' : ''}`} onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet" ref={sheetRef}>
        <div className="sheet-handle" onTouchStart={dragStartH} onTouchMove={dragMoveH} onTouchEnd={dragEndH}>
          <div className="grab" />
        </div>
        <button className="sheet-close" onClick={close} aria-label="Close">✕</button>
        {posted ? (
          <div className="post-success">
            <div className="ps-check">✓</div>
            <h3>Report posted</h3>
            <p>It’s live on the map. Share it so people nearby see it and stay safe.</p>
            <button className="submit" onClick={sharePosted}>📲 Share to social media</button>
            <button className="ps-skip" onClick={close}>Done</button>
          </div>
        ) : (
        <>
        <h3>Report from your location</h3>
        <div className="step-sub">Your report appears on the live map. Photos are taken in-app to keep them real.</div>

        <div className="gps">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" />
          </svg>
          <span>
            {geoState === 'locating' && 'Locating you…'}
            {geoState === 'ok' && coords && `GPS locked · ${coords[0].toFixed(3)}°, ${coords[1].toFixed(3)}°`}
            {geoState === 'denied' && 'Location needed to report - enable GPS and reopen.'}
          </span>
        </div>

        <div className="catgrid">
          {CATEGORIES.map((c) => (
            <div key={c.key} className={`catopt${cat === c.key ? ' sel' : ''}`} onClick={() => setCat(c.key)}>
              <span className="dot" style={{ background: c.color }} />{c.label}
            </div>
          ))}
        </div>

        {cat === 'help' && (
          <div className="help-emergency">
            <span>Life-threatening or trapped? <b>Call 911 now</b> - LINDOL notifies the community, not responders.</span>
            <a className="call911 sm" href="tel:911">📞 911</a>
          </div>
        )}

        <textarea rows="2" placeholder="Add a short note (optional)…" value={note}
          maxLength={280} onChange={(e) => setNote(e.target.value)} />

        <input ref={fileRef} type="file" accept="image/*" capture="environment"
          style={{ display: 'none' }} onChange={onPickPhoto} />
        {photoUrl ? (
          <div className="cam-preview">
            <img className="cam-img" src={photoUrl} alt="Captured" />
            <span className="badge">📷 captured · in-app</span>
            <button type="button" className="cam-retake" onClick={() => fileRef.current?.click()}>↻ Retake photo</button>
          </div>
        ) : (
          <div className="camera" onClick={() => fileRef.current?.click()}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span>Tap to take a photo</span>
          </div>
        )}
        <div className="cam-hint">Camera only · no gallery uploads - keeps reports trustworthy</div>

        <p className="post-note">By posting, your photo and exact location are shared publicly on the live map. Photos are automatically deleted after 14 days.</p>
        <button className="submit" disabled={!canSubmit} onClick={submit}>
          {!cat ? 'Choose a category to continue' : !coords ? 'Waiting for location…' : busy ? 'Posting…' : 'Post report to the map'}
        </button>
        </>
        )}
      </div>
    </div>
  );
}
