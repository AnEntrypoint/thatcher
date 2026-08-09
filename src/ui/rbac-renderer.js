import { page } from '@/ui/layout.js';
import { esc } from '@/ui/render-helpers.js';

const ACTIONS = ['list', 'view', 'create', 'edit', 'delete', 'archive', 'export', 'manage_settings'];

export function renderRolesList(user, roles) {
  const sorted = Object.entries(roles).sort((a, b) => (a[1].hierarchy ?? 999) - (b[1].hierarchy ?? 999));
  const rows = sorted.map(([name, def]) =>
    `<tr data-row><td>${esc(name)}</td><td>${esc(def.label || name)}</td><td>${esc(String(def.hierarchy ?? '-'))}</td><td>${esc(def.permissions_scope || '-')}</td></tr>`
  ).join('') || '<tr><td colspan="4">No roles configured</td></tr>';
  const content = `<div class="page-header"><h1 class="page-title">Roles</h1></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Label</th><th>Hierarchy</th><th>Scope</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div style="margin-top:16px"><a href="/admin/permissions" class="btn-ghost-clean">Edit Permission Templates</a></div>`;
  return page(user, 'Roles | Thatcher', [{ href: '/admin/settings', label: 'Settings' }, { label: 'Roles' }], content);
}

export function renderTemplateList(user, templateNames) {
  const rows = templateNames.map(name =>
    `<tr data-row data-navigate="/admin/permissions/${esc(name)}" style="cursor:pointer"><td>${esc(name)}</td></tr>`
  ).join('') || '<tr><td>No permission templates configured</td></tr>';
  const content = `<div class="page-header"><h1 class="page-title">Permission Templates</h1></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  return page(user, 'Permission Templates | Thatcher', [{ href: '/admin/settings', label: 'Settings' }, { href: '/admin/roles', label: 'Roles' }, { label: 'Permission Templates' }], content);
}

export function renderPermissionMatrix(user, templateName, roleNames, roleActionsMap) {
  const header = ACTIONS.map(a => `<th style="text-align:center">${esc(a)}</th>`).join('');
  const rows = roleNames.map(role => {
    const actions = roleActionsMap[role] || [];
    const cells = ACTIONS.map(a =>
      `<td style="text-align:center"><input type="checkbox" data-role="${esc(role)}" data-action="${esc(a)}"${actions.includes(a) ? ' checked' : ''}></td>`
    ).join('');
    return `<tr><td>${esc(role)}</td>${cells}</tr>`;
  }).join('');

  const content = `<div class="page-header"><h1 class="page-title">Permissions: ${esc(templateName)}</h1></div>
    <div class="table-wrap"><table class="data-table" id="perm-matrix"><thead><tr><th>Role</th>${header}</tr></thead><tbody>${rows}</tbody></table></div>
    <div style="margin-top:16px">
      <button type="button" class="btn-primary-clean" data-action="savePermissions" data-args='["${esc(templateName)}"]'>Save</button>
      <span id="save-status" style="margin-left:12px;font-size:13px"></span>
    </div>`;

  const script = `(function(){
    window.savePermissions=function(templateName){
      var boxes=document.querySelectorAll('#perm-matrix input[type="checkbox"]');
      var map={};
      boxes.forEach(function(cb){
        var role=cb.getAttribute('data-role');
        var action=cb.getAttribute('data-action');
        if(!map[role])map[role]=[];
        if(cb.checked)map[role].push(action);
      });
      var status=document.getElementById('save-status');
      status.textContent='Saving...';
      fetch('/api/permission-template/'+templateName+'/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roles:map})})
        .then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d}})})
        .then(function(res){if(res.ok){status.textContent='Saved';status.style.color='var(--color-success,#22c55e)';setTimeout(function(){location.reload()},500)}else{status.textContent='Error: '+(res.d.error||'save failed');status.style.color='var(--color-danger,#ef4444)'}})
        .catch(function(err){status.textContent='Error: '+err.message;status.style.color='var(--color-danger,#ef4444)'});
    };
  })();`;

  return page(user, `Permissions: ${templateName} | Thatcher`, [{ href: '/admin/settings', label: 'Settings' }, { href: '/admin/roles', label: 'Roles' }, { href: '/admin/permissions', label: 'Permission Templates' }, { label: templateName }], content, [script]);
}
