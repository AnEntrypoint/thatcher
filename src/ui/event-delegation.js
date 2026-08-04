window.__events = window.__events || {
  handlers: new Map(),
  register(name, fn) { this.handlers.set(name, fn); },
  dispatch(name, event, target, params) {
    const fn = this.handlers.get(name);
    if (fn) return fn(event, target, params);
    if (typeof window[name] === 'function') {
      const args = target?.dataset?.args ? JSON.parse(target.dataset.args) : [];
      if ('passEvent' in (target?.dataset || {})) args.unshift(event);
      if ('self' in (target?.dataset || {})) args.push(target);
      return window[name](...args);
    }
    console.warn(`Unknown action: ${name}`);
  }
};

// --- Dialog focus management -------------------------------------------------
// A dialog is any visible [role=dialog] / .dialog-overlay / .modal / .modal-overlay.
// We trap Tab within the topmost open dialog, move focus inside on open, and
// restore focus to the opener on close. This works regardless of HOW the dialog
// was opened (central openDialog OR a window.show*Dialog setter that flips
// display=flex), because a MutationObserver watches visibility transitions.
const dialogFocus = {
  openerStack: [],
  FOCUSABLE: 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',

  isDialog(el) {
    return el && el.nodeType === 1 && (
      el.getAttribute('role') === 'dialog' ||
      el.classList.contains('dialog-overlay') ||
      el.classList.contains('dialog-backdrop') ||
      el.classList.contains('modal') ||
      el.classList.contains('modal-overlay')
    );
  },

  isVisible(el) {
    if (!el) return false;
    // offsetParent is null for position:fixed elements even when visible, so we
    // rely on computed display/visibility plus a non-zero box.
    const cs = (typeof getComputedStyle === 'function') ? getComputedStyle(el) : null;
    if (cs) {
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      return el.getClientRects().length > 0;
    }
    return el.style.display !== 'none';
  },

  topOpenDialog() {
    const dialogs = document.querySelectorAll('[role="dialog"], .dialog-overlay, .dialog-backdrop, .modal, .modal-overlay');
    let top = null;
    dialogs.forEach((d) => { if (this.isVisible(d)) top = d; });
    return top;
  },

  focusables(container) {
    return Array.from(container.querySelectorAll(this.FOCUSABLE))
      .filter((el) => el.getClientRects().length > 0 || el === document.activeElement);
  },

  onOpen(dialog) {
    // idempotent: openDialog and the MutationObserver can both report the same
    // open; only the first wins so the opener stack stays balanced.
    if (this.openerStack.some((s) => s.dialog === dialog)) return;
    // remember the element that had focus so we can restore it on close
    const opener = document.activeElement && document.activeElement !== document.body
      ? document.activeElement : null;
    this.openerStack.push({ dialog, opener });
    const f = this.focusables(dialog);
    const first = dialog.querySelector('[autofocus]') || f[0] || dialog;
    setTimeout(() => { try { first.focus(); } catch (_) {} }, 0);
  },

  onClose(dialog) {
    for (let i = this.openerStack.length - 1; i >= 0; i--) {
      if (this.openerStack[i].dialog === dialog) {
        const { opener } = this.openerStack[i];
        this.openerStack.splice(i, 1);
        if (opener && document.contains(opener)) {
          try { opener.focus(); } catch (_) {}
        }
        break;
      }
    }
  }
};

// Exposed for live debugging of dialog focus management via the browser verb.
if (typeof window !== 'undefined') window.__dialogFocus = dialogFocus;

