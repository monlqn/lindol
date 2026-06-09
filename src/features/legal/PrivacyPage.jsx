// Privacy policy, served at lindol.app/#privacy. Plain-language and accurate to what
// the app actually does. Linked from the Safety-tab footer.
export default function PrivacyPage() {
  return (
    <div className="legal">
      <a className="legal-back" href="/">← Back to LINDOL</a>
      <h1>Privacy Policy</h1>
      <p className="legal-date">Last updated: June 2026</p>

      <p>
        LINDOL is a free, community earthquake-awareness web app for the Philippines. We collect as
        little as possible, never sell your data, and run no advertising or third-party tracking.
        This notice explains what we handle and why, consistent with the Philippine Data Privacy Act
        of 2012 (RA 10173).
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li><b>Location.</b> Only with your permission. Used to show quakes near you, to tag a report
          you submit, and to decide whether an earthquake is near enough to alert you. If you submit
          a report, its coordinates are stored and shown publicly on the map. If you enable
          notifications, an approximate location is stored so alerts can be limited to quakes near you.</li>
        <li><b>Citizen reports.</b> The category you pick, your optional text note, an optional photo,
          the location, a timestamp, and an anonymous device ID. Reports are <b>public</b>.</li>
        <li><b>Photos.</b> Images you attach are stored in our backend and are publicly viewable. They
          are automatically deleted about 14 days after upload.</li>
        <li><b>Push notification subscription.</b> If you turn on alerts: the push endpoint and keys
          your browser generates, plus your approximate location, used only to deliver earthquake
          alerts. Turn it off any time and the subscription is removed.</li>
        <li><b>Flagging.</b> When you flag a report, we store the report ID, your anonymous device ID,
          and the reason you chose, to prevent duplicate flags and to help moderators.</li>
        <li><b>Anonymous device ID.</b> A random ID kept in your browser to limit spam and stop
          duplicate flags. It is not linked to your name or any account.</li>
        <li><b>On-device settings & cache.</b> Your theme, alarm setting, and dismissed items are
          stored only on your device. For offline use, the app also caches recent earthquake data and
          map tiles on your device.</li>
      </ul>

      <h2>2. What we do NOT collect</h2>
      <p>No names, no email addresses, no user accounts, no passwords, no advertising, and no
        third-party analytics or tracking cookies. We have no way to identify you personally.</p>

      <h2>3. Services we rely on</h2>
      <p>To function, LINDOL exchanges data with: <b>USGS</b> and <b>EMSC</b> (live earthquake data),
        <b> CartoDB</b> (map tiles), <b>Supabase</b> (database, photo storage, and notification
        delivery), <b>Vercel</b> (website hosting), and your browser vendor's <b>push service</b>
        (Google, Apple, or Mozilla) when notifications are enabled. As with any website, these
        providers may receive your IP address and basic device info as part of normal requests.</p>

      <h2>4. Where your data is stored</h2>
      <p>Reports, photos, and subscriptions are stored on infrastructure operated by Supabase and
        Vercel, which may be located outside the Philippines. Connections use HTTPS encryption.</p>

      <h2>5. Reports are public, so please be careful</h2>
      <p>Anything you submit (photo, note, location) is visible to everyone using LINDOL. Do not
        include sensitive personal information, ID documents, contact details, or identifiable faces
        of people who have not agreed to be shown. Reports can be flagged by users and hidden or
        removed by moderators.</p>

      <h2>6. Data retention</h2>
      <p>Photos are automatically deleted about 14 days after upload. Report records may be kept
        longer to maintain the public timeline, but you can ask us to remove a specific report
        (see Contact). On-device data stays until you clear your browser/site data.</p>

      <h2>7. Security & moderation</h2>
      <p>We use reputable providers and HTTPS, and apply rate limits and community flagging to reduce
        abuse. To rate-limit spam, we briefly store a one-way <b>hashed</b> version of your IP address
        (never the raw IP); these records auto-delete within 30 minutes. A small number of moderators
        can hide or delete reported content. No online service can be guaranteed 100% secure, so please
        share responsibly.</p>

      <h2>8. Your choices</h2>
      <ul>
        <li>Decline the location prompt, or simply don't submit reports.</li>
        <li>Turn notifications off any time in the Safety tab.</li>
        <li>Clear your browser/site data to remove local settings, cached data, and your device ID.</li>
        <li>Ask us to remove a specific report or photo (see Contact).</li>
      </ul>

      <h2>9. Not an emergency service</h2>
      <p>LINDOL is an awareness tool, <b>not</b> a 911 replacement and <b>not</b> an earthquake
        early-warning system. Alerts arrive minutes after a quake is detected. In an emergency, call
        <b> 911</b> or your local DRRMO, and react to shaking immediately.</p>

      <h2>10. Children</h2>
      <p>LINDOL is not directed at children and does not knowingly collect information from them.</p>

      <h2>11. Changes to this policy</h2>
      <p>We may update this policy as the app evolves. The "last updated" date above will change when
        we do, and the current version always lives at this page.</p>

      <h2>12. Contact</h2>
      <p>Questions, concerns, or removal requests: reach the developer via <a href="https://moncodes.com"
        target="_blank" rel="noopener noreferrer">moncodes.com</a>.</p>

      <a className="legal-back" href="/">← Back to LINDOL</a>
    </div>
  );
}
