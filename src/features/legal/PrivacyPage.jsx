// Privacy policy, served at lindol.app/#privacy. Plain-language and accurate to what
// the app actually does. Linked from the Safety-tab footer.
export default function PrivacyPage() {
  return (
    <div className="legal">
      <a className="legal-back" href="/">← Back to LINDOL</a>
      <h1>Privacy Policy</h1>
      <p className="legal-date">Last updated: June 2026</p>

      <p>
        LINDOL is a free, community earthquake-awareness web app for the Philippines. We try to
        collect as little as possible, and we never sell your data or run third-party ad tracking.
        This notice explains what we handle and why, in line with the Philippine Data Privacy Act
        (RA 10173).
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Location</b> — only with your permission. Used to show quakes near you, to tag a
          report you submit, and to send alerts for quakes near you. Report coordinates are stored
          and shown publicly on the map.</li>
        <li><b>Citizen reports</b> — the category, your optional note, an optional photo, the
          location, the time, and an anonymous device ID. Reports are <b>public</b>.</li>
        <li><b>Photos</b> you attach — stored in our backend and publicly viewable. They are
          automatically deleted about 14 days after upload.</li>
        <li><b>Push subscription</b> — if you enable notifications: the browser-provided push
          endpoint, its keys, and your approximate location, used only to deliver earthquake alerts.</li>
        <li><b>Anonymous device ID</b> — a random ID stored in your browser to limit spam and stop
          duplicate flags. It is not linked to your identity.</li>
        <li><b>Device settings</b> — your theme, alarm and dismissed items are stored only on your
          own device.</li>
      </ul>

      <h2>What we do NOT collect</h2>
      <p>No names, no email addresses, no accounts, no advertising, and no third-party analytics or
        tracking cookies.</p>

      <h2>Services we rely on</h2>
      <p>To work, LINDOL sends requests to: <b>USGS</b> and <b>EMSC</b> (earthquake data),
        <b> CartoDB</b> (map tiles), <b>Supabase</b> (database, photo storage, notifications),
        <b> Vercel</b> (hosting), and your browser vendor's <b>push service</b> (Google, Apple, or
        Mozilla) when notifications are on. As with any website, these may receive your IP address.</p>

      <h2>Reports are public — please be careful</h2>
      <p>Anything you submit (photo, note, location) is visible to everyone. Don't include sensitive
        personal information, ID documents, or identifiable faces of people who haven't agreed to be
        shown. Reports can be flagged by users and hidden or removed by moderators.</p>

      <h2>Your choices</h2>
      <ul>
        <li>Decline the location prompt, or simply don't submit reports.</li>
        <li>Turn notifications off any time in the Safety tab.</li>
        <li>Clear your browser/site data to remove local settings and your device ID.</li>
        <li>Ask us to remove a specific report or photo (see Contact).</li>
      </ul>

      <h2>Not an emergency service</h2>
      <p>LINDOL is an awareness tool — <b>not</b> a 911 replacement and <b>not</b> an earthquake
        early-warning system. In an emergency, call <b>911</b> or your local DRRMO.</p>

      <h2>Children</h2>
      <p>LINDOL is not directed at children and does not knowingly collect information from them.</p>

      <h2>Contact</h2>
      <p>Questions or removal requests: reach the developer via <a href="https://moncodes.com"
        target="_blank" rel="noopener noreferrer">moncodes.com</a>.</p>

      <a className="legal-back" href="/">← Back to LINDOL</a>
    </div>
  );
}
