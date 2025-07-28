/**
 * MotoScrape - Australian Motorcycle Gear Web Scraper
 * Main entry point for the application
 */

import { ScraperOrchestrator } from "./core/index.js";
import { AppSettingsSchema, SiteConfigSchema } from "./models/site-config.js";

console.log("🏍️  MotoScrape - Australian Motorcycle Gear Scraper");
console.log("================================================");

const motoheavenConfig = SiteConfigSchema.parse({
  name: "motoheaven",
  base_url: "https://www.motoheaven.com.au",
  adapter_type: "shopify",

  rate_limit: {
    requests_per_minute: 30,
    delay_between_requests: 5000,
    concurrent_requests: 6,
  },

  categories: ["helmets", "jackets", "gloves", "boots", "pants", "accessories"],

  selectors: {
    product_container: ".product-item",
    product_name: ".product-item__product-title",
    price: ".product-item__price-main",
    sale_price: ".product-item__price-main", // Same element contains both regular and sale price
    stock_status: ".product-item__stock", // May not exist on listing pages
    brand: ".product-item__product-vendor",
    images: ".product-item__image img",
    description: ".product-description",
    specifications: ".product-specs",
    variants: ".product-variants",
  },

  navigation: {
    product_list_pattern: "/collections/{category}",
    product_page_pattern: "/products/{slug}",
    pagination_selector: ".pagination__next",
    category_urls: {
      helmets: "/collections/helmets",
      jackets: "/collections/jackets",
      gloves: "/collections/gloves",
      boots: "/collections/boots",
      pants: "/collections/pants",
      accessories: "/collections/accessories",
    },
  },
});

/**
 * Example configuration for MCAS (custom platform)
 */
const mcasConfig = SiteConfigSchema.parse({
  name: "mcas",
  base_url: "https://www.mcas.com.au",
  adapter_type: "mcas",

  rate_limit: {
    requests_per_minute: 10,
    delay_between_requests: 5000,
    concurrent_requests: 1,
  },

  categories: [
    "motorcycle-helmets",
    "motorcycle-clothing",
    "motorcycle-gloves",
    "motorcycle-boots",
  ],

  selectors: {
    product_container: ".product-grid-item",
    product_name: ".product-name",
    price: ".current-price",
    sale_price: ".sale-price",
    stock_status: ".stock-indicator",
    brand: ".brand-name",
    images: ".product-image img",
    description: ".product-description",
    specifications: ".product-specifications",
  },

  navigation: {
    product_list_pattern: "/category/{category}",
    product_page_pattern: "/product/{id}",
    pagination_selector: ".pagination-next",
  },
});

/**
 * Application settings
 */
const appSettings = AppSettingsSchema.parse({
  global_settings: {
    headless: true,
    timeout: 30000,
    max_retries: 3,
    max_concurrent_requests: 3,
    delay_between_requests: 1000,
    max_requests_per_minute: 60,
    output_format: "json",
    output_directory: "./data",
    image_download: false,
    image_directory: "./data/images",
    log_level: "info", // Use "debug" for verbose logging, "warn" for minimal logging
  },

  browser_settings: {
    viewport: {
      width: 1920,
      height: 1080,
    },
    user_agent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    locale: "en-AU",
    timezone: "Australia/Sydney",
  },
});

async function main() {
  const scraper = new ScraperOrchestrator(appSettings, [
    motoheavenConfig,
    mcasConfig,
  ]);

  scraper.on("url-processed", (result) => {
    if (result.success) {
      console.log(
        `✅ Processed: ${result.url} (${result.data?.length} products, ${result.processingTime}ms)`
      );
    } else {
      console.log(`❌ Failed: ${result.url} - ${result.error}`);
    }
  });

  scraper.on("urls-added", (count) => {
    console.log(`📝 Added ${count} URLs to queue`);
  });

  // Set up graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down gracefully...");
    await scraper.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\n🛑 Received SIGTERM, shutting down...");
    await scraper.stop();
    process.exit(0);
  });

  try {
    await scraper.start();

    // Add initial URLs
    const initialUrls = [
      {
        url: "https://www.motoheaven.com.au/collections/helmets",
        siteName: "motoheaven",
        priority: 10,
      },
      {
        url: "https://www.motoheaven.com.au/collections/jackets",
        siteName: "motoheaven",
        priority: 9,
      },
      {
        url: "https://www.motoheaven.com.au/collections/gloves",
        siteName: "motoheaven",
        priority: 8,
      },
    ];

    console.log(`📝 Adding ${initialUrls.length} URLs to queue...`);
    scraper.addUrls(initialUrls);

    const monitorInterval = setInterval(() => {
      const stats = scraper.getStats();
      const queueStatus = scraper.getQueueStatus();

      console.log(
        `📊 Stats: ${stats.successful}/${stats.totalProcessed} successful, Queue: ${queueStatus.pending} pending, ${queueStatus.processing} processing`
      );

      if (queueStatus.pending === 0 && queueStatus.processing === 0) {
        clearInterval(monitorInterval);
        console.log("✅ All processing complete!");

        // Final stats
        console.log("📈 Final Statistics:");
        console.log(`  - Total processed: ${stats.totalProcessed}`);
        console.log(`  - Successful: ${stats.successful}`);
        console.log(`  - Failed: ${stats.failed}`);
        console.log(
          `  - Average processing time: ${Math.round(stats.averageProcessingTime)}ms`
        );
        console.log(`  - Rate limit hits: ${stats.rateLimitHits}`);
        console.log(`  - Uptime: ${Math.round(stats.uptime / 1000)}s`);

        // Stop the scraper
        scraper.stop();
      }
    }, 10000);
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

// Check if this module is being run directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch((error) => {
    console.error("❌ Unhandled error:", error);
    process.exit(1);
  });
}
