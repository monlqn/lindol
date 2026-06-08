import StatusBar from './components/StatusBar.jsx';
import Masthead from './components/Masthead.jsx';
import OfflineBanner from './components/OfflineBanner.jsx';
import SectionLabel from './components/SectionLabel.jsx';
import ReportButtonStub from './components/ReportButtonStub.jsx';
import QuakeHero from './features/quakes/QuakeHero.jsx';
import QuakeMap from './features/quakes/QuakeMap.jsx';
import SafetyPanel from './features/safety/SafetyPanel.jsx';
import { useQuakes } from './features/quakes/useQuakes.js';
import { useOnline } from './lib/useOnline.js';

export default function App() {
  const online = useOnline();
  const { mainshock, aftershocks, all, status, updatedAt } = useQuakes();

  return (
    <div className={`app${online ? '' : ' off'}`}>
      <StatusBar online={online} updatedAt={updatedAt} />
      <Masthead />
      <div className="scroll">
        {!online && <OfflineBanner updatedAt={updatedAt} />}

        <section className="reveal">
          <SectionLabel>Latest event{status === 'cached' ? ' · cached' : ''}</SectionLabel>
          <QuakeHero quake={mainshock} />
        </section>

        <section className="reveal">
          <SectionLabel>Live map · {all.length} events nearby</SectionLabel>
          <QuakeMap mainshock={mainshock} aftershocks={aftershocks} />
        </section>

        <section className="reveal">
          <SectionLabel>Safety · works offline</SectionLabel>
          <SafetyPanel />
        </section>
      </div>
      <ReportButtonStub />
    </div>
  );
}
