let tagsStore = {};

async function apiCall(endpoint, options = {}) {
  try {
    const res = await fetch(`/api/tag${endpoint}`, { headers: { 'Content-Type': 'application/json' }, ...options });
    if (!res.ok) throw new Error('API error');
    return await res.json();
  } catch (e) {
    throw e;
  }
}

async function createTag(name, color = '#808080') {
  const data = await apiCall('', { method: 'POST', body: JSON.stringify({ name: name.trim(), color }) });
  tagsStore[data.id] = { id: data.id, name: data.name, color: data.color, usage: 0 };
  showToast('Tag created', 'success');
  return data;
}

async function updateTag(id, name, color) {
  const data = await apiCall(`/${id}`, { method: 'PUT', body: JSON.stringify({ name: name.trim(), color }) });
  tagsStore[id] = { ...tagsStore[id], name: data.name, color: data.color };
  showToast('Tag updated', 'success');
  return data;
}

async function deleteTag(id) {
  await apiCall(`/${id}`, { method: 'DELETE' });
  delete tagsStore[id];
  showToast('Tag deleted', 'success');
}

async function listTags() {
  try {
    const data = await apiCall('');
    const tags = Array.isArray(data) ? data : data.data || [];
    tagsStore = tags.reduce((acc, tag) => { acc[tag.id] = tag; return acc; }, {});
    return tags;
  } catch (e) {
    console.error('Error loading tags:', e);
    return [];
  }
}

function esc(text) {
  const m = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, c => m[c]);
}

function renderTagsList() {
  const tags = Object.values(tagsStore).sort((a, b) => (b.usage || 0) - (a.usage || 0));
  return `<div class="tags-list">${tags.map(t => `
    <div class="tag-item" data-tag-id="${t.id}">
      <div class="tag-dot" style="background-color: ${t.color}"></div>
      <div class="tag-info"><span class="tag-name">${esc(t.name)}</span><span class="tag-usage">${t.usage || 0} items</span></div>
      <div class="tag-actions">
        <button class="btn btn-xs btn-ghost" data-action="gtsEditTag" data-args='["${t.id}"]'>Edit</button>
        <button class="btn btn-xs btn-ghost text-error" data-action="gtsDeleteTag" data-args='["${t.id}"]'>Delete</button>
      </div>
    </div>
  `).join('') || '<p class="text-xs text-gray-500">No tags created</p>'}</div>`;
}

function showDialog(mode = 'create', tagId = null) {
  const tag = mode === 'edit' ? tagsStore[tagId] : null;
  const html = `
    <div class="dialog-overlay" id="tag-dialog-overlay" data-action="gtsCloseDialog" onkeydown="if(event.key==='Escape')gtsCloseDialog()" role="dialog" aria-modal="true" aria-labelledby="tag-dialog-heading" aria-hidden="true">
      <div class="dialog-content" data-stop-propagation="true">
        <div class="dialog-header"><h2 id="tag-dialog-heading">${mode === 'create' ? 'Create New Tag' : 'Edit Tag'}</h2><button class="btn btn-sm btn-ghost" data-action="gtsCloseDialog" aria-label="Close dialog">&times;</button></div>
        <div class="dialog-body">
          <div class="form-group"><label class="label" for="tag-name-input">Tag Name</label><input type="text" class="input input-bordered w-full" id="tag-name-input" placeholder="e.g., Priority" value="${tag ? esc(tag.name) : ''}" maxlength="50" /></div>
          <div class="form-group"><label class="label" for="tag-color-input">Color</label><div class="flex gap-2"><input type="color" id="tag-color-input" value="${tag ? tag.color : '#808080'}" aria-label="Tag color" /><span id="color-preview" class="w-8 h-8 rounded border" style="background-color: ${tag ? tag.color : '#808080'}" aria-hidden="true"></span></div></div>
        </div>
        <div class="dialog-footer"><button class="btn btn-ghost" data-action="gtsCloseDialog">Cancel</button><button class="btn btn-primary" data-action="gtsSaveTag" data-args='["${mode}","${tagId || ''}"]'>${mode === 'create' ? 'Create' : 'Update'}</button></div>
      </div>
    </div>`;
  const container = document.getElementById('tag-dialog-container') || (c => (document.body.appendChild(c), c))(Object.assign(document.createElement('div'), { id: 'tag-dialog-container' }));
  container.innerHTML = html;
  document.getElementById('tag-color-input').addEventListener('input', (e) => {
    document.getElementById('color-preview').style.backgroundColor = e.target.value;
  });
}

