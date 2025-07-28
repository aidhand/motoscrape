import { z } from "zod";
import { Product, ProductSchema } from "../models/product.js";
import { IValidationService, ValidationResult } from "../interfaces/validation-service.interface.js";

/**
 * Domain service for data validation and normalization
 */
export class ValidationService implements IValidationService {
  private validationStats = {
    totalValidated: 0,
    validProducts: 0,
    invalidProducts: 0,
    errors: [] as string[],
  };

  /**
   * Validate a single product
   */
  validateProduct(product: any): ValidationResult<Product> {
    this.validationStats.totalValidated++;

    try {
      // Validate using Zod schema
      const validatedProduct = ProductSchema.parse(product);

      // Apply additional normalization
      const normalizedProduct = this.normalizeProduct(validatedProduct);

      if (normalizedProduct) {
        this.validationStats.validProducts++;
        
        // Check quality standards
        const qualityCheck = this.checkProductQuality(normalizedProduct);
        
        return {
          success: true,
          data: normalizedProduct,
          warnings: qualityCheck.warnings,
        };
      } else {
        this.validationStats.invalidProducts++;
        return {
          success: false,
          errors: ['Product normalization failed'],
        };
      }
    } catch (error) {
      this.validationStats.invalidProducts++;

      if (error instanceof z.ZodError) {
        const errorMessage = this.formatZodError(error);
        this.validationStats.errors.push(errorMessage);
        return {
          success: false,
          errors: [errorMessage],
        };
      } else {
        const errorMessage = `Product validation failed: ${error}`;
        this.validationStats.errors.push(errorMessage);
        return {
          success: false,
          errors: [errorMessage],
        };
      }
    }
  }

  /**
   * Validate multiple products
   */
  validateProducts(products: any[]): ValidationResult<Product[]> {
    const validProducts: Product[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const [index, product] of products.entries()) {
      const result = this.validateProduct(product);
      
      if (result.success && result.data) {
        validProducts.push(result.data);
        if (result.warnings) {
          warnings.push(...result.warnings.map(w => `Product ${index}: ${w}`));
        }
      } else if (result.errors) {
        errors.push(...result.errors.map(e => `Product ${index}: ${e}`));
      }
    }

    return {
      success: validProducts.length > 0,
      data: validProducts,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Validate product data structure
   */
  validateProductStructure(data: any): boolean {
    try {
      ProductSchema.parse(data);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Normalize product data
   */
  normalizeProduct(product: any): Product | null {
    try {
      // Clean and normalize string fields
      const normalized = {
        ...product,
        name: this.cleanString(product.name),
        brand: this.cleanString(product.brand),
        category: this.cleanString(product.category),
        description: product.description ? this.cleanString(product.description) : undefined,
        price: this.normalizePrice(product.price),
        availability: this.normalizeAvailability(product.availability),
      };

      // Normalize variants if they exist
      if (normalized.variants && Array.isArray(normalized.variants)) {
        normalized.variants = normalized.variants.map((variant: any) => ({
          ...variant,
          name: this.cleanString(variant.name),
          price: variant.price ? this.normalizePrice(variant.price) : undefined,
          availability: this.normalizeAvailability(variant.availability),
        }));
      }

      return normalized;
    } catch (error) {
      console.warn(`Product normalization failed:`, error);
      return null;
    }
  }

  /**
   * Check if product meets quality standards
   */
  checkProductQuality(product: Product): ValidationResult<Product> {
    const warnings: string[] = [];

    // Check required fields quality
    if (!product.name || product.name.length < 3) {
      warnings.push('Product name is too short');
    }

    if (!product.description || product.description.length < 10) {
      warnings.push('Product description is too short');
    }

    if (!product.images || product.images.length === 0) {
      warnings.push('Product has no images');
    }

    if (!product.price || product.price <= 0) {
      warnings.push('Product price is invalid or missing');
    }

    // Check for placeholder or generic values
    if (this.isPlaceholderValue(product.name)) {
      warnings.push('Product name appears to be a placeholder');
    }

    if (this.isPlaceholderValue(product.brand)) {
      warnings.push('Product brand appears to be a placeholder');
    }

    return {
      success: true,
      data: product,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Get validation statistics
   */
  getStats() {
    return { ...this.validationStats };
  }

  /**
   * Reset validation statistics
   */
  resetStats(): void {
    this.validationStats = {
      totalValidated: 0,
      validProducts: 0,
      invalidProducts: 0,
      errors: [],
    };
  }

  private cleanString(value: string): string {
    if (!value || typeof value !== 'string') return '';
    return value.trim().replace(/\s+/g, ' ');
  }

  private normalizePrice(price: any): number {
    if (typeof price === 'number') return price;
    if (typeof price === 'string') {
      const cleanPrice = price.replace(/[^\d.]/g, '');
      const parsed = parseFloat(cleanPrice);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  private normalizeAvailability(availability: any): string {
    if (!availability) return 'unknown';
    
    const normalizedAvailability = String(availability).toLowerCase().trim();
    
    // Map common availability terms
    const availabilityMap: Record<string, string> = {
      'in stock': 'in_stock',
      'instock': 'in_stock',
      'available': 'in_stock',
      'out of stock': 'out_of_stock',
      'outofstock': 'out_of_stock',
      'unavailable': 'out_of_stock',
      'limited': 'limited_stock',
      'low stock': 'limited_stock',
      'preorder': 'pre_order',
      'pre-order': 'pre_order',
      'backorder': 'back_order',
      'back-order': 'back_order',
    };

    return availabilityMap[normalizedAvailability] || normalizedAvailability;
  }

  private isPlaceholderValue(value: string): boolean {
    if (!value) return true;
    
    const placeholders = [
      'placeholder',
      'example',
      'test',
      'todo',
      'n/a',
      'tbd',
      'unknown',
      'default',
    ];
    
    const lowerValue = value.toLowerCase();
    return placeholders.some(placeholder => lowerValue.includes(placeholder));
  }

  private formatZodError(error: z.ZodError): string {
    return error.errors
      .map(err => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
  }
}