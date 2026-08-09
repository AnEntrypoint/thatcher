// Single source of truth for contract expiry math, shared between
// page-handler.js's detail-view computation and scheduler-engine.js's
// expiry-notification pre-filter -- kept in one place so the two never drift
// against each other the way a duplicated formula could.
export function daysUntilExpiry(endDate, nowSeconds = Math.floor(Date.now() / 1000)) {
  return Math.floor((Number(endDate) - nowSeconds) / 86400);
}

export function isWithinNoticeWindow(contract, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (contract.status !== 'active' || contract.end_date == null) return false;
  const days = daysUntilExpiry(contract.end_date, nowSeconds);
  return days <= (contract.notice_period_days ?? 30);
}
