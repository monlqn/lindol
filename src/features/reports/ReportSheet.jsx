import { useEffect, useRef, useState } from 'react';
import { CATEGORIES } from './reportSchema.js';
import { rejectFile } from '../../lib/image.js';
import { getDeviceId } from '../../lib/device.js';

const newId = () => crypto?.randomUUID?.() ?? `r-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// onSubmit(report) -> Promise<{ok, queued}>. report: {id, category, note, lat, lng, photoFile, deviceId}
export default function ReportSheet({ open, onClose, onSubmit, onToast }) {
  const [cat, setCat] = useState(null);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [coords, setCoords] = useState(null);
  const [geoState, setGeoState] = useState('idle');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

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
    setPhotoUrl(''); setBusy(false);
  }
  function close() { reset(); onClose(); }

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
    setBusy(true);
    const res = await onSubmit({
      id: newId(), category: cat, note: note.trim(), lat: coords[0], lng: coords[1],
      photoFile: photo, deviceId: getDeviceId(),
    });
    onToast(res.queued ? 'No signal — report queued, will send when back online' : 'Report posted to the live map',
      res.queued ? '#C08A1E' : '#3F7D43');
    close();
  }

  const canSubmit = cat && coords && !busy;

  return (
    <div className={`scrim${open ? ' open' : ''}`} onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet">
        <div className="grab" />
        <h3>Report from your location</h3>
        <div className="step-sub">Your report appears on the live map. Photos are taken in-app to keep them real.</div>

        <div className="gps">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" />
          </svg>
          <span>
            {geoState === 'locating' && 'Locating you…'}
            {geoState === 'ok' && coords && `GPS locked · ${coords[0].toFixed(3)}°, ${coords[1].toFixed(3)}°`}
            {geoState === 'denied' && 'Location needed to report — enable GPS and reopen.'}
          </span>
        </div>

        <div className="catgrid">
          {CATEGORIES.map((c) => (
            <div key={c.key} className={`catopt${cat === c.key ? ' sel' : ''}`} onClick={() => setCat(c.key)}>
              <span className="dot" style={{ background: c.color }} />{c.label}
            </div>
          ))}
        </div>

        <textarea rows="2" placeholder="Add a short note (optional)…" value={note}
          maxLength={280} onChange={(e) => setNote(e.target.value)} />

        <input ref={fileRef} type="file" accept="image/*" capture="environment"
          style={{ display: 'none' }} onChange={onPickPhoto} />
        <div className={`camera${photoUrl ? ' shot' : ''}`}
          style={photoUrl ? { backgroundImage: `url('${photoUrl}')` } : undefined}
          onClick={() => fileRef.current?.click()}>
          {photoUrl ? <div className="badge">📷 captured · in-app</div> : (
            <>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span>Tap to take a photo</span>
            </>
          )}
        </div>
        <div className="cam-hint">Camera only · no gallery uploads — keeps reports trustworthy</div>

        <button className="submit" disabled={!canSubmit} onClick={submit}>
          {!cat ? 'Choose a category to continue' : !coords ? 'Waiting for location…' : busy ? 'Posting…' : 'Post report to the map'}
        </button>
      </div>
    </div>
  );
}
