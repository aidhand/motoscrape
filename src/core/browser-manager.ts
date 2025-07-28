import { Browser, BrowserContext, Page, chromium } from "playwright";
import { AppSettings } from "../models/site-config.js";

/**
 * Browser pool manager for efficient resource utilization
 */
export class BrowserManager {
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();
  private settings: AppSettings["global_settings"];
  private browserSettings: AppSettings["browser_settings"];

  constructor(settings: AppSettings) {
    this.settings = settings.global_settings;
    this.browserSettings = settings.browser_settings;
  }

  /**
   * Initialize the browser instance
   */
  async initialize(): Promise<void> {
    if (this.browser) {
      return;
    }

    console.log("Initializing browser...");

    this.browser = await chromium.launch({
      headless: false, // Set to false to run in headed mode
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
      ],
    });

    console.log("Browser initialized successfully");
  }

  /**
   * Create or get a browser context for a specific site
   */
  async getContext(siteName: string): Promise<BrowserContext> {
    if (!this.browser) {
      await this.initialize();
    }

    if (this.contexts.has(siteName)) {
      return this.contexts.get(siteName)!;
    }

    const context = await this.browser!.newContext({
      viewport: this.browserSettings.viewport,
      userAgent: this.browserSettings.user_agent,
      locale: this.browserSettings.locale,
      timezoneId: this.browserSettings.timezone,
      // Enable stealth mode
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
      acceptDownloads: false,
      // Simulate real browser behavior
      extraHTTPHeaders: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        DNT: "1",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    // Add stealth scripts to avoid detection
    await context.addInitScript(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });

      // Mock languages
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en"],
      });

      // Mock plugins
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5],
      });

      // Mock permission API
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) =>
        originalQuery(parameters);
    });

    this.contexts.set(siteName, context);
    return context;
  }

  /**
   * Create a new page with common settings
   */
  async createPage(siteName: string): Promise<Page> {
    const context = await this.getContext(siteName);
    const page = await context.newPage();

    // Set default timeout
    page.setDefaultTimeout(this.settings.timeout);

    // Block unnecessary resources to speed up scraping
    await page.route("**/*", (route) => {
      const url = route.request().url();
      const resourceType = route.request().resourceType();

      // Block analytics, ads, and social media trackers
      if (
        url.includes("google-analytics") ||
        url.includes("googletagmanager") ||
        url.includes("facebook.com") ||
        url.includes("twitter.com") ||
        url.includes("doubleclick") ||
        url.includes("adsystem") ||
        url.includes("error-analytics") ||
        url.includes("shop.app/pay") ||
        url.includes("loyalty.rivo.io")
      ) {
        route.abort();
        return;
      }

      // Block font files by URL extensions
      if (
        url.endsWith(".woff") ||
        url.endsWith(".woff2") ||
        url.endsWith(".ttf") ||
        url.endsWith(".otf")
      ) {
        route.abort();
        return;
      }

      // Optionally block images and CSS for faster loading
      if (!this.settings.image_download && resourceType === "image") {
        route.abort();
        return;
      }

      route.continue();
    });

    // Add page error handling (only log critical errors)
    page.on("pageerror", (error) => {
      // Only log errors that are not common JavaScript issues on e-commerce sites
      const errorMessage = error.message.toLowerCase();
      if (
        !errorMessage.includes("$ is not defined") &&
        !errorMessage.includes("__name is not defined") &&
        !errorMessage.includes("jquery") &&
        !errorMessage.includes("undefined variable")
      ) {
        console.warn(`Critical page error on ${siteName}:`, error.message);
      }
    });

    page.on("requestfailed", (request) => {
      const url = request.url();
      const failure = request.failure();

      // Only log failed requests that are not intentionally blocked or common failures
      const isBlocked =
        url.includes("google-analytics") ||
        url.includes("googletagmanager") ||
        url.includes("facebook.com") ||
        url.includes("twitter.com") ||
        url.includes("doubleclick") ||
        url.includes("adsystem") ||
        url.includes("fonts.googleapis.com") ||
        url.includes("fonts.gstatic.com") ||
        url.includes("error-analytics") ||
        url.includes("shop.app/pay") ||
        url.includes("loyalty.rivo.io") ||
        url.endsWith(".woff") ||
        url.endsWith(".woff2") ||
        url.endsWith(".ttf") ||
        url.endsWith(".otf");

      const isImageBlocked =
        !this.settings.image_download &&
        (url.endsWith(".jpg") ||
          url.endsWith(".png") ||
          url.endsWith(".svg") ||
          url.endsWith(".webp"));

      const isImageFailure =
        url.endsWith(".jpg") ||
        url.endsWith(".png") ||
        url.endsWith(".svg") ||
        url.endsWith(".webp") ||
        url.endsWith(".gif") ||
        url.includes("/cdn/shop/files/") ||
        url.includes("/cdn/shop/products/");

      // Only log unexpected failures that might indicate real issues
      if (
        !isBlocked &&
        !isImageBlocked &&
        !isImageFailure &&
        failure?.errorText !== "net::ERR_ABORTED"
      ) {
        console.warn(
          `Unexpected request failure on ${siteName}:`,
          request.url(),
          failure?.errorText
        );
      }
    });

    return page;
  }

  /**
   * Navigate to a URL with retry logic
   */
  async navigateWithRetry(
    page: Page,
    url: string,
    maxRetries: number = 3
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt === 1) {
          // Only log navigation on first attempt to reduce console noise
        } else {
          console.log(
            `Retrying navigation to ${url} (attempt ${attempt}/${maxRetries})`
          );
        }

        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: this.settings.timeout,
        });

        // Wait for page to be interactive
        await page.waitForLoadState("networkidle", { timeout: 10000 });

        if (attempt > 1) {
          console.log(`Successfully loaded ${url} on retry`);
        }
        // Removed verbose success logging for first attempts
        return;
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          console.log(`Navigation attempt ${attempt} failed, retrying...`);
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          console.warn(`All navigation attempts failed for ${url}:`, error);
        }
      }
    }

    throw new Error(
      `Failed to navigate to ${url} after ${maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Simulate human-like behavior
   */
  async simulateHumanBehavior(page: Page): Promise<void> {
    // Random scroll
    await page.evaluate(() => {
      window.scrollTo(0, Math.random() * 1000);
    });

    // Random mouse movement
    const viewport = page.viewportSize();
    if (viewport) {
      await page.mouse.move(
        Math.random() * viewport.width,
        Math.random() * viewport.height
      );
    }

    // Random delay
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 2000 + 1000)
    );
  }

  /**
   * Close a specific context
   */
  async closeContext(siteName: string): Promise<void> {
    const context = this.contexts.get(siteName);
    if (context) {
      await context.close();
      this.contexts.delete(siteName);
      console.log(`Closed context for ${siteName}`);
    }
  }

  /**
   * Close all contexts and browser
   */
  async close(): Promise<void> {
    console.log("Closing browser manager...");

    // Close all contexts
    for (const [siteName, context] of this.contexts) {
      await context.close();
      console.log(`Closed context for ${siteName}`);
    }
    this.contexts.clear();

    // Close browser
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log("Browser closed");
    }
  }
}
