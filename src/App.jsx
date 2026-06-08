import { useState, useEffect } from 'react';
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
import AdminPage from './features/admin/AdminPage.jsx';
import IntroOverlay from './components/IntroOverlay.jsx';
import Tour from './components/Tour.jsx';
import InstallPrompt from './components/InstallPrompt.jsx';
import UpdatePrompt from './components/UpdatePrompt.jsx';
import EarlyWarningTip from './components/EarlyWarningTip.jsx';
import SupportCard from './components/SupportCard.jsx';
import Community from './components/Community.jsx';
import PrivacyPage from './features/legal/PrivacyPage.jsx';
import { useQuakes } from './features/quakes/useQuakes.js';
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
  const user = useGeolocation();
  const { latest, mainshock, aftershocks, all, status, updatedAt } = useQuakes(user);
  const { reports, pendingCount, submit, flag, confirm, resolve, escalate, voteResolve } = useReports(user);
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, showToast] = useToast();
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
    <div className={`app${online ? '' : ' off'}`}>
      <AlertBanner alert={alert} onDismiss={dismiss} />
      <StatusBar online={online} updatedAt={updatedAt} />

      {tab === 'map' ? (
        <div className="map-screen">
          <QuakeMap fill mainshock={mainshock} aftershocks={aftershocks} reports={reports} user={user} />
        </div>
      ) : (
      <div className="scroll" key={tab}>
        {tab === 'home' && (
          <>
            <Masthead quakes={all} />
            <InstallPrompt />
            {!online && <OfflineBanner updatedAt={updatedAt} />}
            <section className="reveal">
              <SectionLabel>Latest event{status === 'cached' ? ' · cached' : ''}</SectionLabel>
              <QuakeHero quake={latest} />
            </section>
            <section className="reveal">
              <SectionLabel>Recent quakes · {all.length} in 7 days</SectionLabel>
              <QuakeList quakes={all} />
            </section>
            <section className="reveal">
              <SectionLabel>Community</SectionLabel>
              <Community />
            </section>
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
              <SectionLabel>Citizen reports · near you</SectionLabel>
              <ReportFeed reports={reports} onFlag={flag} onConfirm={confirm} onResolve={resolve}
                onEscalate={escalate} onVoteResolve={voteResolve} focused={focusedReport} />
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
            <button className="replay-tour" onClick={() => setOnboard('tour')}>↻ Replay the tutorial</button>
            <SupportCard />
            <footer className="credit">
              Built by <a href="https://moncodes.com" target="_blank" rel="noopener noreferrer">moncodes.com</a>
              <span aria-hidden="true"> · </span>
              <a href="#privacy">Privacy</a>
            </footer>
          </>
        )}
      </div>
      )}

      <BottomNav active={tab} onChange={setTab} onReport={() => setSheetOpen(true)} pulseReport={tourReport} />

      <ReportSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onSubmit={submit} onToast={showToast} />
      {toast && (
        <div className="toast show">
          <span className="tdot" style={{ background: toast.color || '#3F7D43' }} />
          <span>{toast.msg}</span>
        </div>
      )}
      <UpdatePrompt />
      {onboard === 'intro' && <IntroOverlay onStartTour={() => setOnboard('tour')} onSkip={finishOnboard} />}
      {onboard === 'tour' && <Tour onTab={setTab} onReportPulse={setTourReport} onDone={finishOnboard} />}
    </div>
  );
}
