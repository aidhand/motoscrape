import { Container } from "../shared/container/container.js";
import { SERVICE_TOKENS } from "../shared/types/service.types.js";
import { AppSettings, SiteConfig } from "../domain/models/site-config.js";

// Domain services
import { ScrapingService } from "../domain/services/scraping-service.js";
import { QueueService } from "../domain/services/queue-service.js";
import { ValidationService } from "../domain/services/validation-service.js";

// Infrastructure services
import { BrowserService } from "../infrastructure/browser/browser-service.js";
import { StorageService } from "../infrastructure/storage/storage-service.js";
import { RateLimitingService } from "../infrastructure/rate-limiting/rate-limiting-service.js";

// Application services
import { ScrapingApplication } from "./scraping-application.js";

/**
 * Service configuration and dependency injection setup
 */
export class ServiceContainer extends Container {
  
  /**
   * Configure all services with their dependencies
   */
  configure(settings: AppSettings, siteConfigs: SiteConfig[]): void {
    // Register configuration
    this.register(SERVICE_TOKENS.APP_SETTINGS, settings);
    this.register(SERVICE_TOKENS.SITE_CONFIGS, siteConfigs);

    // Register infrastructure services
    this.registerFactory(SERVICE_TOKENS.BROWSER_SERVICE, () => {
      return new BrowserService(settings);
    });

    this.registerFactory(SERVICE_TOKENS.STORAGE_SERVICE, () => {
      return new StorageService({
        format: settings.global_settings.output_format as any,
        outputDirectory: settings.global_settings.output_directory,
        appendTimestamp: true,
      });
    });

    this.registerFactory(SERVICE_TOKENS.RATE_LIMITING_SERVICE, () => {
      return new RateLimitingService({
        requestsPerMinute: settings.global_settings.max_requests_per_minute,
        maxConcurrent: settings.global_settings.max_concurrent_requests,
      });
    });

    // Register domain services
    this.registerFactory(SERVICE_TOKENS.VALIDATION_SERVICE, () => {
      return new ValidationService();
    });

    this.registerFactory(SERVICE_TOKENS.QUEUE_SERVICE, () => {
      return new QueueService({
        maxConcurrent: settings.global_settings.max_concurrent_requests,
        maxRetries: settings.global_settings.max_retries,
        retryDelay: 5000,
      });
    });

    this.registerFactory(SERVICE_TOKENS.SCRAPING_SERVICE, () => {
      const browserService = this.get<any>(SERVICE_TOKENS.BROWSER_SERVICE);
      const validationService = this.get<any>(SERVICE_TOKENS.VALIDATION_SERVICE);
      const rateLimitingService = this.get<any>(SERVICE_TOKENS.RATE_LIMITING_SERVICE);
      
      return new ScrapingService(
        browserService,
        validationService,
        rateLimitingService,
        siteConfigs
      );
    });

    // Register application services
    this.registerFactory(Symbol('scraping-application'), () => {
      const scrapingService = this.get<any>(SERVICE_TOKENS.SCRAPING_SERVICE);
      const queueService = this.get<any>(SERVICE_TOKENS.QUEUE_SERVICE);
      const browserService = this.get<any>(SERVICE_TOKENS.BROWSER_SERVICE);
      const storageService = this.get<any>(SERVICE_TOKENS.STORAGE_SERVICE);

      return new ScrapingApplication(
        scrapingService,
        queueService,
        browserService,
        storageService,
        settings
      );
    });
  }

  /**
   * Get the main scraping application
   */
  getScrapingApplication(): ScrapingApplication {
    return this.get(Symbol('scraping-application') as any);
  }
}

/**
 * Create and configure a service container
 */
export function createServiceContainer(settings: AppSettings, siteConfigs: SiteConfig[]): ServiceContainer {
  const container = new ServiceContainer();
  container.configure(settings, siteConfigs);
  return container;
}