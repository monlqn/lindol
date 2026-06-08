const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const isAndroid = /android/i.test(ua);
const isIOS = /iphone|ipad|ipod/i.test(ua);

// Seconds-level early warning isn't something a web app can deliver. On Android,
// the OS has a built-in system — point users to it. On iPhone there's no equivalent,
// so be honest about it.
export default function EarlyWarningTip() {
  return (
    <div className={`ew-tip${isAndroid ? ' ok' : ''}`}>
      <div className="ew-tip-h">⚡ Want a warning in seconds?</div>
      {isAndroid ? (
        <p>
          Your Android phone has a built-in early-warning system that can alert you
          <b> seconds before</b> strong shaking arrives. Turn it on now:
          <br /><b>Settings → Safety &amp; emergency → Earthquake alerts</b>.
        </p>
      ) : isIOS ? (
        <p>
          iPhone has <b>no built-in earthquake early warning</b>, and LINDOL’s alerts
          arrive minutes after a quake. If you feel shaking, <b>act immediately</b> —
          Drop, Cover, Hold On — and follow <b>PHIVOLCS</b> for official updates.
        </p>
      ) : (
        <p>
          On <b>Android</b> phones, enable <b>Settings → Safety &amp; emergency →
          Earthquake alerts</b> for seconds-level warning. <b>iPhone</b> has no
          built-in equivalent — react to shaking immediately.
        </p>
      )}
    </div>
  );
}
