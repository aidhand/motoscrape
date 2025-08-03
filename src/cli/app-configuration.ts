import { AppSettingsSchema, SiteConfigSchema } from "../domain/models/site-config.js";

/**
 * Configuration management for the CLI application
 */
export class AppConfiguration {
  
  /**
   * Get MotoHeaven site configuration
   */
  static getMotoHeavenConfig() {
    return SiteConfigSchema.parse({
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
        // Collection page selectors
        product_container: ".product-item",
        product_name: ".product-item__product-title",
        price: ".product-item__price-main",
        sale_price: ".product-item__price-main",
        stock_status: ".product-item__stock",
        brand: ".product-item__product-vendor",
        images: ".product-item__image img",
        
        // Product page selectors
        product_title: "h1",
        product_brand: 'a[href*="/collections/"]',
        product_sku: 'text',
        product_images: 'img[alt*="AGV"], .product-media img, img[src*="agv"], img[src*="helmet"]',
        product_description: '.product-description, [data-testid="description"], .description',
        product_specifications: '.product-specs, .specifications, .spec-table',
        product_variants: 'button',
        product_price: '.product-price, [class*="price"]',
        
        // Legacy selectors for compatibility
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
  }

  /**
   * Get MCAS site configuration
   */
  static getMCASConfig() {
    return SiteConfigSchema.parse({
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
  }

  /**
   * Get application settings
   */
  static getAppSettings() {
    return AppSettingsSchema.parse({
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
        log_level: "info",
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
  }

  /**
   * Get initial URLs for scraping
   */
  static getInitialUrls() {
    return [
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
  }
}