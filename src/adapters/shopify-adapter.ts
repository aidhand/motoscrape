import { Page } from "playwright";
import {
  BaseAdapter,
  PageType,
  DiscoveryResult,
  ExtractionContext,
} from "./base-adapter.js";
import { Product } from "../models/product.js";
import { ProductVariant } from "../models/variant.js";
import { SiteConfig } from "../models/site-config.js";
import { DataNormalizer } from "../utils/index.js";

/**
 * Shopify-specific adapter for sites like MotoHeaven
 */
export class ShopifyAdapter extends BaseAdapter {
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
   * Identify the type of Shopify page
   */
  async identifyPageType(url: string, page: Page): Promise<PageType> {
    const normalizedUrl = this.normalizeUrl(url);

    // Check URL patterns first (faster)
    if (normalizedUrl.includes("/products/")) {
      return PageType.PRODUCT;
    }

    if (normalizedUrl.includes("/collections/")) {
      return PageType.COLLECTION;
    }

    if (normalizedUrl.includes("/search")) {
      return PageType.SEARCH;
    }

    // Check page content for confirmation
    try {
      // Shopify product pages typically have these selectors
      const isProductPage =
        (await page.$(".product-form")) !== null ||
        (await page.$("[data-product-id]")) !== null ||
        (await page.$(".product-single")) !== null;

      if (isProductPage) {
        return PageType.PRODUCT;
      }

      // Collection pages have product grids
      const isCollectionPage =
        (await page.$(".collection")) !== null ||
        (await page.$(".product-grid")) !== null ||
        (await page.$$(".product-item").then((items) => items.length > 0));

      if (isCollectionPage) {
        return PageType.COLLECTION;
      }
    } catch (error) {
      console.warn("Error identifying page type:", error);
    }

    return PageType.UNKNOWN;
  }

  /**
   * Discover product URLs from Shopify collection pages
   */
  async discoverProducts(context: ExtractionContext): Promise<DiscoveryResult> {
    const { page, url } = context;
    const result: DiscoveryResult = {
      productUrls: [],
      collectionUrls: [],
      totalProducts: 0,
      hasNextPage: false,
    };

    try {
      // Strategy 1: Wait for products with the configured selector
      let productsFound = await this.waitForSelector(
        page,
        this.siteConfig.selectors.product_container
      );

      if (!productsFound) {
        // Strategy 2: Try common Shopify collection selectors
        const alternativeSelectors = [
          ".grid__item",
          ".collection-grid-item",
          ".product-grid-item",
          ".collection-product-card",
          ".product-block",
          ".js-product-item",
          "[data-product-handle]",
          ".product-list-item",
        ];

        for (const selector of alternativeSelectors) {
          productsFound = await this.waitForSelector(page, selector, 5000);
          if (productsFound) {
            console.log(
              `Found products with alternative selector: ${selector}`
            );
            this.siteConfig.selectors.product_container = selector;
            break;
          }
        }
      }

      if (!productsFound) {
        // Strategy 2 failed, trying to scroll and wait for dynamic content
        await this.scrollToLoadContent(page);
        await page.waitForTimeout(3000); // Wait for content to load

        // Try original selector again
        productsFound = await this.waitForSelector(
          page,
          this.siteConfig.selectors.product_container,
          5000
        );
      }

      if (!productsFound) {
        // Strategy 3: Look for any links that match product URL patterns
        const productLinks = await page.$$eval(
          'a[href*="/products/"]',
          (links) => links.map((link) => (link as HTMLAnchorElement).href)
        );

        if (productLinks.length > 0) {
          result.productUrls = [
            ...new Set(productLinks.map((url) => this.normalizeUrl(url))),
          ];
          result.totalProducts = result.productUrls.length;
          return result;
        }
      }

      if (!productsFound) {
        console.warn(`No products found on ${url} after trying all strategies`);
        return result;
      }

      // Get all product containers
      const productElements = await page.$$(
        this.siteConfig.selectors.product_container
      );
      result.totalProducts = productElements.length;

      // Extract product URLs
      for (const element of productElements) {
        try {
          // Try multiple common Shopify link selectors
          const linkSelectors = [
            'a[href*="/products/"]',
            ".product-item__image-link",
            ".product-item__title a",
            ".product-link",
            ".product-item a",
            "a", // Fallback to any link within the product container
          ];

          let productUrl = null;
          for (const selector of linkSelectors) {
            productUrl = await this.safeExtractAttribute(
              page,
              selector,
              "href",
              element
            );
            if (productUrl && productUrl.includes("/products/")) {
              break;
            }
            productUrl = null;
          }

          if (productUrl) {
            const normalizedUrl = this.normalizeUrl(productUrl);
            if (!result.productUrls.includes(normalizedUrl)) {
              result.productUrls.push(normalizedUrl);
            }
          }
        } catch (error) {
          console.warn("Error extracting product URL:", error);
        }
      }

      // Check for pagination
      const paginationSelectors = [
        ".pagination__next",
        ".pagination .next",
        '[rel="next"]',
        'a[aria-label="Next"]',
      ];

      for (const selector of paginationSelectors) {
        const nextPageUrl = await this.safeExtractAttribute(
          page,
          selector,
          "href"
        );
        if (nextPageUrl) {
          result.hasNextPage = true;
          result.nextPageUrl = this.normalizeUrl(nextPageUrl);
          break;
        }
      }

      // Look for other collection pages
      const collectionLinks = await this.safeExtractAttributes(
        page,
        'a[href*="/collections/"]',
        "href"
      );
      result.collectionUrls = collectionLinks
        .map((url) => this.normalizeUrl(url))
        .filter((url) => !url.includes(this.normalizeUrl(context.url))) // Exclude current page
        .filter((url, index, self) => self.indexOf(url) === index); // Remove duplicates
    } catch (error) {
      console.error("Error discovering products:", error);
    }

    return result;
  }

