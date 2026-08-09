// Single source of truth for inventory demand-forecast math, shared between
// page-handler.js's product detail-view computation and any future forecast
// summary view -- kept in one place so they never drift, the same pattern
// contract-expiry.js already established for expiry math.
const DEFAULT_WINDOW_DAYS = 90;
const DEFAULT_LEAD_TIME_DAYS = 14;
const DAY_SECONDS = 86400;

// Average daily consumption over a trailing window: sum of every OUTBOUND
// (negative quantity) movement within the window, divided by the window's
// day-count -- not the number of movements, so sparse activity (e.g. one
// large monthly shipment) still averages correctly over the full period
// rather than only the days something happened.
export function averageDailyConsumption(movements, windowDays = DEFAULT_WINDOW_DAYS, nowSeconds = Math.floor(Date.now() / 1000)) {
  const windowStart = nowSeconds - windowDays * DAY_SECONDS;
  const outboundTotal = movements
    .filter(m => Number(m.created_at) >= windowStart && Number(m.quantity) < 0)
    .reduce((sum, m) => sum + Math.abs(Number(m.quantity) || 0), 0);
  return outboundTotal / windowDays;
}

// null (not Infinity, not a crash) when there is no consumption to project
// against -- a caller rendering this must be able to tell "we don't know"
// apart from "never" without special-casing an infinite number.
export function daysUntilStockout(currentStock, avgDailyConsumption) {
  if (!Number.isFinite(avgDailyConsumption) || avgDailyConsumption <= 0) return null;
  if (currentStock <= 0) return 0;
  return currentStock / avgDailyConsumption;
}

export function suggestedReorderDate(daysUntilStockoutValue, leadTimeDays = DEFAULT_LEAD_TIME_DAYS, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (daysUntilStockoutValue == null) return null;
  const daysUntilReorder = daysUntilStockoutValue - leadTimeDays;
  return nowSeconds + daysUntilReorder * DAY_SECONDS;
}

export function isReorderDue(reorderDateSeconds, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (reorderDateSeconds == null) return false;
  return reorderDateSeconds <= nowSeconds;
}

export function computeInventoryForecast(product, movements, currentStock, options = {}) {
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;
  const leadTimeDays = product.lead_time_days ?? DEFAULT_LEAD_TIME_DAYS;

  const avgDailyConsumption = averageDailyConsumption(movements, windowDays, nowSeconds);
  const daysUntilOut = daysUntilStockout(currentStock, avgDailyConsumption);
  const reorderDate = suggestedReorderDate(daysUntilOut, leadTimeDays, nowSeconds);
  const reorderDue = isReorderDue(reorderDate, nowSeconds);

  return { avg_daily_consumption: avgDailyConsumption, days_until_stockout: daysUntilOut, reorder_date: reorderDate, reorder_due: reorderDue };
}
