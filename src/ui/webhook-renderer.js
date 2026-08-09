import { page } from '@/ui/layout.js';
import { esc } from '@/ui/render-helpers.js';

export function renderWebhookList(user, webhooks, entityNames) {
  const rows = webhooks.map(w =>
    `<tr data-row data-navigate="/admin/webhooks/${esc(w.id)}" style="cursor:pointer">
      <td>${esc(w.entity)}</td><td>${esc(w.trigger)}</td><td>${esc(w.url)}</td>
      <td>${w.enabled ? 'Enabled' : 'Disabled'}</td>
    </tr>`
  ).join('') || '<tr><td colspan="4">No webhooks configured</td></tr>';

  const entityOpts = entityNames.map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join('');
  const triggerOpts = ['create', 'update', 'delete', 'transition'].map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');

  const content = `<div class="page-header"><h1 class="page-title">Webhooks</h1></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Entity</th><th>Trigger</th><th>URL</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="card-clean" style="margin-top:16px"><div class="card-clean-body">
      <h3 style="margin-bottom:8px">Add Webhook</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <select id="new-wh-entity">${entityOpts}</select>
        <select id="new-wh-trigger">${triggerOpts}</select>
        <input type="text" id="new-wh-url" placeholder="https://example.com/hook" style="flex:1;min-width:200px">
        <button type="button" class="btn-primary-clean" data-action="createWebhook">Add</button>
      </div>
      <span id="create-status" style="margin-left:8px;font-size:13px"></span>
    </div></div>`;

  const script = `(function(){
    window.createWebhook=function(){
      var entity=document.getElementById('new-wh-entity').value;
      var trigger=document.getElementById('new-wh-trigger').value;
      var urlInput=document.getElementById('new-wh-url');
      var url=urlInput.value.trim();
      var status=document.getElementById('create-status');
      if(!url){status.textContent='URL required';return}
      status.textContent='Creating...';
      fetch('/api/webhook/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entity:entity,trigger:trigger,url:url})})
        .then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d}})})
        .then(function(res){if(res.ok){status.textContent='Created';location.reload()}else{status.textContent='Error: '+(res.d.error||'create failed')}})
        .catch(function(err){status.textContent='Error: '+err.message});
    };
  })();`;

  return page(user, 'Webhooks | Thatcher', [{ href: '/admin/settings', label: 'Settings' }, { label: 'Webhooks' }], content, [script]);
}

export function renderWebhookDetail(user, webhook, deliveries) {
  const deliveryRows = deliveries.map(d =>
    `<tr><td>${esc(String(d.attempt))}</td><td>${d.success ? 'Success' : 'Failed'}</td><td>${esc(String(d.status_code ?? '-'))}</td><td>${esc(d.error || '-')}</td></tr>`
  ).join('') || '<tr><td colspan="4">No deliveries yet</td></tr>';

  const content = `<div class="page-header"><h1 class="page-title">Webhook: ${esc(webhook.entity)}.${esc(webhook.trigger)}</h1></div>
    <div class="card-clean" style="margin-bottom:16px"><div class="card-clean-body">
      <div style="margin-bottom:8px"><strong>URL:</strong> ${esc(webhook.url)}</div>
      <div style="margin-bottom:8px"><strong>Status:</strong> <span id="wh-status-label">${webhook.enabled ? 'Enabled' : 'Disabled'}</span></div>
      <button type="button" class="btn-ghost-clean" data-action="toggleWebhook" data-args='["${esc(webhook.id)}",${webhook.enabled ? 'false' : 'true'}]'>${webhook.enabled ? 'Disable' : 'Enable'}</button>
      <button type="button" class="btn-danger-clean" data-action="deleteWebhook" data-args='["${esc(webhook.id)}"]'>Delete</button>
      <span id="action-status" style="margin-left:8px;font-size:13px"></span>
    </div></div>
    <h3>Recent Deliveries</h3>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Attempt</th><th>Result</th><th>Status Code</th><th>Error</th></tr></thead><tbody>${deliveryRows}</tbody></table></div>`;

  const script = `(function(){
    window.toggleWebhook=function(id,nextEnabled){
      var status=document.getElementById('action-status');
      status.textContent='Saving...';
      fetch('/api/webhook/'+id+'/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:nextEnabled})})
        .then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d}})})
        .then(function(res){if(res.ok){location.reload()}else{status.textContent='Error: '+(res.d.error||'update failed')}})
        .catch(function(err){status.textContent='Error: '+err.message});
    };
    window.deleteWebhook=function(id){
      var status=document.getElementById('action-status');
      status.textContent='Deleting...';
      fetch('/api/webhook/'+id+'/delete',{method:'POST'})
        .then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d}})})
        .then(function(res){if(res.ok){window.location='/admin/webhooks'}else{status.textContent='Error: '+(res.d.error||'delete failed')}})
        .catch(function(err){status.textContent='Error: '+err.message});
    };
  })();`;

  return page(user, `Webhook: ${webhook.entity}.${webhook.trigger} | Thatcher`, [{ href: '/admin/settings', label: 'Settings' }, { href: '/admin/webhooks', label: 'Webhooks' }, { label: `${webhook.entity}.${webhook.trigger}` }], content, [script]);
}
