import Seismograph from './Seismograph.jsx';

export default function Masthead() {
  return (
    <header className="masthead">
      <div className="brandrow">
        <div className="wordmark">LIND<b>Ó</b>L</div>
        <div className="tagline">Southern Mindanao · live earthquake watch</div>
      </div>
      <Seismograph />
    </header>
  );
}
