import { hookEngine } from '@/lib/hook-engine.js';
import { list, get, update, create, remove } from '@/engine.js';
import { queueEmail } from '@/engine/notification-engine';
import { safeJsonParse } from '@/lib/safe-json.js';
import { validateTransition } from '@/lib/workflow-engine.js';
import { AppError } from '@/lib/error-handler';
import { HTTP } from '@/config/constants';

const logActivity = (t, id, act, msg, u, d) =>
  create('activity_log', { entity_type: t, entity_id: id, action: act, message: msg, details: d ? JSON.stringify(d) : null, user_email: u?.email }, u);

const updateEngagementProgress = (eid) => {
  const rfis = list('rfi', { engagement_id: eid });
  if (rfis.length > 0) {
    const comp = rfis.filter(r => r.status === 'completed' || r.client_status === 'completed');
    update('engagement', eid, { progress: Math.round((comp.length / rfis.length) * 100) });
  }
};

const activateWorkflowsForStage = async (engagementId, stage, user) => {
  try {
    const { getConfigEngine } = await import('@/lib/config-generator-engine');
    const configEngine = await getConfigEngine();
    const config = configEngine.getConfig();

    const stageConfig = config.workflows?.engagement_lifecycle?.stages?.find(s => s.name === stage);
    if (!stageConfig?.activates?.length) return;

    for (const feature of stageConfig.activates) {
      logActivity('engagement', engagementId, 'feature_activated', `Activated ${feature}`, user, { activated_feature: feature });
      hookEngine.execute(`feature:activated:${feature}`, { engagementId, stage, feature, user });
    }
  } catch (error) {
    console.error(`[ACTIVATION] Error activating workflows for stage ${stage}:`, error.message);
  }
};

