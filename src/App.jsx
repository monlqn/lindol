import { useState, useEffect, useMemo } from 'react';
import { REGION } from './config.js';
import { activeZone, pointInPolygon } from './lib/activeZone.js';
import { subscribeToPush } from './lib/push.js';
import { savePushSubscription } from './features/alerts/pushApi.js';
import AlertBanner from './components/AlertBanner.jsx';
import StatusBar from './components/StatusBar.jsx';
import Masthead from './components/Masthead.jsx';
import OfflineBanner from './components/OfflineBanner.jsx';
import SectionLabel from './components/SectionLabel.jsx';
import ShareButton from './components/ShareButton.jsx';
import BottomNav from './components/BottomNav.jsx';
import QuakeHero from './features/quakes/QuakeHero.jsx';
import QuakeMap from './features/quakes/QuakeMap.jsx';
import QuakeList from './features/quakes/QuakeList.jsx';
import SafetyPanel from './features/safety/SafetyPanel.jsx';
import ReportSheet from './features/reports/ReportSheet.jsx';
import ReportFeed from './features/reports/ReportFeed.jsx';
import SituationUpdates from './components/SituationUpdates.jsx';
import AboutQuake from './components/AboutQuake.jsx';
import FeltAtYou from './components/FeltAtYou.jsx';
import AdminPage from './features/admin/AdminPage.jsx';
import IntroOverlay from './components/IntroOverlay.jsx';
import Tour from './components/Tour.jsx';
import Lightbox from './components/Lightbox.jsx';
import PullToRefresh from './components/PullToRefresh.jsx';
import { useTick } from './lib/useTick.js';
import { useMediaQuery } from './lib/useMediaQuery.js';
import { useViewerCount } from './lib/usePresence.js';
import InstallPrompt from './components/InstallPrompt.jsx';
import UpdatePrompt from './components/UpdatePrompt.jsx';
import EarlyWarningTip from './components/EarlyWarningTip.jsx';
import SupportCard from './components/SupportCard.jsx';
import Community from './components/Community.jsx';
import PrivacyPage from './features/legal/PrivacyPage.jsx';
import { useQuakes } from './features/quakes/useQuakes.js';
import { useShakemaps } from './features/quakes/useShakemaps.js';
import { useReports } from './features/reports/useReports.js';
import { useOnline } from './lib/useOnline.js';
import { useGeolocation } from './lib/useGeolocation.js';
import { useQuakeAlerts } from './features/alerts/useQuakeAlerts.js';
import { arm, startAlarm, stopAlarm } from './lib/alarm.js';
import { HOTLINES } from './config.js';
import { useTheme } from './lib/useTheme.js';
import ToggleRow from './components/ToggleRow.jsx';

function useToast() {
  const [toast, setToast] = useState(null);
  const show = (msg, color) => { setToast({ msg, color }); setTimeout(() => setToast(null), 2600); };
  return [toast, show];
}

export default function App() {
  const [route, setRoute] = useState(() => (typeof window !== 'undefined' ? window.location.hash : ''));
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  if (route === '#admin') return <AdminPage />;
  if (route === '#privacy') return <PrivacyPage />;
  return <MainApp />;
}

