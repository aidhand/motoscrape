import { Product } from "../models/product.js";
import { ScrapingResult } from "../../shared/types/scraping.types.js";

/**
 * Interface for core scraping business logic
 */
export interface IScrapingService {
  /**
   * Process a single URL and extract product data
   */
  processUrl(url: string, siteName: string, metadata?: Record<string, any>): Promise<ScrapingResult>;

  /**
   * Extract products from a collection/listing page
   */
  extractFromCollection(url: string, siteName: string): Promise<Product[]>;

  /**
   * Extract detailed product information from a product page
   */
  extractFromProduct(url: string, siteName: string): Promise<Product | null>;

  /**
   * Discover additional URLs from a page (pagination, related products, etc.)
   */
  discoverUrls(url: string, siteName: string): Promise<string[]>;
}