export const registerEntityHandlers = () => {
  hookEngine.register('update:engagement:before', async (context) => {
    const { entity, data, user, prev } = context;
    if (entity !== 'engagement' || !data.stage || data.stage === prev.stage) return context;
    validateTransition('engagement_lifecycle', prev.stage, data.stage, user);
    if (user?.role === 'clerk' && !(prev.clerks_can_approve === true || prev.clerks_can_approve === 1)) {
      throw new AppError('Clerks cannot change engagement stage unless clerksCanApprove is enabled', 'INSUFFICIENT_PERMISSIONS', HTTP.FORBIDDEN);
    }
    try {
      create('activity_log', { entity_type: 'engagement', entity_id: context.id, action: 'stage_transition',
        message: `Stage transitioned: ${prev.stage} -> ${data.stage}`,
        details: JSON.stringify({ from: prev.stage, to: data.stage, user_role: user?.role }), user_email: user?.email }, user);
    } catch (e) { console.error('[events-engine] Failed to log stage change:', e.message); }
    return context;
  }, { priority: 100, name: 'workflow-stage-validator' });

  hookEngine.on('create:rfi_response:after', async (ctx) => {
    if (!ctx.data?.rfi_id) return;
    const rfi = get('rfi', ctx.data.rfi_id);
    if (rfi) update('rfi', ctx.data.rfi_id, { response_count: (rfi.response_count || 0) + 1, last_response_date: Math.floor(Date.now() / 1000) });
  });

  hookEngine.on('engagement:afterCreate', async (engagement, user) => {
    if (engagement.client_id) {
      const cnt = list('engagement', { client_id: engagement.client_id }).length;
      update('client', engagement.client_id, { engagement_count: cnt });
    }
    if (engagement.stage === 'info_gathering') {
      await queueEmail('engagement_info_gathering', { engagement, recipients: 'client_users' });
    }
    logActivity('engagement', engagement.id, 'create', `Engagement "${engagement.name}" created`, user);
  });

  hookEngine.on('engagement:afterUpdate', async (engagement, changes, prev, user) => {
    if (changes.stage && changes.stage !== prev.stage) {
      logActivity('engagement', engagement.id, 'stage_change', `Stage: ${prev.stage} → ${changes.stage}`, user, { from: prev.stage, to: changes.stage });
      const stageActions = {
        commencement: () => queueEmail('engagement_commencement', { engagement, recipients: 'client_users' }),
        finalization: async () => {
          await queueEmail('engagement_finalization', { engagement, recipients: 'client_admin' });
          await activateWorkflowsForStage(engagement.id, 'finalization', user);
        },
        closeout: () => {
          if (engagement.letter_auditor_status !== 'accepted' && engagement.progress > 0)
            throw new Error('Cannot close out: Letter must be accepted or progress must be 0%');
        },
      };
      await stageActions[changes.stage]?.();
    }
    if (changes.status && changes.status !== prev.status) {
      logActivity('engagement', engagement.id, 'status_change', `Status: ${prev.status} → ${changes.status}`, user);
    }
    if (changes.commencement_date && changes.commencement_date !== prev.commencement_date) {
      await queueEmail('engagement_date_change', { engagement, field: 'commencement_date', recipients: 'team_members' });
    }
  });

  hookEngine.on('engagement:afterDelete', async (engagement) => {
    if (engagement.client_id) {
      const cnt = list('engagement', { client_id: engagement.client_id }).length;
      update('client', engagement.client_id, { engagement_count: cnt });
    }
  });

  hookEngine.on('client:afterUpdate', async (client, changes, prev, user) => {
    if (changes.status === 'inactive' && prev.status !== 'inactive') {
      const engagements = list('engagement', { client_id: client.id });
      for (const e of engagements) {
        if (e.repeat_interval !== 'once') update('engagement', e.id, { repeat_interval: 'once' });
        if (e.stage === 'info_gathering' && e.progress === 0) remove('engagement', e.id);
      }
      logActivity('client', client.id, 'status_change', `Client inactive. Updated ${engagements.length} engagements.`, user);
    }
  });

  hookEngine.on('rfi:afterUpdate', async (rfi, changes, prev, user) => {
    if (changes.status !== undefined && changes.status !== prev.status) {
      if (changes.status === 'completed' && !rfi.date_resolved) {
        update('rfi', rfi.id, { date_resolved: Math.floor(Date.now() / 1000) });
      }
      if (changes.client_status && changes.client_status !== prev.client_status) {
        await queueEmail('rfi_status_change', { rfi, from: prev.client_status, to: changes.client_status, recipients: 'assigned_users' });
      }
      logActivity('rfi', rfi.id, 'status_change', `Status: ${prev.status} → ${changes.status}`, user);
    }
    if (changes.deadline && changes.deadline !== prev.deadline) {
      await queueEmail('rfi_deadline_change', { rfi, newDeadline: changes.deadline, recipients: 'assigned_users' });
      logActivity('rfi', rfi.id, 'update', `Deadline: ${changes.deadline}`, user);
    }
    if (changes.status !== undefined || changes.client_status !== undefined) {
      await updateEngagementProgress(rfi.engagement_id);
    }
  });

  hookEngine.on('team:afterUpdate', async (team, changes, prev) => {
    if (changes.users && prev.users) {
      const prevUsers = safeJsonParse(prev.users, []);
      const newUsers = safeJsonParse(changes.users, []);
      const removed = prevUsers.filter(u => !newUsers.includes(u));
      if (removed.length > 0) {
        for (const e of list('engagement', { team_id: team.id })) {
          const users = safeJsonParse(e.users, []).filter(u => !removed.includes(u));
          if (users.length !== safeJsonParse(e.users, []).length) {
            update('engagement', e.id, { users: JSON.stringify(users) });
          }
        }
      }
    }
  });

  hookEngine.on('review:afterCreate', async (review, user) => {
    await queueEmail('review_created', { review, recipients: 'team_partners' });
    if (review.template_id) {
      const template = get('review_template', review.template_id);
      for (const id of safeJsonParse(template?.default_checklists, [])) {
        const checklist = get('checklist', id);
        if (checklist) create('review_checklist', { review_id: review.id, checklist_id: id, items: checklist.section_items || checklist.items, status: 'pending' }, user);
      }
    }
    logActivity('review', review.id, 'create', `Review "${review.name}" created`, user);
  });

  hookEngine.on('review:afterUpdate', async (review, changes, prev, user) => {
    if (changes.status && changes.status !== prev.status) {
      await queueEmail('review_status_change', { review, from: prev.status, to: changes.status, recipients: 'team_members' });
      logActivity('review', review.id, 'status_change', `Status: ${prev.status} → ${changes.status}`, user);
    }
    if (changes.collaborators && changes.collaborators !== prev.collaborators) {
      const added = safeJsonParse(changes.collaborators, []).filter(c => !safeJsonParse(prev.collaborators, []).find(p => p.id === c.id));
      for (const c of added) await queueEmail('collaborator_added', { review, collaborator: c, recipients: 'collaborator' });
    }
  });

  hookEngine.on('highlight:beforeDelete', async (highlight, user) => {
    create('removed_highlight', { review_id: highlight.review_id, original_id: highlight.id, highlight_data: JSON.stringify(highlight) }, user);
  });

  hookEngine.on('collaborator:afterCreate', async (collaborator, user) => {
    const review = get('review', collaborator.review_id);
    const collabUser = get('user', collaborator.user_id);
    if (review && collabUser) {
      await queueEmail('collaborator_added', { review, collaborator: collabUser, type: collaborator.type, expiresAt: collaborator.expires_at, recipients: 'collaborator' });
    }
  });
};
