import { EventEmitter } from "events";
import { Product } from "../models/product.js";
import { SiteConfig } from "../models/site-config.js";
import { IScrapingService } from "../interfaces/scraping-service.interface.js";
import { IBrowserService } from "../interfaces/browser-service.interface.js";
import { IValidationService } from "../interfaces/validation-service.interface.js";
import { IRateLimitingService } from "../interfaces/rate-limiting-service.interface.js";
import { ScrapingResult } from "../../shared/types/scraping.types.js";
import { adapterRegistry } from "../../adapters/adapter-registry.js";
import { PageType } from "../../adapters/base-adapter.js";

/**
 * Core domain service for scraping operations
 */
export class ScrapingService extends EventEmitter implements IScrapingService {
  private siteConfigs: Map<string, SiteConfig> = new Map();

  constructor(
    private browserService: IBrowserService,
    private validationService: IValidationService,
    private rateLimitingService: IRateLimitingService,
    siteConfigs: SiteConfig[] = []
  ) {
    super();
    
    // Store site configurations
    siteConfigs.forEach(config => {
      this.siteConfigs.set(config.name, config);
    });

    // Register adapters
    adapterRegistry.registerFromConfigs(siteConfigs);
  }

  /**
   * Process a single URL and extract product data
   */
  async processUrl(url: string, siteName: string, metadata?: Record<string, any>): Promise<ScrapingResult> {
    const startTime = Date.now();
    const result: ScrapingResult = {
      success: false,
      url,
      siteName,
      timestamp: new Date(),
      processingTime: 0,
    };

    try {
      // Check and wait for rate limiting
      await this.rateLimitingService.waitForAllowance(siteName);
      this.rateLimitingService.recordRequest(siteName);

      // Get site configuration
      const siteConfig = this.siteConfigs.get(siteName);
      if (!siteConfig) {
        throw new Error(`No configuration found for site: ${siteName}`);
      }

      // Create page and navigate
      const page = await this.browserService.createPage(siteName);

      try {
        await this.browserService.navigateWithRetry(page, url);
        await this.browserService.simulateHumanBehavior(page);

        // Get adapter for this site
        const adapter = adapterRegistry.getAdapter(siteName);
        if (!adapter) {
          throw new Error(`No adapter found for site: ${siteName}`);
        }

        // Identify page type
        const pageType = await adapter.identifyPageType(url, page);

        let products: Product[] = [];

        if (pageType === PageType.PRODUCT) {
          // Extract detailed product information
          const product = await adapter.extractProduct({
            page,
            url,
            siteConfig,
            pageType,
            metadata,
          });

          if (product) {
            const validationResult = this.validationService.validateProduct(product);
            if (validationResult.success && validationResult.data) {
              products = [validationResult.data];
            } else {
              console.warn(`Product validation failed for ${url}:`, validationResult.errors);
            }
          }
        } else if (pageType === PageType.COLLECTION || pageType === PageType.SEARCH) {
          // Extract product summaries from collection page
          const productSummaries = await adapter.extractProductSummary({
            page,
            url,
            siteConfig,
            pageType,
            metadata,
          });

          // Validate extracted products
          const validationResult = this.validationService.validateProducts(productSummaries);
          if (validationResult.success && validationResult.data) {
            products = validationResult.data;
          }

          // Handle product URL discovery for detailed extraction
          const discovery = await adapter.discoverProducts({
            page,
            url,
            siteConfig,
            pageType,
            metadata,
          });

          // Emit discovered URLs for queue processing
          if (discovery.productUrls.length > 0) {
            this.emit('urls-discovered', {
              siteName,
              urls: discovery.productUrls,
              sourceUrl: url,
              hasNextPage: discovery.hasNextPage,
              nextPageUrl: discovery.nextPageUrl,
            });
          }
        }

        result.success = true;
        result.data = products;

        this.emit('url-processed', result);
      } finally {
        await page.close();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.error = errorMessage;
      
      console.error(`Failed to process ${url}:`, errorMessage);
      this.emit('processing-error', { url, siteName, error: errorMessage });
    }

    result.processingTime = Date.now() - startTime;
    return result;
  }

  /**
   * Extract products from a collection/listing page
   */
  async extractFromCollection(url: string, siteName: string): Promise<Product[]> {
    const result = await this.processUrl(url, siteName, { pageType: 'collection' });
    return result.data || [];
  }

  /**
   * Extract detailed product information from a product page
   */
  async extractFromProduct(url: string, siteName: string): Promise<Product | null> {
    const result = await this.processUrl(url, siteName, { pageType: 'product' });
    return result.data?.[0] || null;
  }

  /**
   * Discover additional URLs from a page
   */
  async discoverUrls(url: string, siteName: string): Promise<string[]> {
    try {
      const siteConfig = this.siteConfigs.get(siteName);
      if (!siteConfig) {
        throw new Error(`No configuration found for site: ${siteName}`);
      }

      const page = await this.browserService.createPage(siteName);
      
      try {
        await this.browserService.navigateWithRetry(page, url);
        
        const adapter = adapterRegistry.getAdapter(siteName);
        if (!adapter) {
          throw new Error(`No adapter found for site: ${siteName}`);
        }

        const pageType = await adapter.identifyPageType(url, page);
        const discovery = await adapter.discoverProducts({
          page,
          url,
          siteConfig,
          pageType,
          metadata: { discovery: true },
        });

        return discovery.productUrls;
      } finally {
        await page.close();
      }
    } catch (error) {
      console.error(`Failed to discover URLs from ${url}:`, error);
      return [];
    }
  }

  /**
   * Get scraping statistics
   */
  getStats() {
    return {
      siteConfigs: this.siteConfigs.size,
      rateLimitingStatus: this.rateLimitingService.getStatus(),
      validationStats: this.validationService.getStats(),
    };
  }

  /**
   * Add or update site configuration
   */
  configureSite(siteConfig: SiteConfig): void {
    this.siteConfigs.set(siteConfig.name, siteConfig);
    
    // Configure rate limiting for the site
    this.rateLimitingService.configureSite(
      siteConfig.name,
      siteConfig.rate_limit.requests_per_minute,
      siteConfig.rate_limit.concurrent_requests,
      siteConfig.rate_limit.delay_between_requests
    );

    // Register adapter
    adapterRegistry.registerFromConfigs([siteConfig]);
  }

  /**
   * Remove site configuration
   */
  removeSite(siteName: string): void {
    this.siteConfigs.delete(siteName);
    this.rateLimitingService.reset(siteName);
  }

  /**
   * Get all configured sites
   */
  getConfiguredSites(): string[] {
    return Array.from(this.siteConfigs.keys());
  }
}