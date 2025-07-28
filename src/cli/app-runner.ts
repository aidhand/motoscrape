import { createServiceContainer } from "../application/service-container.js";
import { AppConfiguration } from "./app-configuration.js";

/**
 * CLI Application Runner - Entry point for the application
 * This replaces the complex index.ts with a clean, focused entry point
 */
export class AppRunner {
  
  /**
   * Run the MotoScrape application
   */
  static async run(): Promise<void> {
    console.log("🏍️  MotoScrape - Australian Motorcycle Gear Scraper");
    console.log("================================================");

    try {
      // Load configuration
      const appSettings = AppConfiguration.getAppSettings();
      const siteConfigs = [
        AppConfiguration.getMotoHeavenConfig(),
        AppConfiguration.getMCASConfig(),
      ];

      // Create service container and configure dependencies
      const container = createServiceContainer(appSettings, siteConfigs);
      const scrapingApp = container.getScrapingApplication();

      // Set up event handlers
      AppRunner.setupEventHandlers(scrapingApp);

      // Set up graceful shutdown
      AppRunner.setupGracefulShutdown(scrapingApp);

      // Start the application
      await scrapingApp.start();

      // Add initial URLs
      const initialUrls = AppConfiguration.getInitialUrls();
      console.log(`📝 Adding ${initialUrls.length} URLs to queue...`);
      scrapingApp.addUrls(initialUrls);

      // Start monitoring
      AppRunner.startMonitoring(scrapingApp);

    } catch (error) {
      console.error("❌ Fatal error:", error);
      process.exit(1);
    }
  }

  /**
   * Set up event handlers for the scraping application
   */
  private static setupEventHandlers(scrapingApp: any): void {
    scrapingApp.on("url-processed", (result: any) => {
      if (result.success) {
        console.log(
          `✅ Processed: ${result.url} (${result.data?.length || 0} products, ${result.processingTime}ms)`
        );
      } else {
        console.log(`❌ Failed: ${result.url} - ${result.error}`);
      }
    });

    scrapingApp.on("urls-added", (count: number) => {
      console.log(`📝 Added ${count} URLs to queue`);
    });

    scrapingApp.on("products-saved", (data: any) => {
      console.log(`💾 Saved ${data.count} products to storage`);
    });

    scrapingApp.on("storage-error", (error: Error) => {
      console.error("❌ Storage error:", error.message);
    });
  }

  /**
   * Set up graceful shutdown handlers
   */
  private static setupGracefulShutdown(scrapingApp: any): void {
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      try {
        await scrapingApp.stop();
        console.log("✅ Shutdown complete");
        process.exit(0);
      } catch (error) {
        console.error("❌ Error during shutdown:", error);
        process.exit(1);
      }
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      console.error("❌ Uncaught exception:", error);
      shutdown("uncaughtException").catch(() => process.exit(1));
    });

    process.on("unhandledRejection", (reason, promise) => {
      console.error("❌ Unhandled rejection at:", promise, "reason:", reason);
      shutdown("unhandledRejection").catch(() => process.exit(1));
    });
  }

  /**
   * Start monitoring and progress reporting
   */
  private static startMonitoring(scrapingApp: any): void {
    const monitorInterval = setInterval(() => {
      const stats = scrapingApp.getStats();
      const queueStatus = scrapingApp.getQueueStatus();

      console.log(
        `📊 Stats: ${stats.successful}/${stats.totalProcessed} successful, ` +
        `Queue: ${queueStatus.pending} pending, ${queueStatus.processing} processing`
      );

      // Check if processing is complete
      if (queueStatus.pending === 0 && queueStatus.processing === 0 && stats.totalProcessed > 0) {
        clearInterval(monitorInterval);
        console.log("✅ All processing complete!");

        // Final stats
        AppRunner.displayFinalStats(stats, scrapingApp.getCollectedProductsCount());

        // Stop the scraper
        scrapingApp.stop().catch((error: Error) => {
          console.error("Error stopping scraper:", error);
        });
      }
    }, 10000); // Monitor every 10 seconds
  }

  /**
   * Display final statistics
   */
  private static displayFinalStats(stats: any, productCount: number): void {
    console.log("📈 Final Statistics:");
    console.log(`  - Total processed: ${stats.totalProcessed}`);
    console.log(`  - Successful: ${stats.successful}`);
    console.log(`  - Failed: ${stats.failed}`);
    console.log(`  - Average processing time: ${Math.round(stats.averageProcessingTime)}ms`);
    console.log(`  - Rate limit hits: ${stats.rateLimitHits}`);
    console.log(`  - Uptime: ${Math.round(stats.uptime / 1000)}s`);
    console.log(`  - Products collected: ${productCount}`);
  }
}