// --- gmPrompt: styled replacement for native window.prompt ---------------------
// Returns a Promise that resolves to the entered string (trimmed) or null if
// cancelled. Lazily builds one reusable dialog so any page (incl. standalone) can
// call window.gmPrompt({title, label, value, placeholder, type, confirmLabel}).
// Participates in dialogFocus (Escape/Tab-trap/focus-restore) like any dialog.
if (typeof window !== 'undefined' && !window.gmPrompt) {
  window.gmPrompt = function (opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      let dlg = document.getElementById('gm-prompt-dialog');
      if (!dlg) {
        dlg = document.createElement('div');
        dlg.id = 'gm-prompt-dialog';
        dlg.className = 'dialog-overlay';
        dlg.style.display = 'none';
        dlg.setAttribute('role', 'dialog');
        dlg.setAttribute('aria-modal', 'true');
        dlg.setAttribute('aria-labelledby', 'gm-prompt-title');
        dlg.innerHTML =
          '<div class="dialog-panel" style="max-width:420px">' +
          '<div class="dialog-header"><span class="dialog-title" id="gm-prompt-title"></span>' +
          '<button class="dialog-close" type="button" aria-label="Close dialog" data-gm-prompt="cancel">&times;</button></div>' +
          '<div class="dialog-body"><div class="modal-form-group">' +
          '<label id="gm-prompt-label" for="gm-prompt-input"></label>' +
          '<input id="gm-prompt-input" class="input input-bordered w-full"/></div>' +
          '<div id="gm-prompt-error" class="text-error text-sm mt-1" style="display:none"></div></div>' +
          '<div class="dialog-footer">' +
          '<button class="btn btn-ghost btn-sm" type="button" data-gm-prompt="cancel">Cancel</button>' +
          '<button class="btn btn-primary btn-sm" type="button" data-gm-prompt="ok"></button></div>';
        document.body.appendChild(dlg);
      }
      const titleEl = dlg.querySelector('#gm-prompt-title');
      const labelEl = dlg.querySelector('#gm-prompt-label');
      const input = dlg.querySelector('#gm-prompt-input');
      const errEl = dlg.querySelector('#gm-prompt-error');
      const okBtn = dlg.querySelector('[data-gm-prompt="ok"]');
      titleEl.textContent = opts.title || 'Enter value';
      labelEl.textContent = opts.label || opts.title || 'Value';
      input.type = opts.type || 'text';
      input.value = opts.value != null ? String(opts.value) : '';
      input.placeholder = opts.placeholder || '';
      okBtn.textContent = opts.confirmLabel || 'OK';
      errEl.style.display = 'none';
      errEl.textContent = '';

      let settled = false;
      const finish = (val) => {
        if (settled) return;
        settled = true;
        dlg.style.display = 'none';
        dialogFocus.onClose(dlg);
        dlg.removeEventListener('click', onClick);
        input.removeEventListener('keydown', onKey);
        dlg.removeEventListener('keydown', onEsc);
        resolve(val);
      };
      const submit = () => {
        const v = input.value.trim();
        if (opts.required !== false && !v) {
          errEl.textContent = (opts.label || 'Value') + ' is required.';
          errEl.style.display = 'block';
          return;
        }
        if (opts.validate) {
          const msg = opts.validate(v);
          if (msg) { errEl.textContent = msg; errEl.style.display = 'block'; return; }
        }
        finish(v);
      };
      const onClick = (e) => {
        const b = e.target.closest('[data-gm-prompt]');
        if (b) { e.preventDefault(); b.dataset.gmPrompt === 'ok' ? submit() : finish(null); return; }
        if (e.target === dlg) finish(null); // backdrop click cancels
      };
      const onKey = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
      };
      // Escape is handled by the central dialogFocus keydown (hides + onClose);
      // we mirror it here so the Promise also resolves to null on Escape.
      const onEsc = (e) => { if (e.key === 'Escape') finish(null); };
      dlg.addEventListener('keydown', onEsc);
      dlg.addEventListener('click', onClick);
      input.addEventListener('keydown', onKey);
      dlg.style.display = 'flex';
      dialogFocus.onOpen(dlg);
    });
  };
}

