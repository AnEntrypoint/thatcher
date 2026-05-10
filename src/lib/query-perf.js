const queryMetrics = new Map();
const slowQueries = [];
const MAX_SLOW_QUERIES = 100;
const SLOW_QUERY_THRESHOLD = 100;

export const trackQuery = (sql, duration, params = []) => {
  const key = sql.substring(0, 200);

  if (!queryMetrics.has(key)) {
    queryMetrics.set(key, {
      sql: key,
      count: 0,
      totalTime: 0,
      minTime: Infinity,
      maxTime: 0,
      times: []
    });
  }

  const metric = queryMetrics.get(key);
  metric.count++;
  metric.totalTime += duration;
  metric.minTime = Math.min(metric.minTime, duration);
  metric.maxTime = Math.max(metric.maxTime, duration);
  metric.times.push(duration);

  if (metric.times.length > 1000) metric.times.shift();

  if (duration >= SLOW_QUERY_THRESHOLD) {
    slowQueries.push({
      sql: key,
      duration,
      params: params.slice(0, 10),
      timestamp: Date.now()
    });

    if (slowQueries.length > MAX_SLOW_QUERIES) slowQueries.shift();
  }
};

const percentile = (arr, p) => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * p / 100) - 1;
  return sorted[Math.max(0, index)];
};

export const getMetrics = () => {
  const metrics = [];

  for (const [, metric] of queryMetrics) {
    const avgTime = metric.count > 0 ? metric.totalTime / metric.count : 0;
    const p50 = percentile(metric.times, 50);
    const p95 = percentile(metric.times, 95);
    const p99 = percentile(metric.times, 99);

    metrics.push({
      sql: metric.sql,
      count: metric.count,
      avgTime: avgTime.toFixed(2),
      minTime: metric.minTime === Infinity ? 0 : metric.minTime.toFixed(2),
      maxTime: metric.maxTime.toFixed(2),
      p50: p50.toFixed(2),
      p95: p95.toFixed(2),
      p99: p99.toFixed(2),
      totalTime: metric.totalTime.toFixed(2)
    });
  }

  return metrics.sort((a, b) => parseFloat(b.totalTime) - parseFloat(a.totalTime));
};

export const getSlowQueries = () => {
  return slowQueries.slice().reverse();
};

export const getSummary = () => {
  const metrics = getMetrics();
  const totalQueries = metrics.reduce((sum, m) => sum + m.count, 0);
  const totalTime = metrics.reduce((sum, m) => sum + parseFloat(m.totalTime), 0);
  const allTimes = [];

  for (const [, metric] of queryMetrics) {
    allTimes.push(...metric.times);
  }

  return {
    totalQueries,
    uniqueQueries: metrics.length,
    totalTime: totalTime.toFixed(2),
    avgTime: totalQueries > 0 ? (totalTime / totalQueries).toFixed(2) : '0',
    p50: percentile(allTimes, 50).toFixed(2),
    p95: percentile(allTimes, 95).toFixed(2),
    p99: percentile(allTimes, 99).toFixed(2),
    slowQueries: slowQueries.length,
    slowQueryThreshold: SLOW_QUERY_THRESHOLD
  };
};

export const clearMetrics = () => {
  queryMetrics.clear();
  slowQueries.length = 0;
};

export const withPerfTracking = (db, sql, params, executor) => {
  const start = performance.now();
  try {
    const result = executor();
    const duration = performance.now() - start;
    trackQuery(sql, duration, params);
    return result;
  } catch (e) {
    const duration = performance.now() - start;
    trackQuery(sql, duration, params);
    throw e;
  }
};
