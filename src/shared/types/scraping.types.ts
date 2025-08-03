import { Product } from "../../domain/models/product.js";

/**
 * Result of a scraping operation
 */
export interface ScrapingResult {
  success: boolean;
  data?: Product[];
  error?: string;
  url: string;
  siteName: string;
  timestamp: Date;
  processingTime: number;
}

/**
 * Scraping statistics
 */
export interface ScrapingStats {
  totalProcessed: number;
  successful: number;
  failed: number;
  averageProcessingTime: number;
  rateLimitHits: number;
  startTime: Date;
  uptime: number;
}

/**
 * Application events
 */
export interface ScrapingEvents {
  'url-processed': (result: ScrapingResult) => void;
  'urls-added': (count: number) => void;
  'url-added': (data: {url: string; siteName: string}) => void;
  'scraper-started': () => void;
  'scraper-stopped': () => void;
  'products-saved': (data: {count: number; results: any[]}) => void;
  'storage-error': (error: Error) => void;
  'rate-limit-hit': (siteName: string) => void;
}