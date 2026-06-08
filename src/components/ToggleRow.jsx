// A settings row with a clear ON/OFF switch (so state is obvious at a glance).
export default function ToggleRow({ label, desc, on, onClick }) {
  return (
    <button type="button" className={`toggle-row${on ? ' on' : ''}`} onClick={onClick} aria-pressed={on}>
      <div className="tr-text">
        <b>{label}</b>
        {desc && <span>{desc}</span>}
      </div>
      <span className="tr-switch" aria-hidden="true"><i /></span>
    </button>
  );
}
