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
    const targets = await list(job.entity, filter, { user: owner });
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
