import { runDueJobs } from '@/engine/job-engine';
import { create } from '@/engine';

export const runtime = 'nodejs';

export async function POST(request) {
  const startTime = Date.now();

  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token || token !== process.env.CRON_SECRET) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const results = await runDueJobs();
    const duration = Date.now() - startTime;

    await create('job_execution_log', {
      timestamp: Math.floor(Date.now() / 1000),
      total_jobs: results.total || 0,
      executed_jobs: results.executed || 0,
      failed_jobs: results.failed || 0,
      duration_ms: duration,
      status: results.failed > 0 ? 'partial_failure' : 'success',
      error_details: results.errors || null
    }).catch(err => console.error('[Cron] Log error:', err.message));

    return new Response(
      JSON.stringify({
        status: 'success',
        timestamp: new Date().toISOString(),
        total_jobs: results.total,
        executed_jobs: results.executed,
        failed_jobs: results.failed,
        duration_ms: duration,
        details: results.details || []
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ status: 'error', message: error.message, timestamp: new Date().toISOString() }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function GET() {
  return new Response(
    JSON.stringify({ status: 'ok', message: 'Cron trigger endpoint active. POST with Bearer token to execute.', timestamp: new Date().toISOString() }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
