import { defu } from 'defu';
import { klona } from 'klona';
import { hash } from 'ohash';
import { Product, ProductSchema } from '../models/product.js';
import { ProductVariant, ProductVariantSchema } from '../models/variant.js';

/**
 * Simple object manipulation utilities
 */
function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

function flatten(obj: Record<string, any>, delimiter = '.'): Record<string, any> {
  const result: Record<string, any> = {};
  
  function flattenRecursive(current: any, prop: string) {
    if (Object(current) !== current) {
      result[prop] = current;
    } else if (Array.isArray(current)) {
      const length = current.length;
      for (let i = 0; i < length; i++) {
        flattenRecursive(current[i], `${prop}[${i}]`);
      }
      if (length === 0) {
        result[prop] = [];
      }
    } else {
      let isEmpty = true;
      for (const p in current) {
        isEmpty = false;
        flattenRecursive(current[p], prop ? `${prop}${delimiter}${p}` : p);
      }
      if (isEmpty && prop) {
        result[prop] = {};
      }
    }
  }
  
  flattenRecursive(obj, '');
  return result;
}

/**
 * Data normalization utility using UnJS packages for consistent product structure
 */
export class DataNormalizer {
  /**
   * Normalize product data from different site formats
   */
  static normalizeProduct(rawData: Record<string, any>, siteType: string): Product {
    // Use pick to safely extract known fields
    const baseData = pick(rawData, [
      'name', 'title', 'product_title', 'product_name',
      'price', 'cost', 'amount', 'regular_price', 'sale_price',
      'description', 'desc', 'product_description', 'summary',
      'brand', 'manufacturer', 'vendor',
      'category', 'product_type', 'collection',
      'images', 'photos', 'image_urls',
      'variants', 'options',
      'sku', 'product_id', 'handle',
      'availability', 'in_stock', 'stock_status',
      'url', 'source_url', '_source_url'
    ]);

    // Create normalized product structure
    const normalizedProduct = {
      id: this.generateProductId(baseData, siteType),
      name: baseData.name || baseData.title || baseData.product_title || baseData.product_name || 'Unknown Product',
      brand: baseData.brand || baseData.manufacturer || baseData.vendor || 'Unknown',
      sku: baseData.sku || baseData.product_id || baseData.handle,
      category: baseData.category || baseData.product_type || baseData.collection || 'uncategorized',
      price: this.normalizePrice(baseData),
      availability: this.normalizeAvailability(baseData),
      variants: this.normalizeVariants(baseData.variants || []),
      images: this.normalizeImages(baseData),
      description: this.normalizeDescription(baseData),
      metadata: {
        scraped_at: new Date(),
        source_url: baseData.url || baseData.source_url || baseData._source_url || '',
        site: siteType,
        scrape_quality_score: this.calculateQualityScore(baseData)
      }
    };

    // Validate and return the product
    const validatedProduct = ProductSchema.parse(normalizedProduct);
    return klona(validatedProduct);
  }

  /**
   * Flatten nested product variants for easier processing
   */
  static flattenVariants(product: Product): Record<string, any> {
    const flattened = flatten(product);
    
    // Extract variant information
    const variantKeys = Object.keys(flattened).filter(key => 
      key.startsWith('variants.')
    );

    return {
      ...product,
      flattenedVariants: pick(flattened, variantKeys)
    };
  }

  /**
   * Merge data from multiple extraction attempts
   */
  static mergeExtractionResults(results: Partial<Product>[]): Partial<Product> {
    if (results.length === 0) return {};
    if (results.length === 1) return results[0];
    
    // Use defu to merge objects, with first non-empty value taking precedence
    return results.reduce((merged, current) => defu(merged, current), {});
  }

  /**
   * Normalize price data from various formats
   */
  private static normalizePrice(baseData: Record<string, any>): Product['price'] {
    let regular = 0;
    let sale: number | undefined;

    // Try to extract regular price
    if (baseData.price) {
      regular = this.extractNumericPrice(baseData.price);
    } else if (baseData.regular_price) {
      regular = this.extractNumericPrice(baseData.regular_price);
    } else if (baseData.cost) {
      regular = this.extractNumericPrice(baseData.cost);
    } else if (baseData.amount) {
      regular = this.extractNumericPrice(baseData.amount);
    }

    // Try to extract sale price
    if (baseData.sale_price) {
      sale = this.extractNumericPrice(baseData.sale_price);
    }

    return {
      regular,
      sale,
      currency: 'AUD' as const // Ensure literal type
    };
  }

  /**
   * Extract numeric price from various string formats
   */
  private static extractNumericPrice(priceStr: any): number {
    if (typeof priceStr === 'number') {
      return priceStr;
    }

    if (typeof priceStr === 'string') {
      // Remove currency symbols and extract number
      const cleanPrice = priceStr.replace(/[^0-9.,]/g, '');
      const numericPrice = parseFloat(cleanPrice.replace(',', ''));
      return isNaN(numericPrice) ? 0 : numericPrice;
    }

    return 0;
  }

  /**
   * Normalize image URLs and data
   */
  private static normalizeImages(baseData: Record<string, any>): string[] {
    const images = baseData.images || baseData.photos || baseData.image_urls || [];
    
    if (Array.isArray(images)) {
      return images.filter(img => typeof img === 'string' && img.trim() !== '');
    }

    if (typeof images === 'string') {
      return [images];
    }

    return [];
  }

