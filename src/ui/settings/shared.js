/*
 * Shared settings-page building blocks: the page shell (settingsPage/settingsBack),
 * the settings-scoped breadcrumb builder (bc), a plain inline table renderer, and
 * the role badge. Previously settings-renderer-advanced.js and
 * settings-renderer-advanced2.js each defined an identical local `bc()` breadcrumb
 * helper (byte-for-byte the same arrow function) -- deduped here to one definition
 * every settings/*.js file imports.
 */
import { page } from '@/ui/layout.js';
import { TOAST_SCRIPT, TABLE_SCRIPT, statusBadge as _statusBadge, esc } from '@/ui/render-helpers.js';
import { icon } from '@/ui/format-helpers.js';
import { SPACING, renderCard } from '@/ui/spacing-system.js';

export { TOAST_SCRIPT, TABLE_SCRIPT, esc, icon, SPACING, renderCard };

export function settingsPage(user, title, bc, content, scripts = []) {
  return page(user, title, bc, content, scripts);
}

export function settingsBack() {
  return `<a href="/admin/settings" class="btn btn-ghost btn-sm gap-1 mb-4">Back to Settings</a>`;
}

// Settings-scoped breadcrumb builder: Dashboard -> Settings -> <label>. The
// duplicate this replaces lived identically in settings-renderer-advanced.js
// and settings-renderer-advanced2.js.
export const bc = (label) => [{ href: '/', label: 'Dashboard' }, { href: '/admin/settings', label: 'Settings' }, { label }];

export function inlineTable(headers, rows, emptyMsg) {
  const ths = headers.map(h => `<th>${h}</th>`).join('');
  const empty = `<tr><td colspan="${headers.length}" class="text-center py-8 text-base-content/40 text-sm">${emptyMsg}</td></tr>`;
  return `<div class="table-wrap"><table class="data-table"><thead><tr>${ths}</tr></thead><tbody>${rows || empty}</tbody></table></div>`;
}

const KNOWN_ROLE_LABELS = { admin:'Admin', partner:'Partner', manager:'Manager', clerk:'Clerk', user:'User', auditor:'Auditor', client_admin:'Client Admin', client_user:'Client User' };

export function roleBadge(role) {
  const r = (role || '').toLowerCase();
  const pillMap = { admin:'pill pill-danger', partner:'pill pill-info', manager:'pill pill-success', clerk:'pill pill-warning', user:'pill pill-neutral', auditor:'pill pill-neutral', client_admin:'pill pill-info', client_user:'pill pill-neutral' };
  const cls = pillMap[r] || 'pill pill-neutral';
  const label = KNOWN_ROLE_LABELS[r] || (r.length > 20 ? 'Staff' : (r.charAt(0).toUpperCase() + r.slice(1))) || 'Staff';
  return `<span class="${cls}">${label}</span>`;
}

export function statusBadge(status) { return _statusBadge(status); }
