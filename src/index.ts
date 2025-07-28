/**
 * MotoScrape - Australian Motorcycle Gear Web Scraper
 * Main entry point for the application
 */

import { ScraperOrchestrator } from "./core/index.js";
import { ConfigLoader } from "./config/index.js";
import { createLogger } from "./utils/logging.js";

const logger = createLogger('Main');

console.log("🏍️  MotoScrape - Australian Motorcycle Gear Scraper");
console.log("================================================");

async function main() {
  // Load configuration from files or environment variables
  const { appSettings, siteConfigs } = ConfigLoader.loadFromEnvironment();

  logger.info(`Loaded ${siteConfigs.length} site configurations`);
  siteConfigs.forEach(config => {
    logger.info(`Site config loaded: ${config.name} (${config.adapter_type}) - ${config.base_url}`);
  });

  const scraper = new ScraperOrchestrator(appSettings, siteConfigs);

  scraper.on("url-processed", (result) => {
    if (result.success) {
      logger.info(`Processed URL successfully`, {
        url: result.url,
        products: result.data?.length || 0,
        processingTime: `${result.processingTime}ms`
      });
    } else {
      logger.error(`Failed to process URL`, {
        url: result.url,
        error: result.error
      });
    }
  });

  scraper.on("urls-added", (count) => {
    logger.info(`Added URLs to queue`, { count });
  });

  // Set up graceful shutdown
  process.on("SIGINT", async () => {
    logger.info("Received SIGINT, shutting down gracefully...");
    await scraper.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    logger.info("Received SIGTERM, shutting down gracefully...");
    await scraper.stop();
    process.exit(0);
  });

  try {
    await scraper.start();

    // Add initial URLs based on configured sites
    const initialUrls = siteConfigs.flatMap(siteConfig => {
      const categoryUrls = siteConfig.navigation?.category_urls;
      if (!categoryUrls) return [];

      return Object.entries(categoryUrls).map(([category, path], index) => ({
        url: `${siteConfig.base_url}${path}`,
        siteName: siteConfig.name,
        priority: 10 - index, // Higher priority for earlier categories
      }));
    });

    logger.info(`Adding initial URLs to queue`, { count: initialUrls.length });
    scraper.addUrls(initialUrls);

    const monitorInterval = setInterval(() => {
      const stats = scraper.getStats();
      const queueStatus = scraper.getQueueStatus();

      logger.info('Processing status', {
        successful: stats.successful,
        totalProcessed: stats.totalProcessed,
        pending: queueStatus.pending,
        processing: queueStatus.processing
      });

      if (queueStatus.pending === 0 && queueStatus.processing === 0) {
        clearInterval(monitorInterval);
        logger.info("All processing complete!");

        // Final stats
        logger.info("Final statistics", {
          totalProcessed: stats.totalProcessed,
          successful: stats.successful,
          failed: stats.failed,
          averageProcessingTime: `${Math.round(stats.averageProcessingTime)}ms`,
          rateLimitHits: stats.rateLimitHits,
          uptime: `${Math.round(stats.uptime / 1000)}s`
        });

        // Stop the scraper
        scraper.stop();
      }
    }, 10000);
  } catch (error) {
    logger.error("Fatal error occurred", { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}

// Check if this module is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error("Unhandled error in main", { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  });
}
