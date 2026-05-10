import { monitoringDashboardScript } from '@/ui/monitoring-dashboard-client.js'
import { SPACING } from '@/ui/spacing-system.js'

const html = (strings, ...values) => strings.reduce((r, s, i) => r + s + (values[i] ?? ''), '')

export function renderMonitoringDashboard() {
  return html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Monitoring Dashboard</title>
        <link rel="stylesheet" href="/ui/styles.css">
        <style>
          .metric-card { min-height: 120px; padding: ${SPACING.md}; }
          .metric-value { font-size: 2rem; font-weight: bold; margin-bottom: ${SPACING.sm}; }
          .metric-label { font-size: 0.875rem; color: #666; }
          .alert-critical { background-color: #fee; border-left: ${SPACING.sm} solid #f00; padding: ${SPACING.md}; margin-bottom: ${SPACING.md}; }
          .alert-warning { background-color: #ffa; border-left: ${SPACING.sm} solid #fa0; padding: ${SPACING.md}; margin-bottom: ${SPACING.md}; }
          .alert-info { background-color: #eff; border-left: ${SPACING.sm} solid #0af; padding: ${SPACING.md}; margin-bottom: ${SPACING.md}; }
          .log-error { color: #f00; }
          .log-warn { color: #fa0; }
          .log-info { color: #0af; }
          .log-debug { color: #888; }
        </style>
      </head>
      <body class="bg-base-100">
        <main id="main-content" role="main">
        <div class="container mx-auto p-4">
          <h1 class="text-3xl font-bold mb-6">System Monitoring Dashboard</h1>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div class="card metric-card bg-base-200">
              <div class="card-clean-body">
                <div class="metric-value text-success" id="health-status">OK</div>
                <div class="metric-label">System Health</div>
              </div>
            </div>

            <div class="card metric-card bg-base-200">
              <div class="card-clean-body">
                <div class="metric-value" id="p95-latency">-</div>
                <div class="metric-label">P95 Latency (ms)</div>
              </div>
            </div>

            <div class="card metric-card bg-base-200">
              <div class="card-clean-body">
                <div class="metric-value" id="error-count">0</div>
                <div class="metric-label">Error Count</div>
              </div>
            </div>

            <div class="card metric-card bg-base-200">
              <div class="card-clean-body">
                <div class="metric-value" id="memory-usage">-</div>
                <div class="metric-label">Memory Usage (%)</div>
              </div>
            </div>
          </div>

          <div class="tabs mb-4">
            <button class="tab tab-lifted tab-active" data-action="showTab" data-args='["requests"]'>Requests</button>
            <button class="tab tab-lifted" data-action="showTab" data-args='["alerts"]'>Alerts</button>
            <button class="tab tab-lifted" data-action="showTab" data-args='["database"]'>Database</button>
            <button class="tab tab-lifted" data-action="showTab" data-args='["resources"]'>Resources</button>
            <button class="tab tab-lifted" data-action="showTab" data-args='["logs"]'>Logs</button>
          </div>

          <div id="tab-requests" class="tab-content">
            <div class="card bg-base-200">
              <div class="card-clean-body">
                <h2 style="font-size:1rem;font-weight:600">Request Metrics</h2>
                <div id="request-metrics" class="overflow-auto max-h-96"></div>
              </div>
            </div>
          </div>

          <div id="tab-alerts" class="tab-content hidden">
            <div class="card bg-base-200">
              <div class="card-clean-body">
                <h2 style="font-size:1rem;font-weight:600">Recent Alerts</h2>
                <div id="alert-list" class="space-y-2"></div>
              </div>
            </div>
          </div>

          <div id="tab-database" class="tab-content hidden">
            <div class="card bg-base-200">
              <div class="card-clean-body">
                <h2 style="font-size:1rem;font-weight:600">Database Metrics</h2>
                <div id="database-metrics"></div>
              </div>
            </div>
          </div>

          <div id="tab-resources" class="tab-content hidden">
            <div class="card bg-base-200">
              <div class="card-clean-body">
                <h2 style="font-size:1rem;font-weight:600">Resource Usage</h2>
                <div id="resource-metrics"></div>
              </div>
            </div>
          </div>

          <div id="tab-logs" class="tab-content hidden">
            <div class="card bg-base-200">
              <div class="card-clean-body">
                <h2 style="font-size:1rem;font-weight:600">System Logs</h2>
                <div class="mb-4 flex gap-2">
                  <label for="log-level" class="sr-only">Log level filter</label>
                  <select id="log-level" class="select select-bordered" aria-label="Log level filter">
                    <option value="">All Levels</option>
                    <option value="debug">Debug</option>
                    <option value="info">Info</option>
                    <option value="warn">Warning</option>
                    <option value="error">Error</option>
                  </select>
                  <label for="log-search" class="sr-only">Search logs</label>
                  <input id="log-search" type="text" placeholder="Search logs..." class="input input-bordered flex-1" aria-label="Search logs">
                </div>
                <div id="log-list" class="overflow-auto max-h-96 font-mono text-sm"></div>
              </div>
            </div>
          </div>
        </div>

        </main>
        ${monitoringDashboardScript()}
      </body>
    </html>
  `
}
