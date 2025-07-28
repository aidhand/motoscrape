import { promises as fs } from "fs";
import path from "path";
import { Product } from "../models/product.js";

export interface JSONStorageOptions {
  prettyPrint?: boolean;
  backup?: boolean;
}

/**
 * JSON file storage for product data
 */
export class JSONStorage {
  private readonly defaultOptions: JSONStorageOptions = {
    prettyPrint: true,
    backup: false,
  };

  constructor(
    private directory: string,
    private options: JSONStorageOptions = {}
  ) {
    this.options = { ...this.defaultOptions, ...options };
  }

  /**
   * Save products to JSON file
   */
  async save(products: Product[], filename: string): Promise<string> {
    await this.ensureDirectoryExists();

    const filePath = path.join(this.directory, filename);

    // Create backup if file exists and backup is enabled
    if (this.options.backup) {
      await this.createBackup(filePath);
    }

    const jsonData = this.options.prettyPrint
      ? JSON.stringify(products, null, 2)
      : JSON.stringify(products);

    await fs.writeFile(filePath, jsonData, "utf-8");

    console.log(`Saved ${products.length} products to ${filePath}`);
    return filePath;
  }

  /**
   * Load products from JSON file
   */
  async load(filename: string): Promise<Product[]> {
    const filePath = path.join(this.directory, filename);

    try {
      const data = await fs.readFile(filePath, "utf-8");
      const products = JSON.parse(data) as Product[];

      console.log(`Loaded ${products.length} products from ${filePath}`);
      return products;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        console.warn(`File not found: ${filePath}`);
        return [];
      }
      throw error;
    }
  }

  /**
   * Append products to existing JSON file
   */
  async append(products: Product[], filename: string): Promise<string> {
    const existingProducts = await this.load(filename);
    const allProducts = [...existingProducts, ...products];

    // Remove duplicates based on product ID
    const uniqueProducts = allProducts.filter(
      (product, index, self) =>
        self.findIndex((p) => p.id === product.id) === index
    );

    return await this.save(uniqueProducts, filename);
  }

  /**
   * List available JSON files
   */
  async listFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.directory);
      return files.filter((file) => file.endsWith(".json"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{ files: number; totalSize: number }> {
    try {
      const files = await this.listFiles();
      let totalSize = 0;

      for (const file of files) {
        try {
          const filePath = path.join(this.directory, file);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
        } catch {
          // Ignore errors for individual files
        }
      }

      return { files: files.length, totalSize };
    } catch {
      return { files: 0, totalSize: 0 };
    }
  }

  /**
   * Clean up old JSON files
   */
  async cleanup(maxAgeHours: number): Promise<void> {
    const files = await this.listFiles();
    const maxAge = maxAgeHours * 60 * 60 * 1000;
    const now = Date.now();

    for (const file of files) {
      try {
        const filePath = path.join(this.directory, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          console.log(`Cleaned up old JSON file: ${file}`);
        }
      } catch (error) {
        console.warn(`Error cleaning up file ${file}:`, error);
      }
    }
  }

  /**
   * Create backup of existing file
   */
  private async createBackup(filePath: string): Promise<void> {
    try {
      await fs.access(filePath);
      const backupPath = `${filePath}.backup`;
      await fs.copyFile(filePath, backupPath);
    } catch {
      // File doesn't exist, no backup needed
    }
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.access(this.directory);
    } catch {
      await fs.mkdir(this.directory, { recursive: true });
      console.log(`Created storage directory: ${this.directory}`);
    }
  }
}
