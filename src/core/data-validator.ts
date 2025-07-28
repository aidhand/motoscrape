import { z } from "zod";
import { Product, ProductSchema } from "../models/product.js";
import { ProductVariant, ProductVariantSchema } from "../models/variant.js";

/**
 * Data validation and normalization utilities
 */
export class DataValidator {
  private static validationStats = {
    totalValidated: 0,
    validProducts: 0,
    invalidProducts: 0,
    errors: [] as string[],
  };

  /**
   * Validate and normalize a single product
   */
  static validateProduct(product: unknown): Product | null {
    this.validationStats.totalValidated++;

    try {
      // Validate using Zod schema
      const validatedProduct = ProductSchema.parse(product);

      // Apply additional normalization
      const normalizedProduct = this.normalizeProduct(validatedProduct);

      this.validationStats.validProducts++;
      return normalizedProduct;
    } catch (error) {
      this.validationStats.invalidProducts++;

      if (error instanceof z.ZodError) {
        const errorMessage = `Product validation failed: ${this.formatZodError(error)}`;
        this.validationStats.errors.push(errorMessage);
        console.warn(errorMessage);
      } else {
        const errorMessage = `Product validation failed: ${error}`;
        this.validationStats.errors.push(errorMessage);
        console.error(errorMessage);
      }

      return null;
    }
  }

  /**
   * Validate and normalize multiple products
   */
  static validateProducts(products: unknown[]): Product[] {
    const validProducts: Product[] = [];

    for (const product of products) {
      const validated = this.validateProduct(product);
      if (validated) {
        validProducts.push(validated);
      }
    }

    return validProducts;
  }

  /**
   * Validate and normalize a product variant
   */
  static validateVariant(variant: unknown): ProductVariant | null {
    try {
      const validatedVariant = ProductVariantSchema.parse(variant);
      return this.normalizeVariant(validatedVariant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.warn(
          `Variant validation failed: ${this.formatZodError(error)}`
        );
      } else {
        console.error(`Variant validation failed: ${error}`);
      }
      return null;
    }
  }

  /**
   * Apply normalization rules to a validated product
   */
  private static normalizeProduct(product: Product): Product {
    return {
      ...product,

      // Normalize name
      name: this.normalizeText(product.name),

      // Normalize brand
      brand: this.normalizeText(product.brand),

      // Normalize category
      category: this.normalizeCategory(product.category),
      subcategory: product.subcategory
        ? this.normalizeCategory(product.subcategory)
        : undefined,

      // Normalize prices
      price: {
        ...product.price,
        regular: this.roundPrice(product.price.regular),
        sale: product.price.sale
          ? this.roundPrice(product.price.sale)
          : undefined,
        discount_percentage: this.calculateDiscountPercentage(
          product.price.regular,
          product.price.sale
        ),
      },

      // Normalize images (remove duplicates, validate URLs)
      images: this.normalizeImages(product.images),

      // Normalize description
      description: {
        short: product.description.short
          ? this.normalizeText(product.description.short)
          : undefined,
        full: product.description.full
          ? this.normalizeText(product.description.full)
          : undefined,
        features:
          product.description.features?.map((f) => this.normalizeText(f)) || [],
        specifications: this.normalizeSpecifications(
          product.description.specifications
        ),
      },

      // Normalize certifications
      certifications: this.normalizeCertifications(product.certifications),

      // Validate and normalize variants
      variants:
        (product.variants
          ?.map((v) => this.validateVariant(v))
          .filter(Boolean) as ProductVariant[]) || [],
    };
  }

  /**
   * Apply normalization rules to a variant
   */
  private static normalizeVariant(variant: ProductVariant): ProductVariant {
    return {
      ...variant,
      name: this.normalizeText(variant.name),
      price: {
        ...variant.price,
        regular: this.roundPrice(variant.price.regular),
        sale: variant.price.sale
          ? this.roundPrice(variant.price.sale)
          : undefined,
      },
    };
  }

