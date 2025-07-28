import { Page } from "playwright";
import { Product } from "../models/product.js";
import { SiteConfig } from "../models/site-config.js";
import { URLManager } from "../utils/index.js";

/**
 * Page type enumeration for different adapter behaviors
 */
export enum PageType {
  COLLECTION = "collection",
  PRODUCT = "product",
  SEARCH = "search",
  CATEGORY = "category",
  UNKNOWN = "unknown",
}

/**
 * Discovery result containing found URLs and their types
 */
export interface DiscoveryResult {
  productUrls: string[];
  collectionUrls: string[];
  totalProducts: number;
  hasNextPage: boolean;
  nextPageUrl?: string;
}

/**
 * Extraction context for adapter methods
 */
export interface ExtractionContext {
  page: Page;
  url: string;
  siteConfig: SiteConfig;
  pageType: PageType;
  metadata?: Record<string, any>;
}

/**
 * Abstract base adapter class for all site-specific adapters.
 * 
 * This class provides common functionality and enforces a consistent interface
 * for all site adapters. Each concrete adapter must implement the abstract methods
 * to handle site-specific scraping logic.
 * 
 * @example
 * ```typescript
 * class MyAdapter extends BaseAdapter {
 *   async identifyPageType(url: string, page: Page): Promise<PageType> {
 *     // Implementation here
 *   }
 *   
 *   async extractProduct(context: ExtractionContext): Promise<Product | null> {
 *     // Implementation here
 *   }
 *   
 *   // ... other required methods
 * }
 * ```
 */
export abstract class BaseAdapter {
  protected siteConfig: SiteConfig;
  protected urlManager: URLManager;

  constructor(siteConfig: SiteConfig) {
    this.siteConfig = siteConfig;
    this.urlManager = new URLManager([siteConfig]);
  }

  /**
   * Determine the type of page from URL and content.
   * 
   * This method analyzes the URL structure and page content to identify
   * what type of page is being processed (product, collection, search, etc.).
   * This is crucial for determining the appropriate extraction strategy.
   * 
   * @param url - The URL being processed
   * @param page - Playwright page instance for content analysis
   * @returns Promise resolving to the identified page type
   */
  abstract identifyPageType(url: string, page: Page): Promise<PageType>;

  /**
   * Discover product URLs from collection/category pages.
   * 
   * This method processes collection or category pages to find individual
   * product URLs. It should also detect pagination and provide information
   * about next pages to process.
   * 
   * @param context - Extraction context containing page, URL, and configuration
   * @returns Promise resolving to discovery results with found URLs and pagination info
   */
  abstract discoverProducts(
    context: ExtractionContext
  ): Promise<DiscoveryResult>;

  /**
   * Extract detailed product information from individual product pages.
   * 
   * This is the main extraction method that processes individual product pages
   * and extracts comprehensive product information including variants, images,
   * specifications, and pricing.
   * 
   * @param context - Extraction context containing page, URL, and configuration
   * @returns Promise resolving to extracted product data or null if extraction fails
   */
  abstract extractProduct(context: ExtractionContext): Promise<Product | null>;

  /**
   * Extract basic product information from collection/listing pages.
   * 
   * This method extracts summary information about products from listing pages,
   * such as name, price, and thumbnail image. This is useful for quick overview
   * data before processing individual product pages.
   * 
   * @param context - Extraction context containing page, URL, and configuration
   * @returns Promise resolving to array of partial product data
   */
  abstract extractProductSummary(
    context: ExtractionContext
  ): Promise<Partial<Product>[]>;

  /**
   * Check if a URL matches this adapter's patterns.
   * 
   * This method determines whether this adapter can handle a given URL.
   * It should check URL patterns, domain matching, and any other criteria
   * specific to the target site.
   * 
   * @param url - The URL to check
   * @returns True if this adapter can handle the URL, false otherwise
   */
  abstract canHandle(url: string): boolean;

  /**
   * Get the site name this adapter handles
   */
  getSiteName(): string {
    return this.siteConfig.name;
  }