// --- gmConfirm: styled replacement for native window.confirm ------------------
// Returns a Promise that resolves to true (confirmed) or false (cancelled).
// Lazily builds one reusable dialog so any page (incl. standalone) can call
// window.gmConfirm({title, message, confirmLabel, cancelLabel, danger}).
// Participates in dialogFocus (Escape/Tab-trap/focus-restore) like any dialog.
// Backdrop click and Escape both resolve false (the safe default for a guard).
if (typeof window !== 'undefined' && !window.gmConfirm) {
  window.gmConfirm = function (opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      let dlg = document.getElementById('gm-confirm-dialog');
      if (!dlg) {
        dlg = document.createElement('div');
        dlg.id = 'gm-confirm-dialog';
        dlg.className = 'dialog-overlay';
        dlg.style.display = 'none';
        dlg.setAttribute('role', 'alertdialog');
        dlg.setAttribute('aria-modal', 'true');
        dlg.setAttribute('aria-labelledby', 'gm-confirm-title');
        dlg.setAttribute('aria-describedby', 'gm-confirm-message');
        dlg.innerHTML =
          '<div class="dialog-panel" style="max-width:440px">' +
          '<div class="dialog-header"><span class="dialog-title" id="gm-confirm-title"></span>' +
          '<button class="dialog-close" type="button" aria-label="Close dialog" data-gm-confirm="cancel">&times;</button></div>' +
          '<div class="dialog-body"><p id="gm-confirm-message" style="margin:0"></p></div>' +
          '<div class="dialog-footer">' +
          '<button class="btn btn-ghost btn-sm" type="button" data-gm-confirm="cancel"></button>' +
          '<button class="btn btn-primary btn-sm" type="button" data-gm-confirm="ok"></button></div>';
        document.body.appendChild(dlg);
      }
      const titleEl = dlg.querySelector('#gm-confirm-title');
      const msgEl = dlg.querySelector('#gm-confirm-message');
      const okBtn = dlg.querySelector('[data-gm-confirm="ok"]');
      const cancelBtn = dlg.querySelector('[data-gm-confirm="cancel"].btn-ghost');
      titleEl.textContent = opts.title || 'Are you sure?';
      msgEl.textContent = opts.message || '';
      okBtn.textContent = opts.confirmLabel || 'Confirm';
      if (cancelBtn) cancelBtn.textContent = opts.cancelLabel || 'Cancel';
      // danger styling for irreversible/destructive actions
      okBtn.className = opts.danger ? 'btn btn-error btn-sm' : 'btn btn-primary btn-sm';

      let settled = false;
      const finish = (val) => {
        if (settled) return;
        settled = true;
        dlg.style.display = 'none';
        dialogFocus.onClose(dlg);
        dlg.removeEventListener('click', onClick);
        dlg.removeEventListener('keydown', onEsc);
        resolve(val);
      };
      const onClick = (e) => {
        const b = e.target.closest('[data-gm-confirm]');
        if (b) { e.preventDefault(); finish(b.dataset.gmConfirm === 'ok'); return; }
        if (e.target === dlg) finish(false); // backdrop click cancels
      };
      // Escape is handled by central dialogFocus keydown (hides + onClose);
      // we mirror it here so the Promise also resolves to false on Escape.
      const onEsc = (e) => { if (e.key === 'Escape') finish(false); };
      dlg.addEventListener('keydown', onEsc);
      dlg.addEventListener('click', onClick);
      dlg.style.display = 'flex';
      dialogFocus.onOpen(dlg);
    });
  };
}

const eventDelegation = {
  closeDialog(dialogId) {
    const el = document.getElementById(dialogId);
    if (el) { el.style.display = 'none'; dialogFocus.onClose(el); }
  },

  openDialog(e, target, params) {
    const id = params?.dialogId || (target?.dataset?.args ? JSON.parse(target.dataset.args)[0] : null);
    const el = id ? document.getElementById(id) : null;
    if (el) { el.style.display = 'flex'; dialogFocus.onOpen(el); }
  },

  printPage() { window.print(); },

  navigate(path) { window.location = path; },

  toggle(elementId, _attr = 'checked') {
    const el = document.getElementById(elementId);
    if (el?.type === 'checkbox') el.checked = !el.checked;
    else el.classList.toggle('active');
  },

  toggleDisplay(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
  },

  setValue(elementId, value) {
    const el = document.getElementById(elementId);
    if (el) el.value = value;
  },

  setDisplay(elementId, show) {
    const el = document.getElementById(elementId);
    if (el) el.style.display = show ? '' : 'none';
  },

  remove(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.remove();
  },

  focus(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.focus();
  }
};

Object.entries(eventDelegation).forEach(([name, fn]) => {
  window.__events.register(name, fn);
});

document.addEventListener('click', (e) => {
  const stopEl = e.target.closest('[data-stop-propagation]');
  if (stopEl) { e.stopPropagation(); if (!stopEl.dataset.action) return; }

  const overlay = e.target.closest('[data-overlay-close]');
  if (overlay && e.target === overlay) { overlay.style.display = 'none'; return; }

  let target = e.target.closest('[data-action], [data-dialog-close], [data-navigate], [data-toggle]');
  if (!target) return;

  if (target.classList.contains('dialog-overlay') && e.target === target) {
    target.style.display = 'none';
    dialogFocus.onClose(target);
    return;
  }

  if (target.dataset.dialogClose) {
    // Backdrop/overlay containers carry data-dialog-close to close on backdrop
    // click; they must NOT close when the click originated inside the panel.
    // Explicit close controls (buttons/links) close regardless of bubbling.
    const isBackdropContainer = target.classList.contains('dialog-backdrop') || target.classList.contains('dialog-overlay') || target.classList.contains('modal') || target.classList.contains('modal-overlay');
    if (isBackdropContainer && e.target !== target) {
      // click bubbled up from inside the panel — ignore, let inner handlers run
    } else {
      eventDelegation.closeDialog(target.dataset.dialogClose);
      if (target.dataset.action) {
        const params = target.dataset.params ? JSON.parse(target.dataset.params) : {};
        window.__events.dispatch(target.dataset.action, e, target, params);
      }
      return;
    }
  }
  if (target.dataset.navigate) {
    eventDelegation.navigate(target.dataset.navigate);
  } else if (target.dataset.toggle) {
    eventDelegation.toggle(target.dataset.toggle);
  } else if (target.dataset.action) {
    const params = target.dataset.params ? JSON.parse(target.dataset.params) : {};
    window.__events.dispatch(target.dataset.action, e, target, params);
  }
}, true);

