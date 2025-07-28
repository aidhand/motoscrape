import { Product } from "../models/product.js";
import { JSONStorage } from "./json-storage.js";
import { SQLiteStorage } from "./sqlite-storage.js";
import { CSVExporter } from "./csv-exporter.js";

export type StorageFormat = "json" | "sqlite" | "csv" | "all";

export interface StorageOptions {
  format: StorageFormat;
  outputDirectory: string;
  filename?: string;
  appendTimestamp?: boolean;
}

export interface StorageResult {
  format: StorageFormat;
  path: string;
  count: number;
  success: boolean;
  error?: string;
}

/**
 * Manages different storage formats for scraped product data
 */
export class StorageManager {
  private jsonStorage: JSONStorage;
  private sqliteStorage: SQLiteStorage;
  private csvExporter: CSVExporter;

  constructor(private options: StorageOptions) {
    this.jsonStorage = new JSONStorage(options.outputDirectory);
    this.sqliteStorage = new SQLiteStorage(options.outputDirectory);
    this.csvExporter = new CSVExporter(options.outputDirectory);
  }

  /**
   * Store products in the specified format(s)
   */
  async storeProducts(products: Product[]): Promise<StorageResult[]> {
    if (!products || products.length === 0) {
      return [];
    }

    const results: StorageResult[] = [];
    const timestamp = this.options.appendTimestamp
      ? `_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-")}`
      : "";

    try {
      switch (this.options.format) {
        case "json":
          results.push(await this.storeAsJSON(products, timestamp));
          break;

        case "sqlite":
          results.push(await this.storeAsSQLite(products));
          break;

        case "csv":
          results.push(await this.storeAsCSV(products, timestamp));
          break;

        case "all":
          results.push(await this.storeAsJSON(products, timestamp));
          results.push(await this.storeAsSQLite(products));
          results.push(await this.storeAsCSV(products, timestamp));
          break;
      }
    } catch (error) {
      console.error("Error storing products:", error);
      results.push({
        format: this.options.format,
        path: "",
        count: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return results;
  }

  /**
   * Store products as JSON
   */
  private async storeAsJSON(
    products: Product[],
    timestamp: string
  ): Promise<StorageResult> {
    try {
      const filename = this.options.filename
        ? `${this.options.filename}${timestamp}.json`
        : `products${timestamp}.json`;

      const path = await this.jsonStorage.save(products, filename);

      return {
        format: "json",
        path,
        count: products.length,
        success: true,
      };
    } catch (error) {
      return {
        format: "json",
        path: "",
        count: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Store products in SQLite database
   */
  private async storeAsSQLite(products: Product[]): Promise<StorageResult> {
    try {
      const filename = this.options.filename
        ? `${this.options.filename}.db`
        : `products.db`;

      const path = await this.sqliteStorage.save(products, filename);

      return {
        format: "sqlite",
        path,
        count: products.length,
        success: true,
      };
    } catch (error) {
      return {
        format: "sqlite",
        path: "",
        count: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Store products as CSV
   */
  private async storeAsCSV(
    products: Product[],
    timestamp: string
  ): Promise<StorageResult> {
    try {
      const filename = this.options.filename
        ? `${this.options.filename}${timestamp}.csv`
        : `products${timestamp}.csv`;

      const path = await this.csvExporter.export(products, filename);

      return {
        format: "csv",
        path,
        count: products.length,
        success: true,
      };
    } catch (error) {
      return {
        format: "csv",
        path: "",
        count: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    json: { files: number; totalSize: number };
    sqlite: { files: number; totalSize: number };
    csv: { files: number; totalSize: number };
  }> {
    const [jsonStats, sqliteStats, csvStats] = await Promise.all([
      this.jsonStorage.getStats(),
      this.sqliteStorage.getStats(),
      this.csvExporter.getStats(),
    ]);

    return {
      json: jsonStats,
      sqlite: sqliteStats,
      csv: csvStats,
    };
  }

  /**
   * Clean up old storage files
   */
  async cleanup(maxAgeHours: number = 24 * 7): Promise<void> {
    await Promise.all([
      this.jsonStorage.cleanup(maxAgeHours),
      this.sqliteStorage.cleanup(maxAgeHours),
      this.csvExporter.cleanup(maxAgeHours),
    ]);
  }
}
