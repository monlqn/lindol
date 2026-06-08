import { useState } from 'react';
import { subscribeToPush } from './lib/push.js';
import { savePushSubscription } from './features/alerts/pushApi.js';
import AlertBanner from './components/AlertBanner.jsx';
import StatusBar from './components/StatusBar.jsx';
import Masthead from './components/Masthead.jsx';
import OfflineBanner from './components/OfflineBanner.jsx';
import SectionLabel from './components/SectionLabel.jsx';
import ShareButton from './components/ShareButton.jsx';
import QuakeHero from './features/quakes/QuakeHero.jsx';
import QuakeMap from './features/quakes/QuakeMap.jsx';
import SafetyPanel from './features/safety/SafetyPanel.jsx';
import ReportButton from './features/reports/ReportButton.jsx';
import ReportSheet from './features/reports/ReportSheet.jsx';
import ReportFeed from './features/reports/ReportFeed.jsx';
import AdminPage from './features/admin/AdminPage.jsx';
import IntroOverlay from './components/IntroOverlay.jsx';
import { useQuakes } from './features/quakes/useQuakes.js';
import { useReports } from './features/reports/useReports.js';
import { useOnline } from './lib/useOnline.js';
import { useGeolocation } from './lib/useGeolocation.js';
import { useQuakeAlerts } from './features/alerts/useQuakeAlerts.js';
import { arm } from './lib/alarm.js';

function useToast() {
  const [toast, setToast] = useState(null);
  const show = (msg, color) => { setToast({ msg, color }); setTimeout(() => setToast(null), 2600); };
  return [toast, show];
}

export default function App() {
  if (typeof window !== 'undefined' && window.location.hash === '#admin') return <AdminPage />;

  const online = useOnline();
  const user = useGeolocation();
  const { mainshock, aftershocks, all, status, updatedAt } = useQuakes(user);
  const { reports, pendingCount, submit, flag } = useReports(user);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, showToast] = useToast();
  const [soundOn, setSoundOn] = useState(false);
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
      showToast("You'll be notified of aftershocks", '#3F7D43');
    } catch (e) {
      showToast(e.message || 'Could not enable notifications', '#CC2A2A');
    }
  };

  return (
    <div className={`app${online ? '' : ' off'}`}>
      <AlertBanner alert={alert} onDismiss={dismiss} />
      <StatusBar online={online} updatedAt={updatedAt} />
      <Masthead quakes={all} />
      <button className="alert-toggle" onClick={toggleSound}>
        {soundOn ? '🔔 Aftershock alarm: ON' : '🔕 Enable aftershock alarm'}
      </button>
      <button className="alert-toggle" onClick={enablePush}>
        🔔 Notify me even when the app is closed
      </button>
      <div className="scroll">
        {!online && <OfflineBanner updatedAt={updatedAt} />}
        {pendingCount > 0 && (
          <div className="offline-banner" style={{ display: 'flex' }}>
            <span>{pendingCount} report{pendingCount > 1 ? 's' : ''} queued — will send when you're back online.</span>
          </div>
        )}

        <section className="reveal">
          <SectionLabel>Latest event{status === 'cached' ? ' · cached' : ''}</SectionLabel>
          <QuakeHero quake={mainshock} />
        </section>

        <section className="reveal">
          <SectionLabel>Live map · {all.length} quakes · {reports.length} reports</SectionLabel>
          <QuakeMap mainshock={mainshock} aftershocks={aftershocks} reports={reports} user={user} />
        </section>

        <section className="reveal">
          <SectionLabel>Near you · newest first</SectionLabel>
          <ReportFeed reports={reports} onFlag={flag} />
        </section>

        <section className="reveal">
          <SectionLabel>Safety · works offline</SectionLabel>
          <SafetyPanel />
        </section>

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
      </div>

      <ReportButton onClick={() => setSheetOpen(true)} />
      <ReportSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onSubmit={submit} onToast={showToast} />
      {toast && (
        <div className="toast show">
          <span className="tdot" style={{ background: toast.color || '#3F7D43' }} />
          <span>{toast.msg}</span>
        </div>
      )}
      <IntroOverlay />
    </div>
  );
}
