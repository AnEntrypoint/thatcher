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

const eventDelegation = {
  closeDialog(dialogId) {
    const el = document.getElementById(dialogId);
    if (el) el.style.display = 'none';
  },

  openDialog(e, target, params) {
    const id = params?.dialogId || (target?.dataset?.args ? JSON.parse(target.dataset.args)[0] : null);
    const el = id ? document.getElementById(id) : null;
    if (el) el.style.display = 'flex';
  },

  printPage() { window.print(); },

  navigate(path) { window.location = path; },

  toggle(elementId, attr = 'checked') {
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
    return;
  }

  if (target.dataset.dialogClose) {
    eventDelegation.closeDialog(target.dataset.dialogClose);
    if (target.dataset.action) {
      const params = target.dataset.params ? JSON.parse(target.dataset.params) : {};
      window.__events.dispatch(target.dataset.action, e, target, params);
    }
  } else if (target.dataset.navigate) {
    eventDelegation.navigate(target.dataset.navigate);
  } else if (target.dataset.toggle) {
    eventDelegation.toggle(target.dataset.toggle);
  } else if (target.dataset.action) {
    const params = target.dataset.params ? JSON.parse(target.dataset.params) : {};
    window.__events.dispatch(target.dataset.action, e, target, params);
  }
}, true);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const dialog = document.querySelector('[role="dialog"]:not([style*="display:none"])');
    if (dialog) {
      dialog.style.display = 'none';
      e.preventDefault();
    }
  }
});
