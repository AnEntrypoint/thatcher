import { page } from '@/ui/layout.js';
import { esc } from '@/ui/render-helpers.js';
import { SPACING, renderPageHeader, renderButton, renderEmptyState } from '@/ui/spacing-system.js';

const STEPS = [
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'signed', label: 'Signed' },
  { key: 'countersigned', label: 'Countersigned' },
];

function stepper(status) {
  const idx = Math.max(0, STEPS.findIndex(s => s.key === status));
  return `<div style="display:flex;gap:${SPACING.sm};margin-bottom:${SPACING.lg};flex-wrap:wrap">
    ${STEPS.map((s, i) => `<span class="${i <= idx ? 'pill pill-success' : 'pill pill-neutral'}">${i + 1}. ${s.label}</span>`).join('')}
  </div>`;
}

export function renderLetterWorkflow(user, engagement = {}) {
  const status = engagement.letter_status || 'draft';
  const letterUrl = engagement.letter_url || null;

  const actions = `<div style="display:flex;gap:${SPACING.sm};flex-wrap:wrap">
    ${renderButton('Generate letter', { action: 'generateEngagementLetter', args: [engagement.id], variant: 'primary' })}
    ${letterUrl ? renderButton('Download letter', { href: letterUrl, variant: 'ghost' }) : ''}
    ${renderButton('Mark as sent', { action: 'markLetterSent', args: [engagement.id], variant: 'ghost' })}
  </div>`;

  const content = `${renderPageHeader('Engagement letter', engagement.name || engagement.client_name || 'Untitled engagement')}
    ${stepper(status)}
    <div class="card-clean"><div class="card-clean-body">
      <div class="card-header">Status</div>
      <p>Current status: <strong>${esc(status.charAt(0).toUpperCase() + status.slice(1))}</strong></p>
      ${actions}
    </div></div>
    <div style="margin-top:${SPACING.lg}">
      ${letterUrl ? `<div class="card-clean"><div class="card-clean-body"><iframe src="${esc(letterUrl)}" title="Engagement letter" style="width:100%;height:70vh;border:0"></iframe></div></div>` : renderEmptyState('No letter generated yet — click "Generate letter" to create one')}
    </div>`;

  const script = `(function(){
    window.generateEngagementLetter=function(id){if(!id)return;fetch('/api/engagement/'+id+'/generate-letter',{method:'POST',credentials:'same-origin'}).then(function(r){return r.json()}).then(function(){window.location.reload()}).catch(function(e){window.showToast&&window.showToast('Failed: '+e.message,'error')})};
    window.markLetterSent=function(id){if(!id)return;fetch('/api/engagement/'+id+'/transition',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({letter_status:'sent'})}).then(function(){window.location.reload()})};
  })();`;

  return page(user, `${engagement.name || 'Engagement'} letter | Thatcher`, [
    { label: 'Engagements', href: '/engagements' },
    { label: engagement.name || 'Engagement', href: `/engagement/${esc(engagement.id || '')}` },
    { label: 'Letter', href: `/engagement/${esc(engagement.id || '')}/letter` },
  ], content, [script]);
}