  /**
   * Extract detailed product information from Shopify product page
   */
  async extractProduct(context: ExtractionContext): Promise<Product | null> {
    const { page, url } = context;

    try {
      // Wait for product content to load
      const productLoaded = await this.waitForSelector(
        page,
        ".product-form, [data-product-id], .product-single"
      );
      if (!productLoaded) {
        console.warn(`Product content not found on ${url}`);
        return null;
      }

      // Extract basic product information
      const name = await this.safeExtractText(
        page,
        "h1, .product-title, [data-product-title]"
      );
      if (!name) {
        console.warn(`Product name not found on ${url}`);
        return null;
      }

      // Extract price information
      const priceText = await this.safeExtractText(
        page,
        ".price, .product-price, [data-price]"
      );
      const priceData = this.parsePrice(priceText || "");

      // Extract brand with comprehensive selectors and fallback logic
      let brand = await this.safeExtractText(
        page,
        [
          // Standard Shopify selectors
          ".product-vendor",
          ".brand",
          "[data-vendor]",
          // Site-specific selectors from configuration
          this.siteConfig.selectors.brand,
          // Additional common selectors
          ".product-brand",
          ".vendor",
          ".product-meta .brand",
          ".product-details .brand",
          "[data-product-vendor]",
          ".product-vendor-name",
        ]
          .filter(Boolean)
          .join(", ")
      );

      // If brand extraction failed, try to infer from product name
      if (!brand || brand === "Unknown") {
        brand = this.inferBrandFromName(name) || "Unknown";
      }

      // Extract SKU
      let sku = await this.safeExtractText(
        page,
        ".sku, [data-sku], .product-sku"
      );

      // MotoHeaven-specific SKU extraction from text content
      if (!sku) {
        const bodyText = (await page.textContent("body")) || "";
        const skuMatch = bodyText.match(/SKU:\s*([^\s\n]+)/);
        if (skuMatch) {
          sku = skuMatch[1];
        }
      }

      // Extract category from breadcrumbs or URL
      const category = await this.extractCategory(page, url);

      // Extract images
      const images = await this.extractImages(page);

      // Extract description - enhanced for MotoHeaven structure
      let description = await this.safeExtractText(
        page,
        ".product-description, .product-content, [data-product-description]"
      );

      // MotoHeaven-specific: try to get expanded description from collapsible sections
      if (!description) {
        // Look for expanded description sections (MotoHeaven uses collapsible descriptions)
        const expandedSections = await page.$$(
          '[aria-expanded="true"] + div, [aria-expanded="true"] ~ div'
        );
        for (const section of expandedSections) {
          const sectionText = await section.textContent();
          if (sectionText && sectionText.length > 100) {
            description = sectionText.trim();
            break;
          }
        }
      }

      // Fallback to any large text block that might be product description
      if (!description) {
        const textBlocks = await page.$$("p, div");
        for (const block of textBlocks) {
          const text = await block.textContent();
          if (
            text &&
            text.length > 100 &&
            text.toLowerCase().includes("helmet")
          ) {
            description = text.trim();
            break;
          }
        }
      }

      // Extract variants
      const variants = await this.extractVariants(page);

      // Extract specifications
      const specifications = await this.extractSpecifications(page);

      // Extract availability
      const availability = await this.extractAvailability(page);

      // Generate product ID
      const productId = this.generateProductId(url, sku || undefined);

      const product: Product = {
        id: productId,
        name,
        brand,
        sku: sku || undefined,
        category,
        price: {
          regular: priceData.regular,
          sale: priceData.sale,
          currency: "AUD",
          discount_percentage: priceData.sale
            ? Math.round((1 - priceData.sale / priceData.regular) * 100)
            : undefined,
        },
        availability,
        variants: variants.length > 0 ? variants : undefined,
        images,
        description: {
          full: description || undefined,
          specifications: specifications && Object.keys(specifications).length > 0 ? specifications : undefined,
        },
        metadata: {
          scraped_at: new Date(),
          source_url: url,
          site: this.siteConfig.name,
          scrape_quality_score: this.calculateQualityScore(
            name,
            priceData.regular,
            images.length,
            description || undefined
          ),
        },
      };

      return product;
    } catch (error) {
      console.error(`Error extracting product from ${url}:`, error);
      return null;
    }
  }

