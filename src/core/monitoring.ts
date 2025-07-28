import { promises as fs } from "fs";
import { EventEmitter } from "events";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type MetricType = "counter" | "gauge" | "histogram" | "timer";

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  source?: string;
}

export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface ScrapingMetrics {
  // Performance metrics
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  totalDataExtracted: number;

  // Rate limiting metrics
  rateLimitHits: number;
  requestsPerMinute: number;

  // Quality metrics
  duplicatesDetected: number;
  dataValidationErrors: number;
  imageDownloadFailures: number;

  // Site-specific metrics
  siteMetrics: Record<
    string,
    {
      requests: number;
      successes: number;
      failures: number;
      avgResponseTime: number;
      lastSuccess: Date | null;
      lastFailure: Date | null;
    }
  >;
}

/**
 * Advanced monitoring and logging system
 */
export class MonitoringManager extends EventEmitter {
  private logs: LogEntry[] = [];
  private metrics: Metric[] = [];
  private scrapingMetrics: ScrapingMetrics;
  private logLevel: LogLevel;
  private logFile?: string;
  private metricsFile?: string;
  private maxLogEntries: number = 10000;
  private maxMetricEntries: number = 50000;

  constructor(
    options: {
      logLevel?: LogLevel;
      logFile?: string;
      metricsFile?: string;
      maxLogEntries?: number;
      maxMetricEntries?: number;
    } = {}
  ) {
    super();

    this.logLevel = options.logLevel || "info";
    this.logFile = options.logFile;
    this.metricsFile = options.metricsFile;
    this.maxLogEntries = options.maxLogEntries || 10000;
    this.maxMetricEntries = options.maxMetricEntries || 50000;

    this.scrapingMetrics = this.initializeScrapingMetrics();

    // Setup log rotation if file logging is enabled
    if (this.logFile) {
      this.setupLogRotation();
    }
  }

