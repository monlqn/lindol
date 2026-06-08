// Loud attention alarm via Web Audio. Browsers block audio until a user gesture,
// so callers must invoke arm() from a click/tap first (that also unlocks playback).
let ctx = null;
let armed = false;

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

// Play a loud two-tone warble for ~`seconds`, plus vibration where supported.
export function playAlarm(seconds = 3) {
  if (!armed || !ctx) return;
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.9, now + 0.05);
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.connect(gain);
  for (let i = 0; i < seconds * 4; i++) {
    osc.frequency.setValueAtTime(i % 2 ? 1320 : 880, now + i * 0.25);
  }
  gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  osc.start(now);
  osc.stop(now + seconds);
  try { navigator.vibrate?.([400, 200, 400, 200, 400]); } catch { /* unsupported */ }
}
