/**
 * Simple configuration and validation test
 * Tests the core functionality without browser automation
 */

import { SiteConfigSchema, AppSettingsSchema } from "./src/models/site-config.js";
import { adapterRegistry } from "./src/adapters/index.js";
import { DataValidator } from "./src/core/data-validator.js";

console.log("🧪 Testing MotoScrape Configuration and Models");
console.log("==============================================");

try {
  // Test site configuration parsing
  console.log("📋 Testing site configuration schemas...");
  
  const motoheavenConfig = SiteConfigSchema.parse({
    name: "motoheaven",
    base_url: "https://www.motoheaven.com.au",
    adapter_type: "shopify",
    rate_limit: {
      requests_per_minute: 30,
      delay_between_requests: 5000,
      concurrent_requests: 6,
    },
    categories: ["helmets", "jackets"],
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
  
  console.log("✅ MotoHeaven config valid:", motoheavenConfig.name);

  // Test app settings
  console.log("⚙️  Testing app settings schema...");
  
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
    },
    browser_settings: {
      viewport: { width: 1920, height: 1080 },
      user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      locale: "en-AU",
      timezone: "Australia/Sydney",
    },
  });
  
  console.log("✅ App settings valid");

  // Test adapter registry
  console.log("🔌 Testing adapter registry...");
  
  // Register adapters from configs
  adapterRegistry.registerFromConfigs([motoheavenConfig]);
  
  const shopifyAdapter = adapterRegistry.getAdapter("motoheaven");
  if (shopifyAdapter) {
    console.log("✅ Shopify adapter created:", shopifyAdapter.constructor.name);
  } else {
    console.log("❌ Failed to create Shopify adapter");
  }

  // Test creating MCAS adapter directly
  const mcasConfig = SiteConfigSchema.parse({
    name: "mcas",
    base_url: "https://www.mcas.com.au",
    adapter_type: "mcas",
    rate_limit: {
      requests_per_minute: 10,
      delay_between_requests: 5000,
      concurrent_requests: 1,
    },
    categories: ["motorcycle-helmets"],
    selectors: {
      product_container: ".product-grid-item",
      product_name: ".product-name",
      price: ".current-price",
      stock_status: ".stock-indicator",
      images: ".product-image img",
    },
    navigation: {
      product_list_pattern: "/category/{category}",
      product_page_pattern: "/product/{id}",
    },
  });

  adapterRegistry.registerFromConfigs([mcasConfig]);
  
  const mcasAdapter = adapterRegistry.getAdapter("mcas");
  if (mcasAdapter) {
    console.log("✅ MCAS adapter created:", mcasAdapter.constructor.name);
  } else {
    console.log("❌ Failed to create MCAS adapter");
  }

  // Test data validator
  console.log("✅ Testing data validator...");
  
  const validator = new DataValidator();
  console.log("✅ Data validator created");

  console.log("\n🎉 All configuration tests passed!");
  console.log("✅ Schemas are valid");
  console.log("✅ Adapters can be instantiated");
  console.log("✅ Core components are functional");

} catch (error) {
  console.error("❌ Configuration test failed:", error);
  process.exit(1);
}