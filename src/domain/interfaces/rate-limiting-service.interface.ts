/**
 * Rate limiting service interface
 */
export interface IRateLimitingService {
  /**
   * Check if a request is allowed for a site
   */
  isAllowed(siteName: string): boolean;

  /**
   * Wait for allowance (rate limit) for a site
   */
  waitForAllowance(siteName: string): Promise<void>;

  /**
   * Record a request for a site
   */
  recordRequest(siteName: string): void;

  /**
   * Configure rate limits for a site
   */
  configureSite(siteName: string, requestsPerMinute: number, burstLimit: number, delayMs: number): void;

  /**
   * Get rate limiting status for all sites
   */
  getStatus(): Record<string, {
    requestsPerMinute: number;
    currentRequests: number;
    waitTime: number;
    isThrottled: boolean;
  }>;

  /**
   * Reset rate limits for a site
   */
  reset(siteName?: string): void;
}