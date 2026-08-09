// Data-derived predictive math, distinct from insights-engine.js's rule-based
// fixed-threshold checks (days<=14, pct>=90, dropPct>30) -- both functions
// here derive their parameters FROM the input series itself (slope/intercept,
// mean/stddev) rather than from a hardcoded constant, the standard
// lightweight statistical technique available without an ML training
// pipeline. Same small-pure-module shape as contract-expiry.js/
// inventory-forecast.js/resource-capacity.js.

// Least-squares fit over [x, y] points. x is typically a period index
// (0, 1, 2...), y the metric value at that period.
export function linearRegression(points) {
  const n = points.length;
  if (n < 2) return null;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (const [x, y] of points) {
    sumX += x; sumY += y; sumXY += x * y; sumXX += x * x;
  }
  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export function predictNext(points) {
  const fit = linearRegression(points);
  if (!fit) return null;
  const nextX = Math.max(...points.map(([x]) => x)) + 1;
  return fit.slope * nextX + fit.intercept;
}

function mean(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values, avg) {
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// Flags latestValue as anomalous relative to series' OWN historical mean/
// stddev -- a value that would be normal for a high-variance series and
// anomalous for a low-variance one, which a fixed threshold cannot express.
// stddev===0 (a perfectly flat history) means ANY deviation is infinitely
// many stddevs away, so any latestValue != mean is reported as anomalous
// with zScore=Infinity rather than dividing by zero into NaN.
export function zScoreAnomaly(series, latestValue, threshold = 2) {
  if (series.length < 2) return { isAnomaly: false, zScore: null, mean: null, stddev: null };
  const avg = mean(series);
  const sd = stddev(series, avg);
  if (sd === 0) return { isAnomaly: latestValue !== avg, zScore: latestValue === avg ? 0 : Infinity, mean: avg, stddev: 0 };
  const zScore = (latestValue - avg) / sd;
  return { isAnomaly: Math.abs(zScore) >= threshold, zScore, mean: avg, stddev: sd };
}