document.addEventListener('keydown', (e) => {
  // Escape closes the topmost open dialog and restores focus to its opener.
  if (e.key === 'Escape') {
    const dialog = dialogFocus.topOpenDialog();
    if (dialog) {
      dialog.style.display = 'none';
      dialogFocus.onClose(dialog);
      e.preventDefault();
    }
    return;
  }

  // Tab is trapped inside the topmost open dialog so focus cannot escape behind it.
  if (e.key === 'Tab') {
    const dialog = dialogFocus.topOpenDialog();
    if (!dialog) return;
    const f = dialogFocus.focusables(dialog);
    if (!f.length) { e.preventDefault(); return; }
    const first = f[0], last = f[f.length - 1];
    const active = document.activeElement;
    if (!dialog.contains(active)) { e.preventDefault(); first.focus(); return; }
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    return;
  }

  // Enter/Space activates a focused keyboard-navigable row ([data-navigate] on a
  // non-natively-focusable element that we made focusable with tabindex).
  if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
    const t = e.target;
    if (t && t.dataset && t.dataset.navigate &&
        t.tagName !== 'A' && t.tagName !== 'BUTTON' && t.tagName !== 'INPUT' &&
        t.tagName !== 'SELECT' && t.tagName !== 'TEXTAREA') {
      e.preventDefault();
      eventDelegation.navigate(t.dataset.navigate);
    }
  }
});

// Make non-natively-focusable navigable rows keyboard-operable: a <tr> (or any
// non-link/button element) carrying data-navigate gets tabindex+role=link so it
// can be focused and activated with Enter/Space (handled in the keydown above).
function upgradeNavigableRows(root) {
  (root || document).querySelectorAll('[data-navigate]').forEach((el) => {
    const tag = el.tagName;
    if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (el.hasAttribute('tabindex')) return;
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'link');
  });
}

// A bare <button> defaults to type=submit; inside a <form> a close/action button
// then submits the form by accident. We set type=button on every button that is
// clearly not a submit control (carries a delegated action, or is not inside a
// form), leaving genuine submit buttons (type=submit, or the form's own submit)
// untouched.
function upgradeButtonTypes(root) {
  (root || document).querySelectorAll('button:not([type])').forEach((b) => {
    const isAction = b.hasAttribute('data-action') || b.hasAttribute('data-dialog-close') ||
      b.hasAttribute('data-navigate') || b.hasAttribute('data-toggle') ||
      b.classList.contains('dialog-close');
    if (isAction || !b.closest('form')) b.setAttribute('type', 'button');
    // A button inside a form with no action attrs is left as-is so a real submit
    // button keeps working; authors mark non-submit form buttons with data-action.
  });
}

function upgradeAll(root) { upgradeNavigableRows(root); upgradeButtonTypes(root); }
// The script may load from <head> (before the body markup exists) or at end of
// body (after). Cover every ordering: run now, on DOMContentLoaded, on load, and
// once more after a tick so server-rendered rows are definitely present. All
// idempotent (queries are :not([type]) / :not([tabindex])).
function runUpgrades() { try { upgradeAll(document); } catch (_) {} }
runUpgrades();
document.addEventListener('DOMContentLoaded', runUpgrades);
window.addEventListener('load', runUpgrades);
setTimeout(runUpgrades, 0);

// Catch dialogs opened by direct display flips (window.show*Dialog setters that
// bypass the central openDialog) and by direct display:none closes — so focus
// management and the Tab-trap apply uniformly however a dialog is toggled.
(function observeDialogs() {
  if (typeof MutationObserver === 'undefined') return;
  const wasVisible = new WeakMap();
  const sync = (el) => {
    if (!dialogFocus.isDialog(el)) return;
    const now = dialogFocus.isVisible(el);
    const before = wasVisible.get(el) || false;
    if (now && !before) dialogFocus.onOpen(el);
    else if (!now && before) dialogFocus.onClose(el);
    wasVisible.set(el, now);
  };
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && (m.attributeName === 'style' || m.attributeName === 'class')) {
        sync(m.target);
      }
    }
  });
  const start = () => {
    document.querySelectorAll('[role="dialog"], .dialog-overlay, .dialog-backdrop, .modal, .modal-overlay')
      .forEach((el) => { wasVisible.set(el, dialogFocus.isVisible(el)); });
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style', 'class'] });
  };
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
