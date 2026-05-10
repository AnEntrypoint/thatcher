export function formatDate(ts, opts) {
  if (!ts) return '—';
  const d = typeof ts === 'number' ? new Date(ts < 1e10 ? ts * 1000 : ts) : new Date(ts);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-ZA', opts || { day: '2-digit', month: 'short', year: 'numeric' });
}

export function timeAgo(ts) {
  if (!ts) return '—';
  const d = typeof ts === 'number' ? new Date(ts < 1e10 ? ts * 1000 : ts) : new Date(ts);
  const diff = Date.now() - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
  return formatDate(ts);
}

export function formatCurrency(amount, currency) {
  if (amount == null || amount === '') return '—';
  const n = Number(amount);
  if (isNaN(n)) return String(amount);
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'R';
  return sym + ' ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatPercent(val) {
  if (val == null || val === '') return '—';
  const n = Number(val);
  if (isNaN(n)) return val;
  return (n > 1 ? n : Math.round(n * 100)) + '%';
}

export function stagePill(stage, stageConfig) {
  const STAGES = stageConfig || {
    info_gathering:  { label: 'Info Gathering',  color: '#e53935', bg: '#ffebee' },
    commencement:    { label: 'Commencement',    color: '#e65100', bg: '#fff3e0' },
    team_execution:  { label: 'Team Execution',  color: '#1565c0', bg: '#e3f2fd' },
    partner_review:  { label: 'Partner Review',  color: '#283593', bg: '#e8eaf6' },
    finalization:    { label: 'Finalization',    color: '#2e7d32', bg: '#e8f5e9' },
    closeout:        { label: 'Close Out',       color: '#33691e', bg: '#f1f8e9' },
  };
  const cfg = STAGES[stage];
  if (!cfg) return stage ? `<span style="background:var(--color-bg,#f5f5f5);color:var(--color-text-muted,#555);padding:2px 8px;border-radius:10px;font-size:0.7rem;font-weight:700">${stage}</span>` : '—';
  return `<span style="background:${cfg.bg};color:${cfg.color};padding:2px 8px;border-radius:10px;font-size:0.7rem;font-weight:700;white-space:nowrap;border:1px solid ${cfg.color}44">${cfg.label}</span>`;
}

const STATUS_MAP = {
  active:    ['#2e7d32', '#e8f5e9'],
  inactive:  ['#555',    '#f5f5f5'],
  pending:   ['#e65100', '#fff3e0'],
  draft:     ['#888',    '#f5f5f5'],
  sent:      ['#e65100', '#fff3e0'],
  responded: ['#2e7d32', '#e8f5e9'],
  closed:    ['#555',    '#eeeeee'],
  overdue:   ['#c62828', '#ffebee'],
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
  const [color, bg] = STATUS_MAP[s] || ['#888', '#f5f5f5'];
  const label = labelOverride || (s ? s.charAt(0).toUpperCase() + s.slice(1) : '—');
  return `<span style="background:${bg};color:${color};padding:2px 9px;border-radius:10px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;white-space:nowrap">${label}</span>`;
}

export function roleBadge(role) {
  const known = ['admin','partner','manager','clerk','user','auditor'];
  if (!role) return statusBadge('', '—');
  if (!known.includes(role.toLowerCase())) return statusBadge('', 'Unknown');
  return statusBadge(role);
}

export function formatName(user) {
  if (!user) return '—';
  return user.name || user.display_name || user.email || '—';
}

export function truncate(str, n) {
  const max = n || 50;
  if (!str) return '—';
  const s = String(str);
  return s.length > max ? s.slice(0, max) + '…' : s;
}

export function emptyState(message, icon) {
  const ico = icon || '📭';
  return `<div style="text-align:center;padding:48px 24px;color:var(--color-text-muted,#aaa)">
    <div style="font-size:2rem;margin-bottom:12px">${ico}</div>
    <div style="font-size:0.88rem;font-weight:500">${message || 'No items found'}</div>
  </div>`;
}

export function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