  /**
   * Get the adapter type
   */
  getAdapterType(): string {
    return this.siteConfig.adapter_type;
  }

  /**
   * Normalize URL to ensure consistency using URLManager
   */
  protected normalizeUrl(url: string): string {
    try {
      return this.urlManager.normalizeURL(url, this.siteConfig.name);
    } catch {
      // Fallback to basic URL construction
      try {
        const urlObj = new URL(url, this.siteConfig.base_url);
        return urlObj.toString();
      } catch {
        return url;
      }
    }
  }

  /**
   * Extract text content safely from element
   */
  protected async safeExtractText(
    page: Page,
    selector: string,
    element?: any
  ): Promise<string | null> {
    try {
      const target = element || page;
      const text = await target.$eval(selector, (el: any) =>
        el.textContent?.trim()
      );
      return text || null;
    } catch {
      return null;
    }
  }

  /**
   * Extract attribute safely from element
   */
  protected async safeExtractAttribute(
    page: Page,
    selector: string,
    attribute: string,
    element?: any
  ): Promise<string | null> {
    try {
      const target = element || page;
      const attr = await target.$eval(
        selector,
        (el: any, attr: string) => el.getAttribute(attr),
        attribute
      );
      return attr || null;
    } catch {
      return null;
    }
  }

  /**
   * Extract multiple text contents from elements
   */
  protected async safeExtractTexts(
    page: Page,
    selector: string,
    element?: any
  ): Promise<string[]> {
    try {
      const target = element || page;
      const texts = await target.$$eval(selector, (els: any[]) =>
        els.map((el) => el.textContent?.trim()).filter((text) => text)
      );
      return texts || [];
    } catch {
      return [];
    }
  }

  /**
   * Extract multiple attributes from elements
   */
  protected async safeExtractAttributes(
    page: Page,
    selector: string,
    attribute: string,
    element?: any
  ): Promise<string[]> {
    try {
      const target = element || page;
      const attrs = await target.$$eval(
        selector,
        (els: any[], attr: string) =>
          els.map((el) => el.getAttribute(attr)).filter((a) => a),
        attribute
      );
      return attrs || [];
    } catch {
      return [];
    }
  }

  /**
   * Parse price string to structured price data
   */
  protected parsePrice(priceStr: string): {
    regular: number;
    sale?: number;
    currency: string;
  } {
    if (!priceStr) {
      return { regular: 0, currency: "AUD" };
    }

    // Extract all price values from the string
    const priceMatches = priceStr.match(/\$[\d,]+\.?\d*/g);

    if (!priceMatches || priceMatches.length === 0) {
      return { regular: 0, currency: "AUD" };
    }

    // Convert price strings to numbers
    const prices = priceMatches.map((price) => {
      const cleaned = price.replace(/[$,]/g, "");
      return parseFloat(cleaned) || 0;
    });

    if (prices.length === 1) {
      return { regular: prices[0], currency: "AUD" };
    } else if (prices.length >= 2) {
      // Multiple prices - assume first is regular, second is sale
      return {
        regular: prices[0],
        sale: prices[1],
        currency: "AUD",
      };
    }

    return { regular: 0, currency: "AUD" };
  }

  /**
   * Generate a unique product ID
   */
  protected generateProductId(url: string, sku?: string): string {
    if (sku) {
      return `${this.siteConfig.name}-${sku}`;
    }

    // Extract slug from URL
    const slug = url.split("/").pop()?.split("?")[0] || "unknown";
    return `${this.siteConfig.name}-${slug}`;
  }

  /**
   * Wait for elements to load with timeout
   */
  protected async waitForSelector(
    page: Page,
    selector: string,
    timeout: number = 10000
  ): Promise<boolean> {
    try {
      await page.waitForSelector(selector, { timeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Scroll page to load dynamic content
   */
  protected async scrollToLoadContent(page: Page): Promise<void> {
    await page.evaluate(() => {
      return new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve(undefined);
          }
        }, 100);
      });
    });
  }
}
