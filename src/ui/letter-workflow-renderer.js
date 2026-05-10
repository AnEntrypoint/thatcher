import { statusLabel } from '@/ui/renderer.js';
import { page } from '@/ui/layout.js';
import { canEdit } from '@/ui/permissions-ui.js';

const LETTER_STEPS = [
  { key: 'generate', label: 'Generate Letter', icon: '1' },
  { key: 'review', label: 'Internal Review', icon: '2' },
  { key: 'send', label: 'Send to Client', icon: '3' },
  { key: 'sign', label: 'Client Signature', icon: '4' },
  { key: 'complete', label: 'Complete', icon: '5' },
];

function stepIndicator(currentStep) {
  const idx = LETTER_STEPS.findIndex(s => s.key === currentStep);
  return `<div class="flex items-center justify-between mb-8">${LETTER_STEPS.map((s, i) => {
    const done = i < idx;
    const active = i === idx;
    const dotColor = done ? 'bg-green-500 text-white' : active ? 'bg-blue-500 text-white ring-4 ring-blue-100' : 'bg-gray-200 text-gray-500';
    const lineColor = done ? 'bg-green-500' : 'bg-gray-200';
    const line = i > 0 ? `<div class="flex-1 h-0.5 ${lineColor} mx-2"></div>` : '';
    return `${line}<div class="flex flex-col items-center"><div class="w-8 h-8 rounded-full ${dotColor} flex items-center justify-center text-sm font-bold">${done ? '&#10003;' : s.icon}</div><div class="text-xs mt-1 ${active ? 'text-blue-600 font-semibold' : 'text-gray-500'} text-center">${s.label}</div></div>`;
  }).join('')}</div>`;
}

function determineStep(engagement) {
  const auditor = engagement.letter_auditor_status || '';
  const client = engagement.letter_client_status || '';
  if (client === 'signed' || client === 'completed') return 'complete';
  if (client === 'sent' || client === 'pending') return 'sign';
  if (auditor === 'approved' || auditor === 'sent') return 'send';
  if (auditor === 'draft' || auditor === 'pending') return 'review';
  return 'generate';
}

