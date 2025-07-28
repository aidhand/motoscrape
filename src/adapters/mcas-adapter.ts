import { Page } from "playwright";
import {
  BaseAdapter,
  PageType,
  DiscoveryResult,
  ExtractionContext,
} from "./base-adapter.js";
import { Product } from "../models/product.js";
import { SiteConfig } from "../models/site-config.js";

/**
 * MCAS-specific adapter for mcas.com.au custom e-commerce platform
 */
export class MCASAdapter extends BaseAdapter {
  constructor(siteConfig: SiteConfig) {
    super(siteConfig);
  }

  /**
   * Determine if this adapter can handle the given URL
   */
  canHandle(url: string): boolean {
    const normalizedUrl = this.normalizeUrl(url);
    return normalizedUrl.includes(this.siteConfig.base_url);
  }

  /**
   * Identify the type of MCAS page
   */
  async identifyPageType(url: string, page: Page): Promise<PageType> {
    const normalizedUrl = this.normalizeUrl(url);

    // Check URL patterns first (faster)
    if (normalizedUrl.includes("/product/")) {
      return PageType.PRODUCT;
    }

    if (normalizedUrl.includes("/category/")) {
      return PageType.COLLECTION;
    }

    if (normalizedUrl.includes("/search")) {
      return PageType.SEARCH;
    }

    // Check page content for confirmation
    try {
      // MCAS product pages typically have these selectors
      const isProductPage =
        (await page.$(".product-details")) !== null ||
        (await page.$(".product-info")) !== null ||
        (await page.$(".product-main")) !== null;

      if (isProductPage) {
        return PageType.PRODUCT;
      }

      // MCAS category pages
      const isCategoryPage =
        (await page.$(".product-grid")) !== null ||
        (await page.$(".category-products")) !== null ||
        (await page.$(".product-listing")) !== null;

      if (isCategoryPage) {
        return PageType.COLLECTION;
      }

      // Search results page
      const isSearchPage =
        (await page.$(".search-results")) !== null ||
        (await page.$(".search-grid")) !== null;

      if (isSearchPage) {
        return PageType.SEARCH;
      }

      return PageType.UNKNOWN;
    } catch (error) {
      console.warn(`Error identifying page type for ${url}:`, error);
      return PageType.UNKNOWN;
    }
  }

  /**
   * Discover product URLs from category/search pages
   */
  async discoverProducts(context: ExtractionContext): Promise<DiscoveryResult> {
    const { page, url } = context;
    const productUrls: string[] = [];
    let nextPageUrl: string | undefined;

    try {
      // Wait for product grid to load
      await page.waitForSelector(
        this.siteConfig.selectors?.product_container || ".product-grid-item",
        { timeout: 10000 }
      );

      // Extract product URLs
      const productLinks = await page.$$eval(
        `${this.siteConfig.selectors?.product_container || ".product-grid-item"} a`,
        (links) =>
          links
            .map((link) => (link as HTMLAnchorElement).href)
            .filter((href) => href && href.includes("/product/"))
      );

      // Normalize and validate URLs
      for (const link of productLinks) {
        const normalizedUrl = this.normalizeUrl(link);
        if (normalizedUrl && this.canHandle(normalizedUrl)) {
          productUrls.push(normalizedUrl);
        }
      }

      // Check for pagination
      const paginationSelector =
        this.siteConfig.navigation?.pagination_selector || ".pagination-next";
      const nextPageLink = await page
        .$eval(paginationSelector, (el) => (el as HTMLAnchorElement)?.href)
        .catch(() => null);

      if (nextPageLink) {
        const normalizedNextUrl = this.normalizeUrl(nextPageLink);
        if (normalizedNextUrl && this.canHandle(normalizedNextUrl)) {
          nextPageUrl = normalizedNextUrl;
        }
      }

      console.log(
        `📋 MCAS Discovery: Found ${productUrls.length} products from ${url}`
      );

      return {
        productUrls,
        collectionUrls: [],
        totalProducts: productUrls.length,
        hasNextPage: !!nextPageUrl,
        nextPageUrl,
      };
    } catch (error) {
      console.error(`❌ MCAS Discovery failed for ${url}:`, error);
      return {
        productUrls: [],
        collectionUrls: [],
        totalProducts: 0,
        hasNextPage: false,
      };
    }
  }

