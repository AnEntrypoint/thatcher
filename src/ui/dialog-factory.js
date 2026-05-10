import { esc } from '@/ui/render-helpers.js';

export function createDialog(id, title, body, footer, opts = {}) {
  const maxWidth = opts.maxWidth || '640px';
  const extraClass = opts.class || '';
  return `<div id="${esc(id)}" class="dialog-overlay ${extraClass}" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="${esc(id)}-title" aria-hidden="true">
  <div class="dialog-panel" style="max-width:${maxWidth}">
    <div class="dialog-header">
      <span class="dialog-title" id="${esc(id)}-title">${title}</span>
      <button class="dialog-close" data-dialog-close="${esc(id)}" aria-label="Close dialog">&times;</button>
    </div>
    <div class="dialog-body">${body}</div>
    ${footer ? `<div class="dialog-footer">${footer}</div>` : ''}
  </div>
</div>`;
}

export function modalDialog(id, title, body, footer, opts = {}) {
  const maxWidth = opts.maxWidth || 'md';
  const sizeMap = { sm: '28rem', md: '36rem', lg: '48rem', xl: '64rem' };
  const width = sizeMap[maxWidth] || maxWidth;
  return `<div id="${esc(id)}" class="modal" style="display:none" data-dialog-close-overlay="true">
  <div class="modal-overlay" data-dialog-close="${esc(id)}"></div>
  <div class="modal-content rounded-box" style="max-width:${width};padding:1.5rem">
    <h3 class="text-lg font-semibold mb-4">${title}</h3>
    ${body}
    ${footer ? `<div class="modal-action mt-4">${footer}</div>` : ''}
  </div>
</div>`;
}

export function openDialog(id) {
  return `document.getElementById('${esc(id)}').style.display='flex';document.getElementById('${esc(id)}').setAttribute('aria-hidden','false')`;
}

export function closeDialog(id) {
  return `document.getElementById('${esc(id)}').style.display='none';document.getElementById('${esc(id)}').setAttribute('aria-hidden','true')`;
}
