import { Product } from "../models/product.js";

/**
 * Validation result
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
  warnings?: string[];
}

/**
 * Interface for data validation service
 */
export interface IValidationService {
  /**
   * Validate a single product
   */
  validateProduct(product: any): ValidationResult<Product>;

  /**
   * Validate multiple products
   */
  validateProducts(products: any[]): ValidationResult<Product[]>;

  /**
   * Validate product data structure
   */
  validateProductStructure(data: any): boolean;

  /**
   * Normalize product data
   */
  normalizeProduct(product: any): Product | null;

  /**
   * Check if product meets quality standards
   */
  checkProductQuality(product: Product): ValidationResult<Product>;
}