  /**
   * Normalize description data
   */
  private static normalizeDescription(baseData: Record<string, any>): Product['description'] {
    const desc = baseData.description || baseData.desc || baseData.product_description || baseData.summary || '';
    
    return {
      short: desc.length > 150 ? desc.substring(0, 150) + '...' : desc,
      full: desc
    };
  }

  /**
   * Normalize product variants
   */
  private static normalizeVariants(variants: any[]): ProductVariant[] {
    if (!Array.isArray(variants)) {
      return [];
    }

    return variants.map((variant, index) => {
      const normalized = pick(variant, [
        'id', 'title', 'name',
        'price', 'sale_price',
        'sku', 'barcode',
        'inventory_quantity', 'available',
        'weight', 'size', 'color',
        'option1', 'option2', 'option3'
      ]);

      const variantData = {
        id: normalized.id || `variant-${index}`,
        name: normalized.title || normalized.name || `Variant ${index + 1}`,
        sku: normalized.sku || '',
        type: this.determineVariantType(normalized) as ProductVariant['type'],
        value: this.extractVariantValue(normalized),
        price: {
          regular: this.extractNumericPrice(normalized.price || normalized.sale_price || 0),
          currency: 'AUD' as const
        },
        availability: {
          in_stock: Boolean(normalized.available ?? (normalized.inventory_quantity || 0) > 0),
          quantity: normalized.inventory_quantity || 0,
          stock_status: this.determineStockStatus(normalized) as ProductVariant['availability']['stock_status']
        }
      };

      return ProductVariantSchema.parse(variantData);
    });
  }

  /**
   * Determine variant type from data
   */
  private static determineVariantType(variant: Record<string, any>): string {
    if (variant.color) return 'color';
    if (variant.size) return 'size';
    if (variant.material) return 'material';
    return 'style';
  }

  /**
   * Extract variant value
   */
  private static extractVariantValue(variant: Record<string, any>): string {
    return variant.color || variant.size || variant.material || 
           variant.option1 || variant.option2 || variant.option3 || 'Default';
  }

  /**
   * Determine stock status
   */
  private static determineStockStatus(variant: Record<string, any>): string {
    if (variant.available === false) return 'out_of_stock';
    if ((variant.inventory_quantity || 0) > 0) return 'in_stock';
    return 'out_of_stock';
  }

  /**
   * Normalize availability information
   */
  private static normalizeAvailability(baseData: Record<string, any>): Product['availability'] {
    let inStock = true;
    let quantity = 0;
    let stockStatus: Product['availability']['stock_status'] = 'in_stock';

    if (baseData.availability !== undefined) {
      inStock = Boolean(baseData.availability);
    } else if (baseData.in_stock !== undefined) {
      inStock = Boolean(baseData.in_stock);
    } else if (baseData.stock_status !== undefined) {
      inStock = baseData.stock_status === 'in_stock' || baseData.stock_status === 'available';
      stockStatus = this.mapStockStatus(baseData.stock_status);
    }

    if (baseData.inventory_quantity !== undefined) {
      quantity = Number(baseData.inventory_quantity) || 0;
      inStock = quantity > 0;
    }

    return {
      in_stock: inStock,
      quantity,
      stock_status: stockStatus
    };
  }

  /**
   * Map various stock status strings to our enum
   */
  private static mapStockStatus(status: string): Product['availability']['stock_status'] {
    const normalizedStatus = status.toLowerCase();
    
    if (normalizedStatus.includes('in_stock') || normalizedStatus.includes('available')) {
      return 'in_stock';
    }
    if (normalizedStatus.includes('backorder')) {
      return 'backorder';
    }
    if (normalizedStatus.includes('preorder')) {
      return 'preorder';
    }
    return 'out_of_stock';
  }

  /**
   * Generate unique product ID
   */
  private static generateProductId(baseData: Record<string, any>, siteType: string): string {
    const name = baseData.name || baseData.title || baseData.product_title;
    const sku = baseData.sku || baseData.product_id || baseData.handle;
    
    if (sku) {
      return `${siteType}-${sku}`;
    }

    if (name) {
      const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      return `${siteType}-${cleanName}`;
    }

    // Fallback to hash of data
    const hashData = pick(baseData, ['name', 'title', 'price', 'brand']);
    const dataHash = hash(hashData);
    return `${siteType}-${dataHash}`;
  }

  /**
   * Calculate data quality score
   */
  private static calculateQualityScore(baseData: Record<string, any>): number {
    let score = 0;
    const maxScore = 10;

    // Check for essential fields
    if (baseData.name || baseData.title) score += 2;
    if (baseData.price || baseData.regular_price) score += 2;
    if (baseData.brand) score += 1;
    if (baseData.description) score += 1;
    if (baseData.images && Array.isArray(baseData.images) && baseData.images.length > 0) score += 2;
    if (baseData.category) score += 1;
    if (baseData.sku) score += 1;

    return Math.min(score / maxScore, 1);
  }

  /**
   * Validate normalized product data
   */
  static validateProduct(product: Product): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      ProductSchema.parse(product);
    } catch (error: any) {
      if (error.errors) {
        errors.push(...error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`));
      } else {
        errors.push(error.message);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Clean and deduplicate product data
   */
  static cleanProductData(products: Product[]): Product[] {
    const seen = new Set<string>();
    const cleaned: Product[] = [];

    for (const product of products) {
      // Create hash of core product data for deduplication
      const coreData = pick(product, ['name', 'brand', 'price', 'sku']);
      const contentHash = hash(coreData);
      
      if (!seen.has(contentHash)) {
        seen.add(contentHash);
        cleaned.push(product);
      }
    }

    return cleaned;
  }
}
