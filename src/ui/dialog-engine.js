import { getConfigEngineSync } from '@/lib/config-generator-engine';
import { aria, role, focusTrap, keyboard } from '@/lib/accessibility';

export function renderDialog(dialogId, context = {}) {
  const config = getConfigEngineSync().getConfig();
  const dialogConfig = config.dialogs?.[dialogId];

  if (!dialogConfig) {
    console.warn(`Dialog config not found: ${dialogId}`);
    return '';
  }

  const { title, fields = [], actions = [], width = '640px', onSubmit } = dialogConfig;
  const dialogHtml = generateDialogHtml(dialogId, title, fields, actions, width, context, onSubmit);

  return dialogHtml;
}

function generateDialogHtml(dialogId, title, fields, actions, width, context, onSubmit) {
  const titleId = `${dialogId}-title`;
  const fieldHtml = fields.map(f => generateFieldHtml(f, dialogId, context)).join('');
  const actionButtons = (actions || []).map(a => {
    if (a.type === 'cancel') {
      return `<button type="button" class="btn btn-ghost btn-sm" ${aria.label('Cancel dialog')} data-action="closeDialog" data-args='["${dialogId}"]'>${a.label || 'Cancel'}</button>`;
    } else if (a.type === 'submit') {
      return `<button type="button" class="btn btn-primary btn-sm" ${aria.label('Submit dialog')} data-action="submitDialog" data-args='["${dialogId}"]'>${a.label || 'Submit'}</button>`;
    }
    return '';
  }).join('');

  return `
    <div id="${dialogId}" class="dialog-overlay" style="display:none" ${role.dialog} aria-modal="true" ${aria.labelledBy(titleId)} ${aria.hidden(true)} data-overlay-close="true" data-action="closeDialog" data-args='["${dialogId}"]' onkeydown="${keyboard.escape(`closeDialog('${dialogId}')`)}">
      <div id="${dialogId}-panel" class="dialog-panel" style="max-width:${width}">
        <div class="dialog-header">
          <h2 id="${titleId}" class="dialog-title">${escapeHtml(title)}</h2>
          <button type="button" class="dialog-close" ${aria.label('Close dialog')} data-action="closeDialog" data-args='["${dialogId}"]'>&times;</button>
        </div>
        <div class="dialog-body">
          ${fieldHtml}
        </div>
        <div class="dialog-footer">
          ${actionButtons}
        </div>
      </div>
    </div>
    <script>
      window.closeDialog = window.closeDialog || function(id) {
        const dlg = document.getElementById(id);
        dlg.style.display = 'none';
        dlg.setAttribute('aria-hidden', 'true');
        ${focusTrap.deactivate('${dialogId}-panel')}
        if (dlg._previousFocus) {
          dlg._previousFocus.focus();
          delete dlg._previousFocus;
        }
      };
      window.submitDialog = window.submitDialog || function(id) {
        const form = document.getElementById(id + '-form');
        if (form) form.dispatchEvent(new Event('submit'));
      };
      window.openDialog = window.openDialog || function(id) {
        const dlg = document.getElementById(id);
        dlg._previousFocus = document.activeElement;
        dlg.style.display = 'flex';
        dlg.setAttribute('aria-hidden', 'false');
        ${focusTrap.activate('${dialogId}-panel')}
      };
    </script>
  `;
}

function generateFieldHtml(field, dialogId, context) {
  const { name, label, type, required, placeholder, options, value } = field;
  const fieldId = `${dialogId}-${name}`;
  const requiredAttr = required ? 'required' : '';
  const ariaRequired = required ? aria.required() : '';
  const descId = field.description ? `${fieldId}-desc` : '';
  const ariaDesc = descId ? aria.describedBy(descId) : '';

  let inputHtml = '';

  switch (type) {
    case 'text':
      inputHtml = `<input type="text" id="${fieldId}" name="${name}" class="input input-bordered w-full" placeholder="${placeholder || ''}" ${requiredAttr} ${ariaRequired} ${ariaDesc}/>`;
      break;
    case 'textarea':
      inputHtml = `<textarea id="${fieldId}" name="${name}" class="textarea textarea-bordered w-full" rows="5" placeholder="${placeholder || ''}" ${requiredAttr} ${ariaRequired} ${ariaDesc}></textarea>`;
      break;
    case 'email':
      inputHtml = `<input type="email" id="${fieldId}" name="${name}" class="input input-bordered w-full" placeholder="${placeholder || ''}" ${requiredAttr} ${ariaRequired} ${ariaDesc}/>`;
      break;
    case 'number':
      inputHtml = `<input type="number" id="${fieldId}" name="${name}" class="input input-bordered w-full" placeholder="${placeholder || ''}" ${requiredAttr} ${ariaRequired} ${ariaDesc}/>`;
      break;
    case 'date':
      inputHtml = `<input type="date" id="${fieldId}" name="${name}" class="input input-bordered w-full" ${requiredAttr} ${ariaRequired} ${ariaDesc}/>`;
      break;
    case 'select':
      const optionsHtml = (options || []).map(opt =>
        `<option value="${opt.value}">${escapeHtml(opt.label || opt.value)}</option>`
      ).join('');
      inputHtml = `<select id="${fieldId}" name="${name}" class="select select-bordered w-full" ${requiredAttr} ${ariaRequired} ${ariaDesc}><option value="">Select...</option>${optionsHtml}</select>`;
      break;
    case 'checkbox':
      inputHtml = `<label class="flex items-center gap-2"><input type="checkbox" id="${fieldId}" name="${name}" class="checkbox" ${requiredAttr} ${ariaRequired} ${ariaDesc}/><span class="text-sm">${label}</span></label>`;
      break;
    case 'multi-select':
      const multiOptHtml = (options || []).map(opt =>
        `<label class="flex items-center gap-2"><input type="checkbox" name="${name}" value="${opt.value}" class="checkbox"/><span class="text-sm">${escapeHtml(opt.label || opt.value)}</span></label>`
      ).join('');
      inputHtml = `<div class="flex flex-col gap-2" ${role.list}>${multiOptHtml}</div>`;
      break;
    case 'file':
      inputHtml = `<input type="file" id="${fieldId}" name="${name}" class="file-input file-input-bordered w-full" ${requiredAttr} ${ariaRequired} ${ariaDesc}/>`;
      break;
    case 'color':
      inputHtml = `<input type="color" id="${fieldId}" name="${name}" class="input input-bordered w-full" ${requiredAttr} ${ariaRequired} ${ariaDesc}/>`;
      break;
    default:
      inputHtml = `<input type="text" id="${fieldId}" name="${name}" class="input input-bordered w-full" placeholder="${placeholder || ''}" ${requiredAttr} ${ariaRequired} ${ariaDesc}/>`;
  }

  const descEl = field.description ? `<p id="${descId}" class="text-xs text-gray-500 mt-1">${escapeHtml(field.description)}</p>` : '';

  return `
    <div class="modal-form-group">
      ${type !== 'checkbox' ? `<label for="${fieldId}">${escapeHtml(label || name)}${required ? ' <span aria-hidden="true">*</span>' : ''}</label>` : ''}
      ${inputHtml}
      ${descEl}
    </div>
  `;
}

function escapeHtml(text) {
  if (text == null) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export function getDialogConfig(dialogId) {
  const config = getConfigEngineSync().getConfig();
  return config.dialogs?.[dialogId];
}

export function listDialogs() {
  const config = getConfigEngineSync().getConfig();
  return Object.keys(config.dialogs || {});
}
