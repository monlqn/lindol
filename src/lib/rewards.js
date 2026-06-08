import { supabase } from './supabase.js';
import { getDeviceId } from './device.js';

const NKEY = 'lindol:nick';

export function getNickname() {
  try { return localStorage.getItem(NKEY) || ''; } catch { return ''; }
}

export async function saveNickname(nick) {
  const clean = String(nick || '').trim().slice(0, 20);
  try { localStorage.setItem(NKEY, clean); } catch { /* ignore */ }
  const { error } = await supabase.rpc('set_nickname', { dev: getDeviceId(), nick: clean });
  if (error) throw error;
  return clean;
}

export async function fetchMyStats() {
  const { data, error } = await supabase.rpc('my_stats', { dev: getDeviceId() });
  if (error) throw error;
  return data || { points: 0, verifiedReports: 0, totalReports: 0, confirmsGiven: 0, resolvesGiven: 0 };
}

export async function fetchLeaderboard(limit = 10) {
  const { data, error } = await supabase.rpc('leaderboard', { lim: limit });
  if (error) throw error;
  return data || [];
}

export const LEVELS = [
  { min: 0, name: 'Newcomer', icon: '🌱' },
  { min: 20, name: 'Watcher', icon: '👁️' },
  { min: 60, name: 'Reporter', icon: '📣' },
  { min: 150, name: 'Responder', icon: '🛟' },
  { min: 400, name: 'Guardian', icon: '🛡️' },
];

export function levelFor(points) {
  let lv = LEVELS[0];
  for (const l of LEVELS) if (points >= l.min) lv = l;
  return lv;
}

export function nextLevel(points) {
  return LEVELS.find((l) => l.min > points) || null;
}
