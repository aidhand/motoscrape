import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScraperOrchestrator } from '../../src/core/scraper-orchestrator.js';
import { AppSettingsSchema, SiteConfigSchema } from '../../src/models/site-config.js';

describe('Scraper Orchestrator', () => {
  let orchestrator: ScraperOrchestrator;
  
  const testConfig = SiteConfigSchema.parse({
    name: "test-site",
    base_url: "https://test.example.com",
    adapter_type: "generic",
    rate_limit: {
      requests_per_minute: 10,
      delay_between_requests: 1000,
      concurrent_requests: 1,
    },
    categories: ["test-category"],
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

  const testSettings = AppSettingsSchema.parse({
    global_settings: {
      headless: true,
      timeout: 5000,
      max_retries: 1,
      max_concurrent_requests: 1,
      delay_between_requests: 1000,
      max_requests_per_minute: 10,
      output_format: "json",
      output_directory: "./test-data",
      image_download: false,
      log_level: "warn", // Reduce noise in tests
    },
    browser_settings: {
      viewport: { width: 1280, height: 720 },
      locale: "en-AU",
      timezone: "Australia/Sydney",
    },
  });

  beforeEach(() => {
    orchestrator = new ScraperOrchestrator(testSettings, [testConfig]);
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.stop();
    }
  });

  it('should create orchestrator with valid configuration', () => {
    expect(orchestrator).toBeDefined();
    expect(orchestrator.getStats).toBeDefined();
    expect(orchestrator.getQueueStatus).toBeDefined();
    expect(orchestrator.addUrls).toBeDefined();
  });

  it('should initialize with empty stats', () => {
    const stats = orchestrator.getStats();
    expect(stats.totalProcessed).toBe(0);
    expect(stats.successful).toBe(0);
    expect(stats.failed).toBe(0);
    expect(stats.rateLimitHits).toBe(0);
  });

  it('should initialize with empty queue', () => {
    const queueStatus = orchestrator.getQueueStatus();
    expect(queueStatus.pending).toBe(0);
    expect(queueStatus.processing).toBe(0);
    expect(queueStatus.total).toBe(0);
  });

  it('should add URLs to queue', () => {
    const testUrls = [
      {
        url: "https://test.example.com/products",
        siteName: "test-site",
        priority: 10,
      },
      {
        url: "https://test.example.com/products/item1",
        siteName: "test-site",
        priority: 5,
      },
    ];

    orchestrator.addUrls(testUrls);
    
    const queueStatus = orchestrator.getQueueStatus();
    expect(queueStatus.pending).toBe(2);
    expect(queueStatus.total).toBe(2);
  });

  it('should emit events when URLs are added', async () => {
    const testUrls = [
      {
        url: "https://test.example.com/products",
        siteName: "test-site",
        priority: 10,
      },
    ];

    const eventPromise = new Promise<number>((resolve) => {
      orchestrator.on('urls-added', (count) => {
        resolve(count);
      });
    });

    orchestrator.addUrls(testUrls);
    
    const count = await eventPromise;
    expect(count).toBe(1);
  });

  it('should handle single URL addition', () => {
    orchestrator.addUrl({
      url: "https://test.example.com/single-product",
      siteName: "test-site",
      priority: 1,
    });

    const queueStatus = orchestrator.getQueueStatus();
    expect(queueStatus.pending).toBe(1);
  });

  it('should prioritize URLs correctly', () => {
    const testUrls = [
      {
        url: "https://test.example.com/low-priority",
        siteName: "test-site",
        priority: 1,
      },
      {
        url: "https://test.example.com/high-priority",
        siteName: "test-site",
        priority: 10,
      },
      {
        url: "https://test.example.com/medium-priority",
        siteName: "test-site",
        priority: 5,
      },
    ];

    orchestrator.addUrls(testUrls);
    
    const queueStatus = orchestrator.getQueueStatus();
    expect(queueStatus.pending).toBe(3);
    expect(queueStatus.total).toBe(3);
  });
});