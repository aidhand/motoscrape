import { BrowserManager } from "./browser-manager.js";
import { QueueManager, QueueItem } from "./queue-manager.js";
import { SiteRateLimiter, GlobalRateLimiter } from "./rate-limiter.js";
import { DataValidator } from "./data-validator.js";
import { StorageManager, StorageFormat } from "../storage/index.js";
import { AppSettings, SiteConfig } from "../models/site-config.js";
import { Product } from "../models/product.js";
import { adapterRegistry, PageType } from "../adapters/index.js";
import { EventEmitter } from "events";
import { createLogger, Logger, initializeLogging } from "../utils/logging.js";

export interface ScrapingResult {
  success: boolean;
  data?: Product[];
  error?: string;
  url: string;
  siteName: string;
  timestamp: Date;
  processingTime: number;
}

export interface ScrapingStats {
  totalProcessed: number;
  successful: number;
  failed: number;
  averageProcessingTime: number;
  rateLimitHits: number;
  startTime: Date;
  uptime: number;
}

/**
 * Main scraper orchestrator that coordinates browser management,
 * queue processing, and rate limiting
 */
export class ScraperOrchestrator extends EventEmitter {
  private browserManager: BrowserManager;
  private queueManager: QueueManager;
  private siteRateLimiter: SiteRateLimiter;
  private globalRateLimiter: GlobalRateLimiter;
  private storageManager: StorageManager;
  private settings: AppSettings;
  private siteConfigs: Map<string, SiteConfig> = new Map();
  private isRunning = false;
  private stats: ScrapingStats;
  private processingIntervals: NodeJS.Timeout[] = [];
  private collectedProducts: Product[] = [];
  private logger: Logger;

