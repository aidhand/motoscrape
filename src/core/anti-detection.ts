import { BrowserContext, Page } from "playwright";
import { SiteConfig } from "../models/site-config.js";

/**
 * Advanced anti-detection measures for web scraping
 */
export class AntiDetectionManager {
  private userAgents: string[] = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15",
  ];

  private currentUserAgentIndex = 0;

  /**
   * Apply stealth measures to a browser context
   */
  async applyStealthMeasures(
    context: BrowserContext,
    siteConfig: SiteConfig
  ): Promise<void> {
    if (!siteConfig.anti_detection?.use_stealth) return;

    // Rotate user agent if enabled
    if (siteConfig.anti_detection.rotate_user_agents) {
      const userAgent = this.getNextUserAgent();
      await context.setExtraHTTPHeaders({
        "User-Agent": userAgent,
      });
    }

    // Set additional headers to appear more human-like
    await context.setExtraHTTPHeaders({
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-AU,en-US;q=0.9,en;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    });

    // Add custom headers if specified
    if (siteConfig.custom_headers) {
      await context.setExtraHTTPHeaders(siteConfig.custom_headers);
    }

    // Set cookies if specified
    if (siteConfig.cookies && siteConfig.cookies.length > 0) {
      await context.addCookies(
        siteConfig.cookies.map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain || new URL(siteConfig.base_url).hostname,
          path: cookie.path || "/",
        }))
      );
    }

    // Block unnecessary resources if enabled
    if (
      siteConfig.anti_detection.block_images ||
      siteConfig.anti_detection.block_css
    ) {
      await context.route("**/*", (route) => {
        const resourceType = route.request().resourceType();

        if (
          siteConfig.anti_detection?.block_images &&
          resourceType === "image"
        ) {
          route.abort();
          return;
        }

        if (
          siteConfig.anti_detection?.block_css &&
          resourceType === "stylesheet"
        ) {
          route.abort();
          return;
        }

        route.continue();
      });
    }
  }

  /**
   * Apply human-like behavior to a page
   */
  async simulateHumanBehavior(
    page: Page,
    siteConfig: SiteConfig
  ): Promise<void> {
    if (!siteConfig.anti_detection?.simulate_human_behavior) return;

    try {
      // Random delay before starting
      await this.randomDelay(500, 2000);

      // Simulate mouse movement
      await this.simulateMouseMovement(page);

      // Random scroll behavior
      await this.simulateScrolling(page);

      // Random delay after actions
      await this.randomDelay(1000, 3000);
    } catch (error) {
      console.warn("Error simulating human behavior:", error);
    }
  }

  /**
   * Get next user agent in rotation
   */
  private getNextUserAgent(): string {
    const userAgent = this.userAgents[this.currentUserAgentIndex];
    this.currentUserAgentIndex =
      (this.currentUserAgentIndex + 1) % this.userAgents.length;
    return userAgent;
  }

  /**
   * Simulate natural mouse movement
   */
  private async simulateMouseMovement(page: Page): Promise<void> {
    try {
      const viewport = page.viewportSize();
      if (!viewport) return;

      // Generate random mouse movements
      const movements = Math.floor(Math.random() * 3) + 1;

      for (let i = 0; i < movements; i++) {
        const x = Math.floor(Math.random() * viewport.width);
        const y = Math.floor(Math.random() * viewport.height);

        await page.mouse.move(x, y, {
          steps: Math.floor(Math.random() * 10) + 5,
        });

        await this.randomDelay(100, 500);
      }
    } catch {
      // Ignore mouse movement errors
    }
  }

  /**
   * Simulate natural scrolling behavior
   */
  private async simulateScrolling(page: Page): Promise<void> {
    try {
      const scrolls = Math.floor(Math.random() * 3) + 1;

      for (let i = 0; i < scrolls; i++) {
        const scrollDistance = Math.floor(Math.random() * 500) + 100;
        await page.evaluate((distance) => {
          window.scrollBy(0, distance);
        }, scrollDistance);

        await this.randomDelay(500, 1500);
      }

      // Scroll back to top
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
    } catch {
      // Ignore scrolling errors
    }
  }

  /**
   * Generate random delay between min and max milliseconds
   */
  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Check if we're being rate limited or blocked
   */
  async detectBlocking(
    page: Page
  ): Promise<{ isBlocked: boolean; reason?: string }> {
    try {
      const title = await page.title().catch(() => "");
      const url = page.url();

      // Check for common blocking indicators
      const blockingIndicators = [
        "access denied",
        "blocked",
        "rate limit",
        "too many requests",
        "captcha",
        "bot detection",
        "suspicious activity",
        "403",
        "429",
        "cloudflare",
      ];

      const titleLower = title.toLowerCase();
      const urlLower = url.toLowerCase();

      for (const indicator of blockingIndicators) {
        if (titleLower.includes(indicator) || urlLower.includes(indicator)) {
          return {
            isBlocked: true,
            reason: `Detected blocking indicator: ${indicator}`,
          };
        }
      }

      // Check for unusual response times or redirects
      if (url.includes("challenge") || url.includes("verify")) {
        return {
          isBlocked: true,
          reason: "Challenge/verification page detected",
        };
      }

      return { isBlocked: false };
    } catch (error) {
      return {
        isBlocked: true,
        reason: `Error checking for blocking: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Wait with exponential backoff
   */
  async exponentialBackoff(
    attempt: number,
    baseDelay: number = 1000
  ): Promise<void> {
    const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
    const maxDelay = 30000; // Max 30 seconds
    const actualDelay = Math.min(delay, maxDelay);

    console.log(`Backing off for ${actualDelay}ms (attempt ${attempt})`);
    await new Promise((resolve) => setTimeout(resolve, actualDelay));
  }
}

export const antiDetectionManager = new AntiDetectionManager();
