import { describe, it, expect } from 'vitest';
import { SiteConfigSchema, AppSettingsSchema } from '../../src/models/site-config.js';

describe('Site Configuration', () => {
  it('should validate a complete MotoHeaven configuration', () => {
    const config = {
      name: "motoheaven",
      base_url: "https://www.motoheaven.com.au",
      adapter_type: "shopify" as const,
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
    };

    const result = SiteConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    
    if (result.success) {
      expect(result.data.name).toBe("motoheaven");
      expect(result.data.adapter_type).toBe("shopify");
      expect(result.data.categories).toContain("helmets");
    }
  });

  it('should validate MCAS configuration', () => {
    const config = {
      name: "mcas",
      base_url: "https://www.mcas.com.au",
      adapter_type: "mcas" as const,
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
    };

    const result = SiteConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('should reject invalid configurations', () => {
    const invalidConfig = {
      name: "test",
      base_url: "not-a-url",
      adapter_type: "invalid" as any,
      rate_limit: {
        requests_per_minute: 0, // Invalid: too low
        delay_between_requests: 100, // Invalid: too low
        concurrent_requests: 0, // Invalid: too low
      },
      categories: [],
      selectors: {
        // Missing required selectors
        product_container: ".product-item",
      },
      navigation: {
        product_list_pattern: "/products",
        product_page_pattern: "/product/{id}",
      },
    };

    const result = SiteConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });
});

describe('App Settings', () => {
  it('should validate complete app settings', () => {
    const settings = {
      global_settings: {
        headless: true,
        timeout: 30000,
        max_retries: 3,
        max_concurrent_requests: 3,
        delay_between_requests: 1000,
        max_requests_per_minute: 60,
        output_format: "json" as const,
        output_directory: "./data",
        image_download: false,
        log_level: "info" as const,
      },
      browser_settings: {
        viewport: { width: 1920, height: 1080 },
        user_agent: "Mozilla/5.0 Test Agent",
        locale: "en-AU",
        timezone: "Australia/Sydney",
      },
    };

    const result = AppSettingsSchema.safeParse(settings);
    expect(result.success).toBe(true);
    
    if (result.success) {
      expect(result.data.global_settings.output_format).toBe("json");
      expect(result.data.browser_settings.locale).toBe("en-AU");
    }
  });

  it('should apply default values', () => {
    const minimalSettings = {
      global_settings: {},
      browser_settings: {
        viewport: {}, // Need to provide viewport object even if empty
      },
    };

    const result = AppSettingsSchema.safeParse(minimalSettings);
    
    if (!result.success) {
      console.log('Validation errors:', result.error.format());
    }
    
    expect(result.success).toBe(true);
    
    if (result.success) {
      expect(result.data.global_settings.headless).toBe(true);
      expect(result.data.global_settings.output_format).toBe("json");
      expect(result.data.browser_settings.locale).toBe("en-AU");
      expect(result.data.browser_settings.timezone).toBe("Australia/Sydney");
      expect(result.data.browser_settings.viewport.width).toBe(1920);
      expect(result.data.browser_settings.viewport.height).toBe(1080);
    }
  });
});