  constructor(settings: AppSettings, siteConfigs: SiteConfig[] = []) {
    super();

    // Initialize logging
    initializeLogging({ 
      level: settings.global_settings.log_level || 'info',
      maxLogs: 1000 
    });
    this.logger = createLogger('ScraperOrchestrator');

    this.settings = settings;
    this.browserManager = new BrowserManager(settings);
    this.queueManager = new QueueManager({
      maxConcurrent: settings.global_settings.max_concurrent_requests,
      maxRetries: settings.global_settings.max_retries,
      retryDelay: 5000,
      rateLimitDelay: settings.global_settings.delay_between_requests,
    });

    // Initialize storage manager
    this.storageManager = new StorageManager({
      format: settings.global_settings.output_format as StorageFormat,
      outputDirectory: settings.global_settings.output_directory,
      appendTimestamp: true,
    });

    this.siteRateLimiter = new SiteRateLimiter();
    this.globalRateLimiter = new GlobalRateLimiter(
      settings.global_settings.max_requests_per_minute,
      60000,
      settings.global_settings.max_concurrent_requests
    );

    // Store site configs and register adapters
    siteConfigs.forEach((config) => {
      this.siteConfigs.set(config.name, config);
      this.siteRateLimiter.configureSite(
        config.name,
        config.rate_limit.requests_per_minute / 2,
        config.rate_limit.requests_per_minute / 120,
        config.rate_limit.delay_between_requests
      );
    });

    // Register adapters from configurations
    adapterRegistry.registerFromConfigs(siteConfigs);

    // Initialize stats
    this.stats = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      averageProcessingTime: 0,
      rateLimitHits: 0,
      startTime: new Date(),
      uptime: 0,
    };
  }

  /**
   * Start the scraping process
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("Scraper is already running");
      return;
    }

    console.log("Starting scraper orchestrator...");

    try {
      await this.browserManager.initialize();
      this.isRunning = true;
      this.stats.startTime = new Date();

      this.startProcessingLoop();
      this.emit("scraper-started");
      console.log("Scraper orchestrator started successfully");
    } catch (error) {
      console.error("Failed to start scraper:", error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop the scraping process
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log("Scraper is not running");
      return;
    }

    console.log("Stopping scraper orchestrator...");
    this.isRunning = false;

    // Clear processing intervals
    this.processingIntervals.forEach((interval) => clearInterval(interval));
    this.processingIntervals = [];

    // Wait for current processing to complete
    while (!this.queueManager.isEmpty()) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Save final collected products
    await this.saveCollectedProducts();

    await this.browserManager.close();
    this.emit("scraper-stopped");
    console.log("Scraper orchestrator stopped");
  }

  /**
   * Add URLs to the processing queue
   */
  addUrls(
    urls: Array<{
      url: string;
      siteName: string;
      priority?: number;
      metadata?: Record<string, any>;
    }>
  ): string[] {
    const ids = this.queueManager.addBatch(urls);
    this.emit("urls-added", urls.length);
    return ids;
  }

  /**
   * Add a single URL to the processing queue
   */
  addUrl(
    url: string,
    siteName: string,
    priority?: number,
    metadata?: Record<string, any>
  ): string {
    const id = this.queueManager.add(url, siteName, { priority, metadata });
    this.emit("url-added", { url, siteName });
    return id;
  }

  /**
   * Get current scraping statistics
   */
  getStats(): ScrapingStats {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.startTime.getTime(),
    };
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      ...this.queueManager.getStats(),
      rateLimiters: this.siteRateLimiter.getStatus(),
      globalRateLimit: this.globalRateLimiter.getStats(),
    };
  }

  /**
   * Get collected products count
   */
  getCollectedProductsCount(): number {
    return this.collectedProducts.length;
  }

  /**
   * Process a single URL
   */
  private async processUrl(item: QueueItem): Promise<ScrapingResult> {
    const startTime = Date.now();
    const result: ScrapingResult = {
      success: false,
      url: item.url,
      siteName: item.siteName,
      timestamp: new Date(),
      processingTime: 0,
    };

    try {
      // Check global rate limit
      if (!this.globalRateLimiter.isAllowed()) {
        await this.globalRateLimiter.waitForAllowance();
        this.stats.rateLimitHits++;
      } else {
        this.globalRateLimiter.recordRequest();
      }

      // Check site-specific rate limit
      await this.siteRateLimiter.consume(item.siteName);

      // Get site configuration
      const siteConfig = this.siteConfigs.get(item.siteName);
      if (!siteConfig) {
        throw new Error(`No configuration found for site: ${item.siteName}`);
      }

      // Create page and navigate
      const page = await this.browserManager.createPage(item.siteName);

      try {
        await this.browserManager.navigateWithRetry(page, item.url);

        // Simulate human behavior
        await this.browserManager.simulateHumanBehavior(page);

        // Get adapter for this site
        const adapter = adapterRegistry.getAdapter(item.siteName);
        if (!adapter) {
          throw new Error(`No adapter found for site: ${item.siteName}`);
        }

        // Identify page type
        const pageType = await adapter.identifyPageType(item.url, page);
        if (this.settings.global_settings.log_level === "debug") {
          console.log(`Page type identified: ${pageType} for ${item.url}`);
        }

        // Process based on page type
        let products: Product[] = [];

        if (pageType === PageType.PRODUCT) {
          // Extract detailed product information
          const product = await adapter.extractProduct({
            page,
            url: item.url,
            siteConfig,
            pageType,
            metadata: item.metadata,
          });

          if (product) {
            // Validate and normalize the extracted product
            const validatedProduct = DataValidator.validateProduct(product);
            if (validatedProduct) {
              products = [validatedProduct];
            } else {
              console.warn(`Product validation failed for ${item.url}`);
            }
          }
        } else if (
          pageType === PageType.COLLECTION ||
          pageType === PageType.SEARCH
        ) {
          // Discover individual product URLs and add them to queue
          const discovery = await adapter.discoverProducts({
            page,
            url: item.url,
            siteConfig,
            pageType,
            metadata: item.metadata,
          });

          console.log(
            `Discovered ${discovery.productUrls.length} product URLs from ${item.url}`
          );

          // Add discovered product URLs to queue with higher priority
          const productUrlsToAdd = discovery.productUrls.map((url) => ({
            url,
            siteName: item.siteName,
            priority: (item.priority || 5) + 1,
            metadata: {
              ...item.metadata,
              discoveredFrom: item.url,
              pageType: "product",
            },
          }));

          if (productUrlsToAdd.length > 0) {
            this.addUrls(productUrlsToAdd);
          }

          // Also extract basic product summaries from collection page
          const productSummaries = await adapter.extractProductSummary({
            page,
            url: item.url,
            siteConfig,
            pageType,
            metadata: item.metadata,
          });

          // Convert summaries to full products and validate them
          const candidateProducts = productSummaries.filter(
            (summary): summary is Product => {
              return !!(
                summary.id &&
                summary.name &&
                summary.brand &&
                summary.category &&
                summary.price &&
                summary.availability &&
                summary.metadata
              );
            }
          );

          // Validate all candidate products
          products = DataValidator.validateProducts(candidateProducts);

          // Handle pagination
          if (discovery.hasNextPage && discovery.nextPageUrl) {
            this.addUrl(discovery.nextPageUrl, item.siteName, item.priority, {
              ...item.metadata,
              pageType: "collection",
              parentUrl: item.url,
            });
            if (this.settings.global_settings.log_level === "debug") {
              console.log(`Added pagination URL: ${discovery.nextPageUrl}`);
            }
          }
        }

        result.success = true;
        result.data = products;
        this.stats.successful++;

        // Collect products for saving
        if (products.length > 0) {
          this.collectedProducts.push(...products);
        }

        this.queueManager.markCompleted(item.id, products);
      } finally {
        await page.close();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      result.error = errorMessage;

      this.stats.failed++;
      this.queueManager.markFailed(item.id, error as Error);

      console.error(`Failed to process ${item.url}:`, errorMessage);
    }

    result.processingTime = Date.now() - startTime;
    this.stats.totalProcessed++;
    this.updateAverageProcessingTime(result.processingTime);

    this.emit("url-processed", result);
    return result;
  }

  /**
   * Start the main processing loop
   */
  private startProcessingLoop(): void {
    const interval = setInterval(async () => {
      if (!this.isRunning) {
        return;
      }

      const item = this.queueManager.getNext();
      if (item) {
        // Process in background
        this.processUrl(item).catch((error) => {
          console.error("Unexpected error in processing loop:", error);
        });
      }
    }, 1000);

    this.processingIntervals.push(interval);

    // Set up periodic saving every 5 minutes or when 100 products are collected
    const saveInterval = setInterval(
      async () => {
        if (!this.isRunning) {
          return;
        }

        const productCount = this.collectedProducts.length;
        if (productCount >= 10) {
          console.log(`Auto-saving ${productCount} products...`);
          await this.saveCollectedProducts();
        }
      },
      1 * 60 * 1000
    ); // 1 minute

    this.processingIntervals.push(saveInterval);
  }

  /**
   * Update average processing time
   */
  private updateAverageProcessingTime(newTime: number): void {
    if (this.stats.totalProcessed === 1) {
      this.stats.averageProcessingTime = newTime;
    } else {
      this.stats.averageProcessingTime =
        (this.stats.averageProcessingTime * (this.stats.totalProcessed - 1) +
          newTime) /
        this.stats.totalProcessed;
    }
  }

  /**
   * Save collected products to storage
   */
  private async saveCollectedProducts(): Promise<void> {
    if (this.collectedProducts.length === 0) {
      console.log("No products to save");
      return;
    }

    try {
      console.log(`Saving ${this.collectedProducts.length} products...`);
      const results = await this.storageManager.storeProducts(
        this.collectedProducts
      );

      // Log storage results
      for (const result of results) {
        if (result.success) {
          console.log(
            `✅ Saved ${result.count} products to ${result.format}: ${result.path}`
          );
        } else {
          console.error(
            `❌ Failed to save to ${result.format}: ${result.error}`
          );
        }
      }

      // Clear collected products after saving
      this.collectedProducts = [];

      this.emit("products-saved", {
        count: results.reduce((sum, r) => sum + r.count, 0),
        results,
      });
    } catch (error) {
      console.error("Error saving products:", error);
      this.emit("storage-error", error);
    }
  }
}
