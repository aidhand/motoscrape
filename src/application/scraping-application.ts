import { EventEmitter } from "events";
import { AppSettings, SiteConfig } from "../domain/models/site-config.js";
import { ScrapingResult, ScrapingStats, ScrapingEvents } from "../shared/types/scraping.types.js";
import { IScrapingService } from "../domain/interfaces/scraping-service.interface.js";
import { IQueueService } from "../domain/interfaces/queue-service.interface.js";
import { IBrowserService } from "../domain/interfaces/browser-service.interface.js";
import { IStorageService } from "../domain/interfaces/storage-service.interface.js";
import { Product } from "../domain/models/product.js";

/**
 * Application service that orchestrates the scraping process
 * This replaces the large ScraperOrchestrator with a focused application service
 */
export class ScrapingApplication extends EventEmitter {
  private isRunning = false;
  private stats: ScrapingStats;
  private processingIntervals: NodeJS.Timeout[] = [];
  private collectedProducts: Product[] = [];
  private settings: AppSettings;

  constructor(
    private scrapingService: IScrapingService,
    private queueService: IQueueService,
    private browserService: IBrowserService,
    private storageService: IStorageService,
    settings: AppSettings
  ) {
    super();
    
    this.settings = settings;
    
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

    // Set up event handlers
    this.setupEventHandlers();
  }

  /**
   * Start the scraping application
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("Scraping application is already running");
      return;
    }

    console.log("Starting scraping application...");

    try {
      await this.browserService.initialize();
      this.isRunning = true;
      this.stats.startTime = new Date();

      this.startProcessingLoop();
      this.emit("scraper-started");
      console.log("Scraping application started successfully");
    } catch (error) {
      console.error("Failed to start scraping application:", error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop the scraping application
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log("Scraping application is not running");
      return;
    }

    console.log("Stopping scraping application...");
    this.isRunning = false;

    // Clear processing intervals
    this.processingIntervals.forEach(interval => clearInterval(interval));
    this.processingIntervals = [];

    // Wait for current processing to complete
    while (!this.queueService.isEmpty()) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Save final collected products
    await this.saveCollectedProducts();

    await this.browserService.close();
    this.emit("scraper-stopped");
    console.log("Scraping application stopped");
  }

  /**
   * Add URLs to the processing queue
   */
  addUrls(urls: Array<{
    url: string;
    siteName: string;
    priority?: number;
    metadata?: Record<string, any>;
  }>): string[] {
    const ids = this.queueService.addUrls(urls);
    this.emit("urls-added", urls.length);
    return ids;
  }

  /**
   * Add a single URL to the processing queue
   */
  addUrl(url: string, siteName: string, priority?: number, metadata?: Record<string, any>): string {
    const id = this.queueService.addUrl(url, siteName, priority, metadata);
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
    return this.queueService.getStatus();
  }

  /**
   * Get collected products count
   */
  getCollectedProductsCount(): number {
    return this.collectedProducts.length;
  }

  /**
   * Set up event handlers for service coordination
   */
  private setupEventHandlers(): void {
    // Handle scraping service events
    this.scrapingService.on('url-processed', (result: ScrapingResult) => {
      this.handleProcessingResult(result);
    });

    this.scrapingService.on('urls-discovered', (data) => {
      // Add discovered URLs to queue
      const urlsToAdd = data.urls.map(url => ({
        url,
        siteName: data.siteName,
        priority: 6, // Higher priority for discovered product URLs
        metadata: {
          discoveredFrom: data.sourceUrl,
          pageType: 'product',
        },
      }));

      if (urlsToAdd.length > 0) {
        this.addUrls(urlsToAdd);
      }

      // Handle pagination
      if (data.hasNextPage && data.nextPageUrl) {
        this.addUrl(data.nextPageUrl, data.siteName, 5, {
          pageType: 'collection',
          parentUrl: data.sourceUrl,
        });
      }
    });

    this.scrapingService.on('processing-error', (error) => {
      console.error('Processing error:', error);
    });

    // Handle queue service events
    this.queueService.on('item-completed', (item, result) => {
      if (this.settings.global_settings.log_level === 'debug') {
        console.log(`Queue item completed: ${item.url}`);
      }
    });

    this.queueService.on('item-failed', (item, error) => {
      console.warn(`Queue item failed permanently: ${item.url} - ${error.message}`);
    });
  }

  /**
   * Handle processing result from scraping service
   */
  private handleProcessingResult(result: ScrapingResult): void {
    this.stats.totalProcessed++;
    this.updateAverageProcessingTime(result.processingTime);

    if (result.success) {
      this.stats.successful++;
      
      // Mark queue item as completed
      if (result.data && result.data.length > 0) {
        this.collectedProducts.push(...result.data);
      }
    } else {
      this.stats.failed++;
    }

    // Emit the result for external listeners
    this.emit("url-processed", result);
  }

  /**
   * Start the main processing loop
   */
  private startProcessingLoop(): void {
    const processingInterval = setInterval(async () => {
      if (!this.isRunning) {
        return;
      }

      const item = this.queueService.getNext();
      if (item) {
        // Process in background
        this.processQueueItem(item).catch(error => {
          console.error("Unexpected error in processing loop:", error);
        });
      }
    }, 1000);

    this.processingIntervals.push(processingInterval);

    // Set up periodic saving
    const saveInterval = setInterval(async () => {
      if (!this.isRunning) {
        return;
      }

      const productCount = this.collectedProducts.length;
      if (productCount >= 10) {
        console.log(`Auto-saving ${productCount} products...`);
        await this.saveCollectedProducts();
      }
    }, 60 * 1000); // 1 minute

    this.processingIntervals.push(saveInterval);
  }

  /**
   * Process a single queue item
   */
  private async processQueueItem(item: any): Promise<void> {
    try {
      const result = await this.scrapingService.processUrl(
        item.url,
        item.siteName,
        item.metadata
      );

      // Mark queue item based on result
      if (result.success) {
        this.queueService.markCompleted(item.id, result.data);
      } else {
        this.queueService.markFailed(item.id, new Error(result.error || 'Processing failed'));
      }
    } catch (error) {
      this.queueService.markFailed(item.id, error as Error);
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
      const results = await this.storageService.storeProducts(this.collectedProducts);

      // Log storage results
      for (const result of results) {
        if (result.success) {
          console.log(`✅ Saved ${result.count} products to ${result.format}: ${result.path}`);
        } else {
          console.error(`❌ Failed to save to ${result.format}: ${result.error}`);
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

  /**
   * Update average processing time
   */
  private updateAverageProcessingTime(newTime: number): void {
    if (this.stats.totalProcessed === 1) {
      this.stats.averageProcessingTime = newTime;
    } else {
      this.stats.averageProcessingTime =
        (this.stats.averageProcessingTime * (this.stats.totalProcessed - 1) + newTime) /
        this.stats.totalProcessed;
    }
  }
}