  /**
   * Log a message with specified level
   */
  async log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    source?: string
  ): Promise<void> {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      source,
    };

    this.logs.push(entry);

    // Trim logs if needed
    if (this.logs.length > this.maxLogEntries) {
      this.logs = this.logs.slice(-this.maxLogEntries);
    }

    // Console output
    this.outputToConsole(entry);

    // File output
    if (this.logFile) {
      await this.outputToFile(entry);
    }

    // Emit event
    this.emit("log", entry);
  }

  /**
   * Log debug message
   */
  async debug(
    message: string,
    context?: Record<string, any>,
    source?: string
  ): Promise<void> {
    await this.log("debug", message, context, source);
  }

  /**
   * Log info message
   */
  async info(
    message: string,
    context?: Record<string, any>,
    source?: string
  ): Promise<void> {
    await this.log("info", message, context, source);
  }

  /**
   * Log warning message
   */
  async warn(
    message: string,
    context?: Record<string, any>,
    source?: string
  ): Promise<void> {
    await this.log("warn", message, context, source);
  }

  /**
   * Log error message
   */
  async error(
    message: string,
    context?: Record<string, any>,
    source?: string
  ): Promise<void> {
    await this.log("error", message, context, source);
  }

  /**
   * Record a metric
   */
  recordMetric(
    name: string,
    type: MetricType,
    value: number,
    tags?: Record<string, string>
  ): void {
    const metric: Metric = {
      name,
      type,
      value,
      timestamp: new Date(),
      tags,
    };

    this.metrics.push(metric);

    // Trim metrics if needed
    if (this.metrics.length > this.maxMetricEntries) {
      this.metrics = this.metrics.slice(-this.maxMetricEntries);
    }

    // Save metrics to file if configured
    if (this.metricsFile) {
      this.saveMetricsToFile().catch((error) => {
        console.error("Failed to save metrics to file:", error);
      });
    }

    this.emit("metric", metric);
  }

  /**
   * Track request metrics
   */
  trackRequest(
    siteName: string,
    success: boolean,
    responseTime: number,
    dataExtracted?: number
  ): void {
    // Update site-specific metrics
    if (!this.scrapingMetrics.siteMetrics[siteName]) {
      this.scrapingMetrics.siteMetrics[siteName] = {
        requests: 0,
        successes: 0,
        failures: 0,
        avgResponseTime: 0,
        lastSuccess: null,
        lastFailure: null,
      };
    }

    const siteMetrics = this.scrapingMetrics.siteMetrics[siteName];
    siteMetrics.requests++;

    if (success) {
      siteMetrics.successes++;
      siteMetrics.lastSuccess = new Date();
      this.scrapingMetrics.successfulRequests++;

      if (dataExtracted) {
        this.scrapingMetrics.totalDataExtracted += dataExtracted;
      }
    } else {
      siteMetrics.failures++;
      siteMetrics.lastFailure = new Date();
      this.scrapingMetrics.failedRequests++;
    }

    // Update average response time
    const totalRequests = siteMetrics.requests;
    siteMetrics.avgResponseTime =
      (siteMetrics.avgResponseTime * (totalRequests - 1) + responseTime) /
      totalRequests;

    // Update global metrics
    this.scrapingMetrics.totalRequests++;
    this.scrapingMetrics.averageResponseTime =
      (this.scrapingMetrics.averageResponseTime *
        (this.scrapingMetrics.totalRequests - 1) +
        responseTime) /
      this.scrapingMetrics.totalRequests;

    // Record individual metrics
    this.recordMetric("request_duration", "timer", responseTime, {
      site: siteName,
      success: success.toString(),
    });
    this.recordMetric("requests_total", "counter", 1, {
      site: siteName,
      success: success.toString(),
    });

    if (dataExtracted) {
      this.recordMetric("data_extracted", "counter", dataExtracted, {
        site: siteName,
      });
    }
  }

  /**
   * Track rate limiting
   */
  trackRateLimit(siteName: string): void {
    this.scrapingMetrics.rateLimitHits++;
    this.recordMetric("rate_limit_hits", "counter", 1, { site: siteName });
    this.warn("Rate limit hit", { site: siteName }, "rate-limiter");
  }

  /**
   * Track data quality issues
   */
  trackDataQuality(
    type: "duplicate" | "validation_error" | "image_failure",
    siteName: string,
    details?: Record<string, any>
  ): void {
    switch (type) {
      case "duplicate":
        this.scrapingMetrics.duplicatesDetected++;
        this.recordMetric("duplicates_detected", "counter", 1, {
          site: siteName,
        });
        break;
      case "validation_error":
        this.scrapingMetrics.dataValidationErrors++;
        this.recordMetric("validation_errors", "counter", 1, {
          site: siteName,
        });
        break;
      case "image_failure":
        this.scrapingMetrics.imageDownloadFailures++;
        this.recordMetric("image_failures", "counter", 1, { site: siteName });
        break;
    }

    this.warn(
      `Data quality issue: ${type}`,
      { site: siteName, details },
      "data-quality"
    );
  }

  /**
   * Get current scraping metrics
   */
  getScrapingMetrics(): ScrapingMetrics {
    // Calculate requests per minute
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const recentRequests = this.metrics
      .filter((m) => m.name === "requests_total" && m.timestamp >= oneMinuteAgo)
      .reduce((sum, m) => sum + m.value, 0);

    this.scrapingMetrics.requestsPerMinute = recentRequests;

    return { ...this.scrapingMetrics };
  }

  /**
   * Get recent logs
   */
  getRecentLogs(count: number = 100, level?: LogLevel): LogEntry[] {
    let filteredLogs = this.logs;

    if (level) {
      const levelPriority = { debug: 0, info: 1, warn: 2, error: 3 };
      const minPriority = levelPriority[level];
      filteredLogs = this.logs.filter(
        (log) => levelPriority[log.level] >= minPriority
      );
    }

    return filteredLogs.slice(-count);
  }

  /**
   * Get metrics for a time range
   */
  getMetrics(startTime?: Date, endTime?: Date, metricName?: string): Metric[] {
    let filteredMetrics = this.metrics;

    if (startTime || endTime) {
      filteredMetrics = this.metrics.filter((metric) => {
        if (startTime && metric.timestamp < startTime) return false;
        if (endTime && metric.timestamp > endTime) return false;
        return true;
      });
    }

    if (metricName) {
      filteredMetrics = filteredMetrics.filter(
        (metric) => metric.name === metricName
      );
    }

    return filteredMetrics;
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): {
    summary: Record<string, any>;
    siteBreakdown: Record<string, any>;
    recentActivity: LogEntry[];
    trends: Record<string, any>;
  } {
    const metrics = this.getScrapingMetrics();
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);

    return {
      summary: {
        totalRequests: metrics.totalRequests,
        successRate:
          metrics.totalRequests > 0
            ? (
                (metrics.successfulRequests / metrics.totalRequests) *
                100
              ).toFixed(2) + "%"
            : "0%",
        averageResponseTime: Math.round(metrics.averageResponseTime) + "ms",
        requestsPerMinute: metrics.requestsPerMinute,
        rateLimitHits: metrics.rateLimitHits,
        dataExtracted: metrics.totalDataExtracted,
        qualityIssues: {
          duplicates: metrics.duplicatesDetected,
          validationErrors: metrics.dataValidationErrors,
          imageFailures: metrics.imageDownloadFailures,
        },
      },
      siteBreakdown: Object.entries(metrics.siteMetrics).reduce(
        (acc, [site, data]) => {
          acc[site] = {
            requests: data.requests,
            successRate:
              data.requests > 0
                ? ((data.successes / data.requests) * 100).toFixed(2) + "%"
                : "0%",
            avgResponseTime: Math.round(data.avgResponseTime) + "ms",
            lastSuccess: data.lastSuccess?.toISOString(),
            lastFailure: data.lastFailure?.toISOString(),
          };
          return acc;
        },
        {} as Record<string, any>
      ),
      recentActivity: this.getRecentLogs(20),
      trends: {
        hourlyRequests: this.getMetrics(oneHourAgo).filter(
          (m) => m.name === "requests_total"
        ).length,
        hourlyFailures: this.getMetrics(oneHourAgo).filter(
          (m) => m.name === "requests_total" && m.tags?.success === "false"
        ).length,
      },
    };
  }

  /**
   * Initialize scraping metrics
   */
  private initializeScrapingMetrics(): ScrapingMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalDataExtracted: 0,
      rateLimitHits: 0,
      requestsPerMinute: 0,
      duplicatesDetected: 0,
      dataValidationErrors: 0,
      imageDownloadFailures: 0,
      siteMetrics: {},
    };
  }

  /**
   * Check if message should be logged based on level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.logLevel];
  }

  /**
   * Output log entry to console
   */
  private outputToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const source = entry.source ? `[${entry.source}] ` : "";
    const context = entry.context ? ` ${JSON.stringify(entry.context)}` : "";

    const message = `${timestamp} ${level} ${source}${entry.message}${context}`;

    switch (entry.level) {
      case "error":
        console.error(message);
        break;
      case "warn":
        console.warn(message);
        break;
      case "debug":
        console.debug(message);
        break;
      default:
        console.log(message);
    }
  }

  /**
   * Output log entry to file
   */
  private async outputToFile(entry: LogEntry): Promise<void> {
    if (!this.logFile) return;

    try {
      const logLine = JSON.stringify(entry) + "\n";
      await fs.appendFile(this.logFile, logLine, "utf-8");
    } catch (error) {
      console.error("Failed to write to log file:", error);
    }
  }

  /**
   * Save metrics to file
   */
  private async saveMetricsToFile(): Promise<void> {
    if (!this.metricsFile) return;

    try {
      const metricsData = {
        timestamp: new Date().toISOString(),
        scrapingMetrics: this.scrapingMetrics,
        recentMetrics: this.metrics.slice(-1000), // Last 1000 metrics
      };

      await fs.writeFile(
        this.metricsFile,
        JSON.stringify(metricsData, null, 2),
        "utf-8"
      );
    } catch (error) {
      console.error("Failed to save metrics to file:", error);
    }
  }

  /**
   * Setup log rotation
   */
  private setupLogRotation(): void {
    // Rotate logs daily at midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const timeUntilMidnight = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      this.rotateLogFile();
      // Setup daily rotation
      setInterval(
        () => {
          this.rotateLogFile();
        },
        24 * 60 * 60 * 1000
      );
    }, timeUntilMidnight);
  }

  /**
   * Rotate log file
   */
  private async rotateLogFile(): Promise<void> {
    if (!this.logFile) return;

    try {
      const timestamp = new Date().toISOString().split("T")[0];
      const rotatedFile = this.logFile.replace(/\.log$/, `-${timestamp}.log`);

      await fs.rename(this.logFile, rotatedFile);
      this.info(
        "Log file rotated",
        { oldFile: this.logFile, newFile: rotatedFile },
        "monitoring"
      );
    } catch (error) {
      console.error("Failed to rotate log file:", error);
    }
  }
}

// Export a default instance
export const monitoringManager = new MonitoringManager({
  logLevel: "info",
  logFile: "./logs/motoscrape.log",
  metricsFile: "./logs/metrics.json",
});
