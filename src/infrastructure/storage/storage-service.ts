import { Product } from "../../domain/models/product.js";
import { IStorageService, StorageResult, StorageFormat } from "../../domain/interfaces/storage-service.interface.js";
import { StorageManager } from "../../storage/storage-manager.js";

/**
 * Infrastructure service for data storage
 */
export class StorageService implements IStorageService {
  private storageManager: StorageManager;

  constructor(config: {
    format: StorageFormat;
    outputDirectory: string;
    appendTimestamp?: boolean;
  }) {
    this.storageManager = new StorageManager(config);
  }

  /**
   * Store products in the configured format
   */
  async storeProducts(products: Product[]): Promise<StorageResult[]> {
    try {
      const results = await this.storageManager.storeProducts(products);
      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown storage error';
      return [{
        success: false,
        format: 'json' as StorageFormat,
        path: '',
        count: 0,
        error: errorMessage,
      }];
    }
  }

  /**
   * Store individual product
   */
  async storeProduct(product: Product): Promise<StorageResult> {
    const results = await this.storeProducts([product]);
    return results[0];
  }

  /**
   * Load products from storage
   */
  async loadProducts(format?: StorageFormat): Promise<Product[]> {
    try {
      // This would need to be implemented in the storage manager
      // For now, return empty array as placeholder
      return [];
    } catch (error) {
      console.error('Failed to load products:', error);
      return [];
    }
  }

  /**
   * Check if storage is available
   */
  isAvailable(): boolean {
    // Check if output directory is writable, etc.
    return true; // Simplified for now
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{totalProducts: number; lastUpdated: Date; formats: StorageFormat[]}> {
    // This would need to be implemented to check actual stored data
    return {
      totalProducts: 0,
      lastUpdated: new Date(),
      formats: ['json', 'csv', 'sqlite'],
    };
  }
}