  /**
   * Extract product using DataNormalizer for consistent data structure
   */
  async extractProductWithNormalizer(context: ExtractionContext): Promise<Product | null> {
    const { page, url } = context;

    try {
      // Wait for product content to load
      const productLoaded = await this.waitForSelector(
        page,
        ".product-form, [data-product-id], .product-single"
      );
      if (!productLoaded) {
        console.warn(`Product content not found on ${url}`);
        return null;
      }

      // Extract raw product data
      const rawData: Record<string, any> = {
        // Basic product information
        name: await this.safeExtractText(page, "h1, .product-title, [data-product-title]"),
        title: await this.safeExtractText(page, "h1, .product-title"),
        
        // Brand information
        brand: await this.safeExtractText(page, ".product-vendor, .brand, [data-vendor], .vendor, .product-brand") ||
               await this.safeExtractText(page, this.siteConfig.selectors.brand || ""),
        
        // Price information
        price: await this.safeExtractText(page, ".price, .product-price, [data-price]"),
        regular_price: await this.safeExtractText(page, ".price-regular, .original-price"),
        sale_price: await this.safeExtractText(page, ".price-sale, .sale-price"),
        
        // Product details
        description: await this.safeExtractText(page, ".product-description, .rte, [data-description]"),
        category: await this.safeExtractText(page, ".breadcrumb a:last-child, .product-type"),
        
        // Product identifiers
        sku: await this.safeExtractText(page, ".sku, [data-sku], .product-sku"),
        product_id: await page.getAttribute("[data-product-id]", "data-product-id"),
        
        // Images
        images: await this.extractImageUrls(page),
        
        // Variants
        variants: await this.extractVariantsForNormalizer(page),
        
        // Availability
        in_stock: await this.checkAvailability(page),
        
        // Source metadata
        source_url: url,
        _source_url: url
      };

      // Use DataNormalizer to create consistent product structure
      const normalizedProduct = DataNormalizer.normalizeProduct(rawData, this.siteConfig.name);

      // Validate the product
      const validation = DataNormalizer.validateProduct(normalizedProduct);
      if (!validation.valid) {
        console.warn(`Product validation failed for ${url}:`, validation.errors);
        // Return the product anyway but log the validation issues
      }

      return normalizedProduct;

    } catch (error) {
      console.error(`Error extracting product from ${url}:`, error);
      return null;
    }
  }

