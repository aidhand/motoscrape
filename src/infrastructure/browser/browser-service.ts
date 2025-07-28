import { Browser, BrowserContext, Page, chromium } from "playwright";
import { AppSettings } from "../../domain/models/site-config.js";
import { IBrowserService } from "../../domain/interfaces/browser-service.interface.js";

/**
 * Infrastructure service for browser management using Playwright
 */
export class BrowserService implements IBrowserService {
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();
  private settings: AppSettings["global_settings"];
  private browserSettings: AppSettings["browser_settings"];

  constructor(settings: AppSettings) {
    this.settings = settings.global_settings;
    this.browserSettings = settings.browser_settings;
  }

  /**
   * Initialize browser
   */
  async initialize(): Promise<void> {
    if (this.browser) {
      return;
    }

    console.log("Initializing browser...");

    this.browser = await chromium.launch({
      headless: this.settings.headless,
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
   * Create a new page for a specific site
   */
  async createPage(siteName: string): Promise<Page> {
    const context = await this.getContext(siteName);
    const page = await context.newPage();

    // Set page timeout
    page.setDefaultTimeout(this.settings.timeout);
    page.setDefaultNavigationTimeout(this.settings.timeout);

    return page;
  }

  /**
   * Navigate to URL with retry logic
   */
  async navigateWithRetry(page: Page, url: string, maxRetries = 3): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: this.settings.timeout,
        });
        
        // Wait for page to be fully loaded
        await page.waitForLoadState("networkidle", { timeout: 10000 });
        return;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Navigation attempt ${attempt} failed for ${url}:`, lastError.message);
        
        if (attempt < maxRetries) {
          await this.delay(1000 * attempt); // Progressive delay
        }
      }
    }

    throw new Error(`Failed to navigate to ${url} after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Simulate human-like behavior
   */
  async simulateHumanBehavior(page: Page): Promise<void> {
    try {
      // Random delay to simulate reading time
      await this.delay(this.randomBetween(500, 2000));

      // Random mouse movement
      const viewport = page.viewportSize();
      if (viewport) {
        await page.mouse.move(
          this.randomBetween(0, viewport.width),
          this.randomBetween(0, viewport.height)
        );
      }

      // Random small scroll
      await page.evaluate(() => {
        window.scrollBy(0, Math.random() * 200);
      });

      // Another small delay
      await this.delay(this.randomBetween(200, 800));
    } catch (error) {
      // Don't fail if human behavior simulation fails
      console.debug("Human behavior simulation failed:", error);
    }
  }

  /**
   * Check if browser is initialized
   */
  isInitialized(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    console.log("Closing browser...");

    // Close all contexts
    for (const context of this.contexts.values()) {
      await context.close();
    }
    this.contexts.clear();

    // Close browser
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    console.log("Browser closed successfully");
  }

  /**
   * Get or create browser context for a site
   */
  private async getContext(siteName: string): Promise<BrowserContext> {
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
      permissions: [],
      colorScheme: "light",
    });

    // Add stealth and anti-detection
    await this.configureAntiDetection(context);

    this.contexts.set(siteName, context);
    return context;
  }

  /**
   * Configure anti-detection measures
   */
  private async configureAntiDetection(context: BrowserContext): Promise<void> {
    // Override navigator properties to appear more human
    await context.addInitScript(() => {
      // Override webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Override plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-AU', 'en'],
      });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}