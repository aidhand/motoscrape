import { promises as fs } from "fs";
import path from "path";
import { Product } from "../models/product.js";
import { ProductVariant } from "../models/variant.js";

export interface CSVExportOptions {
  includeVariants?: boolean;
  includeImages?: boolean;
  delimiter?: string;
  includeHeaders?: boolean;
}

/**
 * CSV export functionality for product data
 */
export class CSVExporter {
  private readonly defaultOptions: CSVExportOptions = {
    includeVariants: false,
    includeImages: true,
    delimiter: ",",
    includeHeaders: true,
  };

  constructor(
    private directory: string,
    private options: CSVExportOptions = {}
  ) {
    this.options = { ...this.defaultOptions, ...options };
  }

  /**
   * Export products to CSV file
   */
  async export(products: Product[], filename: string): Promise<string> {
    await this.ensureDirectoryExists();

    const filePath = path.join(this.directory, filename);
    const csvData = this.convertToCSV(products);

    await fs.writeFile(filePath, csvData, "utf-8");

    console.log(`Exported ${products.length} products to ${filePath}`);
    return filePath;
  }

  /**
   * Convert products to CSV format
   */
  private convertToCSV(products: Product[]): string {
    const rows: string[] = [];

    // Add headers
    if (this.options.includeHeaders) {
      rows.push(this.getHeaders().join(this.options.delimiter || ","));
    }

    // Add product rows
    for (const product of products) {
      if (this.options.includeVariants && product.variants?.length) {
        // Create separate row for each variant
        for (const variant of product.variants) {
          rows.push(this.productToCSVRow(product, variant));
        }
      } else {
        // Single row for product
        rows.push(this.productToCSVRow(product));
      }
    }

    return rows.join("\n");
  }

  /**
   * Get CSV headers
   */
  private getHeaders(): string[] {
    const headers = [
      "id",
      "name",
      "brand",
      "sku",
      "category",
      "subcategory",
      "regular_price",
      "sale_price",
      "currency",
      "discount_percentage",
      "in_stock",
      "stock_status",
      "quantity",
      "short_description",
      "full_description",
      "specifications",
      "certifications",
      "compliance_adr",
      "compliance_standards",
      "vehicle_types",
      "makes",
      "models",
      "site",
      "source_url",
      "scraped_at",
      "quality_score",
    ];

    if (this.options.includeImages) {
      headers.push("images");
    }

    if (this.options.includeVariants) {
      headers.push(
        "variant_id",
        "variant_name",
        "variant_type",
        "variant_value",
        "variant_sku",
        "variant_regular_price",
        "variant_sale_price",
        "variant_in_stock",
        "variant_stock_status",
        "variant_images"
      );
    }

    return headers;
  }

  /**
   * Convert product to CSV row
   */
  private productToCSVRow(product: Product, variant?: ProductVariant): string {
    const values: string[] = [
      this.escapeCSV(product.id),
      this.escapeCSV(product.name),
      this.escapeCSV(product.brand),
      this.escapeCSV(product.sku || ""),
      this.escapeCSV(product.category),
      this.escapeCSV(product.subcategory || ""),
      product.price.regular.toString(),
      product.price.sale?.toString() || "",
      product.price.currency,
      product.price.discount_percentage?.toString() || "",
      product.availability.in_stock.toString(),
      product.availability.stock_status,
      product.availability.quantity?.toString() || "",
      this.escapeCSV(product.description.short || ""),
      this.escapeCSV(product.description.full || ""),
      this.escapeCSV(
        this.formatSpecifications(product.description.specifications)
      ),
      this.escapeCSV(product.certifications?.join("; ") || ""),
      product.compliance?.adr?.toString() || "",
      this.escapeCSV(
        product.compliance?.australian_standards?.join("; ") || ""
      ),
      this.escapeCSV(product.compatibility?.vehicle_types?.join("; ") || ""),
      this.escapeCSV(product.compatibility?.makes?.join("; ") || ""),
      this.escapeCSV(product.compatibility?.models?.join("; ") || ""),
      this.escapeCSV(product.metadata.site),
      this.escapeCSV(product.metadata.source_url),
      product.metadata.scraped_at.toISOString(),
      product.metadata.scrape_quality_score?.toString() || "",
    ];

    if (this.options.includeImages) {
      values.push(this.escapeCSV(product.images.join("; ")));
    }

    if (this.options.includeVariants) {
      if (variant) {
        values.push(
          this.escapeCSV(variant.id),
          this.escapeCSV(variant.name),
          variant.type,
          this.escapeCSV(variant.value),
          this.escapeCSV(variant.sku || ""),
          variant.price.regular.toString(),
          variant.price.sale?.toString() || "",
          variant.availability.in_stock.toString(),
          variant.availability.stock_status,
          this.escapeCSV(variant.images?.join("; ") || "")
        );
      } else {
        // Add empty variant columns
        values.push("", "", "", "", "", "", "", "", "", "");
      }
    }

    return values.join(this.options.delimiter || ",");
  }

  /**
   * Format specifications for CSV
   */
  private formatSpecifications(specs?: Record<string, string>): string {
    if (!specs) return "";

    return Object.entries(specs)
      .map(([key, value]) => `${key}: ${value}`)
      .join("; ");
  }

  /**
   * Escape CSV values
   */
  private escapeCSV(value: string): string {
    if (!value) return "";

    // If value contains delimiter, quotes, or newlines, wrap in quotes
    const delimiter = this.options.delimiter || ",";
    if (
      value.includes(delimiter) ||
      value.includes('"') ||
      value.includes("\n")
    ) {
      return `"${value.replace(/"/g, '""')}"`;
    }

    return value;
  }

  /**
   * List available CSV files
   */
  async listFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.directory);
      return files.filter((file) => file.endsWith(".csv"));
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
   * Clean up old CSV files
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
          console.log(`Cleaned up old CSV file: ${file}`);
        }
      } catch (error) {
        console.warn(`Error cleaning up file ${file}:`, error);
      }
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