function MainApp() {
  const online = useOnline();
  const viewers = useViewerCount();
  const user = useGeolocation();
  const { latest, mainshock, aftershocks, other, all, status, updatedAt } = useQuakes(user);
  const shakemaps = useShakemaps();
  // The active-zone polygon (shared with the map) and a live count of quakes inside it.
  const zone = useMemo(() => {
    const center = mainshock ? [mainshock.lat, mainshock.lng] : REGION.center;
    return activeZone(mainshock ? [mainshock, ...aftershocks] : aftershocks, center);
  }, [aftershocks, mainshock]);
  const zoneCount = useMemo(
    () => (zone ? all.filter((q) => pointInPolygon([q.lat, q.lng], zone)).length : 0),
    [all, zone],
  );
  const [toast, showToast] = useToast();
  const [lightbox, setLightbox] = useState(null);
  useTick(30000);
  const { reports, pendingCount, submit, flag, confirm, resolve, escalate, voteResolve, refresh } = useReports(
    user,
    () => showToast('📍 New report just came in nearby', '#3F7D43'),
  );
  const [tab, setTab] = useState(() => {
    if (typeof window === 'undefined') return 'home';
    if (new URLSearchParams(window.location.search).get('r') || window.location.hash === '#reports') return 'reports';
    return 'home';
  });
  const [focusedReport, setFocusedReport] = useState(null);
  const [onboard, setOnboard] = useState(() => {
    try { return localStorage.getItem('lindol:onboarded-v2') ? 'done' : 'intro'; } catch { return 'intro'; }
  });
  const [tourReport, setTourReport] = useState(false);
  const finishOnboard = () => {
    try { localStorage.setItem('lindol:onboarded-v2', '1'); } catch { /* ignore */ }
    setTourReport(false); setOnboard('done');
  };
  const isWide = useMediaQuery('(min-width: 980px)');
  const [forceMobile, setForceMobile] = useState(() => {
    try { return localStorage.getItem('lindol:force-mobile') === '1'; } catch { return false; }
  });
  const toggleView = () => setForceMobile((v) => {
    const n = !v;
    try { localStorage.setItem('lindol:force-mobile', n ? '1' : '0'); } catch { /* ignore */ }
    return n;
  });
  const twoPane = isWide && !forceMobile;
  const leftTab = tab === 'map' ? 'home' : tab;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reportLoc, setReportLoc] = useState(null);
  const openReportAt = (loc) => { setReportLoc(loc); setSheetOpen(true); };
  const [mapFocus, setMapFocus] = useState(null);
  const locateOnMap = (q) => {
    setMapFocus({ lat: q.lat, lng: q.lng, mag: q.mag, t: Date.now() });
    if (!twoPane) setTab('map');
  };
  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem('lindol:alarm') === '1'; } catch { return false; }
  });
  const { theme, toggle: toggleTheme } = useTheme();
  const [pushEnabled, setPushEnabled] = useState(() => {
    try { return localStorage.getItem('lindol:push') === '1'; } catch { return false; }
  });
  const { alert, dismiss } = useQuakeAlerts(all, soundOn, user);

  const toggleSound = () => {
    setSoundOn((v) => {
      const next = !v;
      if (next) arm(); else stopAlarm();
      try { localStorage.setItem('lindol:alarm', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const previewAlarm = () => {
    arm();
    startAlarm();
    setTimeout(stopAlarm, 8000);
    showToast('▶ Preview - the real alarm loops until you dismiss it', '#C08A1E');
  };

  // After a reload, the alarm setting is restored but browsers require a user gesture
  // before audio can play - re-arm on the first tap.
  useEffect(() => {
    if (!soundOn) return undefined;
    const rearm = () => arm();
    window.addEventListener('pointerdown', rearm, { once: true });
    return () => window.removeEventListener('pointerdown', rearm);
  }, []);

  // Open a deep-linked report (?r=<id>) even if it isn't near the viewer.
  useEffect(() => {
    let id = null;
    try { id = new URLSearchParams(window.location.search).get('r'); } catch { /* ignore */ }
    if (!id) return;
    (async () => {
      try {
        const [{ fetchReportById }, { supabase }] = await Promise.all([
          import('./features/reports/reportsApi.js'),
          import('./lib/supabase.js'),
        ]);
        const r = await fetchReportById(supabase, id);
        if (r) setFocusedReport(r);
      } catch { /* ignore */ }
    })();
  }, []);

  // On desktop two-pane the map is always shown on the right, so never sit on the map tab.
  useEffect(() => { if (twoPane && tab === 'map') setTab('home'); }, [twoPane, tab]);

  const enablePush = async () => {
    try {
      const key = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!key) return showToast('Push not configured yet', '#CC2A2A');
      const sub = await subscribeToPush(key);
      await savePushSubscription(sub, user);
      setPushEnabled(true);
      try { localStorage.setItem('lindol:push', '1'); } catch { /* ignore */ }
      showToast("You'll be notified of aftershocks", '#3F7D43');
    } catch (e) {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
      const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;
      if (ios && !standalone) {
        showToast('On iPhone: open in Safari → Share → Add to Home Screen, then enable from there (Chrome iOS can’t).', '#C08A1E');
      } else {
        showToast(e.message || 'Could not enable notifications', '#CC2A2A');
      }
    }
  };

  return (
    <div className={`app${online ? '' : ' off'}${twoPane ? ' wide' : ''}`}>
      <AlertBanner alert={alert} onDismiss={dismiss} />

      <div className="pane">
      <StatusBar online={online} updatedAt={updatedAt} viewers={viewers} />

      {!twoPane && tab === 'map' ? (
        <div className="map-screen">
          <QuakeMap fill mainshock={mainshock} aftershocks={aftershocks} other={other} reports={reports} user={user} dark={theme === 'dark'} onReportAt={openReportAt} focus={mapFocus} zone={zone} />
        </div>
      ) : (
      <PullToRefresh className="scroll" key={tab} onRefresh={refresh}>
        {tab === 'home' && (
          <>
            <Masthead quakes={all} />
            <InstallPrompt />
            {!online && <OfflineBanner updatedAt={updatedAt} />}
            <section className="reveal">
              <SectionLabel>Latest event{status === 'cached' ? ' · cached' : ''}</SectionLabel>
              <QuakeHero quake={latest} shakemaps={shakemaps} />
            </section>
            {(user[0] !== REGION.defaultUser[0] || user[1] !== REGION.defaultUser[1]) && <FeltAtYou user={user} shakemaps={shakemaps} />}
            {zoneCount > 0 && (
              <button className="zone-stat reveal" onClick={() => setTab('map')}>
                <span className="zs-num">{zoneCount}</span>
                <span className="zs-text">
                  <b>quakes in the Sarangani aftershock zone</b>
                  <span className="zs-sub">M2.0+ · last {REGION.windowDays} days · tap to view the zone on the map</span>
                </span>
              </button>
            )}
            <section className="reveal">
              <SectionLabel>Recent quakes · {all.length} in {REGION.windowDays} days</SectionLabel>
              <p className="src-note">Showing <b>M2.0+</b> earthquakes across the Philippines from <b>PHIVOLCS</b> (the local authority), with <b>USGS &amp; EMSC</b> as backup. The active Sarangani sequence is highlighted on the map. Data can lag a few minutes behind the actual quake, so if you feel shaking, don't wait. Drop, Cover, Hold On.</p>
              <QuakeList quakes={all} onLocate={locateOnMap} shakemaps={shakemaps} />
            </section>
            <AboutQuake />
            <SituationUpdates />
          </>
        )}

        {tab === 'reports' && (
          <>
            {pendingCount > 0 && (
              <div className="offline-banner" style={{ display: 'flex' }}>
                <span>{pendingCount} report{pendingCount > 1 ? 's' : ''} queued - will send when you're back online.</span>
              </div>
            )}
            <section className="reveal">
              <div className="feed-head">
                <SectionLabel>Citizen reports · near you</SectionLabel>
                <span className="livetag"><span className="live-dot" />live</span>
              </div>
              <ReportFeed reports={reports} onFlag={flag} onConfirm={confirm} onResolve={resolve}
                onEscalate={escalate} onVoteResolve={voteResolve} onOpenPhoto={setLightbox}
                onLocate={locateOnMap} focused={focusedReport} onStartReport={() => setSheetOpen(true)} />
            </section>
            <section className="reveal">
              <SectionLabel>Your impact &amp; community</SectionLabel>
              <Community />
            </section>
          </>
        )}

        {tab === 'safety' && (
          <>
            <section className="reveal">
              <SectionLabel>Emergency</SectionLabel>
              <div className="emergency-card">
                <p>Life-threatening emergency? LINDOL alerts the community - it is <b>not</b> an emergency service. Call the national hotline now.</p>
                <a className="call911" href="tel:911">📞 Call 911</a>
              </div>
            </section>
            <section className="reveal">
              <SectionLabel>Emergency hotlines</SectionLabel>
              <div className="hotlines">
                {HOTLINES.map((h) => (
                  <a key={h.tel} className="hotline" href={`tel:${h.tel}`}>
                    <span className="hl-ic">{h.icon}</span>
                    <span className="hl-name">{h.label}</span>
                    <span className="hl-num">{h.number}</span>
                  </a>
                ))}
              </div>
              <p className="hl-tip">Save your barangay & city/municipal DRRMO numbers; they respond fastest. LINDOL alerts the community, not responders.</p>
            </section>
            <section className="reveal">
              <SectionLabel>Safety · works offline</SectionLabel>
              <SafetyPanel />
            </section>
            <div className="sec-label" style={{ margin: '8px 16px 0' }}>Alerts &amp; settings</div>
            <ToggleRow label="Earthquake alerts" desc="Loud alarm + vibration for M4.5+ quakes near you (while app is open)"
              on={soundOn} onClick={toggleSound} />
            <button className="alarm-test" onClick={previewAlarm}>🔊 Test the alarm sound</button>
            <p className="alarm-note">The alarm loops until you dismiss it. Keep your ringer on and volume up - a web app can’t override Silent mode or raise your phone’s volume.</p>
            <p className="ew-note"><b>ℹ️ Awareness tool, not early warning.</b> Alerts arrive minutes after a quake is detected (USGS). If you feel shaking, don’t wait for an alert - Drop, Cover, Hold On immediately.</p>
            <EarlyWarningTip />
            <ToggleRow label="Notify when app is closed" desc="Push alerts for M4.5+ quakes near you, even when LINDOL is closed"
              on={pushEnabled} onClick={enablePush} />
            <ToggleRow label="Dark mode" desc="Easier on the eyes at night"
              on={theme === 'dark'} onClick={toggleTheme} />
            <section className="reveal">
              <SectionLabel>Help others stay safe</SectionLabel>
              <div className="share-cta">
                <p>Know someone in the area? Share LINDOL so they get live earthquake info and safety guidance - even offline.</p>
                <ShareButton stats={{ count: all.length, latestMag: latest?.mag, latestPlace: latest?.place }} />
              </div>
            </section>
            <a className="privacy-link" href="#privacy">🔒 Privacy Policy: how your data is handled</a>
            <button className="replay-tour" onClick={() => setOnboard('tour')}>↻ Replay the tutorial</button>
            <SupportCard />
            <footer className="credit">
              <p className="credit-sources">
                Quake data: <a href="https://earthquake.phivolcs.dost.gov.ph" target="_blank" rel="noopener noreferrer">PHIVOLCS</a>,
                {' '}<a href="https://earthquake.usgs.gov" target="_blank" rel="noopener noreferrer">USGS</a>
                {' & '}<a href="https://www.emsc-csem.org" target="_blank" rel="noopener noreferrer">EMSC</a>
                <span aria-hidden="true"> · </span>
                Hazard &amp; fault maps: <a href="https://www.phivolcs.dost.gov.ph" target="_blank" rel="noopener noreferrer">PHIVOLCS (DOST)</a>
              </p>
              <p className="credit-warn">⚠️ Not an official emergency service. In a life-threatening emergency, call <a href="tel:911">911</a>.</p>
              <p className="credit-by">
                An independent, non-commercial public-safety project
                <span aria-hidden="true"> · </span>
                Built by <a href="https://moncodes.com" target="_blank" rel="noopener noreferrer">moncodes</a>
                <span aria-hidden="true"> · </span>
                <a href="#privacy">Privacy Policy</a>
              </p>
            </footer>
          </>
        )}
      </PullToRefresh>
      )}

      <BottomNav active={tab} onChange={setTab} onReport={() => setSheetOpen(true)} pulseReport={tourReport} hideMap={twoPane} />
      </div>

      {twoPane && (
        <div className="desk-right">
          <QuakeMap fill mainshock={mainshock} aftershocks={aftershocks} other={other} reports={reports} user={user} dark={theme === 'dark'} onReportAt={openReportAt} focus={mapFocus} zone={zone} />
        </div>
      )}

      <ReportSheet open={sheetOpen} onClose={() => { setSheetOpen(false); setReportLoc(null); }} onSubmit={submit} onToast={showToast} overrideLocation={reportLoc} />
      {toast && (
        <div className="toast show">
          <span className="tdot" style={{ background: toast.color || '#3F7D43' }} />
          <span>{toast.msg}</span>
        </div>
      )}
      <Lightbox url={lightbox} onClose={() => setLightbox(null)} />
      <UpdatePrompt />
      {onboard === 'intro' && <IntroOverlay onStartTour={() => setOnboard('tour')} onSkip={finishOnboard} />}
      {onboard === 'tour' && <Tour onTab={setTab} onReportPulse={setTourReport} onDone={finishOnboard} />}
      {isWide && (
        <button className="view-toggle" onClick={toggleView}>
          {forceMobile ? '🖥 Desktop view' : '📱 Mobile view'}
        </button>
      )}
    </div>
  );
}