  /**
   * Extract product data from MCAS product pages
   */
  async extractProduct(context: ExtractionContext): Promise<Product | null> {
    const { page, url } = context;

    try {
      // Wait for product content to load
      await page.waitForSelector(
        this.siteConfig.selectors?.product_name || ".product-name",
        { timeout: 15000 }
      );

      // Extract basic product information
      const productName = await this.safeExtractText(
        page,
        this.siteConfig.selectors?.product_name || ".product-name"
      );

      const brand = await this.safeExtractText(
        page,
        this.siteConfig.selectors?.brand || ".brand-name"
      );

      // Extract pricing information using parsePrice
      const priceText = await this.safeExtractText(
        page,
        this.siteConfig.selectors?.price || ".current-price"
      );

      const salePriceText = await this.safeExtractText(
        page,
        this.siteConfig.selectors?.sale_price || ".sale-price"
      );

      const priceData = this.parsePrice(priceText || "");
      const salePriceData = salePriceText
        ? this.parsePrice(salePriceText)
        : null;

      // Extract stock status
      const stockStatus = await this.extractStockStatus(page);

      // Extract images
      const images = await this.safeExtractAttributes(
        page,
        this.siteConfig.selectors?.images || ".product-image img",
        "src"
      );

      // Extract description
      const description = await this.safeExtractText(
        page,
        this.siteConfig.selectors?.description || ".product-description"
      );

      // Extract specifications
      const specifications = await this.extractSpecifications(page);

      // Extract category from URL or breadcrumbs
      const category = await this.extractCategory(page, url);

      // Generate product ID from URL
      const productId = this.generateProductId(url);

      // Build product object
      const product: Product = {
        id: productId,
        name: productName || "Unknown Product",
        brand: brand || "Unknown Brand",
        sku: (await this.safeExtractText(page, ".product-sku")) || undefined,
        category: category || "unknown",
        subcategory: await this.extractSubcategory(page),

        price: {
          regular: priceData.regular,
          sale: salePriceData?.regular,
          currency: "AUD" as const,
          discount_percentage: this.calculateDiscountPercentage(
            priceData.regular,
            salePriceData?.regular
          ),
        },

        availability: {
          in_stock: stockStatus.in_stock,
          quantity: stockStatus.quantity,
          stock_status: stockStatus.status,
        },

        variants: [],
        images: images.filter(Boolean),

        description: {
          short:
            (await this.safeExtractText(page, ".product-summary")) || undefined,
          full: description || undefined,
          features: await this.extractFeatures(page),
          specifications: specifications,
        },

        certifications: await this.extractCertifications(page),
        compatibility: await this.extractCompatibility(page),

        metadata: {
          scraped_at: new Date(),
          source_url: url,
          site: this.siteConfig.name,
        },
      };

      console.log(`✅ MCAS Extraction: ${productName}`);
      return product;
    } catch (error) {
      console.error(`❌ MCAS Extraction failed for ${url}:`, error);
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
      const productContainers = await page.$$(
        this.siteConfig.selectors?.product_container || ".product-grid-item"
      );

      for (const container of productContainers) {
        const name = await this.safeExtractText(
          page,
          this.siteConfig.selectors?.product_name || ".product-name",
          container
        );

        const priceText = await this.safeExtractText(
          page,
          this.siteConfig.selectors?.price || ".current-price",
          container
        );

        const brand = await this.safeExtractText(
          page,
          this.siteConfig.selectors?.brand || ".brand-name",
          container
        );

        const imageUrl = await this.safeExtractAttribute(
          page,
          this.siteConfig.selectors?.images || ".product-image img",
          "src",
          container
        );

        if (name) {
          const priceData = this.parsePrice(priceText || "");

          products.push({
            name,
            brand: brand || undefined,
            price: {
              regular: priceData.regular,
              sale: priceData.sale,
              currency: "AUD" as const,
            },
            images: imageUrl ? [imageUrl] : [],
          });
        }
      }

      return products;
    } catch (error) {
      console.error("❌ MCAS Product summary extraction failed:", error);
      return [];
    }
  }

  /**
   * Extract stock status information
   */
  private async extractStockStatus(page: Page): Promise<{
    in_stock: boolean;
    quantity?: number;
    status: "in_stock" | "out_of_stock" | "backorder" | "preorder";
  }> {
    try {
      const stockText = await this.safeExtractText(
        page,
        this.siteConfig.selectors?.stock_status || ".stock-indicator"
      );

      if (!stockText) {
        return { in_stock: true, status: "in_stock" };
      }

      const lowerText = stockText.toLowerCase();

      if (
        lowerText.includes("out of stock") ||
        lowerText.includes("sold out")
      ) {
        return { in_stock: false, status: "out_of_stock" };
      }

      if (lowerText.includes("backorder")) {
        return { in_stock: false, status: "backorder" };
      }

      if (lowerText.includes("preorder") || lowerText.includes("pre-order")) {
        return { in_stock: false, status: "preorder" };
      }

      // Try to extract quantity
      const quantityMatch = stockText.match(/(\d+)\s*(in stock|available)/i);
      const quantity = quantityMatch
        ? parseInt(quantityMatch[1], 10)
        : undefined;

      return {
        in_stock: true,
        status: "in_stock",
        quantity,
      };
    } catch {
      return { in_stock: true, status: "in_stock" };
    }
  }

