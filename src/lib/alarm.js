// Loud attention alarm via Web Audio. Browsers block audio until a user gesture,
// so callers must invoke arm() from a click/tap first (that also unlocks playback).
let ctx = null;
let armed = false;
let loopId = null;
let safetyId = null;
let nodes = [];

export function isArmed() { return armed; }

// Call from a user gesture to unlock audio.
export function arm({ AudioContextCtor } = {}) {
  try {
    const Ctor = AudioContextCtor || window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    ctx = ctx || new Ctor();
    ctx.resume?.();
    armed = true;
    return true;
  } catch {
    return false;
  }
}

// One ~`seconds` run of a loud two-tone square-wave siren at full volume.
function burst(seconds) {
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(1.0, now + 0.04);
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.connect(gain);
  for (let i = 0; i < seconds * 4; i++) {
    osc.frequency.setValueAtTime(i % 2 ? 1320 : 880, now + i * 0.25);
  }
  gain.gain.setValueAtTime(1.0, now + seconds - 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  osc.start(now);
  osc.stop(now + seconds);
  osc.onended = () => { try { gain.disconnect(); } catch { /* gone */ } };
  nodes.push(osc);
}

// Finite alarm (used for the preview).
export function playAlarm(seconds = 6) {
  if (!armed || !ctx) return;
  burst(seconds);
  try { navigator.vibrate?.([500, 200, 500, 200, 500]); } catch { /* unsupported */ }
}

// Looping alarm - keeps sounding + vibrating until stopAlarm(). Used for real alerts.
const BURST = 4;
export function startAlarm() {
  if (!armed || !ctx) return;
  stopAlarm();
  const beat = () => {
    burst(BURST);
    try { navigator.vibrate?.([600, 300, 600, 300, 600, 300]); } catch { /* unsupported */ }
  };
  beat();
  loopId = setInterval(beat, BURST * 1000);
  // Safety: never ring longer than 2 minutes even if never dismissed.
  safetyId = setTimeout(stopAlarm, 120000);
}

export function stopAlarm() {
  if (loopId) { clearInterval(loopId); loopId = null; }
  if (safetyId) { clearTimeout(safetyId); safetyId = null; }
  for (const osc of nodes) { try { osc.stop(); } catch { /* already stopped */ } }
  nodes = [];
  try { navigator.vibrate?.(0); } catch { /* unsupported */ }
}
