import { useState } from 'react';
import { EVENT_CONTEXT as C } from '../config.js';

// A collapsible, sourced "about this earthquake" card - real science, clearly credited.
export default function AboutQuake() {
  const [open, setOpen] = useState(false);
  if (!C?.facts?.length) return null;
  return (
    <div className="aboutq">
      <button className="aboutq-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>ℹ️ {C.title}</span>
        <span className="aboutq-chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="aboutq-body">
          {C.facts.map((f) => (
            <p className="aboutq-fact" key={f.h}><b>{f.h}.</b> {f.t}</p>
          ))}
          <p className="aboutq-src">
            Sources: {C.sources.map((s, i) => (
              <span key={s.url}>{i ? ' · ' : ''}
                <a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>
              </span>
            ))}
          </p>
        </div>
      )}
    </div>
  );
}
