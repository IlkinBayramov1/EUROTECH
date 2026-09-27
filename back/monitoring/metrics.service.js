const prisma = require('../config/db');

/**
 * Standard Prometheus Metrics Collector for EuroTech Platform
 */
class MetricsService {
  constructor() {
    this.requestsTotal = new Map(); // key: "METHOD:ROUTE:STATUS" -> count
    this.routeDurationMs = new Map(); // key: "ROUTE" -> { count, totalMs }
    this.startTime = Date.now();
  }

  recordRequest(method, route, statusCode, durationMs) {
    // Normalize route to avoid high cardinality (e.g. /dossiers/uuid-123 -> /dossiers/:id)
    const normalizedRoute = route
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
      .replace(/\d+/g, ':num') || '/';

    const key = `${method}:${normalizedRoute}:${statusCode}`;
    const current = this.requestsTotal.get(key) || 0;
    this.requestsTotal.set(key, current + 1);

    const dur = this.routeDurationMs.get(normalizedRoute) || { count: 0, totalMs: 0 };
    dur.count += 1;
    dur.totalMs += durationMs;
    this.routeDurationMs.set(normalizedRoute, dur);
  }

  async generatePrometheusMetrics() {
    const lines = [];

    // Header comments
    lines.push('# HELP http_requests_total Total number of HTTP requests made to the platform');
    lines.push('# TYPE http_requests_total counter');
    for (const [key, count] of this.requestsTotal.entries()) {
      const [method, route, status] = key.split(':');
      lines.push(`http_requests_total{method="${method}",route="${route}",status="${status}"} ${count}`);
    }

    lines.push('');
    lines.push('# HELP http_request_duration_seconds Average latency of HTTP requests by route');
    lines.push('# TYPE http_request_duration_seconds gauge');
    for (const [route, dur] of this.routeDurationMs.entries()) {
      const avgSeconds = dur.count > 0 ? (dur.totalMs / dur.count / 1000).toFixed(4) : '0.0000';
      lines.push(`http_request_duration_seconds{route="${route}"} ${avgSeconds}`);
    }

    lines.push('');
    lines.push('# HELP system_uptime_seconds Total runtime of the service in seconds');
    lines.push('# TYPE system_uptime_seconds counter');
    lines.push(`system_uptime_seconds ${Math.floor((Date.now() - this.startTime) / 1000)}`);

    lines.push('');
    lines.push('# HELP nodejs_memory_heap_used_bytes Heap memory used by Node.js process');
    lines.push('# TYPE nodejs_memory_heap_used_bytes gauge');
    const mem = process.memoryUsage();
    lines.push(`nodejs_memory_heap_used_bytes ${mem.heapUsed}`);
    lines.push(`nodejs_memory_rss_bytes ${mem.rss}`);

    // Dossiers in system metric
    try {
      const dossierStats = await prisma.dossier.groupBy({
        by: ['status'],
        _count: { id: true },
      });

      lines.push('');
      lines.push('# HELP eurotech_dossiers_total Total number of visa dossiers categorized by status');
      lines.push('# TYPE eurotech_dossiers_total gauge');
      for (const stat of dossierStats) {
        lines.push(`eurotech_dossiers_total{status="${stat.status}"} ${stat._count.id}`);
      }
    } catch (err) {}

    // Cron jobs execution status
    try {
      const cronStats = await prisma.cronTaskLog.groupBy({
        by: ['taskName', 'status'],
        _count: { id: true },
      });

      lines.push('');
      lines.push('# HELP eurotech_cron_tasks_total Total executions of automated background cron tasks');
      lines.push('# TYPE eurotech_cron_tasks_total counter');
      for (const stat of cronStats) {
        lines.push(`eurotech_cron_tasks_total{task="${stat.taskName}",status="${stat.status}"} ${stat._count.id}`);
      }
    } catch (err) {}

    return lines.join('\n') + '\n';
  }
}

const metricsService = new MetricsService();

function metricsMiddleware(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    metricsService.recordRequest(req.method, req.path || req.originalUrl, res.statusCode, durationMs);
  });
  next();
}

module.exports = {
  metricsService,
  metricsMiddleware,
};