function showToast(msg, type = 'info') {
  let c = document.getElementById('toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toast-container';
    c.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2';
    document.body.appendChild(c);
  }
  const t = document.createElement('div');
  t.className = `alert alert-${type === 'error' ? 'error' : type === 'success' ? 'success' : 'info'} shadow-lg max-w-sm`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

window.gtsOpenDialog = (mode = 'create', tagId = null) => showDialog(mode, tagId);
window.gtsEditTag = (tagId) => gtsOpenDialog('edit', tagId);
window.gtsDeleteTag = async (tagId) => {
  if (confirm(`Delete "${esc(tagsStore[tagId].name)}"?`)) {
    await deleteTag(tagId);
    refreshTagsList();
  }
};
window.gtsSaveTag = async (mode, tagId) => {
  const name = document.getElementById('tag-name-input').value.trim();
  const color = document.getElementById('tag-color-input').value;
  if (!name) { showToast('Tag name required', 'error'); return; }
  try {
    mode === 'create' ? await createTag(name, color) : await updateTag(tagId, name, color);
    gtsCloseDialog();
    refreshTagsList();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
};
window.gtsCloseDialog = () => {
  const c = document.getElementById('tag-dialog-container');
  if (c) c.innerHTML = '';
};

async function refreshTagsList() {
  await listTags();
  const c = document.getElementById('tags-list-container');
  if (c) c.innerHTML = renderTagsList();
}

export async function initGlobalTags() {
  await listTags();
  return { createTag, updateTag, deleteTag, listTags, renderTagsList, refreshTagsList };
}

export function renderTagsUI() {
  return `
    <div class="card-clean"><div class="card-clean-body">
      <div class="flex justify-between items-center mb-4"><h2 class="card-title text-lg">Global Tags</h2><button class="btn btn-primary btn-sm" data-action="gtsOpenDialog" data-args='["create"]'>New Tag</button></div>
      <div id="tags-list-container">${renderTagsList()}</div>
    </div></div>
    <div id="tag-dialog-container"></div>
    <style>.tags-list{display:flex;flex-direction:column;gap:0.75rem}.tag-item{display:flex;align-items:center;gap:1rem;padding:0.75rem;border:1px solid var(--color-border,#e5e7eb);border-radius:0.5rem}.tag-dot{width:20px;height:20px;border-radius:50%;flex-shrink:0}.tag-info{flex:1}.tag-name{font-weight:500;display:block}.tag-usage{font-size:0.75rem;color:var(--color-text-muted,#6b7280);display:block}.tag-actions{display:flex;gap:0.5rem}.dialog-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000}.dialog-content{background:var(--color-surface,white);border-radius:0.5rem;box-shadow:0 10px 25px rgba(0,0,0,0.2);max-width:500px;width:90%;color:var(--color-text,#111)}.dialog-header{padding:1.5rem;border-bottom:1px solid var(--color-border,#e5e7eb);display:flex;justify-content:space-between;align-items:center}.dialog-body{padding:1.5rem}.dialog-footer{padding:1rem 1.5rem;border-top:1px solid var(--color-border,#e5e7eb);display:flex;justify-content:flex-end;gap:0.75rem}.form-group{margin-bottom:1rem}.label{display:block;margin-bottom:0.5rem;font-weight:500}</style>
  `;
}
