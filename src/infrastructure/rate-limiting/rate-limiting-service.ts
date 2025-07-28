import { IRateLimitingService } from "../../domain/interfaces/rate-limiting-service.interface.js";

interface SiteRateLimit {
  requestsPerMinute: number;
  burstLimit: number;
  delayMs: number;
  requests: number[];
  lastRequest: number;
}

/**
 * Infrastructure service for rate limiting
 */
export class RateLimitingService implements IRateLimitingService {
  private siteLimits: Map<string, SiteRateLimit> = new Map();
  private globalLimits = {
    requestsPerMinute: 60,
    maxConcurrent: 3,
    requests: [] as number[],
  };

  constructor(globalConfig?: {
    requestsPerMinute?: number;
    maxConcurrent?: number;
  }) {
    if (globalConfig) {
      this.globalLimits = {
        ...this.globalLimits,
        ...globalConfig,
      };
    }
  }

  /**
   * Check if a request is allowed for a site
   */
  isAllowed(siteName: string): boolean {
    const now = Date.now();
    
    // Check global rate limit
    if (!this.isGloballyAllowed(now)) {
      return false;
    }

    // Check site-specific rate limit
    const siteLimit = this.siteLimits.get(siteName);
    if (!siteLimit) {
      return true; // No limits configured for this site
    }

    // Clean old requests (older than 1 minute)
    const minuteAgo = now - 60000;
    siteLimit.requests = siteLimit.requests.filter(time => time > minuteAgo);

    // Check if under the rate limit
    return siteLimit.requests.length < siteLimit.requestsPerMinute;
  }

  /**
   * Wait for allowance (rate limit) for a site
   */
  async waitForAllowance(siteName: string): Promise<void> {
    while (!this.isAllowed(siteName)) {
      const siteLimit = this.siteLimits.get(siteName);
      const waitTime = siteLimit?.delayMs || 1000;
      await this.delay(waitTime);
    }
  }

  /**
   * Record a request for a site
   */
  recordRequest(siteName: string): void {
    const now = Date.now();
    
    // Record global request
    this.globalLimits.requests.push(now);
    
    // Clean old global requests
    const minuteAgo = now - 60000;
    this.globalLimits.requests = this.globalLimits.requests.filter(time => time > minuteAgo);

    // Record site-specific request
    const siteLimit = this.siteLimits.get(siteName);
    if (siteLimit) {
      siteLimit.requests.push(now);
      siteLimit.lastRequest = now;
    }
  }

  /**
   * Configure rate limits for a site
   */
  configureSite(siteName: string, requestsPerMinute: number, burstLimit: number, delayMs: number): void {
    this.siteLimits.set(siteName, {
      requestsPerMinute,
      burstLimit,
      delayMs,
      requests: [],
      lastRequest: 0,
    });
  }

  /**
   * Get rate limiting status for all sites
   */
  getStatus(): Record<string, {
    requestsPerMinute: number;
    currentRequests: number;
    waitTime: number;
    isThrottled: boolean;
  }> {
    const status: Record<string, any> = {};
    const now = Date.now();

    for (const [siteName, limits] of this.siteLimits.entries()) {
      // Clean old requests
      const minuteAgo = now - 60000;
      limits.requests = limits.requests.filter(time => time > minuteAgo);

      const currentRequests = limits.requests.length;
      const isThrottled = currentRequests >= limits.requestsPerMinute;
      const waitTime = isThrottled ? this.calculateWaitTime(limits) : 0;

      status[siteName] = {
        requestsPerMinute: limits.requestsPerMinute,
        currentRequests,
        waitTime,
        isThrottled,
      };
    }

    return status;
  }

  /**
   * Reset rate limits for a site
   */
  reset(siteName?: string): void {
    if (siteName) {
      const siteLimit = this.siteLimits.get(siteName);
      if (siteLimit) {
        siteLimit.requests = [];
        siteLimit.lastRequest = 0;
      }
    } else {
      // Reset all sites
      for (const limits of this.siteLimits.values()) {
        limits.requests = [];
        limits.lastRequest = 0;
      }
      
      // Reset global limits
      this.globalLimits.requests = [];
    }
  }

  /**
   * Get global rate limiting statistics
   */
  getGlobalStats() {
    const now = Date.now();
    const minuteAgo = now - 60000;
    
    // Clean old requests
    this.globalLimits.requests = this.globalLimits.requests.filter(time => time > minuteAgo);
    
    return {
      requestsPerMinute: this.globalLimits.requestsPerMinute,
      currentRequests: this.globalLimits.requests.length,
      maxConcurrent: this.globalLimits.maxConcurrent,
      isThrottled: this.globalLimits.requests.length >= this.globalLimits.requestsPerMinute,
    };
  }

  private isGloballyAllowed(now: number): boolean {
    // Clean old global requests
    const minuteAgo = now - 60000;
    this.globalLimits.requests = this.globalLimits.requests.filter(time => time > minuteAgo);
    
    return this.globalLimits.requests.length < this.globalLimits.requestsPerMinute;
  }

  private calculateWaitTime(limits: SiteRateLimit): number {
    if (limits.requests.length === 0) {
      return 0;
    }

    // Find the oldest request that would still be within the rate limit window
    const now = Date.now();
    const sortedRequests = limits.requests.sort((a, b) => a - b);
    
    if (sortedRequests.length < limits.requestsPerMinute) {
      return 0;
    }

    // The wait time is until the oldest request becomes more than a minute old
    const oldestRequest = sortedRequests[0];
    const waitTime = (oldestRequest + 60000) - now;
    
    return Math.max(0, waitTime);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}