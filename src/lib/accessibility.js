export const aria = {
  label: (text) => `aria-label="${escapeHtml(text)}"`,
  labelledBy: (id) => `aria-labelledby="${id}"`,
  describedBy: (id) => `aria-describedby="${id}"`,
  live: (politeness = 'polite') => `aria-live="${politeness}" aria-atomic="true"`,
  hidden: (hidden = true) => hidden ? 'aria-hidden="true"' : '',
  expanded: (expanded) => `aria-expanded="${expanded}"`,
  pressed: (pressed) => `aria-pressed="${pressed}"`,
  checked: (checked) => `aria-checked="${checked}"`,
  disabled: (disabled) => disabled ? 'aria-disabled="true"' : '',
  current: (type = 'page') => `aria-current="${type}"`,
  haspopup: (type = 'dialog') => `aria-haspopup="${type}"`,
  controls: (id) => `aria-controls="${id}"`,
  owns: (id) => `aria-owns="${id}"`,
  invalid: (invalid) => invalid ? 'aria-invalid="true"' : '',
  required: () => 'aria-required="true"',
};

export const role = {
  button: 'role="button"',
  dialog: 'role="dialog"',
  alertdialog: 'role="alertdialog"',
  navigation: 'role="navigation"',
  main: 'role="main"',
  search: 'role="search"',
  form: 'role="form"',
  region: 'role="region"',
  banner: 'role="banner"',
  contentinfo: 'role="contentinfo"',
  complementary: 'role="complementary"',
  list: 'role="list"',
  listitem: 'role="listitem"',
  menu: 'role="menu"',
  menuitem: 'role="menuitem"',
  status: 'role="status"',
  alert: 'role="alert"',
  progressbar: 'role="progressbar"',
  tablist: 'role="tablist"',
  tab: 'role="tab"',
  tabpanel: 'role="tabpanel"',
};

function escapeHtml(text) {
  return String(text).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function skipLink(href, text) {
  return `<a href="${href}" class="skip-link" ${aria.label('Skip to ' + text)}>${text}</a>`;
}

export function landmark(type, label, content) {
  const r = role[type] || `role="${type}"`;
  const a = label ? aria.label(label) : '';
  return `<div ${r} ${a}>${content}</div>`;
}

export function semanticButton(text, attrs = {}) {
  const label = attrs.label || text;
  const disabled = attrs.disabled ? 'disabled' : '';
  const pressed = attrs.pressed !== undefined ? aria.pressed(attrs.pressed) : '';
  const expanded = attrs.expanded !== undefined ? aria.expanded(attrs.expanded) : '';
  const controls = attrs.controls ? aria.controls(attrs.controls) : '';
  const onClick = attrs.onclick ? `onclick="${attrs.onclick}"` : '';
  const className = attrs.class || 'btn';
  return `<button type="button" class="${className}" ${aria.label(label)} ${disabled} ${pressed} ${expanded} ${controls} ${onClick}>${text}</button>`;
}

export function semanticLink(href, text, attrs = {}) {
  const label = attrs.label || text;
  const current = attrs.current ? aria.current(attrs.current) : '';
  const className = attrs.class || '';
  return `<a href="${href}" class="${className}" ${aria.label(label)} ${current}>${text}</a>`;
}

export function formField(type, name, attrs = {}) {
  const id = attrs.id || `field-${name}`;
  const label = attrs.label || name;
  const required = attrs.required ? aria.required() : '';
  const invalid = attrs.invalid ? aria.invalid(true) : '';
  const describedBy = attrs.description ? aria.describedBy(`${id}-desc`) : '';
  const value = attrs.value !== undefined ? `value="${escapeHtml(attrs.value)}"` : '';
  const placeholder = attrs.placeholder ? `placeholder="${escapeHtml(attrs.placeholder)}"` : '';
  const className = attrs.class || 'input input-bordered';

  let field;
  if (type === 'textarea') {
    field = `<textarea id="${id}" name="${name}" class="${className}" ${required} ${invalid} ${describedBy} ${placeholder}>${attrs.value || ''}</textarea>`;
  } else if (type === 'select') {
    const options = (attrs.options || []).map(opt =>
      `<option value="${opt.value}"${opt.selected ? ' selected' : ''}>${opt.label}</option>`
    ).join('');
    field = `<select id="${id}" name="${name}" class="${className}" ${required} ${invalid} ${describedBy}>${options}</select>`;
  } else {
    field = `<input type="${type}" id="${id}" name="${name}" class="${className}" ${value} ${placeholder} ${required} ${invalid} ${describedBy}/>`;
  }

  const labelEl = `<label for="${id}" class="label"><span class="label-text">${label}${attrs.required ? ' <span aria-hidden="true">*</span>' : ''}</span></label>`;
  const descEl = attrs.description ? `<p id="${id}-desc" class="text-xs text-gray-500 mt-1">${attrs.description}</p>` : '';

  return `<div class="form-control">${labelEl}${field}${descEl}</div>`;
}

export function liveRegion(id, politeness = 'polite') {
  return `<div id="${id}" ${aria.live(politeness)} class="sr-only"></div>`;
}

export function announceToScreenReader(regionId, message) {
  return `document.getElementById('${regionId}').textContent = '${escapeHtml(message).replace(/'/g, "\\'")}';`;
}

export const focusTrap = {
  activate: (containerId) => `
    (function() {
      const container = document.getElementById('${containerId}');
      if (!container) return;
      const focusable = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      container._trapHandler = (e) => {
        if (e.key !== 'Tab') return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      };
      container.addEventListener('keydown', container._trapHandler);
      first?.focus();
    })();
  `,
  deactivate: (containerId) => `
    (function() {
      const container = document.getElementById('${containerId}');
      if (container?._trapHandler) {
        container.removeEventListener('keydown', container._trapHandler);
        delete container._trapHandler;
      }
    })();
  `
};

export const keyboard = {
  escape: (callback) => `if (event.key === 'Escape') { ${callback} }`,
  enter: (callback) => `if (event.key === 'Enter') { ${callback} }`,
  space: (callback) => `if (event.key === ' ' || event.key === 'Spacebar') { event.preventDefault(); ${callback} }`,
  arrowNav: (upCallback, downCallback) => `
    if (event.key === 'ArrowUp') { event.preventDefault(); ${upCallback} }
    if (event.key === 'ArrowDown') { event.preventDefault(); ${downCallback} }
  `,
};

export function visuallyHidden(content) {
  return `<span class="sr-only">${content}</span>`;
}

export function accessibleImage(src, alt, attrs = {}) {
  const className = attrs.class || '';
  const decorative = attrs.decorative ? 'alt="" role="presentation"' : `alt="${escapeHtml(alt)}"`;
  return `<img src="${src}" ${decorative} class="${className}"/>`;
}
