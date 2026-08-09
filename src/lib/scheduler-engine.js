import { list, update, getBy } from './busybase/store.js';
import { runBulkOperation } from './bulk-operations.js';
import { getConfigEngineSync } from './config-generator-engine.js';
import { now } from './id-helpers.js';
import { createLogger } from './logger.js';

const log = createLogger('[Scheduler]');
const CHECK_INTERVAL_MS = 60 * 1000;
let intervalHandle = null;

export async function runDueJobs() {
  const nowTs = now();
  const dueJobs = await list('scheduled_job', { enabled: true });
  const results = [];
  for (const job of dueJobs) {
    if (!job.enabled) continue;
    if (job.next_run_at && job.next_run_at > nowTs) continue;
    results.push(await runOneJob(job, nowTs));
  }
  return results;
}

async function runOneJob(job, nowTs) {
  try {
    const owner = await getBy('users', 'id', job.owner_id);
    if (!owner) throw new Error(`Owner ${job.owner_id} not found`);

    const configEngine = getConfigEngineSync();
    const spec = configEngine.generateEntitySpec(job.entity);

    const filter = job.filter ? (typeof job.filter === 'string' ? JSON.parse(job.filter) : job.filter) : {};
    const action = typeof job.action === 'string' ? JSON.parse(job.action) : job.action;

    // list() is org/row-access scoped by passing {user: owner} -- the same
    // scoping crud-handlers.js's read path enforces for an interactive
    // request, so a job cannot reach records outside its owner's org just
    // because it runs unattended.
    let targets = await list(job.entity, filter, { user: owner });

    // job.filter can only express stored-field equality (e.g. status:active);
    // "expiring within notice_period_days" is a per-record computed
    // comparison, not a filterable field, so it's checked here in JS against
    // the SAME shared math the contract detail view uses -- never a second,
    // divergent formula.
    if (job.entity === 'contract' && action?.type === 'notify') {
      const { isWithinNoticeWindow } = await import('./contract-expiry.js');
      targets = targets.filter(c => isWithinNoticeWindow(c, nowTs));
    }

    // integration_sync is a distinct action shape from bulk field-updates --
    // it fans out to an external system per connection rather than mutating
    // Thatcher records, so it bypasses runBulkOperation entirely but still
    // rides the SAME scheduled_job table/timer, not a new cron mechanism.
    if (job.entity === 'integration_connection' && action?.type === 'integration_sync') {
      const { syncConnection } = await import('./integration-sync-engine.js');
      const syncResults = [];
      for (const connection of targets) {
        if (!connection.enabled) continue;
        const results = await syncConnection(connection, owner);
        syncResults.push(...results);
        await update('integration_connection', connection.id, { last_synced_at: nowTs });
      }
      const nextRunAt = nowTs + job.interval_minutes * 60;
      await update('scheduled_job', job.id, { last_run_at: nowTs, next_run_at: nextRunAt });
      const succeeded = syncResults.filter(r => r.success).length;
      log.info(`Job "${job.name}" ran: ${succeeded}/${syncResults.length} synced`);
      return { job_id: job.id, ok: true, total: syncResults.length, succeeded, failed: syncResults.length - succeeded, results: syncResults };
    }

    const ids = targets.map(r => r.id);

    let result = { ok: true, total: 0, succeeded: 0, failed: 0, results: [] };
    if (ids.length) {
      result = await runBulkOperation(job.entity, spec, ids, action, owner);
    }

    const nextRunAt = nowTs + job.interval_minutes * 60;
    await update('scheduled_job', job.id, { last_run_at: nowTs, next_run_at: nextRunAt });
    log.info(`Job "${job.name}" ran: ${result.succeeded}/${result.total} succeeded`);
    return { job_id: job.id, ok: true, ...result };
  } catch (err) {
    log.error(`Job "${job.name}" failed: ${err.message}`);
    const nextRunAt = nowTs + job.interval_minutes * 60;
    await update('scheduled_job', job.id, { last_run_at: nowTs, next_run_at: nextRunAt }).catch(() => {});
    return { job_id: job.id, ok: false, error: err.message };
  }
}

export function startScheduler() {
  if (intervalHandle) return intervalHandle;
  intervalHandle = setInterval(() => {
    runDueJobs().catch(e => log.error(e.message));
  }, CHECK_INTERVAL_MS);
  if (intervalHandle.unref) intervalHandle.unref();
  return intervalHandle;
}

export function stopScheduler() {
  if (intervalHandle) { clearInterval(intervalHandle); intervalHandle = null; }
}
