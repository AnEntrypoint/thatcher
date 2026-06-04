import { STAGE_COLORS, STATUS_COLORS } from './render-helpers.js';

export function formatDate(ts, opts) {
  if (!ts) return '-';
  const d = typeof ts === 'number' ? new Date(ts < 1e10 ? ts * 1000 : ts) : new Date(ts);
  if (isNaN(d)) return '-';
  return d.toLocaleDateString('en-ZA', opts || { day: '2-digit', month: 'short', year: 'numeric' });
}

export function timeAgo(ts) {
  if (!ts) return '-';
  const d = typeof ts === 'number' ? new Date(ts < 1e10 ? ts * 1000 : ts) : new Date(ts);
  const diff = Date.now() - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
  return formatDate(ts);
}

export function formatCurrency(amount, currency) {
  if (amount == null || amount === '') return '-';
  const n = Number(amount);
  if (isNaN(n)) return String(amount);
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'R';
  return sym + ' ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatPercent(val) {
  if (val == null || val === '') return '-';
  const n = Number(val);
  if (isNaN(n)) return val;
  return (n > 1 ? n : Math.round(n * 100)) + '%';
}

export function stagePill(stage, stageConfig) {
  const STAGES = stageConfig || STAGE_COLORS;
  const raw = STAGES[stage];
  // Normalize both the local {color,bg,label} shape and the shared
  // STAGE_COLORS {text,bg,label} shape into {color,bg,label}.
  const cfg = raw ? { label: raw.label, bg: raw.bg, color: raw.color || raw.text } : null;
  if (!cfg) return stage ? `<span style="background:var(--color-bg,#f5f5f5);color:var(--color-text-muted,#555);padding:2px 8px;border-radius:10px;font-size:0.7rem;font-weight:700">${stage}</span>` : '-';
  return `<span style="background:${cfg.bg};color:${cfg.color};padding:2px 8px;border-radius:10px;font-size:0.7rem;font-weight:700;white-space:nowrap;border:1px solid ${cfg.color}44">${cfg.label}</span>`;
}

// Role/extra status keys not present in the shared STATUS_COLORS table.
// Shared statuses (active, pending, draft, closed, overdue, responded, …)
// are sourced from STATUS_COLORS so the token set stays single-source.
const EXTRA_STATUS_MAP = {
  inactive:  ['#555',    '#f5f5f5'],
  sent:      ['#e65100', '#fff3e0'],
  deleted:   ['#c62828', '#fdecea'],
  admin:     ['#6a1b9a', '#f3e5f5'],
  partner:   ['#1565c0', '#e3f2fd'],
  manager:   ['#2e7d32', '#e8f5e9'],
  clerk:     ['#e65100', '#fff3e0'],
  user:      ['#555',    '#f5f5f5'],
  auditor:   ['#283593', '#e8eaf6'],
};

export function statusBadge(status, labelOverride) {
  const s = (status || '').toLowerCase();
  const shared = STATUS_COLORS[s];
  const [color, bg] = shared
    ? [shared.text, shared.bg]
    : (EXTRA_STATUS_MAP[s] || ['#888', '#f5f5f5']);
  const label = labelOverride || (s ? s.charAt(0).toUpperCase() + s.slice(1) : '-');
  return `<span style="background:${bg};color:${color};padding:2px 9px;border-radius:10px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;white-space:nowrap">${label}</span>`;
}

export function roleBadge(role) {
  const known = ['admin','partner','manager','clerk','user','auditor'];
  if (!role) return statusBadge('', '-');
  if (!known.includes(role.toLowerCase())) return statusBadge('', 'Unknown');
  return statusBadge(role);
}

export function formatName(user) {
  if (!user) return '-';
  return user.name || user.display_name || user.email || '-';
}

export function truncate(str, n) {
  const max = n || 50;
  if (!str) return '-';
  const s = String(str);
  return s.length > max ? s.slice(0, max) + '…' : s;
}

// Shared stroke-based SVG icon set. Replaces emoji/raw-unicode glyphs with a
// consistent, theme-following (currentColor) icon system. Add new paths here
// rather than scattering inline <svg> across renderers.
const ICON_PATHS = {
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  document: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  tag: '<path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
};

export function icon(name, size = 18) {
  const path = ICON_PATHS[name];
  if (!path) return '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
}

export function emptyState(message, iconName) {
  const ico = typeof iconName === 'string' && ICON_PATHS[iconName] ? icon(iconName, 32) : icon('inbox', 32);
  return `<div style="text-align:center;padding:48px 24px;color:var(--color-text-muted,#aaa)">
    <div style="display:flex;justify-content:center;margin-bottom:12px">${ico}</div>
    <div style="font-size:0.88rem;font-weight:500">${message || 'No items found'}</div>
  </div>`;
}

export function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
