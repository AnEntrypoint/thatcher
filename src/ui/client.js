import { createElement, applyDiff } from 'webjsx';

export { createElement, applyDiff };

export function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  toast.style.cssText = 'position:relative'; // Ensure proper stacking on mobile
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

export function showDialog(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'flex';
    const focusable = el.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable) setTimeout(() => focusable.focus(), 100);
  }
}

export function hideDialog(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

export async function submitForm(formId, url, method = 'POST') {
  const form = document.getElementById(formId);
  if (!form) return;
  const fd = new FormData(form);
  const data = {};
  for (const [k, v] of fd.entries()) data[k] = v;
  form.querySelectorAll('input[type=checkbox]').forEach(cb => {
    data[cb.name] = cb.checked;
  });
  form.querySelectorAll('input[type=number]').forEach(inp => {
    if (inp.name && data[inp.name] !== undefined && data[inp.name] !== '')
      data[inp.name] = Number(data[inp.name]);
  });
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast(method === 'POST' ? 'Created' : 'Updated', 'success');
      return { ok: true, data: result.data || result };
    }
    showToast(result.message || result.error || 'Save failed', 'error');
    return { ok: false, data: result };
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
    return { ok: false, error: err };
  }
}

export async function confirmDelete(url, redirectUrl) {
  if (!confirm('Are you sure you want to delete this?')) return false;
  try {
    const res = await fetch(url, { method: 'DELETE' });
    if (res.ok) {
      showToast('Deleted', 'success');
      if (redirectUrl) setTimeout(() => { window.location = redirectUrl; }, 500);
      return true;
    }
    const d = await res.json().catch(() => ({}));
    showToast(d.message || d.error || 'Delete failed', 'error');
    return false;
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
    return false;
  }
}

export function toggleElement(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? '' : 'none';
}

window.showToast = showToast;
window.showDialog = showDialog;
window.hideDialog = hideDialog;
window.submitForm = submitForm;
window.confirmDelete = confirmDelete;
window.toggleElement = toggleElement;
