export function monitoringDashboardScript() {
  return `
    <script>
      let currentTab = 'requests'

      function showTab(name) {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'))
        document.getElementById('tab-' + name).classList.remove('hidden')

        document.querySelectorAll('.tab').forEach(el => el.classList.remove('tab-active'))
        event.target.classList.add('tab-active')

        currentTab = name
      }

      async function fetchMetrics() {
        try {
          const [health, metrics] = await Promise.all([
            fetch('/api/health?detailed=true').then(r => r.json()),
            fetch('/api/metrics').then(r => r.json())
          ])

          document.getElementById('health-status').textContent = health.status.toUpperCase()
          document.getElementById('health-status').className =
            'metric-value ' + (health.status === 'ok' ? 'text-success' : 'text-error')

          if (metrics.metrics?.requests) {
            const allP95 = Object.values(metrics.metrics.requests).map(m => m.p95).filter(v => v > 0)
            const avgP95 = allP95.length ? (allP95.reduce((a,b) => a+b, 0) / allP95.length).toFixed(1) : '-'
            document.getElementById('p95-latency').textContent = avgP95
          }

          if (metrics.metrics?.errors) {
            const totalErrors = Object.values(metrics.metrics.errors.byEndpoint)
              .reduce((sum, ep) => sum + ep.count, 0)
            document.getElementById('error-count').textContent = totalErrors
          }

          if (health.resources?.memory) {
            const memPct = (health.resources.memory.percentage * 100).toFixed(1)
            document.getElementById('memory-usage').textContent = memPct
          }

          if (currentTab === 'requests') updateRequests(metrics.metrics?.requests || {})
          if (currentTab === 'alerts') updateAlerts(metrics.alerts || [])
          if (currentTab === 'database') updateDatabase(metrics.database || {})
          if (currentTab === 'resources') updateResources(health.resources || {})
          if (currentTab === 'logs') updateLogs(metrics.logs || [])

        } catch (err) {
          console.error('Fetch error:', err)
        }
      }

      function updateRequests(requests) {
        const html = Object.entries(requests).map(([endpoint, stats]) => \`
          <div class="mb-4 p-3 bg-base-100 rounded">
            <div class="font-bold">\${endpoint}</div>
            <div class="grid grid-cols-7 gap-2 text-sm mt-2">
              <div>Count: \${stats.count}</div>
              <div>Min: \${stats.min.toFixed(1)}ms</div>
              <div>Max: \${stats.max.toFixed(1)}ms</div>
              <div>Avg: \${stats.avg.toFixed(1)}ms</div>
              <div>P50: \${stats.p50.toFixed(1)}ms</div>
              <div>P95: \${stats.p95.toFixed(1)}ms</div>
              <div>P99: \${stats.p99.toFixed(1)}ms</div>
            </div>
          </div>
        \`).join('')
        document.getElementById('request-metrics').innerHTML = html || '<p>No data</p>'
      }

      function updateAlerts(alerts) {
        const html = alerts.map(alert => \`
          <div class="p-3 rounded alert-\${alert.severity}">
            <div class="font-bold">[\${alert.severity.toUpperCase()}] \${alert.type}</div>
            <div>\${alert.message}</div>
            <div class="text-sm text-gray-600">\${new Date(alert.timestamp).toLocaleString()}</div>
          </div>
        \`).join('')
        document.getElementById('alert-list').innerHTML = html || '<p>No alerts</p>'
      }

      function updateDatabase(db) {
        const html = \`
          <div class="space-y-2">
            <div>Active Queries: \${db.activeQueries || 0}</div>
            <div>Connections: \${db.connections || 0}</div>
            <div>Locks: \${db.locks || 0}</div>
            <div class="mt-4 font-bold">Slow Queries:</div>
            \${(db.slowQueries || []).map(q => \`
              <div class="p-2 bg-base-100 rounded text-sm">
                <div class="font-mono">\${q.sql}</div>
                <div>Duration: \${q.duration.toFixed(2)}ms</div>
              </div>
            \`).join('') || '<p>None</p>'}
          </div>
        \`
        document.getElementById('database-metrics').innerHTML = html
      }

      function updateResources(resources) {
        const html = \`
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="p-4 bg-base-100 rounded">
              <div class="font-bold">CPU</div>
              <div>\${resources.cpu ? (resources.cpu * 100).toFixed(1) + '%' : 'N/A'}</div>
            </div>
            <div class="p-4 bg-base-100 rounded">
              <div class="font-bold">Memory</div>
              <div>\${resources.memory ? (resources.memory.percentage * 100).toFixed(1) + '%' : 'N/A'}</div>
              <div class="text-sm">\${resources.memory ? (resources.memory.used / 1024 / 1024 / 1024).toFixed(2) + ' GB used' : ''}</div>
            </div>
            <div class="p-4 bg-base-100 rounded">
              <div class="font-bold">Disk</div>
              <div>\${resources.disk ? (resources.disk.percentage * 100).toFixed(1) + '%' : 'N/A'}</div>
            </div>
          </div>
        \`
        document.getElementById('resource-metrics').innerHTML = html
      }

      function updateLogs(logs) {
        const html = logs.map(log => \`
          <div class="log-\${log.level} mb-1">
            [\${log.iso}] [\${log.level.toUpperCase()}] \${log.message}
            \${Object.keys(log.metadata).length ? ' ' + JSON.stringify(log.metadata) : ''}
          </div>
        \`).join('')
        document.getElementById('log-list').innerHTML = html || '<p>No logs</p>'
      }

      fetchMetrics()
      setInterval(fetchMetrics, 5000)
    </script>`
}