  /**
   * Extract variants in a format suitable for DataNormalizer
   */
  private async extractVariantsForNormalizer(page: Page): Promise<any[]> {
    try {
      const variants = await page.evaluate(() => {
        // Try to get Shopify product JSON
        const productJson = document.querySelector('script[type="application/json"][data-product-json]');
        if (productJson && productJson.textContent) {
          const product = JSON.parse(productJson.textContent);
          return product.variants || [];
        }

        // Fallback to manual extraction
        const variantSelectors = [
          'select[name="id"] option',
          '.product-variants .variant-option',
          '.product-form select option'
        ];

        for (const selector of variantSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            return Array.from(elements).map((el, index) => ({
              id: el.getAttribute('value') || `variant-${index}`,
              title: el.textContent?.trim() || `Variant ${index + 1}`,
              available: !el.hasAttribute('disabled'),
              option1: el.textContent?.trim()
            }));
          }
        }

        return [];
      });

      return variants;
    } catch (error) {
      console.error('Error extracting variants:', error);
      return [];
    }
  }

  /**
   * Extract image URLs for DataNormalizer
   */
  private async extractImageUrls(page: Page): Promise<string[]> {
    try {
      const images = await page.evaluate(() => {
        const imageElements = document.querySelectorAll([
          '.product-images img',
          '.product-gallery img', 
          '.product-photos img',
          '.product-image img',
          '[data-product-image] img'
        ].join(', '));

        const urls: string[] = [];
        imageElements.forEach(img => {
          const src = img.getAttribute('src') || img.getAttribute('data-src');
          if (src && !urls.includes(src)) {
            // Convert relative URLs to absolute
            const absoluteUrl = src.startsWith('//') ? `https:${src}` : 
                              src.startsWith('/') ? `${window.location.origin}${src}` : src;
            urls.push(absoluteUrl);
          }
        });

        return urls;
      });

      return images;
    } catch (error) {
      console.error('Error extracting images:', error);
      return [];
    }
  }

  /**
   * Check product availability
   */
  private async checkAvailability(page: Page): Promise<boolean> {
    try {
      // Check for add to cart button
      const addToCartExists = await page.$('.btn-add-to-cart, [data-add-to-cart], .product-form button[type="submit"]');
      if (!addToCartExists) return false;

      // Check if button is disabled
      const isDisabled = await page.evaluate(() => {
        const button = document.querySelector('.btn-add-to-cart, [data-add-to-cart], .product-form button[type="submit"]');
        return button ? button.hasAttribute('disabled') : true;
      });

      // Check for out of stock text
      const outOfStockText = await page.textContent('.out-of-stock, .sold-out, [data-sold-out]');
      
      return !isDisabled && !outOfStockText;
    } catch (error) {
      console.error('Error checking availability:', error);
      return false;
    }
  }

  /**
   * Extract product variants
   */
  private async extractVariants(page: Page): Promise<ProductVariant[]> {
    const variants: ProductVariant[] = [];

    try {
      // Strategy 1: Look for Shopify variant selectors (dropdowns)
      const variantSelectors = await page.$$(
        ".product-form__input select, .variant-input select"
      );

      for (const select of variantSelectors) {
        const variantType = await this.determineVariantType(page, select);
        const options = await select.$$("option");

        for (const option of options) {
          const value = await option.getAttribute("value");
          const text = await option.textContent();

          if (
            value &&
            text &&
            value !== "" &&
            !text.toLowerCase().includes("select")
          ) {
            const variant = await this.createVariantFromOption(
              page,
              variantType,
              value,
              text
            );
            if (variant) variants.push(variant);
          }
        }
      }

      // Strategy 2: Look for variant buttons/swatches
      const variantButtons = await page.$$(
        ".variant-input input[type='radio'], .product-form__input input[type='radio']"
      );

      for (const button of variantButtons) {
        const variantType = await this.determineVariantTypeFromButton(
          page,
          button
        );
        const value = await button.getAttribute("value");
        const label = await this.getButtonLabel(page, button);

        if (value && label) {
          const variant = await this.createVariantFromOption(
            page,
            variantType,
            value,
            label
          );
          if (variant) variants.push(variant);
        }
      }

      // Strategy 3: Look for size charts or variant lists
      const sizeElements = await page.$$(
        ".size-chart li, .product-sizes .size-option"
      );

      for (const element of sizeElements) {
        const sizeText = await element.textContent();
        if (sizeText && sizeText.trim()) {
          const variant = await this.createVariantFromSize(
            page,
            sizeText.trim()
          );
          if (variant) variants.push(variant);
        }
      }

      // Strategy 4: MotoHeaven-specific size buttons
      const sizeButtons = await page.$$("button");
      for (const button of sizeButtons) {
        const buttonText = await button.textContent();
        const cleanText = buttonText?.trim();

        // Check if it's a size button
        if (
          cleanText &&
          ["XS", "S", "M", "L", "XL", "XXL"].includes(cleanText)
        ) {
          const variant: ProductVariant = {
            id: `size-${cleanText.toLowerCase()}-${Date.now()}`,
            name: `Size ${cleanText}`,
            type: "size",
            value: cleanText,
            price: {
              regular: 0, // No price adjustment for size variants typically
              currency: "AUD",
            },
            availability: {
              in_stock: true, // Assume available if button exists
              stock_status: "in_stock",
            },
          };
          variants.push(variant);
        }
      }
    } catch {
      // Silently handle errors in variant extraction
    }

    // Remove duplicates based on type and value
    const uniqueVariants = variants.filter(
      (variant, index, array) =>
        array.findIndex(
          (v) => v.type === variant.type && v.value === variant.value
        ) === index
    );

    return uniqueVariants;
  }

  /**
   * Determine variant type from select element
   */
  private async determineVariantType(
    page: Page,
    select: any
  ): Promise<ProductVariant["type"]> {
    try {
      const label = await page.evaluate((el) => {
        const label =
          el.closest(".product-form__input")?.querySelector("label")
            ?.textContent ||
          el.previousElementSibling?.textContent ||
          el.getAttribute("name") ||
          "";
        return label.toLowerCase();
      }, select);

      if (label.includes("size")) return "size";
      if (label.includes("color") || label.includes("colour")) return "color";
      if (label.includes("style")) return "style";
      if (label.includes("material")) return "material";
    } catch (error) {
      console.warn("Error determining variant type:", error);
    }

    return "style"; // Default fallback
  }

  /**
   * Determine variant type from radio button
   */
  private async determineVariantTypeFromButton(
    page: Page,
    button: any
  ): Promise<ProductVariant["type"]> {
    try {
      const name = (await button.getAttribute("name")) || "";
      const labelText = await this.getButtonLabel(page, button);

      const combined = (name + " " + labelText).toLowerCase();

      if (combined.includes("size")) return "size";
      if (combined.includes("color") || combined.includes("colour"))
        return "color";
      if (combined.includes("style")) return "style";
      if (combined.includes("material")) return "material";
    } catch (error) {
      console.warn("Error determining variant type from button:", error);
    }

    return "style";
  }

  /**
   * Get label text for radio button
   */
  private async getButtonLabel(page: Page, button: any): Promise<string> {
    try {
      return await page.evaluate((el) => {
        const label =
          document.querySelector(`label[for="${el.id}"]`)?.textContent ||
          el.nextElementSibling?.textContent ||
          el.closest("label")?.textContent ||
          el.getAttribute("data-value") ||
          "";
        return label.trim();
      }, button);
    } catch {
      return "";
    }
  }

  /**
   * Create variant from select option
   */
  private async createVariantFromOption(
    page: Page,
    type: ProductVariant["type"],
    value: string,
    displayText: string
  ): Promise<ProductVariant | null> {
    try {
      // Extract price if available in the option text
      const priceMatch = displayText.match(/\$?(\d+(?:\.\d{2})?)/);
      const basePrice = priceMatch ? parseFloat(priceMatch[1]) : 0;

      // Generate unique ID for variant
      const variantId = `${type}-${value}-${Date.now()}`;

      const variant: ProductVariant = {
        id: variantId,
        name: displayText.replace(/\s*\$[\d.]+\s*/, "").trim(), // Remove price from name
        type,
        value: displayText.trim(),
        price: {
          regular: basePrice || 0,
          currency: "AUD",
        },
        availability: {
          in_stock: true, // Default assumption
          stock_status: "in_stock",
        },
      };

      return variant;
    } catch (error) {
      console.warn("Error creating variant from option:", error);
      return null;
    }
  }

  /**
   * Create variant from size text
   */
  private async createVariantFromSize(
    page: Page,
    sizeText: string
  ): Promise<ProductVariant | null> {
    try {
      const variantId = `size-${sizeText.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}`;

      const variant: ProductVariant = {
        id: variantId,
        name: sizeText,
        type: "size" as const,
        value: sizeText,
        price: {
          regular: 0, // Size variants typically don't change price
          currency: "AUD",
        },
        availability: {
          in_stock: true,
          stock_status: "in_stock",
        },
      };

      return variant;
    } catch (error) {
      console.warn("Error creating size variant:", error);
      return null;
    }
  }

  /**
   * Extract category from breadcrumbs or URL
   */
  private async extractCategory(page: Page, url: string): Promise<string> {
    // Try breadcrumbs first
    const breadcrumbText = await this.safeExtractText(
      page,
      ".breadcrumb, .breadcrumbs, [data-breadcrumb]"
    );
    if (breadcrumbText) {
      const breadcrumbs = breadcrumbText
        .split(/[>/]/)
        .map((s) => s.trim())
        .filter((s) => s);
      if (breadcrumbs.length > 1) {
        return breadcrumbs[breadcrumbs.length - 2]; // Second to last is usually the category
      }
    }

    // Extract from URL
    const urlParts = url.split("/");
    const collectionsIndex = urlParts.indexOf("collections");
    if (collectionsIndex >= 0 && collectionsIndex < urlParts.length - 1) {
      return urlParts[collectionsIndex + 1].replace(/-/g, " ");
    }

    return "Unknown";
  }

  /**
   * Extract product images - enhanced for MotoHeaven structure
   */
  private async extractImages(page: Page): Promise<string[]> {
    const imageSelectors = [
      ".product-images img",
      ".product-gallery img",
      ".product-media img",
      "[data-product-image]",
      // MotoHeaven-specific selectors
      'img[alt*="AGV"]',
      'img[alt*="Shark"]',
      'img[alt*="Shoei"]',
      'img[alt*="Alpinestars"]',
      'img[src*="agv"]',
      'img[src*="helmet"]',
      // Generic product image selectors
      ".product-form img",
      ".product-single img",
    ];

    const allImages: string[] = [];

    for (const selector of imageSelectors) {
      const images = await this.safeExtractAttributes(page, selector, "src");
      allImages.push(...images);
    }

    // Filter out small icons, logos, and non-product images
    const productImages = allImages.filter((imgSrc) => {
      const url = imgSrc.toLowerCase();
      return (
        !url.includes("logo") &&
        !url.includes("icon") &&
        !url.includes("payment") &&
        !url.includes("social") &&
        !url.includes("trustpilot") &&
        (url.includes("agv") ||
          url.includes("helmet") ||
          url.includes("motorcycle") ||
          url.includes("product") ||
          url.includes("cdn.shop"))
      );
    });

    // Normalize and deduplicate
    return Array.from(
      new Set(productImages.map((img) => this.normalizeUrl(img)))
    );
  }

  private calculateQualityScore(
    name: string,
    price: number,
    imageCount: number,
    description?: string
  ): number {
    let score = 0;

    if (name && name.length > 5) score += 0.3;
    if (price > 0) score += 0.3;
    if (imageCount > 0) score += 0.2;
    if (description && description.length > 20) score += 0.2;

    return Math.min(1, score);
  }

  /**
   * Infer brand from product name using common motorcycle gear brands
   */
  /**
   * Extract basic product information from collection/listing pages
   */
  async extractProductSummary(
    context: ExtractionContext
  ): Promise<Partial<Product>[]> {
    const { page } = context;
    const products: Partial<Product>[] = [];

    try {
      // Wait for product listing to load
      await this.waitForSelector(
        page,
        this.siteConfig.selectors.product_container || ".product-item"
      );

      // Get all product containers
      const productElements = await page.$$(
        this.siteConfig.selectors.product_container || ".product-item"
      );

      for (let i = 0; i < productElements.length; i++) {
        const element = productElements[i];

        try {
          const name = await this.safeExtractText(
            page,
            this.siteConfig.selectors.product_name || ".product-name",
            element
          );

          const priceText = await this.safeExtractText(
            page,
            this.siteConfig.selectors.price || ".price",
            element
          );

          const brand = await this.safeExtractText(
            page,
            this.siteConfig.selectors.brand || ".brand",
            element
          );

          const imageUrl = await this.safeExtractAttribute(
            page,
            "img",
            "src",
            element
          );

          const productUrl = await this.safeExtractAttribute(
            page,
            "a",
            "href",
            element
          );

          if (name && priceText) {
            const priceData = this.parsePrice(priceText);
            const normalizedUrl = productUrl ? this.normalizeUrl(productUrl) : undefined;

            const product: Partial<Product> = {
              id: normalizedUrl ? this.generateProductId(normalizedUrl) : `summary-${i}`,
              name,
              brand: brand || this.inferBrandFromName(name) || "Unknown",
              price: {
                regular: priceData.regular,
                sale: priceData.sale,
                currency: "AUD" as const,
                discount_percentage: priceData.sale
                  ? Math.round((1 - priceData.sale / priceData.regular) * 100)
                  : undefined,
              },
              images: imageUrl ? [this.normalizeUrl(imageUrl)] : [],
              metadata: {
                scraped_at: new Date(),
                source_url: normalizedUrl || "",
                site: this.siteConfig.name,
              },
            };

            products.push(product);
          }
        } catch (error) {
          console.warn(`Error extracting product summary ${i}:`, error);
        }
      }
    } catch (error) {
      console.error("Error extracting product summaries:", error);
    }

    return products;
  }

  /**
   * Extract product specifications from product pages
   */
  private async extractSpecifications(page: Page): Promise<Record<string, any> | undefined> {
    const specifications: Record<string, any> = {};

    try {
      // Try different specification selector patterns
      const specSelectors = [
        this.siteConfig.selectors.specifications || ".product-specs",
        ".specifications",
        ".spec-table",
        ".product-specifications",
        "[data-specifications]",
        ".product-details table",
        ".product-info table"
      ];

      for (const selector of specSelectors) {
        try {
          const specElements = await page.$$(selector);
          if (specElements.length > 0) {
            // Extract table-based specifications
            const tableSpecs = await page.evaluate((sel) => {
              const specs: Record<string, any> = {};
              const tables = document.querySelectorAll(sel + ' table, ' + sel);
              
              tables.forEach(table => {
                const rows = table.querySelectorAll('tr');
                rows.forEach(row => {
                  const cells = row.querySelectorAll('td, th');
                  if (cells.length >= 2) {
                    const key = cells[0].textContent?.trim();
                    const value = cells[1].textContent?.trim();
                    if (key && value) {
                      specs[key] = value;
                    }
                  }
                });
              });
              
              return specs;
            }, selector);

            Object.assign(specifications, tableSpecs);
          }
        } catch {
          // Continue to next selector
        }
      }

      // Extract key-value pairs from description if no specs found
      if (Object.keys(specifications).length === 0) {
        const description = await this.safeExtractText(page, ".product-description, .description");
        if (description) {
          const lines = description.split('\n').filter(line => line.includes(':'));
          lines.forEach(line => {
            const [key, ...valueParts] = line.split(':');
            if (key && valueParts.length > 0) {
              specifications[key.trim()] = valueParts.join(':').trim();
            }
          });
        }
      }

      return Object.keys(specifications).length > 0 ? specifications : undefined;
    } catch (error) {
      console.error("Error extracting specifications:", error);
      return undefined;
    }
  }

  /**
   * Extract product availability information
   */
  private async extractAvailability(page: Page): Promise<{
    in_stock: boolean;
    stock_status: "in_stock" | "out_of_stock" | "backorder" | "preorder";
    quantity?: number;
  }> {
    try {
      // Check for availability indicators
      const stockSelectors = [
        this.siteConfig.selectors.stock_status || ".stock-status",
        ".availability",
        ".stock-info",
        "[data-stock]",
        ".product-availability"
      ];

      let stockText = "";
      for (const selector of stockSelectors) {
        const text = await this.safeExtractText(page, selector);
        if (text) {
          stockText = text.toLowerCase();
          break;
        }
      }

      // Check add to cart button state
      const addToCartButton = await page.$('.btn-add-to-cart, [data-add-to-cart], .product-form button[type="submit"]');
      const isButtonDisabled = addToCartButton ? await addToCartButton.isDisabled() : true;

      // Determine stock status
      let in_stock = true;
      let stock_status: "in_stock" | "out_of_stock" | "backorder" | "preorder" = "in_stock";

      if (isButtonDisabled || 
          stockText.includes("out of stock") || 
          stockText.includes("sold out") ||
          stockText.includes("unavailable")) {
        in_stock = false;
        stock_status = "out_of_stock";
      } else if (stockText.includes("backorder") || stockText.includes("back order")) {
        stock_status = "backorder";
      } else if (stockText.includes("pre-order") || stockText.includes("preorder")) {
        stock_status = "preorder";
      }

      // Try to extract quantity if available
      const quantityMatch = stockText.match(/(\d+)\s*(in stock|available|left)/);
      const quantity = quantityMatch ? parseInt(quantityMatch[1]) : undefined;

      return {
        in_stock,
        stock_status,
        quantity
      };
    } catch (error) {
      console.error("Error extracting availability:", error);
      return {
        in_stock: false,
        stock_status: "out_of_stock"
      };
    }
  }

  private inferBrandFromName(productName: string): string | null {
    if (!productName) return null;

    // Common motorcycle gear brands (Australian market focused)
    const brands = [
      "Dainese",
      "Alpinestars",
      "AGV",
      "Shoei",
      "Arai",
      "Bell",
      "Shark",
      "HJC",
      "Scorpion",
      "TCX",
      "Sidi",
      "Forma",
      "Gaerne",
      "Rev'it",
      "Revit",
      "Oxford",
      "Rukka",
      "Klim",
      "RST",
      "Held",
      "Spidi",
      "Five",
      "Knox",
      "Richa",
      "Bull-it",
      "Bullitt",
      "Icon",
      "Joe Rocket",
      "Alpinestars",
      "Thor",
      "Fox",
      "Oneal",
      "O'Neal",
      "Leatt",
      "Troy Lee",
      "Acerbis",
      "UFO",
      "Polisport",
      "Racetech",
      "Race Tech",
      "Pro Grip",
      "ProGrip",
      "Michelin",
      "Pirelli",
      "Bridgestone",
      "Dunlop",
      "Continental",
      "Metzeler",
      "Avon",
      "Shinko",
      "Kenda",
      "Maxxis",
      "IRC",
      "Heidenau",
    ];

    const nameUpper = productName.toUpperCase();

    for (const brand of brands) {
      const brandUpper = brand.toUpperCase();

      // Check if brand appears at the start of the product name
      if (
        nameUpper.startsWith(brandUpper + " ") ||
        nameUpper.startsWith(brandUpper + "-") ||
        nameUpper === brandUpper
      ) {
        return brand;
      }

      // Check if brand appears as a whole word in the product name
      const regex = new RegExp(`\\b${brandUpper}\\b`, "i");
      if (regex.test(nameUpper)) {
        return brand;
      }
    }

    return null;
  }
}
