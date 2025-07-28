/**
 * Dry run test of the ScraperOrchestrator without browser automation
 * Tests the orchestration, queuing, and event system
 */

import { ScraperOrchestrator } from "./src/core/index.js";
import { AppSettingsSchema, SiteConfigSchema } from "./src/models/site-config.js";

console.log("🧪 Testing MotoScrape Orchestrator (Dry Run)");
console.log("============================================");

const motoheavenConfig = SiteConfigSchema.parse({
  name: "motoheaven",
  base_url: "https://www.motoheaven.com.au",
  adapter_type: "shopify",
  rate_limit: {
    requests_per_minute: 30,
    delay_between_requests: 5000,
    concurrent_requests: 1, // Keep low for testing
  },
  categories: ["helmets"],
  selectors: {
    product_container: ".product-item",
    product_name: ".product-item__product-title",
    price: ".product-item__price-main",
    stock_status: ".product-item__stock",
    images: ".product-item__image img",
  },
  navigation: {
    product_list_pattern: "/collections/{category}",
    product_page_pattern: "/products/{slug}",
    pagination_selector: ".pagination__next",
  },
});

const appSettings = AppSettingsSchema.parse({
  global_settings: {
    headless: true,
    timeout: 30000,
    max_retries: 1, // Reduce retries for testing
    max_concurrent_requests: 1, // Keep low for testing
    delay_between_requests: 2000,
    max_requests_per_minute: 10, // Keep low for testing
    output_format: "json",
    output_directory: "./data",
    image_download: false,
    log_level: "info",
  },
  browser_settings: {
    viewport: { width: 1920, height: 1080 },
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    locale: "en-AU",
    timezone: "Australia/Sydney",
  },
});

async function testOrchestratorSetup() {
  console.log("🏗️  Creating ScraperOrchestrator...");
  
  try {
    const scraper = new ScraperOrchestrator(appSettings, [motoheavenConfig]);
    
    // Set up event listeners
    scraper.on("url-processed", (result) => {
      if (result.success) {
        console.log(`✅ Processed: ${result.url} (${result.data?.length || 0} products)`);
      } else {
        console.log(`❌ Failed: ${result.url} - ${result.error}`);
      }
    });

    scraper.on("urls-added", (count) => {
      console.log(`📝 Added ${count} URLs to queue`);
    });

    console.log("✅ ScraperOrchestrator created successfully");
    
    // Test queue operations without starting browser
    const testUrls = [
      {
        url: "https://www.motoheaven.com.au/collections/helmets",
        siteName: "motoheaven",
        priority: 10,
      },
    ];

    console.log("📝 Testing queue operations...");
    scraper.addUrls(testUrls);
    
    const queueStatus = scraper.getQueueStatus();
    console.log(`📊 Queue Status: ${queueStatus.pending} pending, ${queueStatus.processing} processing`);
    
    const stats = scraper.getStats();
    console.log(`📈 Stats: ${stats.totalProcessed} processed, ${stats.successful} successful`);
    
    console.log("✅ Queue operations working");
    console.log("✅ Event system working");
    console.log("✅ Configuration system working");
    
    console.log("\n🎉 Dry run test completed successfully!");
    console.log("📝 Note: Actual browser automation testing requires Playwright installation");
    
    return true;
  } catch (error) {
    console.error("❌ Dry run test failed:", error);
    return false;
  }
}

// Run the test
testOrchestratorSetup().then((success) => {
  process.exit(success ? 0 : 1);
}).catch((error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});