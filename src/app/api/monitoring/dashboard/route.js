import { renderMonitoringDashboard } from '@/ui/monitoring-dashboard.js'

export const GET = async (request) => {
  const { getUser, setCurrentRequest } = await import('@/engine.server')
  setCurrentRequest(request)
  const user = await getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }
  if (user.role !== 'admin' && user.role !== 'partner') {
    return new Response(JSON.stringify({ error: 'Permission denied' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
  }
  const html = renderMonitoringDashboard()
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}