export function renderLetterWorkflow(user, engagement) {
  const canEditEng = canEdit(user, 'engagement');
  const currentStep = determineStep(engagement);
  const auditorStatus = engagement.letter_auditor_status || 'not_started';
  const clientStatus = engagement.letter_client_status || 'not_started';

  const stepper = stepIndicator(currentStep);

  const statusCards = `<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6"><div class="card-clean"><div class="card-clean-body"><h3 class="font-semibold mb-2">Auditor Status</h3><div class="flex items-center gap-2">${statusLabel(auditorStatus)}<span class="text-sm text-gray-500">${auditorStatus.replace(/_/g, ' ')}</span></div></div></div><div class="card-clean"><div class="card-clean-body"><h3 class="font-semibold mb-2">Client Status</h3><div class="flex items-center gap-2">${statusLabel(clientStatus)}<span class="text-sm text-gray-500">${clientStatus.replace(/_/g, ' ')}</span></div></div></div></div>`;

  const generateAction = currentStep === 'generate' && canEditEng
    ? `<div class="card-clean" style="margin-bottom:1.5rem"><div class="card-clean-body"><h3 class="font-semibold mb-3">Generate Engagement Letter</h3><p class="text-sm text-gray-500 mb-4">Generate the engagement letter from the configured template. This will create a Google Doc and convert it to PDF.</p><div class="flex gap-2"><button class="btn btn-primary btn-sm" data-action="generateLetter" data-args='["${engagement.id}"]'>Generate Letter</button></div></div></div>` : '';

  const reviewAction = currentStep === 'review' && canEditEng
    ? `<div class="card-clean" style="margin-bottom:1.5rem"><div class="card-clean-body"><h3 class="font-semibold mb-3">Internal Review</h3><p class="text-sm text-gray-500 mb-4">Review the generated letter before sending to client.</p>${engagement.letter_url ? `<a href="${engagement.letter_url}" target="_blank" class="btn btn-outline btn-sm mb-3">View Letter</a>` : ''}<div class="flex gap-2"><button class="btn btn-primary btn-sm" data-action="approveLetter" data-args='["${engagement.id}"]'>Approve</button><button class="btn btn-ghost btn-sm" data-action="regenerateLetter" data-args='["${engagement.id}"]'>Regenerate</button></div></div></div>` : '';

  const sendAction = currentStep === 'send' && canEditEng
    ? `<div class="card-clean" style="margin-bottom:1.5rem"><div class="card-clean-body"><h3 class="font-semibold mb-3">Send to Client</h3><p class="text-sm text-gray-500 mb-4">Send the engagement letter to the client along with team CVs and engagement details.</p><div class="flex gap-2"><button class="btn btn-primary btn-sm" data-action="sendLetter" data-args='["${engagement.id}"]'>Send to Client</button></div></div></div>` : '';

  const signAction = currentStep === 'sign'
    ? `<div class="card-clean" style="margin-bottom:1.5rem"><div class="card-clean-body"><h3 class="font-semibold mb-3">Awaiting Client Signature</h3><p class="text-sm text-gray-500 mb-4">The engagement letter has been sent. Waiting for the client to upload the signed version.</p>${canEditEng ? `<div class="mt-3"><label class="text-sm font-medium block mb-2" for="signed-letter">Upload Signed Letter</label><input type="file"  id="signed-letter" accept=".pdf,.doc,.docx" class="file-input file-input-bordered file-input-sm w-full max-w-xs"/><button class="btn btn-primary btn-sm mt-2" data-action="uploadSigned" data-args='["${engagement.id}"]'>Upload</button></div>` : '<div class="text-sm text-gray-400">Waiting for signed letter upload...</div>'}</div></div>` : '';

  const completeSection = currentStep === 'complete'
    ? `<div class="card-clean" style="margin-bottom:1.5rem;border-left:4px solid var(--color-success,#22c55e)"><div class="card-clean-body"><div class="flex items-center gap-3"><span class="text-2xl">&#10003;</span><div><h3 class="font-semibold text-green-700">Letter Workflow Complete</h3><p class="text-sm text-gray-500">The engagement letter has been signed and filed.</p></div></div></div></div>` : '';

  const content = `<div class="flex justify-between items-center mb-6"><h1 class="text-2xl font-bold">Engagement Letter</h1><a href="/engagement/${engagement.id}" class="btn btn-ghost btn-sm">Back to Engagement</a></div>${stepper}${statusCards}${generateAction}${reviewAction}${sendAction}${signAction}${completeSection}`;

  const letterScript = `window.generateLetter=async function(id){try{const r=await fetch('/api/engagement/'+id+'/letter/generate',{method:'POST'});if(r.ok){location.reload()}else{alert('Generation failed')}}catch(e){alert(e.message)}};window.approveLetter=async function(id){try{const r=await fetch('/api/engagement/'+id+'/letter/approve',{method:'POST'});if(r.ok)location.reload();else alert('Approval failed')}catch(e){alert(e.message)}};window.sendLetter=async function(id){if(!confirm('Send engagement letter to client?'))return;try{const r=await fetch('/api/engagement/'+id+'/letter/send',{method:'POST'});if(r.ok)location.reload();else alert('Send failed')}catch(e){alert(e.message)}};window.regenerateLetter=async function(id){if(!confirm('Regenerate letter?'))return;try{const r=await fetch('/api/engagement/'+id+'/letter/generate',{method:'POST'});if(r.ok)location.reload();else alert('Failed')}catch(e){alert(e.message)}};window.uploadSigned=async function(id){const f=document.getElementById('signed-letter')?.files[0];if(!f)return alert('Select a file');const fd=new FormData();fd.append('file',f);try{const r=await fetch('/api/engagement/'+id+'/letter/upload-signed',{method:'POST',body:fd});if(r.ok)location.reload();else alert('Upload failed')}catch(e){alert(e.message)}}`;

  return page(user, 'Engagement Letter | Moonlanding', [
    { href: '/', label: 'Dashboard' },
    { href: '/engagement', label: 'Engagements' },
    { href: `/engagement/${engagement.id}`, label: engagement.name || 'Engagement' },
    { label: 'Letter' }
  ], content, [letterScript]);
}
