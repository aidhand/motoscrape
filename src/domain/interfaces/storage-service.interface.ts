import { Product } from "../models/product.js";

/**
 * Storage format options
 */
export type StorageFormat = "json" | "csv" | "sqlite";

/**
 * Storage result
 */
export interface StorageResult {
  success: boolean;
  format: StorageFormat;
  path: string;
  count: number;
  error?: string;
}

/**
 * Storage service interface
 */
export interface IStorageService {
  /**
   * Store products in the configured format
   */
  storeProducts(products: Product[]): Promise<StorageResult[]>;

  /**
   * Store individual product
   */
  storeProduct(product: Product): Promise<StorageResult>;

  /**
   * Load products from storage
   */
  loadProducts(format?: StorageFormat): Promise<Product[]>;

  /**
   * Check if storage is available
   */
  isAvailable(): boolean;

  /**
   * Get storage statistics
   */
  getStats(): Promise<{totalProducts: number; lastUpdated: Date; formats: StorageFormat[]}>;
}