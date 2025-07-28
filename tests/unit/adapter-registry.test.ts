import { describe, it, expect, beforeEach } from 'vitest';
import { AdapterRegistry } from '../../src/adapters/adapter-registry.js';
import { SiteConfigSchema } from '../../src/models/site-config.js';

describe('Adapter Registry', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  it('should create and register Shopify adapter from config', () => {
    const config = SiteConfigSchema.parse({
      name: "motoheaven",
      base_url: "https://www.motoheaven.com.au",
      adapter_type: "shopify",
      rate_limit: {
        requests_per_minute: 30,
        delay_between_requests: 5000,
        concurrent_requests: 6,
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
      },
    });

    registry.registerFromConfigs([config]);
    
    const adapter = registry.getAdapter("motoheaven");
    expect(adapter).toBeTruthy();
    expect(adapter?.getAdapterType()).toBe("shopify");
  });

  it('should create and register MCAS adapter from config', () => {
    const config = SiteConfigSchema.parse({
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

    registry.registerFromConfigs([config]);
    
    const adapter = registry.getAdapter("mcas");
    expect(adapter).toBeTruthy();
    expect(adapter?.getAdapterType()).toBe("mcas");
  });

  it('should return null for unregistered adapters', () => {
    const adapter = registry.getAdapter("nonexistent");
    expect(adapter).toBeNull();
  });

  it('should handle multiple site registrations', () => {
    const motoheavenConfig = SiteConfigSchema.parse({
      name: "motoheaven",
      base_url: "https://www.motoheaven.com.au",
      adapter_type: "shopify",
      rate_limit: {
        requests_per_minute: 30,
        delay_between_requests: 5000,
        concurrent_requests: 6,
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
      },
    });

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

    registry.registerFromConfigs([motoheavenConfig, mcasConfig]);
    
    expect(registry.getRegisteredSites()).toContain("motoheaven");
    expect(registry.getRegisteredSites()).toContain("mcas");
    expect(registry.getRegisteredSites()).toHaveLength(2);
  });

  it('should clear all registered adapters', () => {
    const config = SiteConfigSchema.parse({
      name: "test",
      base_url: "https://test.com",
      adapter_type: "generic",
      rate_limit: {
        requests_per_minute: 10,
        delay_between_requests: 1000,
        concurrent_requests: 1,
      },
      categories: ["test"],
      selectors: {
        product_container: ".product",
        product_name: ".name",
        price: ".price",
        stock_status: ".stock",
        images: ".image img",
      },
      navigation: {
        product_list_pattern: "/products",
        product_page_pattern: "/product/{id}",
      },
    });

    registry.registerFromConfigs([config]);
    expect(registry.getRegisteredSites()).toHaveLength(1);
    
    registry.clear();
    expect(registry.getRegisteredSites()).toHaveLength(0);
  });
});