  /**
   * Normalize text content (trim, clean up whitespace)
   */
  private static normalizeText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, " ") // Replace multiple whitespace with single space
      .replace(/[\r\n\t]/g, " ") // Replace line breaks and tabs with spaces
      .trim();
  }

  /**
   * Normalize category names (lowercase, kebab-case)
   */
  private static normalizeCategory(category: string): string {
    return category
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens with single
      .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
  }

  /**
   * Round prices to 2 decimal places
   */
  private static roundPrice(price: number): number {
    return Math.round(price * 100) / 100;
  }

  /**
   * Calculate discount percentage
   */
  private static calculateDiscountPercentage(
    regular: number,
    sale?: number
  ): number | undefined {
    if (!sale || sale >= regular || regular <= 0) return undefined;
    return Math.round(((regular - sale) / regular) * 100);
  }

  /**
   * Normalize and deduplicate images
   */
  private static normalizeImages(images: string[]): string[] {
    const validImages: string[] = [];
    const seenUrls = new Set<string>();

    for (const image of images) {
      try {
        // Validate URL
        const url = new URL(image);
        const normalizedUrl = url.toString();

        // Check for duplicates
        if (!seenUrls.has(normalizedUrl)) {
          seenUrls.add(normalizedUrl);
          validImages.push(normalizedUrl);
        }
      } catch {
        // Skip invalid URLs
        console.warn(`Invalid image URL skipped: ${image}`);
      }
    }

    return validImages;
  }

  /**
   * Normalize specifications object
   */
  private static normalizeSpecifications(
    specs?: Record<string, string>
  ): Record<string, string> {
    if (!specs) return {};

    const normalized: Record<string, string> = {};

    for (const [key, value] of Object.entries(specs)) {
      const normalizedKey = this.normalizeText(key);
      const normalizedValue = this.normalizeText(value);

      if (normalizedKey && normalizedValue) {
        normalized[normalizedKey] = normalizedValue;
      }
    }

    return normalized;
  }

  /**
   * Normalize and deduplicate certifications
   */
  private static normalizeCertifications(certifications?: string[]): string[] {
    if (!certifications) return [];

    const normalized = certifications
      .map((cert) => cert.toUpperCase().trim())
      .filter((cert, index, arr) => cert && arr.indexOf(cert) === index); // Remove duplicates

    return normalized;
  }

  /**
   * Format Zod validation errors for logging
   */
  private static formatZodError(error: z.ZodError): string {
    return error.issues
      .map((err: any) => `${err.path.join(".")}: ${err.message}`)
      .join("; ");
  }

  /**
   * Get validation statistics
   */
  static getValidationStats() {
    return { ...this.validationStats };
  }

  /**
   * Reset validation statistics
   */
  static resetValidationStats() {
    this.validationStats = {
      totalValidated: 0,
      validProducts: 0,
      invalidProducts: 0,
      errors: [],
    };
  }

  /**
   * Create a safe partial product for preview/listing purposes
   */
  static createProductPreview(data: Partial<Product>): Partial<Product> {
    return {
      id: data.id,
      name: data.name ? this.normalizeText(data.name) : undefined,
      brand: data.brand ? this.normalizeText(data.brand) : undefined,
      category: data.category
        ? this.normalizeCategory(data.category)
        : undefined,
      price: data.price
        ? {
            regular: data.price.regular
              ? this.roundPrice(data.price.regular)
              : 0,
            sale: data.price.sale
              ? this.roundPrice(data.price.sale)
              : undefined,
            currency: "AUD" as const,
            discount_percentage:
              data.price.sale && data.price.regular
                ? this.calculateDiscountPercentage(
                    data.price.regular,
                    data.price.sale
                  )
                : undefined,
          }
        : undefined,
      images: data.images ? this.normalizeImages(data.images) : [],
      availability: data.availability,
    };
  }

  /**
   * Validate product data before scraping (configuration validation)
   */
  static validateScrapeConfiguration(config: {
    urls: string[];
    maxProducts?: number;
    categories?: string[];
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate URLs
    if (!config.urls || config.urls.length === 0) {
      errors.push("At least one URL must be provided");
    } else {
      for (const url of config.urls) {
        try {
          new URL(url);
        } catch {
          errors.push(`Invalid URL: ${url}`);
        }
      }
    }

    // Validate maxProducts
    if (
      config.maxProducts !== undefined &&
      (config.maxProducts < 1 || config.maxProducts > 10000)
    ) {
      errors.push("maxProducts must be between 1 and 10000");
    }

    // Validate categories
    if (config.categories) {
      for (const category of config.categories) {
        if (!category || category.trim().length === 0) {
          errors.push("Category names cannot be empty");
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Decorator for automatic product validation
 */
export function validateProducts<
  T extends (...args: any[]) => Promise<Product[]>,
>(target: any, propertyName: string, descriptor: TypedPropertyDescriptor<T>) {
  const method = descriptor.value!;

  descriptor.value = async function (this: any, ...args: any[]) {
    const result = await method.apply(this, args);
    return DataValidator.validateProducts(result);
  } as any as T;

  return descriptor;
}

/**
 * Decorator for automatic single product validation
 */
export function validateProduct<
  T extends (...args: any[]) => Promise<Product | null>,
>(target: any, propertyName: string, descriptor: TypedPropertyDescriptor<T>) {
  const method = descriptor.value!;

  descriptor.value = async function (this: any, ...args: any[]) {
    const result = await method.apply(this, args);
    return result ? DataValidator.validateProduct(result) : null;
  } as any as T;

  return descriptor;
}
