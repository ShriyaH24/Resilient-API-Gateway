const stats = {
  totalRequests: 0,
  statusCodes: {},
  latencyMs: [],
};

function metricsLogger(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    stats.totalRequests++;

    const code = res.statusCode;
    stats.statusCodes[code] = (stats.statusCodes[code] || 0) + 1;

    // Keep last 100 latency samples for calculating average
    stats.latencyMs.push(duration);
    if (stats.latencyMs.length > 100) stats.latencyMs.shift();
  });

  next();
}

function getMetrics(req, res) {
  const total = stats.latencyMs.length;
  const avgLatency =
    total === 0
      ? 0
      : Math.round(stats.latencyMs.reduce((a, b) => a + b, 0) / total);

  res.json({
    totalRequests: stats.totalRequests,
    averageLatencyMs: `${avgLatency}ms`,
    statusCodes: stats.statusCodes,
    uptimeSeconds: Math.floor(process.uptime()),
  });
}

module.exports = { metricsLogger, getMetrics };