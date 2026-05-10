export const commonHandlers = {
  dialogs: {
    close(dialogId) {
      const el = document.getElementById(dialogId);
      if (el) el.style.display = 'none';
    },
    open(dialogId, display = 'flex') {
      const el = document.getElementById(dialogId);
      if (el) el.style.display = display;
    },
    toggle(dialogId) {
      const el = document.getElementById(dialogId);
      if (el) el.style.display = el.style.display === 'none' ? 'flex' : 'none';
    }
  },

  nav: {
    go(path) { window.location = path; },
    external(url) { window.open(url, '_blank'); },
    back() { window.history.back(); }
  },

  forms: {
    reset(formId) {
      const form = document.getElementById(formId);
      if (form?.reset) form.reset();
    },
    submit(formId) {
      const form = document.getElementById(formId);
      if (form) form.dispatchEvent(new Event('submit', { bubbles: true }));
    },
    disable(formId) {
      const form = document.getElementById(formId);
      if (form) {
        form.querySelectorAll('input, button, select, textarea').forEach(el => el.disabled = true);
      }
    },
    enable(formId) {
      const form = document.getElementById(formId);
      if (form) {
        form.querySelectorAll('input, button, select, textarea').forEach(el => el.disabled = false);
      }
    }
  },

  dom: {
    show(id) { const el = document.getElementById(id); if (el) el.style.display = ''; },
    hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; },
    toggle(id) {
      const el = document.getElementById(id);
      if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
    },
    addClass(id, cls) {
      const el = document.getElementById(id);
      if (el) el.classList.add(...cls.split(' '));
    },
    removeClass(id, cls) {
      const el = document.getElementById(id);
      if (el) el.classList.remove(...cls.split(' '));
    },
    toggleClass(id, cls) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle(cls);
    },
    setText(id, text) {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    },
    setHtml(id, html) {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    },
    getValue(id) {
      const el = document.getElementById(id);
      return el?.value || '';
    },
    setValue(id, value) {
      const el = document.getElementById(id);
      if (el) el.value = value;
    },
    focus(id) {
      const el = document.getElementById(id);
      if (el) el.focus();
    },
    remove(id) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
  },

  selection: {
    toggleCheckbox(id) {
      const el = document.getElementById(id);
      if (el?.type === 'checkbox') el.checked = !el.checked;
    },
    setChecked(id, checked) {
      const el = document.getElementById(id);
      if (el?.type === 'checkbox') el.checked = checked;
    },
    isChecked(id) {
      const el = document.getElementById(id);
      return el?.type === 'checkbox' && el.checked;
    },
    toggleActive(id) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('active');
    }
  },

  data: {
    getSelectedRows() {
      return Array.from(document.querySelectorAll('input[data-row-select]:checked'))
        .map(el => el.dataset.rowId);
    },
    clearSelections() {
      document.querySelectorAll('input[data-row-select]').forEach(el => el.checked = false);
    },
    selectAll(selector = 'input[data-row-select]') {
      document.querySelectorAll(selector).forEach(el => el.checked = true);
    }
  },

  notify: {
    show(message, type = 'info') {
      if (typeof showToast === 'function') {
        showToast(message, type);
      }
    },
    success(message) { this.show(message, 'success'); },
    error(message) { this.show(message, 'error'); },
    warning(message) { this.show(message, 'warning'); },
    info(message) { this.show(message, 'info'); }
  },

  keyboard: {
    isEnter(event) { return event.key === 'Enter'; },
    isEscape(event) { return event.key === 'Escape'; },
    isSpace(event) { return event.key === ' '; },
    preventDefault(event) { event.preventDefault(); event.stopPropagation(); }
  },

  utils: {
    debounce(fn, delay = 300) {
      let timer;
      return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
      };
    },
    confirm(message) { return window.confirm(message); },
    prompt(message, defaultValue = '') { return window.prompt(message, defaultValue); },
    wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  }
};

export const { dialogs, nav, forms, dom, selection, data, notify, keyboard, utils } = commonHandlers;
