/**
 * Rate limiter implementation using token bucket algorithm
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second
  private readonly minInterval: number; // minimum ms between requests

  constructor(
    maxTokens: number = 10,
    refillRate: number = 1,
    minInterval: number = 1000
  ) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.minInterval = minInterval;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Try to consume a token, returns true if successful
   */
  tryConsume(tokens: number = 1): boolean {
    this.refillTokens();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    return false;
  }

  /**
   * Wait until a token is available and consume it
   */
  async consume(tokens: number = 1): Promise<void> {
    while (!this.tryConsume(tokens)) {
      const waitTime = this.getWaitTime(tokens);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Get estimated wait time for tokens to be available
   */
  getWaitTime(tokens: number = 1): number {
    this.refillTokens();

    if (this.tokens >= tokens) {
      return 0;
    }

    const tokensNeeded = tokens - this.tokens;
    const timeNeeded = (tokensNeeded / this.refillRate) * 1000;

    return Math.max(timeNeeded, this.minInterval);
  }

  /**
   * Get current token count
   */
  getTokenCount(): number {
    this.refillTokens();
    return this.tokens;
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

/**
 * Site-specific rate limiter manager
 */
export class SiteRateLimiter {
  private limiters: Map<string, RateLimiter> = new Map();
  private siteConfigs: Map<
    string,
    { maxTokens: number; refillRate: number; minInterval: number }
  > = new Map();

  /**
   * Configure rate limiting for a specific site
   */
  configureSite(
    siteName: string,
    maxTokens: number = 5,
    refillRate: number = 0.5, // 2 seconds per token
    minInterval: number = 2000
  ): void {
    this.siteConfigs.set(siteName, { maxTokens, refillRate, minInterval });

    // Create or update the rate limiter
    const limiter = new RateLimiter(maxTokens, refillRate, minInterval);
    this.limiters.set(siteName, limiter);

    console.log(
      `Rate limiter configured for ${siteName}: ${maxTokens} tokens, ${refillRate} refill rate, ${minInterval}ms min interval`
    );
  }

  /**
   * Try to consume a token for a specific site
   */
  tryConsume(siteName: string, tokens: number = 1): boolean {
    const limiter = this.getLimiter(siteName);
    return limiter.tryConsume(tokens);
  }

  /**
   * Wait and consume a token for a specific site
   */
  async consume(siteName: string, tokens: number = 1): Promise<void> {
    const limiter = this.getLimiter(siteName);
    await limiter.consume(tokens);
  }

  /**
   * Get wait time for a specific site
   */
  getWaitTime(siteName: string, tokens: number = 1): number {
    const limiter = this.getLimiter(siteName);
    return limiter.getWaitTime(tokens);
  }

  /**
   * Get token count for a specific site
   */
  getTokenCount(siteName: string): number {
    const limiter = this.getLimiter(siteName);
    return limiter.getTokenCount();
  }

  /**
   * Reset rate limiter for a specific site
   */
  reset(siteName: string): void {
    const limiter = this.limiters.get(siteName);
    if (limiter) {
      limiter.reset();
      console.log(`Rate limiter reset for ${siteName}`);
    }
  }

  /**
   * Reset all rate limiters
   */
  resetAll(): void {
    for (const [_siteName, limiter] of this.limiters) {
      limiter.reset();
    }
    console.log("All rate limiters reset");
  }

  /**
   * Get or create a rate limiter for a site
   */
  private getLimiter(siteName: string): RateLimiter {
    if (!this.limiters.has(siteName)) {
      // Use default configuration
      const config = this.siteConfigs.get(siteName) || {
        maxTokens: 5,
        refillRate: 0.5,
        minInterval: 2000,
      };
      this.configureSite(
        siteName,
        config.maxTokens,
        config.refillRate,
        config.minInterval
      );
    }

    return this.limiters.get(siteName)!;
  }

  /**
   * Get status for all sites
   */
  getStatus(): Record<string, { tokens: number; waitTime: number }> {
    const status: Record<string, { tokens: number; waitTime: number }> = {};

    for (const [siteName, limiter] of this.limiters) {
      status[siteName] = {
        tokens: limiter.getTokenCount(),
        waitTime: limiter.getWaitTime(),
      };
    }

    return status;
  }
}

/**
 * Global rate limiter with burst protection
 */
export class GlobalRateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly timeWindow: number; // in ms
  private readonly burstLimit: number;
  private lastRequest: number = 0;

  constructor(
    maxRequests: number = 60, // requests per time window
    timeWindow: number = 60000, // 1 minute
    burstLimit: number = 10 // max requests in quick succession
  ) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.burstLimit = burstLimit;
  }

  /**
   * Check if request is allowed
   */
  isAllowed(): boolean {
    const now = Date.now();

    // Clean old requests
    this.requests = this.requests.filter(
      (time) => now - time < this.timeWindow
    );

    // Check rate limit
    if (this.requests.length >= this.maxRequests) {
      return false;
    }

    // Check burst protection
    const recentRequests = this.requests.filter((time) => now - time < 10000); // last 10 seconds
    if (recentRequests.length >= this.burstLimit) {
      return false;
    }

    return true;
  }

  /**
   * Record a request
   */
  recordRequest(): void {
    const now = Date.now();
    this.requests.push(now);
    this.lastRequest = now;
  }

  /**
   * Wait until request is allowed
   */
  async waitForAllowance(): Promise<void> {
    while (!this.isAllowed()) {
      const waitTime = this.getWaitTime();
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    this.recordRequest();
  }

  /**
   * Get estimated wait time
   */
  getWaitTime(): number {
    const now = Date.now();

    // Clean old requests
    this.requests = this.requests.filter(
      (time) => now - time < this.timeWindow
    );

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      return this.timeWindow - (now - oldestRequest) + 100;
    }

    // Check burst protection
    const recentRequests = this.requests.filter((time) => now - time < 10000);
    if (recentRequests.length >= this.burstLimit) {
      return 10000 - (now - Math.min(...recentRequests)) + 100;
    }

    return 0;
  }

  /**
   * Get current usage statistics
   */
  getStats(): {
    requestsInWindow: number;
    maxRequests: number;
    utilization: number;
  } {
    const now = Date.now();
    this.requests = this.requests.filter(
      (time) => now - time < this.timeWindow
    );

    return {
      requestsInWindow: this.requests.length,
      maxRequests: this.maxRequests,
      utilization: this.requests.length / this.maxRequests,
    };
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.requests = [];
    this.lastRequest = 0;
  }
}
