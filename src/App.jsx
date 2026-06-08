import { useState } from 'react';
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
import InstallPrompt from './components/InstallPrompt.jsx';
import UpdatePrompt from './components/UpdatePrompt.jsx';
import { useQuakes } from './features/quakes/useQuakes.js';
import { useReports } from './features/reports/useReports.js';
import { useOnline } from './lib/useOnline.js';
import { useGeolocation } from './lib/useGeolocation.js';
import { useQuakeAlerts } from './features/alerts/useQuakeAlerts.js';
import { arm } from './lib/alarm.js';
import { useTheme } from './lib/useTheme.js';
import ToggleRow from './components/ToggleRow.jsx';

function useToast() {
  const [toast, setToast] = useState(null);
  const show = (msg, color) => { setToast({ msg, color }); setTimeout(() => setToast(null), 2600); };
  return [toast, show];
}

export default function App() {
  if (typeof window !== 'undefined' && window.location.hash === '#admin') return <AdminPage />;

  const online = useOnline();
  const user = useGeolocation();
  const { latest, mainshock, aftershocks, all, status, updatedAt } = useQuakes(user);
  const { reports, pendingCount, submit, flag } = useReports(user);
  const [tab, setTab] = useState('home');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, showToast] = useToast();
  const [soundOn, setSoundOn] = useState(false);
  const { theme, toggle: toggleTheme } = useTheme();
  const [pushEnabled, setPushEnabled] = useState(() => {
    try { return localStorage.getItem('lindol:push') === '1'; } catch { return false; }
  });
  const { alert, dismiss } = useQuakeAlerts(all, soundOn);

  const toggleSound = () => {
    if (!soundOn) arm();
    setSoundOn((v) => !v);
  };

  const enablePush = async () => {
    try {
      const key = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!key) return showToast('Push not configured yet', '#CC2A2A');
      const sub = await subscribeToPush(key);
      await savePushSubscription(sub);
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
          </>
        )}

        {tab === 'reports' && (
          <>
            {pendingCount > 0 && (
              <div className="offline-banner" style={{ display: 'flex' }}>
                <span>{pendingCount} report{pendingCount > 1 ? 's' : ''} queued — will send when you're back online.</span>
              </div>
            )}
            <section className="reveal">
              <SectionLabel>Citizen reports · near you</SectionLabel>
              <ReportFeed reports={reports} onFlag={flag} />
            </section>
          </>
        )}

        {tab === 'safety' && (
          <>
            <section className="reveal">
              <SectionLabel>Emergency</SectionLabel>
              <div className="emergency-card">
                <p>Life-threatening emergency? LINDOL alerts the community — it is <b>not</b> an emergency service. Call the national hotline now.</p>
                <a className="call911" href="tel:911">📞 Call 911</a>
              </div>
            </section>
            <section className="reveal">
              <SectionLabel>Safety · works offline</SectionLabel>
              <SafetyPanel />
            </section>
            <div className="sec-label" style={{ margin: '8px 16px 0' }}>Alerts &amp; settings</div>
            <ToggleRow label="Aftershock alarm" desc="Loud alert + vibration while the app is open"
              on={soundOn} onClick={toggleSound} />
            <ToggleRow label="Notify when app is closed" desc="Push notifications for new aftershocks (M4.5+)"
              on={pushEnabled} onClick={enablePush} />
            <ToggleRow label="Dark mode" desc="Easier on the eyes at night"
              on={theme === 'dark'} onClick={toggleTheme} />
            <section className="reveal">
              <SectionLabel>Help others stay safe</SectionLabel>
              <div className="share-cta">
                <p>Know someone in the area? Share LINDOL so they get live earthquake info and safety guidance — even offline.</p>
                <ShareButton />
              </div>
            </section>
            <footer className="credit">
              Built by <a href="https://moncodes.com" target="_blank" rel="noopener noreferrer">moncodes.com</a>
            </footer>
          </>
        )}
      </div>
      )}

      <BottomNav active={tab} onChange={setTab} onReport={() => setSheetOpen(true)} />

      <ReportSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onSubmit={submit} onToast={showToast} />
      {toast && (
        <div className="toast show">
          <span className="tdot" style={{ background: toast.color || '#3F7D43' }} />
          <span>{toast.msg}</span>
        </div>
      )}
      <UpdatePrompt />
      <IntroOverlay />
    </div>
  );
}