  /**
   * Extract specifications from product page
   */
  private async extractSpecifications(
    page: Page
  ): Promise<Record<string, string>> {
    try {
      const specs: Record<string, string> = {};

      // Try different specification selectors
      const specSelectors = [
        ".product-specifications",
        ".product-specs",
        ".specifications",
        ".spec-table",
      ];

      for (const selector of specSelectors) {
        const specElement = await page.$(selector);
        if (specElement) {
          // Try to extract key-value pairs
          const specPairs = await page
            .$$eval(`${selector} tr`, (rows) => {
              return rows
                .map((row) => {
                  const cells = row.querySelectorAll("td, th");
                  if (cells.length >= 2) {
                    const key = cells[0].textContent?.trim();
                    const value = cells[1].textContent?.trim();
                    return key && value
                      ? ([key, value] as [string, string])
                      : null;
                  }
                  return null;
                })
                .filter((pair): pair is [string, string] => pair !== null);
            })
            .catch(() => [] as [string, string][]);

          for (const [key, value] of specPairs) {
            specs[key] = value;
          }

          if (Object.keys(specs).length > 0) {
            break;
          }
        }
      }

      return specs;
    } catch {
      return {};
    }
  }

  /**
   * Extract category from URL path or breadcrumbs
   */
  private async extractCategory(page: Page, url: string): Promise<string> {
    // Try to extract from breadcrumbs first
    const breadcrumbCategory = await this.safeExtractText(
      page,
      ".breadcrumb-item:nth-last-child(2)"
    );
    if (breadcrumbCategory) {
      return breadcrumbCategory.toLowerCase().replace(/\s+/g, "-");
    }

    // Extract from URL path
    const urlMatch = url.match(/\/category\/([^/]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }

    return "unknown";
  }

  /**
   * Extract subcategory information
   */
  private async extractSubcategory(page: Page): Promise<string | undefined> {
    const subcategory = await this.safeExtractText(
      page,
      ".product-category, .product-subcategory"
    );
    return subcategory || undefined;
  }

  /**
   * Extract product features from the page
   */
  private async extractFeatures(page: Page): Promise<string[]> {
    try {
      const features = await page.$$eval(
        ".product-features li, .feature-list li, .features ul li",
        (items) => items.map((item) => item.textContent?.trim()).filter(Boolean)
      );
      return features as string[];
    } catch {
      return [];
    }
  }

  /**
   * Extract certifications (CE, DOT, ECE, etc.)
   */
  private async extractCertifications(page: Page): Promise<string[]> {
    try {
      const certText = await this.safeExtractText(
        page,
        ".certifications, .standards, .product-certifications"
      );

      if (!certText) return [];

      const certifications: string[] = [];
      const certPatterns = [
        /\b(CE)\b/gi,
        /\b(DOT)\b/gi,
        /\b(ECE)\b/gi,
        /\b(SNELL)\b/gi,
        /\b(ADR)\b/gi,
        /\b(AS\/NZS\s*\d+(?:\.\d+)?)\b/gi,
      ];

      for (const pattern of certPatterns) {
        const matches = certText.match(pattern);
        if (matches) {
          certifications.push(...matches.map((m) => m.toUpperCase()));
        }
      }

      return [...new Set(certifications)]; // Remove duplicates
    } catch {
      return [];
    }
  }

  /**
   * Extract compatibility information
   */
  private async extractCompatibility(page: Page): Promise<{
    vehicle_types?: string[];
    makes?: string[];
    models?: string[];
  }> {
    try {
      const compatibilityText = await this.safeExtractText(
        page,
        ".compatibility, .fits, .suitable-for"
      );

      if (!compatibilityText) return {};

      const compatibility: {
        vehicle_types?: string[];
        makes?: string[];
        models?: string[];
      } = {};

      // Extract vehicle types
      const vehicleTypes = compatibilityText.match(
        /\b(motorcycle|bike|scooter|atv|quad)\b/gi
      );
      if (vehicleTypes) {
        compatibility.vehicle_types = [
          ...new Set(vehicleTypes.map((v) => v.toLowerCase())),
        ];
      }

      // Extract common motorcycle makes
      const makes = compatibilityText.match(
        /\b(yamaha|honda|kawasaki|suzuki|ducati|bmw|harley|triumph|ktm)\b/gi
      );
      if (makes) {
        compatibility.makes = [...new Set(makes.map((m) => m.toLowerCase()))];
      }

      return compatibility;
    } catch {
      return {};
    }
  }

  /**
   * Calculate discount percentage
   */
  private calculateDiscountPercentage(
    regular: number,
    sale?: number
  ): number | undefined {
    if (!sale || sale >= regular) return undefined;
    return Math.round(((regular - sale) / regular) * 100);
  }
}
