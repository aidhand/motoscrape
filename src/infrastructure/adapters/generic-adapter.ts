import { Page } from "playwright";
import {
  BaseAdapter,
  PageType,
  DiscoveryResult,
  ExtractionContext,
} from "./base-adapter.js";
import { Product } from "../../domain/models/product.js";
import { SiteConfig } from "../../domain/models/site-config.js";

/**
 * Generic fallback adapter for unknown e-commerce platforms
 * Uses common selectors and heuristics to extract product data
 */
export class GenericAdapter extends BaseAdapter {
  constructor(siteConfig: SiteConfig) {
    super(siteConfig);
  }

  /**
   * Generic adapter can handle any URL as a fallback
   */
  canHandle(_url: string): boolean {
    return true; // Fallback adapter handles any URL
  }

  /**
   * Identify page type using common patterns and heuristics
   */
  async identifyPageType(url: string, page: Page): Promise<PageType> {
    const normalizedUrl = this.normalizeUrl(url).toLowerCase();

    try {
      // Check URL patterns first
      if (
        normalizedUrl.includes("/product") ||
        normalizedUrl.includes("/item") ||
        normalizedUrl.includes("/p/")
      ) {
        return PageType.PRODUCT;
      }

      if (
        normalizedUrl.includes("/category") ||
        normalizedUrl.includes("/collection") ||
        normalizedUrl.includes("/shop") ||
        normalizedUrl.includes("/browse")
      ) {
        return PageType.COLLECTION;
      }

      if (normalizedUrl.includes("/search")) {
        return PageType.SEARCH;
      }

      // Check page content using common e-commerce patterns
      const productIndicators = [
        'script[type="application/ld+json"]', // Structured data
        ".product-details",
        ".product-info",
        ".product-main",
        ".single-product",
        ".product-page",
        "[itemtype*='Product']",
        ".add-to-cart",
        ".buy-now",
        ".product-price",
      ];

      for (const selector of productIndicators) {
        const element = await page.$(selector);
        if (element) {
          // Check if it contains product-related content
          const text = await element.textContent();
          if (text && this.containsProductKeywords(text)) {
            return PageType.PRODUCT;
          }
        }
      }

      // Check for collection/category page indicators
      const collectionIndicators = [
        ".product-list",
        ".product-grid",
        ".products",
        ".category-products",
        ".collection-products",
        ".product-items",
        "[class*='product'][class*='grid']",
        "[class*='product'][class*='list']",
      ];

      for (const selector of collectionIndicators) {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          return PageType.COLLECTION;
        }
      }

      return PageType.UNKNOWN;
    } catch (error) {
      console.warn(`Error identifying page type for ${url}:`, error);
      return PageType.UNKNOWN;
    }
  }

  /**
   * Discover product URLs using common e-commerce patterns
   */
  async discoverProducts(context: ExtractionContext): Promise<DiscoveryResult> {
    const { page, url } = context;
    const productUrls: string[] = [];
    let nextPageUrl: string | undefined;

    try {
      // Common product link selectors
      const productLinkSelectors = [
        "a[href*='/product']",
        "a[href*='/item']",
        "a[href*='/p/']",
        ".product-item a",
        ".product-card a",
        ".product a",
        "[class*='product'] a[href]",
        ".grid-item a",
        ".list-item a",
      ];

      const foundLinks: string[] = [];

      for (const selector of productLinkSelectors) {
        try {
          const links = await page.$$eval(selector, (elements) =>
            elements
              .map((el) => (el as HTMLAnchorElement).href)
              .filter((href) => href && href.length > 0)
          );
          foundLinks.push(...links);
        } catch {
          // Continue with next selector if this one fails
        }
      }

      // Filter and normalize URLs
      const uniqueLinks = [...new Set(foundLinks)];
      for (const link of uniqueLinks) {
        try {
          const normalizedUrl = this.normalizeUrl(link);
          if (this.isProductUrl(normalizedUrl)) {
            productUrls.push(normalizedUrl);
          }
        } catch {
          // Skip invalid URLs
        }
      }

      // Look for pagination
      const paginationSelectors = [
        "a[rel='next']",
        ".next-page",
        ".pagination-next",
        "a[href*='page=']",
        ".next",
        "[class*='next'][href]",
        "[class*='pagination'] a:last-child",
      ];

      for (const selector of paginationSelectors) {
        try {
          const nextLink = await page.$eval(
            selector,
            (el) => (el as HTMLAnchorElement).href
          );
          if (nextLink) {
            nextPageUrl = this.normalizeUrl(nextLink);
            break;
          }
        } catch {
          // Continue with next selector
        }
      }

      console.log(
        `📋 Generic Discovery: Found ${productUrls.length} products from ${url}`
      );

      return {
        productUrls,
        collectionUrls: [],
        totalProducts: productUrls.length,
        hasNextPage: !!nextPageUrl,
        nextPageUrl,
      };
    } catch (error) {
      console.error(`❌ Generic Discovery failed for ${url}:`, error);
      return {
        productUrls: [],
        collectionUrls: [],
        totalProducts: 0,
        hasNextPage: false,
      };
    }
  }

  /**
   * Extract product data using generic selectors and heuristics
   */
  async extractProduct(context: ExtractionContext): Promise<Product | null> {
    const { page, url } = context;

    try {
      // Wait for page to load
      await page.waitForLoadState("domcontentloaded");

      // Try to extract structured data first
      const structuredData = await this.extractStructuredData(page);
      if (structuredData) {
        console.log(
          `✅ Generic Extraction (structured data): ${structuredData.name}`
        );
        return structuredData;
      }

      // Fallback to heuristic extraction
      const product = await this.extractWithHeuristics(page, url);
      if (product) {
        console.log(`✅ Generic Extraction (heuristics): ${product.name}`);
        return product;
      }

      console.warn(`⚠️ Generic Extraction: No product data found for ${url}`);
      return null;
    } catch (error) {
      console.error(`❌ Generic Extraction failed for ${url}:`, error);
      return null;
    }
  }

  /**
   * Extract basic product summaries from collection pages
   */
  async extractProductSummary(
    context: ExtractionContext
  ): Promise<Partial<Product>[]> {
    const { page } = context;
    const products: Partial<Product>[] = [];

    try {
      const productContainerSelectors = [
        ".product-item",
        ".product-card",
        ".product",
        "[class*='product'][class*='item']",
        "[class*='product'][class*='card']",
        ".grid-item",
        ".list-item",
      ];

      let containers: any[] = [];
      for (const selector of productContainerSelectors) {
        containers = await page.$$(selector);
        if (containers.length > 0) {
          break;
        }
      }

      for (const container of containers.slice(0, 20)) {
        // Limit to 20 items
        try {
          const name = await this.extractProductName(page, container);
          const price = await this.extractProductPrice(page, container);
          const image = await this.extractProductImage(page, container);
          const brand = await this.extractProductBrand(page, container);

          if (name) {
            products.push({
              name,
              brand: brand || undefined,
              price: price
                ? {
                    regular: price.regular,
                    sale: price.sale,
                    currency: "AUD" as const,
                  }
                : { regular: 0, currency: "AUD" as const },
              images: image ? [image] : [],
            });
          }
        } catch {
          // Skip problematic items
        }
      }

      return products;
    } catch (error) {
      console.error("❌ Generic Product summary extraction failed:", error);
      return [];
    }
  }

  /**
   * Extract structured data (JSON-LD) if available
   */
  private async extractStructuredData(page: Page): Promise<Product | null> {
    try {
      const structuredData = await page.$$eval(
        'script[type="application/ld+json"]',
        (scripts) => {
          for (const script of scripts) {
            try {
              const data = JSON.parse(script.textContent || "");
              if (
                data["@type"] === "Product" ||
                (Array.isArray(data) &&
                  data.some((item) => item["@type"] === "Product"))
              ) {
                return data;
              }
            } catch {
              continue;
            }
          }
          return null;
        }
      );

      if (!structuredData) return null;

      const productData = Array.isArray(structuredData)
        ? structuredData.find((item) => item["@type"] === "Product")
        : structuredData;

      if (!productData || productData["@type"] !== "Product") return null;

      // Convert structured data to Product format
      const product: Product = {
        id: this.generateProductId(page.url()),
        name: productData.name || "Unknown Product",
        brand:
          productData.brand?.name ||
          productData.manufacturer?.name ||
          "Unknown Brand",
        sku: productData.sku || productData.mpn || undefined,
        category: productData.category || "unknown",
        subcategory: undefined,

        price: {
          regular:
            productData.offers?.price || productData.offers?.lowPrice
              ? parseFloat(
                  productData.offers.price || productData.offers.lowPrice
                )
              : 0,
          sale: productData.offers?.highPrice
            ? parseFloat(productData.offers.highPrice)
            : undefined,
          currency: "AUD" as const,
        },

        availability: {
          in_stock:
            productData.offers?.availability === "https://schema.org/InStock",
          stock_status: this.mapAvailabilityStatus(
            productData.offers?.availability
          ),
        },

        variants: [],
        images: Array.isArray(productData.image)
          ? productData.image
          : productData.image
            ? [productData.image]
            : [],

        description: {
          short: productData.description,
          full: productData.description,
          features:
            productData.additionalProperty?.map(
              (prop: any) => `${prop.name}: ${prop.value}`
            ) || [],
          specifications: {},
        },

        certifications: [],
        compatibility: {},

        metadata: {
          scraped_at: new Date(),
          source_url: page.url(),
          site: this.siteConfig.name,
        },
      };

      return product;
    } catch {
      return null;
    }
  }

  /**
   * Extract product data using heuristic selectors
   */
  private async extractWithHeuristics(
    page: Page,
    url: string
  ): Promise<Product | null> {
    try {
      const name = await this.extractProductName(page);
      if (!name) return null;

      const brand = await this.extractProductBrand(page);
      const price = await this.extractProductPrice(page);
      const images = await this.extractProductImages(page);
      const description = await this.extractProductDescription(page);

      const product: Product = {
        id: this.generateProductId(url),
        name,
        brand: brand || "Unknown Brand",
        sku: undefined,
        category: "unknown",
        subcategory: undefined,

        price: price
          ? {
              regular: price.regular,
              sale: price.sale,
              currency: "AUD" as const,
            }
          : { regular: 0, currency: "AUD" as const },

        availability: {
          in_stock: true,
          stock_status: "in_stock" as const,
        },

        variants: [],
        images: images,

        description: {
          short: description,
          full: description,
          features: [],
          specifications: {},
        },

        certifications: [],
        compatibility: {},

        metadata: {
          scraped_at: new Date(),
          source_url: url,
          site: this.siteConfig.name,
        },
      };

      return product;
    } catch {
      return null;
    }
  }

  /**
   * Extract product name using common selectors
   */
  private async extractProductName(
    page: Page,
    container?: any
  ): Promise<string | null> {
    const selectors = [
      "h1",
      ".product-title",
      ".product-name",
      "[class*='title']",
      "[class*='name']",
      ".entry-title",
      "[data-testid*='title']",
      "[data-testid*='name']",
    ];

    for (const selector of selectors) {
      const name = await this.safeExtractText(page, selector, container);
      if (name && name.length > 0) {
        return name;
      }
    }

    return null;
  }

  /**
   * Extract product brand using common selectors
   */
  private async extractProductBrand(
    page: Page,
    container?: any
  ): Promise<string | null> {
    const selectors = [
      ".brand",
      ".brand-name",
      ".manufacturer",
      "[class*='brand']",
      "[data-testid*='brand']",
      ".vendor",
    ];

    for (const selector of selectors) {
      const brand = await this.safeExtractText(page, selector, container);
      if (brand && brand.length > 0) {
        return brand;
      }
    }

    return null;
  }

  /**
   * Extract product price using common selectors and patterns
   */
  private async extractProductPrice(
    page: Page,
    container?: any
  ): Promise<{
    regular: number;
    sale?: number;
    currency: string;
  } | null> {
    const selectors = [
      ".price",
      ".product-price",
      "[class*='price']",
      "[data-testid*='price']",
      ".cost",
      ".amount",
    ];

    for (const selector of selectors) {
      const priceText = await this.safeExtractText(page, selector, container);
      if (priceText) {
        const priceData = this.parsePrice(priceText);
        if (priceData.regular > 0) {
          return priceData;
        }
      }
    }

    return null;
  }

  /**
   * Extract product image using common selectors
   */
  private async extractProductImage(
    page: Page,
    container?: any
  ): Promise<string | null> {
    const selectors = [
      "img",
      ".product-image img",
      ".image img",
      "[class*='image'] img",
    ];

    for (const selector of selectors) {
      const imageSrc = await this.safeExtractAttribute(
        page,
        selector,
        "src",
        container
      );
      if (imageSrc && imageSrc.startsWith("http")) {
        return imageSrc;
      }
    }

    return null;
  }

  /**
   * Extract product images for detailed product page
   */
  private async extractProductImages(page: Page): Promise<string[]> {
    const selectors = [
      ".product-images img",
      ".product-gallery img",
      ".images img",
      "[class*='image'] img",
      "[class*='gallery'] img",
    ];

    const images: string[] = [];

    for (const selector of selectors) {
      const imageSrcs = await this.safeExtractAttributes(page, selector, "src");
      for (const src of imageSrcs) {
        if (src && src.startsWith("http") && !images.includes(src)) {
          images.push(src);
        }
      }
      if (images.length > 0) break;
    }

    return images.slice(0, 10); // Limit to 10 images
  }

  /**
   * Extract product description using common selectors
   */
  private async extractProductDescription(
    page: Page
  ): Promise<string | undefined> {
    const selectors = [
      ".product-description",
      ".description",
      ".product-details",
      ".product-info",
      "[class*='description']",
      "[class*='details']",
    ];

    for (const selector of selectors) {
      const description = await this.safeExtractText(page, selector);
      if (description && description.length > 20) {
        return description;
      }
    }

    return undefined;
  }

  /**
   * Check if text contains product-related keywords
   */
  private containsProductKeywords(text: string): boolean {
    const keywords = [
      "add to cart",
      "buy now",
      "purchase",
      "price",
      "in stock",
      "out of stock",
      "product",
      "brand",
      "model",
      "sku",
    ];

    const lowerText = text.toLowerCase();
    return keywords.some((keyword) => lowerText.includes(keyword));
  }

  /**
   * Check if URL looks like a product URL
   */
  private isProductUrl(url: string): boolean {
    const productPatterns = [
      /\/product/i,
      /\/item/i,
      /\/p\//i,
      /\/products\//i,
      /\/shop\/.+\/.+/i, // Shop with category and product
    ];

    return productPatterns.some((pattern) => pattern.test(url));
  }

  /**
   * Map schema.org availability status to our enum
   */
  private mapAvailabilityStatus(
    availability: string
  ): "in_stock" | "out_of_stock" | "backorder" | "preorder" {
    if (!availability) return "in_stock";

    if (availability.includes("InStock")) return "in_stock";
    if (availability.includes("OutOfStock")) return "out_of_stock";
    if (availability.includes("PreOrder")) return "preorder";
    if (availability.includes("BackOrder")) return "backorder";

    return "in_stock";
  }
}
